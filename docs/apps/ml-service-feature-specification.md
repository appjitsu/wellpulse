# ML Service Feature Specification (services/ml)

**Version**: 1.0
**Last Updated**: October 23, 2025
**Tech Stack**: Python 3.11+, FastAPI, scikit-learn, pandas, numpy, joblib

---

## Overview

The WellPulse ML Service is an **internal microservice** that provides machine learning predictions for predictive maintenance, production optimization, anomaly detection, and decline curve analysis. It runs as a separate Python service called by the main NestJS API.

**Key Principle**: ML service is **internal-only** (not publicly accessible). The NestJS API acts as a gateway, handling authentication, authorization, and request routing to the ML service.

**Architecture Pattern**: Microservice with RESTful API

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     NestJS API (Port 3001)                  │
│  - Handles authentication                                   │
│  - Fetches tenant data from PostgreSQL                      │
│  - Calls ML service internally                              │
│  - Caches predictions (Redis)                               │
└─────────────────────┬───────────────────────────────────────┘
                      │ Internal HTTP
                      ↓
┌─────────────────────────────────────────────────────────────┐
│             Python ML Service (Port 8000)                   │
│  - Receives prediction requests                             │
│  - Loads trained models from disk                           │
│  - Runs inference                                            │
│  - Returns predictions                                       │
└─────────────────────────────────────────────────────────────┘
                      │
                      ↓
               ┌──────────────┐
               │ Trained Models│
               │   (.joblib)   │
               └──────────────┘
```

**Deployment:**

- **Development**: `http://localhost:8000`
- **Production**: Internal-only endpoint (not exposed to internet)
  - Azure Container Apps with internal ingress
  - Only accessible from `wellpulse-api` container

---

## ML Use Cases

### 1. Predictive Maintenance (Equipment Failure Prediction)

**Goal**: Predict equipment failures 7-30 days in advance

**Input Features:**

