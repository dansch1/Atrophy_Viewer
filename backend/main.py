import asyncio
import random
import threading
from typing import List, Dict, Callable

import os
import torch
from timm.data import IMAGENET_DEFAULT_MEAN, IMAGENET_DEFAULT_STD

from torchvision import transforms
from PIL import Image

import pydicom
from pydicom.filebase import DicomBytesIO

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ic_detr.ic_detr import build_ic_detr

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = "models"


class ModelData(BaseModel):
    name: str
    classes: List[str]


class LoadedModel:
    def __init__(self, model, device, transform, num_classes: int, meta: Dict):
        self.model = model
        self.device = device
        self.transform = transform
        self.num_classes = num_classes
        self.meta = meta


def build_eval_transform(img_size: int):
    return transforms.Compose([
        transforms.Resize((img_size, img_size), interpolation=transforms.InterpolationMode.BICUBIC),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_DEFAULT_MEAN, std=IMAGENET_DEFAULT_STD),
    ])


class ModelManager:
    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.models: Dict[str, LoadedModel] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self.load_tasks: Dict[str, asyncio.Task] = {}

    def _checkpoint_path(self, filename: str) -> str:
        path = os.path.join(self.models_dir, filename)

        if not os.path.isfile(path):
            raise FileNotFoundError(f"Checkpoint '{filename}' not found.")

        return path

    async def preload(self, filename: str):
        if filename in self.models:
            return

        if filename in self.load_tasks and not self.load_tasks[filename].done():
            return

        self.load_tasks[filename] = asyncio.create_task(self._load_model(filename))

    async def get_or_load(self, filename: str) -> LoadedModel:
        if filename in self.models:
            return self.models[filename]

        lock = self._locks.setdefault(filename, asyncio.Lock())

        async with lock:
            if filename in self.models:
                return self.models[filename]

            if filename in self.load_tasks:
                await self.load_tasks[filename]
            else:
                await self._load_model(filename)

            if filename not in self.models:
                raise RuntimeError("Model failed to load.")

            return self.models[filename]

    async def _load_model(self, filename: str):
        path = self._checkpoint_path(filename)
        ckpt = torch.load(path, map_location="cpu")

        for k in ("num_classes", "max_intervals", "input_size"):
            if k not in ckpt:
                raise RuntimeError(f"Checkpoint missing top-level '{k}'.")

        num_classes = int(ckpt["num_classes"])
        max_intervals = int(ckpt["max_intervals"])
        img_size = int(ckpt["input_size"])

        model_cfg = ckpt.get("model_config")
        if not isinstance(model_cfg, dict):
            raise RuntimeError("Checkpoint missing 'model_config' needed to rebuild model.")

        for k in ("patch_size", "embed_dim", "depth", "num_heads", "hidden_dim", "dec_layers", "dec_heads"):
            if k not in model_cfg:
                raise RuntimeError(f"'model_config' missing top-level '{k}'.")

        classes = ckpt.get("classes")
        if not isinstance(classes, list) or len(classes) < 1:
            raise RuntimeError("Checkpoint missing valid 'classes' list.")

        # build IC-DETR
        model, _ = build_ic_detr(
            num_classes=num_classes,
            alpha=None, class_weight=None,
            max_intervals=max_intervals,
            img_size=img_size,
            patch_size=int(model_cfg["patch_size"]),
            embed_dim=int(model_cfg["embed_dim"]),
            depth=int(model_cfg["depth"]),
            num_heads=int(model_cfg["num_heads"]),
            hidden_dim=int(model_cfg["hidden_dim"]),
            dec_layers=int(model_cfg["dec_layers"]),
            dec_heads=int(model_cfg["dec_heads"]),
            use_dn=bool(model_cfg.get("use_dn", False)),
            dn_groups=int(model_cfg.get("dn_groups", 1)),
            dn_noise_scale=float(model_cfg.get("dn_noise_scale", 0.0)),
            # not relevant for inference
            use_focal=bool(model_cfg.get("use_focal", False)),
            matcher_cls_cost=1.0, matcher_l1_cost=1.0, matcher_iou_cost=1.0,
            ce_weight=1.0, l1_weight=1.0, iou_weight=1.0,
            eos_coef=0.1, use_aux=True,
        )

        state = ckpt["model"] if isinstance(ckpt, dict) and "model" in ckpt else ckpt
        model.load_state_dict(state, strict=False)
        model.eval()

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)

        norm = ckpt.get("norm", {"mean": IMAGENET_DEFAULT_MEAN, "std": IMAGENET_DEFAULT_STD})
        transform = transforms.Compose([
            transforms.Resize((img_size, img_size), interpolation=transforms.InterpolationMode.BICUBIC),
            transforms.ToTensor(),
            transforms.Normalize(mean=norm.get("mean"), std=norm.get("std")),
        ])

        infer_meta = ckpt.get("inference", {})
        lm_meta = {
            "classes": classes,
            "img_size": img_size,
            "score_thresh": float(infer_meta.get("score_thresh", 0.05)),
            "class_score_thresh": infer_meta.get("class_score_thresh"),
            "nms_iou": infer_meta.get("nms_iou"),
            "nms_cover": infer_meta.get("nms_cover"),
            "topk": infer_meta.get("topk"),
            "decode": infer_meta.get("decode", {"method": "nms"}),
        }

        self.models[filename] = LoadedModel(
            model=model, device=device, transform=transform,
            num_classes=num_classes, meta=lm_meta
        )


