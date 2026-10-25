# Vercel Full-Stack Deployment Guide — RoadVision AI

This repository is configured for **full-stack deployment on Vercel**, hosting both the **React + Vite Frontend** and the **FastAPI Python Backend** together in a single deployment.

---

## 1. How It Works on Vercel

```
                        Incoming Request
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
       API / Backend Endpoints         Frontend Page Routes
   (/health, /predict, /records,     (/image-analysis, /violations,
         /api/violations)               /history, /settings, /)
                 │                             │
                 ▼                             ▼
         api/index.py                  dist/index.html
     (FastAPI Serverless)             (Vite React SPA)
```

1. **Vercel Serverless Function (`api/index.py`)**:
   Exposes the full FastAPI application handling object detection, conflict resolution, OCR extraction, and violation registration.
2. **Dynamic Routing (`vercel.json`)**:
   Rewrites API endpoints (`/health`, `/predict`, `/records`, `/api/*`) directly to `api/index.py`, and catches all SPA frontend routes (`/(.*)`) back to `index.html`.
3. **Automatic Same-Origin API Calls**:
   When deployed on Vercel, the client automatically defaults to relative requests (e.g. `/health`, `/predict`), completely eliminating CORS errors and Mixed Content blocks.
4. **Serverless Filesystem Adaptation**:
   SQLite database records (`roadvision.db`) and cropped evidence images automatically save to the ephemeral `/tmp` storage in serverless runtimes.

---

## 2. Step-by-Step Vercel Deployment

### Step 1: Push to GitHub
Commit your project and push it to your GitHub repository:
```bash
git add .
git commit -m "Deploy both frontend and backend to Vercel"
git push origin main
```

### Step 2: Import into Vercel
1. Go to [vercel.com](https://vercel.com/) and click **Add New... -> Project**.
2. Select your `helmet-number-plate-detection` GitHub repository and click **Import**.
3. Vercel automatically detects the framework preset as **Vite**:
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
   * **Install Command**: `npm install`

### Step 3: Configure Environment Variables (Optional)
Vercel reserves the `VERCEL_` prefix for internal system variables, so you **do not** need to add any system flags. New projects automatically run on Vercel Fluid Compute.

You can leave Environment Variables completely blank, or optionally configure client defaults:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `VITE_DEMO_MODE` | `false` | Set to `true` if you ever want to force simulated browser detections. |
| `VITE_DEFAULT_CONF` | `0.25` | Default detection confidence threshold (strictly $\ge 0.05$). |
| `VITE_DEFAULT_IOU` | `0.45` | Default Intersection-over-Union threshold. |

### Step 4: Click Deploy!
Vercel will:
1. Build the Vite production bundle (`npm run build -> dist/`).
2. Install Python packages from `requirements.txt` using CPU-optimized PyTorch wheels (`--extra-index-url https://download.pytorch.org/whl/cpu`).
3. Deploy the unified application to your `https://<your-project>.vercel.app` URL.

---

## 3. Local Development vs. Vercel Production

| Feature | Local Development | Vercel Production |
| :--- | :--- | :--- |
| **Frontend URL** | `http://localhost:5173` | `https://your-app.vercel.app` |
| **Backend URL** | `http://127.0.0.1:8000` | `https://your-app.vercel.app` (Same-Origin) |
| **API Base URL** | Automatically connects to `http://127.0.0.1:8000` | Automatically uses relative `""` paths |
| **Storage Path** | `./results/roadvision.db` | `/tmp/results/roadvision.db` |
| **Weights Path** | `models/best.pt` (included in repo) | `models/best.pt` (bundled in function) |

---

## 4. Verification After Deployment

Once deployment completes:
1. Visit `https://<your-app>.vercel.app/health` in your browser. It should return:
   ```json
   {
     "status": "ok",
     "model_loaded": true,
     "ocr_available": true,
     "model_name": "YOLO11n (Low-Confidence & Conflict Resolution Enabled)"
   }
   ```
2. Navigate to `https://<your-app>.vercel.app/` — the status indicator in the top-right header should display **Backend Connected (Ready)**.
3. Upload an image in **Image Analysis** to run YOLO11n object detection and license plate OCR directly through your Vercel deployment!