- Equipment age (days since installation)
- Runtime hours (cumulative)
- Maintenance history (days since last maintenance, # of past failures)
- Production data (oil/gas/water volumes, runtime hours/day)
- Sensor data (if available): Vibration, temperature, pressure
- Environmental data: Temperature, humidity (from weather API)

**Output:**

- **Failure probability**: 0-100% (next 30 days)
- **Risk score**: Low/Medium/High/Critical
- **Predicted failure date**: Estimated date if no action taken
- **Recommended action**: "Inspect bearing", "Replace belt", "Schedule maintenance"
- **Confidence level**: Model confidence (e.g., 85%)

**Model Type**: Binary classification (failure vs. no failure) + regression (days until failure)

**Algorithm**: Random Forest Classifier + Gradient Boosting Regressor

**Training Data:**

- Historical equipment data (all tenants, anonymized)
- Failure events (past equipment failures with conditions leading up to failure)
- Minimum dataset size: 1,000 equipment-months (e.g., 100 pieces of equipment × 10 months)

**Retraining Frequency**: Monthly (as new failure data collected)

---

### 2. Production Optimization (Underperforming Well Detection)

**Goal**: Identify wells producing below expected decline curve

**Input Features:**

- Well metadata: Age, type (oil/gas), depth, formation
- Historical production data: Daily oil/gas/water volumes (last 365 days)
- Equipment configuration: Pump size, compressor capacity
- Completion data: Number of frac stages, proppant volume
- Nearby well performance (offset wells)

**Output:**

- **Expected production**: Predicted oil/gas volumes based on decline curve
- **Actual vs. expected**: Percentage deviation (e.g., "20% below expected")
- **Anomaly flag**: Boolean (is well underperforming?)
- **Potential causes**: "Equipment malfunction", "Reservoir depletion", "Water cut increase"
- **Recommended actions**: "Inspect pump", "Workover candidate", "Monitor for 30 days"

**Model Type**: Regression (forecasting production) + anomaly detection

**Algorithm**:

- Decline curve fitting (Arps hyperbolic decline)
- ARIMA/Prophet for time-series forecasting
- Isolation Forest for anomaly detection

**Training Data:**

- Historical production data (all wells, all tenants)
- Minimum: 500 wells × 12 months of production data

**Retraining Frequency**: Quarterly

---

### 3. Anomaly Detection (Production Data)

**Goal**: Flag unusual production patterns for investigation

**Input Features:**

- Daily production data: Oil, gas, water (last 90 days)
- Runtime hours
- Pressure readings

**Output:**

- **Anomaly score**: 0-100 (higher = more anomalous)
- **Anomaly type**: "Sudden drop", "Spike", "Trend change", "Missing data"
- **Severity**: Info/Warning/Critical
- **Description**: "Oil production dropped 40% on Oct 22 with no corresponding maintenance log"

**Model Type**: Unsupervised anomaly detection

**Algorithm**: Isolation Forest or Autoencoders

**Training Data:**

- Normal production patterns (last 12 months, all wells)
- Minimum: 10,000 daily production records

**Retraining Frequency**: Monthly

---

### 4. Decline Curve Analysis (Production Forecasting)

**Goal**: Forecast future production for planning and economics

**Input Features:**

- Historical production data (daily oil/gas volumes)
- Well age (days since first production)
- Cumulative production to date

**Output:**

- **Forecasted production**: Oil/gas volumes for next 12 months (monthly aggregation)
- **Decline rate**: Percentage decline per year
- **Estimated ultimate recovery (EUR)**: Total barrels expected over well life
- **Economic metrics**: Net Present Value (NPV), Payout time

**Model Type**: Regression (time-series forecasting)

**Algorithm**:

- Arps Decline Curve (exponential, hyperbolic, harmonic)
- Prophet (Facebook's time-series forecasting)

**Training Data:**

- Historical production data for mature wells (2+ years of production)
- Minimum: 100 wells with complete production history

**Retraining Frequency**: Annually (decline curves stable over time)

---

### 5. Emissions Prediction (ESG Compliance)

**Goal**: Predict emissions for upcoming month (for proactive compliance)

**Input Features:**

- Forecasted production (from decline curve analysis)
- Equipment type and configuration
- Historical emissions data
- Maintenance schedule (downtime affects emissions)

**Output:**

- **Predicted CO2 emissions**: Tons for next 30 days
- **Predicted CH4 emissions**: Tons for next 30 days
- **Predicted VOC emissions**: Tons for next 30 days
- **Compliance risk**: Probability of exceeding regulatory thresholds

**Model Type**: Regression

**Algorithm**: Gradient Boosting Regressor

**Training Data:**

- Historical production + emissions data (all tenants)
- Minimum: 6 months of emissions data

**Retraining Frequency**: Quarterly

---

## API Endpoints

**Base URL**: `http://localhost:8000` (development), Internal URL (production)

### Health Check

```
GET /health
Response:
{
  "status": "healthy",
  "models_loaded": true,
  "version": "1.0.0"
}
```

### Predictive Maintenance

```
POST /predict/equipment-failure
Body:
{
  "equipmentId": "equipment-123",
  "equipmentType": "PUMP_JACK",
  "ageInDays": 730,
  "runtimeHours": 17520,
  "daysSinceLastMaintenance": 90,
  "pastFailureCount": 2,
  "recentProductionData": [
    { "date": "2025-10-22", "oil": 45.5, "gas": 123.0, "runtime": 24.0 },
    { "date": "2025-10-21", "oil": 47.2, "gas": 125.0, "runtime": 24.0 },
    // ... last 30 days
  ],
  "sensorData": {
    "vibration": 0.25,  // Optional
    "temperature": 85.0,
    "pressure": 350.0
  }
}

Response:
{
  "failureProbability": 0.72,
  "riskScore": "HIGH",
  "predictedFailureDate": "2025-11-05",
  "daysUntilFailure": 13,
  "confidence": 0.85,
  "recommendedAction": "Inspect bearing and belt within 7 days",
  "contributingFactors": [
    "High runtime hours (17,520 hrs)",
    "90 days since last maintenance (exceeds 60-day recommendation)",
    "2 past failures indicate wear pattern"
  ]
}
```

### Production Optimization

```
POST /predict/production-optimization
Body:
{
  "wellId": "well-456",
  "wellType": "OIL",
  "wellAge": 1095, // days
  "historicalProduction": [
    { "date": "2025-10-22", "oil": 45.5, "gas": 123.0, "water": 12.0 },
    { "date": "2025-10-21", "oil": 47.2, "gas": 125.0, "water": 11.5 },
    // ... last 365 days
  ]
}

Response:
{
  "expectedProduction": {
    "oil": 50.0,
    "gas": 130.0
  },
  "actualProduction": {
    "oil": 45.5,
    "gas": 123.0
  },
  "deviationPercentage": {
    "oil": -9.0,
    "gas": -5.4
  },
  "isUnderperforming": true,
  "potentialCauses": [
    "Production declining faster than expected decline curve",
    "Possible equipment inefficiency"
  ],
  "recommendedActions": [
    "Inspect pump jack for mechanical issues",
    "Consider workover or stimulation"
  ]
}
```

### Anomaly Detection

```
POST /predict/anomaly-detection
Body:
{
  "wellId": "well-456",
  "recentProductionData": [
    { "date": "2025-10-22", "oil": 20.0, "gas": 123.0, "water": 12.0 },  // Sudden drop
    { "date": "2025-10-21", "oil": 47.2, "gas": 125.0, "water": 11.5 },
    // ... last 90 days
  ]
}

Response:
{
  "isAnomaly": true,
  "anomalyScore": 0.85,
  "anomalyType": "SUDDEN_DROP",
  "severity": "WARNING",
  "description": "Oil production dropped 40% on Oct 22 with no corresponding maintenance log",
  "affectedMetrics": ["oil"],
  "detectedDate": "2025-10-22"
}
```

### Decline Curve Analysis

```
POST /predict/decline-curve
Body:
{
  "wellId": "well-456",
  "wellType": "OIL",
  "firstProductionDate": "2023-01-15",
  "historicalProduction": [
    { "date": "2023-01-15", "oil": 150.0 },
    { "date": "2023-01-16", "oil": 148.0 },
    // ... all historical data
  ]
}

Response:
{
  "forecastedProduction": [
    { "month": "2025-11", "oil": 42.0 },
    { "month": "2025-12", "oil": 40.5 },
    // ... next 12 months
  ],
  "declineRate": 0.08,  // 8% annual decline
  "estimatedUltimateRecovery": 125000,  // barrels
  "economicMetrics": {
    "npv": 450000,  // Net Present Value ($)
    "payoutMonths": 18
  },
  "declineModel": "HYPERBOLIC",
  "confidence": 0.90
}
```

### Emissions Prediction

```
POST /predict/emissions
Body:
{
  "tenantId": "tenant-123",
  "forecastedProduction": {
    "oil": 1200,  // barrels for next 30 days
    "gas": 3500   // mcf for next 30 days
  },
  "equipmentConfiguration": [
    { "type": "PUMP_JACK", "count": 10 },
    { "type": "COMPRESSOR", "count": 2 }
  ]
}

Response:
{
  "predictedEmissions": {
    "co2": 125.5,  // tons
    "ch4": 3.2,
    "voc": 0.8
  },
  "complianceRisk": {
    "exceedsThreshold": false,
    "percentOfThreshold": 65.0,
    "daysUntilThreshold": 45
  },
  "confidence": 0.88
}
```

### Model Training (Admin Only)

```
POST /train/predictive-maintenance
Body:
{
  "tenantIds": ["all"],  // Or specific tenant IDs
  "startDate": "2024-01-01",
  "endDate": "2025-10-23"
}

Response:
{
  "success": true,
  "modelVersion": "v1.2.0",
  "trainingDuration": 120,  // seconds
  "accuracy": 0.87,
  "f1Score": 0.82,
  "samplesUsed": 15000
}
```

---

## Model Management

### Model Versioning

**Storage Location:**

```
services/ml/models/
├── predictive_maintenance/
│   ├── v1.0.0_model.joblib
│   ├── v1.1.0_model.joblib
│   └── v1.2.0_model.joblib (current)
├── production_optimization/
│   └── v1.0.0_model.joblib
├── anomaly_detection/
│   └── v1.0.0_model.joblib
└── decline_curve/
    └── v1.0.0_model.joblib
```

**Model Metadata:**

```json
{
  "modelName": "predictive_maintenance",
  "version": "v1.2.0",
  "algorithm": "RandomForestClassifier",
  "trainedAt": "2025-10-15T10:30:00Z",
  "accuracy": 0.87,
  "f1Score": 0.82,
  "trainingDataSize": 15000,
  "features": ["ageInDays", "runtimeHours", "daysSinceLastMaintenance", ...]
}
```

### Model Loading

**On Startup:**

- Load all current models into memory (for fast inference)
- Validate models (check file integrity, compatibility)
- Log model versions to console

**On Model Update:**

- Download new model from Azure Blob Storage
- Load new model into memory
- Perform A/B test (compare old vs. new model predictions)
- Switch traffic to new model if performance improves

---

## Training Pipeline

### Data Collection

**Source**: NestJS API fetches training data from all tenant databases (anonymized)

**Process**:

1. NestJS API aggregates data across tenants (scheduled task)
2. Anonymize data (remove tenant IDs, well names)
3. Export to CSV or Parquet format
4. Upload to Azure Blob Storage (training-data/ folder)
5. ML service downloads training data
6. Train models
7. Upload trained models back to Blob Storage
8. NestJS API downloads new models for deployment

### Retraining Schedule

**Automated Retraining:**

- **Predictive Maintenance**: Monthly (1st of every month, 2 AM)
- **Production Optimization**: Quarterly (1st of Jan/Apr/Jul/Oct, 2 AM)
- **Anomaly Detection**: Monthly
- **Decline Curve Analysis**: Annually (January 1st)
- **Emissions Prediction**: Quarterly

**Manual Retraining:**

- Admin can trigger retraining via admin portal
- Useful after adding new tenants or major data updates

---

## Performance

### Latency Targets

- **Single prediction**: < 200ms
- **Batch predictions** (100 wells): < 5 seconds
- **Model loading**: < 5 seconds on startup

### Scalability

- **Concurrent requests**: Handle 100 requests/second
- **Memory usage**: < 2GB per container
- **Horizontal scaling**: Add more ML service containers (stateless)

### Caching (NestJS API Layer)

- Cache predictions for 1 hour (reduce redundant ML calls)
- Cache key: `ml:predict:equipment-failure:equipment-123`
- Use Redis for caching

---

## Security

### Internal-Only Access

- ML service **not exposed to public internet**
- Only accessible from NestJS API container
- Azure Container Apps internal ingress

### Authentication

- API key authentication (shared secret between NestJS API and ML service)
- Header: `X-API-Key: <secret>`

### Data Privacy

- Training data anonymized (no tenant-identifiable information)
- Models trained on aggregate data (all tenants combined)
- Individual predictions do NOT expose other tenant data

---

## Monitoring & Observability

### Metrics

- **Request count**: Total predictions made
- **Latency**: p50, p95, p99 response times
- **Model performance**: Accuracy, F1 score (tracked over time)
- **Error rate**: Failed predictions (e.g., invalid input data)

### Logging

- **Structured logs** (JSON format)
- **Log levels**: DEBUG, INFO, WARNING, ERROR
- **Log to**: Azure Application Insights

**Example Log:**

```json
{
  "timestamp": "2025-10-23T14:30:00Z",
  "level": "INFO",
  "message": "Prediction successful",
  "model": "predictive_maintenance",
  "modelVersion": "v1.2.0",
  "equipmentId": "equipment-123",
  "failureProbability": 0.72,
  "latency": 150
}
```

### Alerts

- Alert if ML service unavailable (health check fails)
- Alert if prediction latency > 500ms (p95)
- Alert if model training fails

---

## Deployment

### Docker Container

**Dockerfile:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Download pre-trained models (or mount from volume)
RUN mkdir -p /app/models

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8000/health || exit 1

# Run FastAPI with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Azure Container Apps

```yaml
Name: wellpulse-ml
Configuration:
  Image: ghcr.io/yourusername/wellpulse-ml:latest
  Ingress: Enabled, Internal (only accessible from wellpulse-api)
  Port: 8000
  Scale Rules:
    - Min Replicas: 0 (scale to zero when idle)
    - Max Replicas: 3
    - HTTP Concurrency: 10 (ML is CPU-intensive)
  Resources:
    CPU: 1.0 vCPU (bootstrap), 2.0 vCPU (production)
    Memory: 2.0 Gi (bootstrap), 4.0 Gi (production)
  Environment Variables:
    - MODEL_PATH: /app/models
    - LOG_LEVEL: INFO
    - API_KEY: @Microsoft.KeyVault(SecretUri=...)
```

---

## Testing

### Unit Tests

- Test feature engineering functions
- Test model inference logic (mock models)
- Test input validation

### Integration Tests

- Test end-to-end prediction flow
- Test model loading from disk
- Test API endpoints (FastAPI TestClient)

### Model Validation Tests

- Test model accuracy on holdout dataset
- Test prediction consistency (same input → same output)
- Test edge cases (missing data, extreme values)

---

## Dependencies

**requirements.txt:**

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
scikit-learn==1.3.2
pandas==2.1.3
numpy==1.26.2
joblib==1.3.2
prophet==1.1.5  # For time-series forecasting
scipy==1.11.4
python-multipart==0.0.6
```

---

## Related Documentation

- [API Feature Specification](./api-feature-specification.md)
- [Permian Basin Market Research](../research/01-permian-basin-market-research.md)
- [Azure Production Architecture](../deployment/azure-production-architecture.md)

---

**Next Steps:**

1. Set up Python FastAPI project structure
2. Implement predictive maintenance model (highest priority)
3. Create training pipeline for data collection
4. Integrate ML service with NestJS API
5. Test predictions with sample data
6. Deploy to Azure Container Apps (internal ingress)