model_manager = ModelManager(MODELS_DIR)


def _dicom_to_images(raw: bytes) -> (List[Image.Image], int):
    images: List[Image.Image] = []

    ds = pydicom.dcmread(DicomBytesIO(raw))
    cols = int(ds.Columns)

    frames = getattr(ds, "NumberOfFrames", None)

    for i in range(frames):
        arr = ds.pixel_array[i]
        image = Image.fromarray(arr, mode="L").convert("RGB")
        images.append(image)

    return images, cols


def nms_1d(boxes: torch.Tensor, scores: torch.Tensor, iou_thresh: float, cover_thresh: float | None):
    # boxes: [N,2] in [0,1]
    if boxes.numel() == 0:
        return torch.zeros(0, dtype=torch.long, device=boxes.device)

    x0 = torch.minimum(boxes[:, 0], boxes[:, 1])
    x1 = torch.maximum(boxes[:, 0], boxes[:, 1])
    order = torch.argsort(scores, descending=True)
    keep = []
    use_cov = (cover_thresh is not None) and (cover_thresh > 0.0)

    while order.numel() > 0:
        i = int(order[0])
        keep.append(i)
        if order.numel() == 1:
            break

        rest = order[1:]
        r0, r1 = x0[rest], x1[rest]
        b0, b1 = x0[i], x1[i]

        inter = (torch.minimum(b1, r1) - torch.maximum(b0, r0)).clamp(min=0.0)
        len_i = (b1 - b0).clamp(min=1e-6)
        len_r = (r1 - r0).clamp(min=1e-6)
        union = len_i + len_r - inter
        iou = inter / union

        if use_cov:
            cover_ir = inter / len_r  # i covers rest
            cover_ri = inter / len_i  # rest covers i
            mask = (iou <= iou_thresh) & ((cover_ir <= cover_thresh) | (cover_ri <= cover_thresh))
        else:
            mask = (iou <= iou_thresh)

        order = rest[mask]

    return torch.as_tensor(keep, dtype=torch.long, device=boxes.device)


