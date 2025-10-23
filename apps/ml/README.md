# WellPulse ML Service

Internal microservice for machine learning predictions in oil & gas field operations.

## Features

### Predictive Maintenance

Predict equipment failure probability 7-30 days in advance using:

- Historical maintenance data
- Real-time sensor readings (temperature, pressure, vibration)
- Equipment age and usage patterns
- Environmental conditions

**Output**: Failure probability, predicted date, risk level, recommended actions

### Production Optimization

Recommend adjustments to maximize production while minimizing costs:

- Pump speed optimization
- Choke setting recommendations
- Gas lift rate adjustments
- Artificial lift parameter tuning

**Output**: Recommended changes, expected improvement percentage

### Anomaly Detection

Identify unusual patterns in production or sensor data:

- Potential leaks (sudden volume drops)
- Equipment malfunctions
- Unusual production patterns
- Data quality issues

**Output**: Detected anomalies, severity, investigation recommendations

### Decline Curve Analysis (Future)

Predict future production rates using decline curve models:

- Exponential decline
- Hyperbolic decline
- Harmonic decline

### Emissions Prediction (Future)

Estimate emissions for ESG compliance:

- Flaring estimates
- Venting calculations
- Methane leak detection

## Tech Stack

- **FastAPI**: High-performance async web framework
- **Uvicorn**: ASGI server with auto-reload
- **Pydantic**: Request/response validation
- **scikit-learn**: ML algorithms
- **NumPy**: Numerical computing
- **Pandas**: Data manipulation

## Development

### Prerequisites

- Python 3.11+
- pip or Poetry

### Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Run development server (with auto-reload)
python -m src.main

# Or use uvicorn directly
uvicorn src.main:app --reload --port 8000
```

### API Documentation

FastAPI automatically generates interactive API docs:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Docker

### Build Image

```bash
docker build -t wellpulse-ml:latest .
```

### Run Container

```bash
docker run -p 8000:8000 --env-file .env wellpulse-ml:latest
```

### Docker Compose

```bash
docker compose up ml
```

## Endpoints

### Health Check

```bash
GET /health
```

### Predictive Maintenance

```bash
POST /predict/equipment-failure
Content-Type: application/json

{
  "equipment_id": "PUMP-001",
  "equipment_type": "pump_jack",
  "sensor_data": {
    "temperature": 85.5,
    "vibration": 2.3,
    "pressure": 120
  }
}
```

### Production Optimization

```bash
POST /predict/production
Content-Type: application/json

{
  "well_id": "WELL-123",
  "current_production": {
    "oil_bbl": 45,
    "gas_mcf": 120,
    "water_bbl": 15
  },
  "reservoir_data": {},
  "equipment_config": {}
}
```

### Anomaly Detection

```bash
POST /predict/anomaly
Content-Type: application/json

{
  "well_id": "WELL-123",
  "time_series_data": [...],
  "detection_type": "leak"
}
```

## Deployment

### Azure Container Apps

The ML service runs as a containerized microservice on Azure:

- **Auto-scaling**: Scales based on CPU/memory/request count
- **Internal networking**: Only accessible from API server
- **Health checks**: Kubernetes-style liveness/readiness probes

### Environment Variables

```bash
API_URL=https://api.wellpulse.app
MODEL_PATH=/app/models
LOG_LEVEL=INFO
```

## Model Training

ML models are trained offline using historical data:

1. **Data Collection**: Export historical data from tenant databases
2. **Feature Engineering**: Transform raw data into ML features
3. **Model Training**: Train using scikit-learn, TensorFlow, or PyTorch
4. **Model Evaluation**: Test on holdout dataset
5. **Model Deployment**: Save model files, load in service

Models are versioned and stored in Azure Blob Storage.

## Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html
```

## Architecture

```
src/
├── main.py           # FastAPI app entry point
├── routes/           # API endpoints
│   ├── health.py
│   └── predict.py
├── models/           # ML model classes
├── utils/            # Utility functions
└── __init__.py
```

## Performance

- **Response Time**: < 100ms for most predictions
- **Throughput**: 1000+ requests/second
- **Model Latency**: < 50ms inference time
- **Memory**: ~500MB base + model sizes

## Security

- **CORS**: Only allows requests from API server
- **No authentication**: Relies on internal network isolation
- **Input validation**: Pydantic models validate all inputs
- **Rate limiting**: Handled by API server
