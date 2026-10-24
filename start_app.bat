@echo off
echo ========================================================
echo   RoadVision AI - Helmet ^& Number Plate Detection System
echo ========================================================
echo.
echo [1/2] Starting Python FastAPI Backend on port 8000...
start "RoadVision AI Backend (FastAPI)" cmd /k "python -m uvicorn backend.main:app --port 8000 --host 127.0.0.1 --reload"

timeout /t 2 /nobreak >nul

echo [2/2] Starting React Vite Frontend on port 5173...
start "RoadVision AI Frontend (Vite)" cmd /k "npm run dev"

echo.
echo ========================================================
echo   System running!
echo   - Frontend: http://localhost:5173
echo   - Backend:  http://127.0.0.1:8000
echo   - API Docs: http://127.0.0.1:8000/docs
echo ========================================================
echo.
pause
