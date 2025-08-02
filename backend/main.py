from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze_dicom(file: UploadFile = File(...), model: str = Form(...)) -> List[List[List[float]]]:
    # TODO

    dummy_result = []

    for _ in range(25):
        scan_result = []

        for _ in range(random.randint(1, 2)):
            x0 = random.randint(0, 400)
            x1 = x0 + random.randint(10, 100)
            c = random.randint(0, 3)
            
            scan_result.append([x0, min(x1, 511), c])

        dummy_result.append(scan_result)

    return dummy_result
