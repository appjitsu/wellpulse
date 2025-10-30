"""
WellPulse ML Service

Internal microservice for machine learning predictions:
- Predictive maintenance (equipment failure prediction)
- Production optimization
- Anomaly detection (leaks, unusual patterns)
- Decline curve analysis
- Emissions prediction
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from src.routes import health, predict

# Initialize FastAPI app
app = FastAPI(
    title="WellPulse ML Service",
    description="Machine learning microservice for oil & gas field operations",
    version="0.1.0",
)

# CORS configuration (only allow requests from API server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4001",  # API server (development)
        "https://api.wellpulse.app",  # API server (production)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(predict.router, prefix="/predict", tags=["Predictions"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "WellPulse ML Service",
        "version": "0.1.0",
        "status": "operational",
        "endpoints": {
            "health": "/health",
            "predictive_maintenance": "/predict/equipment-failure",
            "production_optimization": "/predict/production",
            "anomaly_detection": "/predict/anomaly",
        },
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
        },
    )


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes (development only)
    )