def select_non_overlapping_intervals(boxes: torch.Tensor,
                                     scores: torch.Tensor,
                                     weight_by_length: bool = False,
                                     eps: float = 1e-6) -> torch.Tensor:
    device = boxes.device
    if boxes.numel() == 0:
        return torch.zeros(0, dtype=torch.long, device=device)

    x0 = torch.minimum(boxes[:, 0], boxes[:, 1])
    x1 = torch.maximum(boxes[:, 0], boxes[:, 1])
    length = (x1 - x0).clamp_min(0)

    w = scores
    if weight_by_length:
        w = w * length

    # sort by end coordinate
    order = torch.argsort(x1)
    x0_s, x1_s, w_s = x0[order], x1[order], w[order]

    # p[i]: rightmost interval ending before i starts
    ends = x1_s.cpu()
    starts = (x0_s - eps).cpu()
    p = torch.searchsorted(ends, starts).to(torch.long) - 1  # [-1..i-1]

    N = x0_s.numel()
    dp = torch.zeros(N + 1, dtype=torch.float32)
    choose = torch.zeros(N, dtype=torch.bool)
    for i in range(1, N + 1):
        take = w_s[i - 1].cpu() + (dp[p[i - 1] + 1] if p[i - 1] >= 0 else 0.0)
        skip = dp[i - 1]
        if take >= skip:
            dp[i] = take
            choose[i - 1] = True
        else:
            dp[i] = skip

    # backtrack
    idx = []
    i = N - 1
    while i >= 0:
        if choose[i]:
            idx.append(i)
            i = p[i].item()
        else:
            i -= 1

    idx = torch.tensor(list(reversed(idx)), dtype=torch.long)
    return order[idx].to(device)


@torch.no_grad()
def _infer_ic_detr(lm, images: List[Image.Image], cols_px: int, should_cancel: Callable[[], bool] = lambda: False):
    def _check():
        if should_cancel():
            raise asyncio.CancelledError()

    device = lm.device
    model = lm.model.eval()

    N = len(images)
    volume_annotations: List[List[List[float]]] = [None] * N

    K = lm.num_classes
    thr = float(lm.meta.get("score_thresh", 0.05))
    pcs = lm.meta.get("class_score_thresh")
    decode_cfg = lm.meta.get("decode", {"method": "nms"})
    method = decode_cfg.get("method", "nms")
    nms_iou = lm.meta.get("nms_iou")
    nms_cover = lm.meta.get("nms_cover")
    topk = lm.meta.get("topk")

    for i, img in enumerate(images):
        _check()

        x = lm.transform(img)  # [C,H,W]
        x = x.unsqueeze(0)  # [1,C,H,W]
        x = x.pin_memory().to(device, non_blocking=True) if device.type == "cuda" else x.to(device)

        _check()
        out = model(x)
        _check()

        probs = out["pred_logits"].softmax(-1)[0]  # [Q,K+1]
        boxes = out["pred_intervals"].clamp(0, 1)[0]  # [Q,2]
        class_probs = probs[:, :K]
        p_eos = probs[:, -1]
        scores, labels = class_probs.max(dim=-1)
        scores = scores * (1.0 - p_eos)

        if pcs is not None:
            pcs_t = torch.tensor(pcs, device=boxes.device, dtype=boxes.dtype)
            keep = scores >= pcs_t[labels]
        else:
            keep = scores >= thr

        scores_i = scores[keep]
        labels_i = labels[keep]
        boxes_i = boxes[keep]

        if scores_i.numel() > 0:
            if method == "wis":
                wis_weight = bool(decode_cfg.get("wis_weight_by_length", False))
                wis_global = bool(decode_cfg.get("wis_global", False))
                if wis_global or K == 1:
                    sel = select_non_overlapping_intervals(boxes_i, scores_i, weight_by_length=wis_weight)
                    scores_i, labels_i, boxes_i = scores_i[sel], labels_i[sel], boxes_i[sel]
                else:
                    keep_idx_all = []
                    for c in range(K):
                        m = (labels_i == c)
                        if m.any():
                            sel = select_non_overlapping_intervals(boxes_i[m], scores_i[m], weight_by_length=wis_weight)
                            keep_idx_all.append(torch.nonzero(m, as_tuple=False).squeeze(1)[sel])
                    if keep_idx_all:
                        keep_idx = torch.cat(keep_idx_all, dim=0)
                        scores_i, labels_i, boxes_i = scores_i[keep_idx], labels_i[keep_idx], boxes_i[keep_idx]
            elif method == "nms":
                if nms_iou is not None and isinstance(nms_iou, (int, float)) and nms_iou > 0:
                    keep_idx_all = []
                    for c in range(K):
                        m = (labels_i == c)
                        if m.any():
                            idx_local = nms_1d(boxes_i[m], scores_i[m], float(nms_iou), nms_cover)
                            keep_idx_all.append(torch.nonzero(m, as_tuple=False).squeeze(1)[idx_local])
                    if keep_idx_all:
                        keep_idx = torch.cat(keep_idx_all, dim=0)
                        scores_i, labels_i, boxes_i = scores_i[keep_idx], labels_i[keep_idx], boxes_i[keep_idx]
            else:
                raise RuntimeError(f"Unknown decode method: {method}")

        if isinstance(topk, int) and 0 < topk < scores_i.numel():
            order = torch.argsort(scores_i, descending=True)[:topk]
            scores_i = scores_i[order]
            labels_i = labels_i[order]
            boxes_i = boxes_i[order]

        x0 = (boxes_i[:, 0] * cols_px).tolist()
        x1 = (boxes_i[:, 1] * cols_px).tolist()
        cls = labels_i.tolist()
        volume_annotations[i] = [[float(a), float(b), int(c)] for a, b, c in zip(x0, x1, cls)]

        _check()

    return volume_annotations


