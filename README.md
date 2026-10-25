Run commands:-
Backend:-python -m uvicorn backend.main:app --port 8000
Frontend:-npm run dev

# 🏍️ RoadVision AI: Helmet & Number Plate Detection Using YOLO11n

An AI-powered computer vision system and modern analytics dashboard that detects **helmets**, **no-helmet safety violations**, **number plates**, **pillion passengers**, and **riders** in motorcycle and road traffic images using a fine-tuned **YOLO11n** (You Only Look Once) deep learning model.

The system localizes objects with pixel-accurate bounding boxes, generates calibrated confidence scores, and visualizes detections through both a Python FastAPI backend and an interactive React web dashboard. Model training and inference experiments were accelerated using an **Intel Arc GPU** via PyTorch's native **Intel XPU** backend.

---

## 📌 Table of Contents

- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Objectives](#objectives)
- [Features](#features)
- [Detection Classes](#detection-classes)
- [Technology Stack](#technology-stack)
- [Model Architecture](#model-architecture)
- [Dataset Specifications](#dataset-specifications)
- [Dataset Preparation & Augmentation](#dataset-preparation--augmentation)
- [Model Training & Intel Arc GPU Acceleration](#model-training--intel-arc-gpu-acceleration)
- [Model Evaluation & Benchmark Results](#model-evaluation--benchmark-results)
- [Baseline vs Fine-Tuned Comparative Study](#baseline-vs-fine-tuned-comparative-study)
- [Web Application & Analytics Dashboard](#web-application--analytics-dashboard)
- [API Endpoints & Integration Contract](#api-endpoints--integration-contract)
- [Installation & Setup](#installation--setup)
- [Running Inference](#running-inference)
- [Understanding the Output](#understanding-the-output)
- [Hardware & Environment](#hardware--environment)
- [Limitations & Operational Scope](#limitations--operational-scope)
- [Future Improvements & Roadmap](#future-improvements--roadmap)
- [Applications](#applications)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## 📖 Project Overview

Motorcycle safety is a critical dimension of intelligent transportation systems (ITS) and urban road safety management. Unprotected motorcyclists face disproportionately high risks of severe injury and fatality in traffic accidents. Detecting riders, verifying helmet compliance, and localizing vehicle registration plates from traffic surveillance feeds can significantly assist automated traffic analytics and safety audits.

This project delivers:
1. **A lightweight deep learning object detector** based on Ultralytics **YOLO11n**, trained and benchmarked across 5,472 multi-class traffic images.
2. **Hardware acceleration experiments** using Intel Arc Graphics and PyTorch's XPU backend.
3. **An empirical evaluation and comparative study** between baseline and fine-tuned checkpoints across precision, recall, mAP@50, and mAP@50–95.
4. **A turnkey web application** comprising a Python FastAPI REST service and a high-performance React (Vite, TypeScript, Tailwind CSS) dashboard with interactive canvas overlays and session analytics.

> [!IMPORTANT]
> **Operational Scope Notice:** The current model detects visual object classes. It does not independently establish whether a traffic-law violation has occurred. Downstream legal enforcement requires spatial relation verification (associating riders with headwear) and human-in-the-loop oversight.

---

## 🏗️ System Architecture

```
+-------------------------------------------------------------+
|                 React 18 + Vite Frontend                    |
|   (TypeScript, Tailwind CSS, Recharts, Lucide React, HTML5) |
|                     Port: 5173 / Client                     |
+------------------------------+------------------------------+
                               |
                               | HTTP Multipart Form / JSON
                               v
+-------------------------------------------------------------+
|                   Python FastAPI Backend                    |
|        (Ultralytics YOLO, PyTorch / XPU, OpenCV, CORS)      |
|                     Port: 8000 / REST API                   |
+------------------------------+------------------------------+
                               |
                               | Loads Weights
                               v
+-------------------------------------------------------------+
|                       models/best.pt                        |
|       (YOLO11n • 2.58M Params • 6.4 GFLOPs • 640x640)       |
+-------------------------------------------------------------+
```

---

## 🎯 Objectives

- **Develop a specialized detector** for real-world motorcycle traffic scenarios.
- **Differentiate compliance:** Reliably detect both `helmet` (compliant) and `no_helmet` (violation) classes.
- **Distinguish vehicle occupants:** Identify the primary `rider` at handlebars and the secondary `pillion` passenger.
- **Localize registration plates:** Accurately locate `number_plate` regions for future downstream optical character recognition (OCR).
- **Rigorous benchmarking:** Measure precision, recall, mAP@50, and mAP@50–95 on held-out test data.
- **Empirical model comparison:** Compare original baseline vs. fine-tuned checkpoints to assess generalization.
- **Hardware acceleration:** Validate model execution on Intel Arc GPU hardware using PyTorch XPU.
- **Deploy full-stack product:** Integrate the trained detector into an interactive web interface with exportable analytics.

---

## ✨ Features

- **5-Class Object Detection:** Simultaneous localization and classification in a single forward pass.
- **Sub-50ms Latency:** Nano architecture tailored for edge appliances and real-time processing.
- **Pixel-Accurate Bounding Boxes:** Standard `[x1, y1, x2, y2]` coordinate system matching original image space.
- **Dual Visualizer:** Toggle seamlessly between the backend model's plotted output and an interactive client-side HTML5 canvas overlay.
- **Interactive Inspection:** Hovering over any table row illuminates the detected object on the image with an accent glow.
- **Dynamic Filtering:** Click any class badge to filter detections shown on the canvas and result table.
- **Session-Level Analytics:** Real-time calculation of total objects, helmet compliance rate ($Helmets / (Helmets + No\_Helmets)$), and per-class distributions via Recharts.
- **High-Resolution Export:** Download annotated results directly from the backend or rendered from the canvas.
- **Verified Health Checks:** Periodic polling of `/health` ensuring the UI truthfully displays backend and model readiness.
- **Explicit Offline Demo Mode:** Built-in simulated predictions engine for demonstration when the backend is offline.

---

## 🚦 Detection Classes

The model is trained on five target categories:

| Class ID | Canonical Name | Display Name | Palette Color | Description |
| :---: | :--- | :--- | :---: | :--- |
| `0` | `helmet` | Helmet | `#34D399` (Emerald) | Protective safety helmet securely worn by rider or pillion (Compliance marker) |
| `1` | `no_helmet` | No Helmet | `#F87171` (Coral Red) | Motorcyclist detected without protective headgear (Safety violation marker) |
| `2` | `number_plate` | Number Plate | `#8BE8FF` (Electric Cyan) | Vehicle license registration plate for vehicle identification |
| `3` | `pillion` | Pillion Rider | `#FBBF24` (Warm Amber) | Secondary passenger seated behind the primary operator |
| `4` | `rider` | Rider | `#A78BFA` (Soft Purple) | Primary motorcycle operator seated at the handlebars controlling the vehicle |

---

## 🛠️ Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Model & Framework** | Ultralytics YOLO11 | 8.4+ | Object detection training, evaluation, and inference pipeline |
| **Deep Learning** | PyTorch | 2.x | Neural network computation and tensor backend |
| **Hardware Backend** | Intel PyTorch XPU | Intel Arc | Hardware accelerator backend for Intel Arc GPU execution |
| **Computer Vision** | OpenCV (`cv2`) | 4.x | Image decoding, color transformations, and plot generation |
| **Backend API** | FastAPI + Uvicorn | 0.110+ | Asynchronous REST API serving `/health` and `/predict` |
| **Frontend Framework**| React + TypeScript | 18.3 / 5.5 | Type-safe, component-driven client architecture |
| **Build Tooling** | Vite | 5.4 | Ultra-fast HMR and production asset bundling |
| **Styling** | Tailwind CSS | 3.4 | Custom dark developer-tools theme (`#09090B`) |
| **Data Visualization**| Recharts | 2.12 | Session detection distribution and compliance metrics |
| **Icons & UI** | Lucide React | 0.441 | Vector icons for computer vision dashboard controls |

---

## 🧠 Model Architecture

### YOLO11n (Nano Variant)

YOLO11 is a single-stage convolutional object detector that predicts bounding boxes and class probabilities directly from full images in a single evaluation step.

```
Input Image (640x640x3)
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  BACKBONE: Multi-scale Feature Extraction              │
│  - Convolutional layers with modified C3k2 / C2PSA     │
│  - Extracts hierarchical spatial patterns              │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│  NECK: Path Aggregation Network (PANet / FPN)          │
│  - Bottom-up and top-down multi-scale feature fusion   │
│  - Enhances small object detection (e.g. number plates)│
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│  DETECTION HEAD: Decoupled Classification & Regression │
│  - Predicts 5 class probabilities + xyxy box offsets   │
│  - Non-Maximum Suppression (NMS) removes duplicates    │
└────────────────────────────────────────────────────────┘
```

### Architectural Parameters

| Property | Value | Notes |
| :--- | :--- | :--- |
| **Model Variant** | YOLO11n | Nano configuration |
| **Parameters** | ~2,580,000 (2.58M) | Highly compact for edge deployment |
| **Compute Complexity**| ~6.4 GFLOPs | At 640 × 640 input resolution |
| **Input Shape** | `3 × 640 × 640` | Letterbox padded |
| **Output Tensor** | `[x1, y1, x2, y2, conf, class_id]` | 5 target classes |
| **Anchor Mechanism** | Anchor-free | Center-based regression |

---

## 📂 Dataset Specifications

The model was trained and evaluated on a combined dataset curated from real-world traffic, highway surveillance, and road intersection imagery.

### Dataset Split Distribution

| Split | Number of Images | Percentage | Purpose |
| :--- | :---: | :---: | :--- |
| **Training Set** | 4,480 | 81.9% | Optimizes learnable model weights |
| **Validation Set** | 616 | 11.2% | Monitors training loss & guides checkpoint selection |
| **Test Set** | 376 | 6.9% | Unseen held-out benchmark (761 object instances) |
| **Total** | **5,472** | **100%** | Comprehensive motorcycle safety dataset |

### Annotation Schema

Annotations use standard YOLO format with normalized coordinates relative to image width and height:
```text
<class_id> <x_center> <y_center> <width> <height>
```
*All coordinates are normalized in the range $[0.0, 1.0]$.*

---

## 🔧 Dataset Preparation & Augmentation

1. **Collection & Filtering:** Aggregated road, motorcycle, rider, helmet, and vehicle registration images.
2. **Annotation Verification:** Corrected bounding boxes ensuring accurate coverage of small objects (e.g., number plates and helmet boundaries).
3. **Class Consistency Check:** Verified that class indices `0` through `4` remained identical across training, validation, and test splits.
4. **Data Preprocessing:**
   - Letterbox resizing to $640 \times 640$ preserving original aspect ratios.
   - Channel normalization ($[0, 255] \rightarrow [0.0, 1.0]$).
5. **Data Augmentation:**
   - Mosaic augmentation ($1.0$) with `close_mosaic=20` (disabling mosaic during the final 20 epochs for fine localization stabilization).
   - Random horizontal flips ($p=0.5$).
   - HSV color-space jittering for lighting robustness.

---

## 🏋️ Model Training & Intel Arc GPU Acceleration

### Fine-Tuning Setup

| Parameter | Configuration | Details |
| :--- | :--- | :--- |
| **Base Weights** | `yolo11n.pt` | Pretrained on COCO |
| **Input Resolution** | $640 \times 640$ | Letterbox padded |
| **Batch Size** | 4 | Tuned for GPU memory footprint |
| **Optimizer** | `AdamW` | Adaptive moment estimation with decoupled weight decay |
| **Execution Device** | `xpu:0` | Intel Arc GPU via PyTorch Intel XPU backend |
| **DataLoader Workers**| 0 | Optimized for Windows IPC |
| **Mosaic Strategy** | `close_mosaic=20` | Stabilizes bounding box regression |
| **Training Run** | ~15 Recorded Epochs | Evaluated checkpoint extracted at peak validation |

### Intel Arc GPU & PyTorch XPU Integration

Experiments utilized Intel Arc graphics hardware through PyTorch's native `xpu` device target:
```python
import torch
from ultralytics import YOLO

# Verify Intel XPU availability
print("XPU Available:", hasattr(torch, "xpu") and torch.xpu.is_available())

# Train on Intel Arc
model = YOLO("yolo11n.pt")
results = model.train(
    data="data.yaml",
    epochs=20,
    imgsz=640,
    batch=4,
    device="xpu:0",
    optimizer="AdamW"
)
```

---

## 📊 Model Evaluation & Benchmark Results

The baseline model was evaluated on the held-out test split consisting of **376 images** and **761 annotated ground-truth instances**.

### Overall Performance Metrics

| Metric | Score | Description |
| :--- | :---: | :--- |
| **Precision** | **87.05%** | Fraction of predictions that correctly matched ground truth |
| **Recall** | **87.90%** | Fraction of ground-truth objects successfully localized |
| **mAP@50** | **91.68%** | Mean Average Precision at IoU threshold $\ge 0.50$ |
| **mAP@50–95** | **56.72%** | Mean Average Precision averaged across IoU $0.50:0.05:0.95$ |

### Per-Class Evaluation Breakdown

| Class | Precision | Recall | mAP@50 | mAP@50–95 | Key Insight |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Rider** | 89.7% | **94.8%** | **97.94%** | **73.1%** | Outstanding detection of primary vehicle drivers |
| **Number Plate** | **90.9%** | **95.6%** | **94.68%** | **62.9%** | High recall ensuring vehicle identification |
| **Pillion** | **92.1%** | 90.9% | 94.30% | 51.5% | Strong discrimination of secondary passengers |
| **Helmet** | 81.3% | 79.4% | 85.81% | 45.7% | Reliable detection of compliant headgear |
| **No Helmet** | 81.3% | 78.9% | 85.66% | 50.4% | Effective identification of safety violations |

---

## 🔬 Baseline vs Fine-Tuned Comparative Study

Both checkpoints were benchmarked on the identical held-out test split at $640 \times 640$:

### Overall Comparison

| Metric | Baseline Checkpoint | Fine-Tuned Checkpoint | Difference |
| :--- | :---: | :---: | :---: |
| **Precision** | 87.05% | **87.06%** | $+0.01\%$ |
| **Recall** | **87.90%** | 86.38% | $-1.52\%$ |
| **mAP@50** | **91.68%** | 91.61% | $-0.07\%$ |
| **mAP@50–95** | **56.72%** | 55.56% | $-1.16\%$ |

### Per-Class mAP@50 Comparison

| Class | Baseline mAP@50 | Fine-Tuned mAP@50 | Delta |
| :--- | :---: | :---: | :---: |
| **Helmet** | **85.81%** | 85.73% | $-0.08\%$ |
| **No Helmet** | **85.66%** | 84.99% | $-0.67\%$ |
| **Number Plate** | 94.68% | **95.48%** | **$+0.80\%$** |
| **Pillion** | **94.30%** | 94.25% | $-0.05\%$ |
| **Rider** | **97.94%** | 97.58% | $-0.36\%$ |

### Key Scientific Findings

1. **Recall Advantage:** The baseline checkpoint retained higher overall recall ($87.90\%$ vs $86.38\%$), which is critical for road safety where missing a violation is penalized heavily.
2. **Strict Localization:** The baseline achieved superior mAP@50–95 ($56.72\%$ vs $55.56\%$), indicating tighter bounding-box boundaries.
3. **Number Plate Gain:** Fine-tuning yielded a small improvement in number plate localization ($+0.80\%$ mAP@50) due to additional plate-specific crops.
4. **Model Selection Conclusion:** The original baseline checkpoint is selected as the production model (`models/best.pt`) because it maintains superior recall across compliance classes.

---

## 💻 Web Application & Analytics Dashboard

The project includes a production-grade full-stack web application designed for demonstrations, research, and portfolio reviews:

- **Image Detection Workspace (`/detect`):** Complete upload dropzone with client-side file size and format validation, progress indicator, and comparison modes (Interactive Canvas, Backend Render, Original, and Side-by-Side).
- **Interactive Coordinate Scaling:** Bounding boxes dynamically rescale to display dimensions while preserving original coordinates.
- **Detections Table:** Real-time sortable, searchable table showing class badges, percentages, and coordinates with one-click copy.
- **Overview Dashboard (`/`):** Session statistics, safety compliance rates, Recharts class distribution charts, and quick-jump history.
- **Model Documentation (`/model-info`):** Embedded technical specifications and training parameters.
- **Settings (`/settings`):** Configurable API URL, confidence threshold slider, IoU slider, input resolution, and demo mode toggle.

---

## 📡 API Endpoints & Integration Contract

The FastAPI backend runs on port `8000`:

### 1. Health Check
`GET /health`
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_name": "YOLO11n (Helmet & Number Plate)",
  "device": "cpu",
  "classes": ["helmet", "no_helmet", "number_plate", "pillion", "rider"],
  "timestamp": 1792837278.96
}
```

### 2. Image Inference
`POST /predict?conf=0.25&iou=0.45&imgsz=640`
- **Body:** `multipart/form-data` with field `file`
- **Response:**
```json
{
  "success": true,
  "filename": "traffic_sample.jpg",
  "inference_time_ms": 38.6,
  "image_width": 1280,
  "image_height": 720,
  "annotated_image_url": "/results/annotated_5f3e2ac251.jpg",
  "detections": [
    {
      "class_id": 0,
      "class_name": "helmet",
      "confidence": 0.9412,
      "bbox": [240.5, 110.2, 380.0, 260.4]
    },
    {
      "class_id": 2,
      "class_name": "number_plate",
      "confidence": 0.9150,
      "bbox": [510.0, 480.2, 630.5, 530.8]
    }
  ],
  "counts": {
    "helmet": 1,
    "no_helmet": 0,
    "number_plate": 1,
    "pillion": 0,
    "rider": 1
  }
}
```

### 3. Static Results
`GET /results/{filename}`
Serves high-resolution annotated JPEG files.

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js:** v18+ (tested on v22.20)
- **Python:** 3.10+ (tested on 3.11)
- **Package Managers:** npm, pip

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/helmet-number-plate-detection.git
cd helmet-number-plate-detection
```

### 2. Backend Setup
Install Python dependencies:
```bash
pip install ultralytics opencv-python fastapi uvicorn numpy requests
```

*(Optional for Intel Arc GPU users)*: Install the Intel XPU PyTorch wheels matching your graphics driver.

### 3. Frontend Setup
Install frontend dependencies:
```bash
npm install
```

### 4. Launch Application

#### Quick Launch (Windows):
Double-click `start_app.bat` or run:
```powershell
.\start_app.bat
```

#### Manual Launch:
**Terminal 1 — FastAPI Backend:**
```bash
python -m uvicorn backend.main:app --port 8000 --host 127.0.0.1 --reload
```
*API running at `http://127.0.0.1:8000` • Docs at `http://127.0.0.1:8000/docs`*

**Terminal 2 — React Frontend:**
```bash
npm run dev
```
*Frontend running at `http://localhost:5173`*

---

## 🏃 Running Inference

### Python SDK Example
```python
from ultralytics import YOLO

# Load model weights
model = YOLO("models/best.pt")

# Perform inference
results = model.predict(
    source="test_traffic.jpg",
    conf=0.25,
    iou=0.45,
    imgsz=640,
    save=True
)

for result in results:
    for box in result.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        coords = box.xyxy[0].tolist()
        print(f"Class: {model.names[cls_id]} | Conf: {conf:.2%} | Box: {coords}")
```

---

## 📦 Understanding the Output

- **Class ID & Class Name:** Identifier matching the 5 canonical classes.
- **Confidence Score:** Model's statistical certainty (e.g. `0.9412` $\rightarrow$ `94.1%`).
- **Bounding Box (`xyxy`):** Top-left and bottom-right pixel coordinates:
  $$[x_1, y_1, x_2, y_2]$$
  Where $x_1, y_1$ is the upper-left corner and $x_2, y_2$ is the lower-right corner.

### Downstream Number Plate Recognition (OCR Pipeline)

The detector localizes license plate regions; it does not read alphanumeric text. A downstream character recognition pipeline can be attached:
1. Detect plate coordinates $[x_1, y_1, x_2, y_2]$.
2. Crop the plate region of interest (ROI).
3. Apply contrast enhancement and perspective rectification.
4. Execute OCR (e.g. PaddleOCR, EasyOCR, or Tesseract).

---

## ⚙️ Hardware & Environment

- **Operating System:** Windows 11 / Linux
- **Accelerator:** Intel Arc GPU with PyTorch XPU / CPU Fallback
- **Weights Size:** 5.44 MB (`models/best.pt`)
- **Memory Footprint:** $< 1.2\text{ GB}$ VRAM during batch-1 inference

---

## ⚠️ Limitations & Operational Scope

1. **Helmet-Related Recall:** Missed detections can occur under severe occlusion, night lighting, or low-resolution crops.
2. **Spatial Association:** The model outputs independent bounding boxes; additional geometric logic is required to link a detected helmet directly to a specific rider.
3. **Severe Weather:** Heavy rainfall, fog, or lens glare may reduce detection confidence.
4. **No Automated Penalty:** This system is an operator decision-support tool, not an autonomous punitive enforcement engine.

---

## 🔮 Future Improvements & Roadmap

- [x] YOLO11n fine-tuning on 5-class safety dataset.
- [x] Intel Arc GPU PyTorch XPU acceleration experiments.
- [x] FastAPI REST inference service.
- [x] React + Vite analytics dashboard with canvas bounding-box overlays.
- [ ] Multi-object tracking (ByteTrack / BoT-SORT) for continuous video feeds.
- [ ] Downstream OCR integration for license plate character extraction.
- [ ] Spatial heuristic module associating riders with helmet/no-helmet boxes.
- [ ] TensorRT / OpenVINO quantization for embedded edge deployment.

---

## 🌍 Applications

- **Intelligent Transportation Systems (ITS):** Highway and junction safety auditing.
- **Smart City Surveillance:** Automated compliance rate tracking across urban intersections.
- **Academic Research:** Object detection benchmarking on edge accelerators.
- **Fleet Safety Monitoring:** Logistics and delivery motorcycle fleet safety compliance.

---

## ⚖️ Disclaimer

This software and model weights are provided for research, educational, and demonstration purposes. Model predictions reflect statistical visual patterns and should not be used as the exclusive legal basis for issuing traffic citations or legal penalties.

---

## 📄 License

This project is licensed under the MIT License — see the repository license file for details. Pretrained YOLO11 weights are governed by Ultralytics licensing terms.
