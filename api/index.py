"""
Vercel Serverless Function entrypoint for RoadVision AI.
Routes incoming HTTP requests to the FastAPI application.
"""
import os
import sys
from pathlib import Path

# Mark environment as Vercel serverless
os.environ["VERCEL"] = "1"

# Ensure project root directory is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Import the core FastAPI application
from backend.main import app