@app.get("/models", response_model=List[ModelData])
def list_models():
    if not os.path.isdir(MODELS_DIR):
        raise HTTPException(status_code=500, detail=f"Models directory '{MODELS_DIR}' not found.")

    model_files = [f for f in os.listdir(MODELS_DIR) if f.endswith(".pth")]
    if not model_files:
        raise HTTPException(status_code=404, detail="No model files found.")

    models: List[ModelData] = []
    for filename in model_files:
        try:
            ckpt = torch.load(os.path.join(MODELS_DIR, filename), map_location="cpu")
            meta = ckpt.get("meta", {}) if isinstance(ckpt, dict) else {}
            classes = meta.get("classes") or ckpt.get("classes")

            if not isinstance(classes, list):
                raise ValueError("Missing or invalid 'classes' in checkpoint.")

            models.append(ModelData(name=filename, classes=classes))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error loading model '{filename}': {str(e)}")

    return models


@app.post("/models/preload")
async def preload_model(model: str):
    try:
        await model_manager.preload(model)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preload failed: {e}")

    return {"status": "preloading"}


@app.get("/models/status/{model}")
async def model_status(model: str):
    if model in model_manager.models:
        return {"status": "preloaded"}

    if model in model_manager.load_tasks:
        task = model_manager.load_tasks[model]
        return {"status": "failed" if task.done() and task.exception() else "preloading"}

    return {"status": "not_started"}


@app.post("/annotate")
async def annotate_dicom(
        request: Request,
        file: UploadFile = File(...),
        model: str = Form(...)
):
    if model.strip().lower() == "test.pth":
        return _make_dummy_intervals()

    try:
        lm = await model_manager.get_or_load(model)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Model '{model}' not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model: {e}")

    try:
        raw = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {e}")

    try:
        frames, cols = _dicom_to_images(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid DICOM: {e}")

    cancel_event = threading.Event()

    async def watch_disconnect():
        try:
            while True:
                if await request.is_disconnected():
                    cancel_event.set()
                    return

                await asyncio.sleep(0.2)
        except Exception:
            cancel_event.set()

    watcher = asyncio.create_task(watch_disconnect())

    try:
        return await asyncio.to_thread(
            _infer_ic_detr,
            lm,
            frames,
            cols,
            cancel_event.is_set
        )
    except asyncio.CancelledError:
        if torch.cuda.is_available():
            torch.cuda.synchronize()

        raise HTTPException(status_code=499, detail="Client Closed Request")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")
    finally:
        watcher.cancel()


def _make_dummy_intervals() -> List[List[List[int]]]:
    # TODO: only for testing
    volume_annotations = []

    for _ in range(25):
        slice_annotations = []

        for _ in range(random.randint(1, 2)):
            x0 = random.randint(0, 400)
            x1 = x0 + random.randint(10, 100)
            cls = random.randint(0, 3)

            slice_annotations.append([x0, min(x1, 511), cls])

        volume_annotations.append(slice_annotations)

    return volume_annotations
