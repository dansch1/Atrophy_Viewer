import asyncio
import os
import random
import threading
from typing import List, Dict

import pydicom
import torch
from PIL import Image
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ic_detr.infer import infer_intervals
from ic_detr.model import build_ic_detr
from pydantic import BaseModel
from pydicom.filebase import DicomBytesIO
from timm.data import IMAGENET_DEFAULT_MEAN, IMAGENET_DEFAULT_STD
from torchvision import transforms

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


@torch.no_grad()
def _infer_ic_detr(lm: LoadedModel, images: List[Image.Image], cols_px: int, should_cancel=lambda: False):
    device = lm.device
    model = lm.model.eval()
    tfm = lm.transform
    K = lm.num_classes

    meta = lm.meta
    decode_cfg = meta.get("decode", {"method": "wis"})
    method = decode_cfg.get("method", "wis")
    wis_weight = bool(decode_cfg.get("wis_weight_by_length", False))
    wis_global = bool(decode_cfg.get("wis_global", True))
    nms_iou = meta.get("nms_iou")
    nms_cover = meta.get("nms_cover")
    score_thr = float(meta.get("score_thresh", 0.05))
    class_thr = meta.get("class_score_thresh")
    topk = meta.get("topk")

    if class_thr is not None:
        class_thr = torch.tensor(class_thr, dtype=torch.float32)

    BATCH = 8
    volume: List[List[List[float]]] = []
    for s in range(0, len(images), BATCH):
        if should_cancel():
            raise asyncio.CancelledError()
        chunk = images[s:s + BATCH]
        x = torch.stack([tfm(im) for im in chunk], dim=0)  # [b,3,H,W]

        preds = infer_intervals(
            model, x, device, K,
            score_thresh=score_thr,
            class_score_thresh=class_thr,
            topk=topk,
            decode=method,
            nms_iou=nms_iou,
            nms_cover=nms_cover,
            wis_weight_by_length=wis_weight,
            merge_gap=0.0,
            merge_iou=0.6,
        )

        for p in preds:
            anns = [[float(d["x0"] * cols_px), float(d["x1"] * cols_px), int(d["label"])] for d in p]
            volume.append(anns)

    return volume


@app.get("/models", response_model=Dict[str, List[str]])
def get_models():
    if not os.path.isdir(MODELS_DIR):
        raise HTTPException(status_code=500, detail=f"Models directory '{MODELS_DIR}' not found.")

    model_files = [f for f in os.listdir(MODELS_DIR) if f.endswith(".pth")]
    if not model_files:
        raise HTTPException(status_code=404, detail="No model files found.")

    models: Dict[str, List[str]] = {}
    for filename in model_files:
        try:
            ckpt = torch.load(os.path.join(MODELS_DIR, filename), map_location="cpu")
            meta = ckpt.get("meta", {}) if isinstance(ckpt, dict) else {}
            classes = meta.get("classes") or ckpt.get("classes")

            if not isinstance(classes, list):
                raise ValueError("Missing or invalid 'classes' in checkpoint.")

            models[filename] = classes
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
        result = await asyncio.to_thread(
            _infer_ic_detr,
            lm,
            frames,
            cols,
            cancel_event.is_set
        )

        return result
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
