from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import random

from pydantic import BaseModel
import torch
import os

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


@app.get("/models", response_model=List[ModelData])
def list_models():
    models = []

    if not os.path.isdir(MODELS_DIR):
        raise HTTPException(status_code=500, detail=f"Models directory '{MODELS_DIR}' not found.")

    model_files = [f for f in os.listdir(MODELS_DIR) if f.endswith(".pth")]

    if not model_files:
        raise HTTPException(status_code=404, detail="No model files found.")

    for filename in model_files:
        path = os.path.join(MODELS_DIR, filename)

        try:
            checkpoint = torch.load(path, map_location="cpu")
            classes = checkpoint.get("classes")

            if not isinstance(classes, list):
                raise ValueError("Missing or invalid 'classes' in checkpoint.")

            models.append(ModelData(
                name=filename,
                classes=classes
            ))
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error loading model '{filename}': {str(e)}"
            )

    return models


@app.post("/annotate", response_model=List[List[List[float]]])
async def annotate_dicom(file: UploadFile = File(...), model: str = Form(...)):
    # TODO

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
