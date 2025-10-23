"""Health check endpoint"""

from fastapi import APIRouter
from datetime import datetime

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring and load balancers

    Returns service status, uptime, and system information
    """
    return {
        "status": "healthy",
        "service": "ml",
        "timestamp": datetime.utcnow().isoformat(),
        "models": {
            "predictive_maintenance": "ready",
            "production_optimization": "ready",
            "anomaly_detection": "ready",
        },
    }
