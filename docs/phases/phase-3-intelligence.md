# Phase 3: ML Intelligence & Production Launch

**Version**: 1.0
**Duration**: Weeks 17-24 (Sprints 9-10)
**Last Updated**: October 23, 2025

Phase 3 transforms WellPulse from a PSA platform into an intelligent system with predictive capabilities, ESG compliance, and production-ready multi-tenant infrastructure.

---

## Table of Contents

1. [Overview](#overview)
2. [Sprint 9: ML Service & ESG Compliance](#sprint-9-ml-service--esg-compliance)
3. [Sprint 10: Admin Portal & Production Launch](#sprint-10-admin-portal--production-launch)
4. [Production Readiness](#production-readiness)
5. [Beta Onboarding](#beta-onboarding)
6. [Post-MVP Roadmap](#post-mvp-roadmap)

---

## Overview

### Phase 3 Goals

1. **ML Intelligence**: Predictive maintenance, production optimization, anomaly detection
2. **ESG Compliance**: Emissions calculations, regulatory reporting (TX RRC, NM OCD)
3. **Admin Portal**: Tenant management, billing, usage analytics
4. **Production Launch**: Azure deployment, monitoring, beta customer onboarding

### Tech Stack Additions

- **ML Service**: Python 3.11, FastAPI, scikit-learn, pandas, numpy
- **Admin App**: Next.js 15, Shadcn UI, React Query
- **Billing**: Stripe Checkout, Stripe Webhooks
- **Infrastructure**: Azure Container Apps, Azure PostgreSQL, Application Insights
- **Monitoring**: Azure Monitor, Sentry, custom metrics

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure Front Door                        │
│                  (CDN + WAF + SSL)                          │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
    ┌────────▼────────┐              ┌────────▼────────┐
    │   apps/web      │              │   apps/admin    │
    │  (Next.js 15)   │              │  (Next.js 15)   │
    │  Port: 3000     │              │  Port: 3004     │
    └────────┬────────┘              └────────┬────────┘
             │                                │
             └────────────┬───────────────────┘
                          │
                 ┌────────▼────────┐
                 │    apps/api     │
                 │   (NestJS)      │
                 │   Port: 3001    │
                 └────────┬────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼─────┐    ┌────▼─────┐    ┌────▼─────┐
    │PostgreSQL│    │  ML API  │    │  Stripe  │
    │  (Azure) │    │ (FastAPI)│    │   API    │
    └──────────┘    │Port: 8000│    └──────────┘
                    └──────────┘
```

---

## Sprint 9: ML Service & ESG Compliance

**Duration**: Weeks 17-20
**Focus**: Build Python ML service with 5 use cases, ESG emissions calculations, regulatory reporting

### 9.1 ML Service Architecture

#### Directory Structure

```
apps/ml/
├── src/
│   ├── main.py                    # FastAPI app
│   ├── config.py                  # Configuration
│   ├── models/                    # ML models
│   │   ├── predictive_maintenance.py
│   │   ├── production_optimizer.py
│   │   ├── anomaly_detector.py
│   │   ├── decline_curve.py
│   │   └── emissions_predictor.py
│   ├── training/                  # Training pipelines
│   │   ├── data_loader.py
│   │   ├── feature_engineering.py
│   │   ├── train_maintenance.py
│   │   ├── train_optimizer.py
│   │   ├── train_anomaly.py
│   │   ├── train_decline.py
│   │   └── train_emissions.py
│   ├── services/                  # Business logic
│   │   ├── prediction_service.py
│   │   ├── esg_service.py
│   │   └── report_service.py
│   ├── api/                       # API routes
│   │   ├── predictions.py
│   │   ├── esg.py
│   │   └── health.py
│   └── utils/
│       ├── db.py                  # PostgreSQL connection
│       ├── metrics.py             # Model metrics
│       └── validators.py
├── models/                        # Saved models
│   ├── maintenance_model.pkl
│   ├── optimizer_model.pkl
│   ├── anomaly_model.pkl
│   ├── decline_model.pkl
│   └── emissions_model.pkl
├── requirements.txt
├── Dockerfile
└── README.md
```

#### FastAPI Application Setup

```python
# apps/ml/src/main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from .api import predictions, esg, health
from .services import prediction_service, esg_service
from .config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup"""
    logger.info("Loading ML models...")
    await prediction_service.load_models()
    logger.info("ML models loaded successfully")
    yield
    logger.info("Shutting down ML service...")

app = FastAPI(
    title="WellPulse ML API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["predictions"])
app.include_router(esg.router, prefix="/api/v1/esg", tags=["esg"])

@app.get("/")
async def root():
    return {
        "service": "WellPulse ML API",
        "version": "1.0.0",
        "status": "running"
    }
```

```python
# apps/ml/src/config.py
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # API
    API_KEY: str
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Models
    MODEL_PATH: str = "./models"

    # Training
    TRAIN_TEST_SPLIT: float = 0.2
    RANDOM_STATE: int = 42

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"

settings = Settings()
```

```txt
# apps/ml/requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
scikit-learn==1.3.2
pandas==2.1.3
numpy==1.26.2
scipy==1.11.4
psycopg2-binary==2.9.9
sqlalchemy==2.0.23
joblib==1.3.2
python-multipart==0.0.6
```

### 9.2 ML Use Case 1: Predictive Maintenance

**Goal**: Predict equipment failures 7-30 days in advance using production data and maintenance history.

#### Feature Engineering

```python
# apps/ml/src/training/feature_engineering.py
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List

class MaintenanceFeatureEngineer:
    """Feature engineering for predictive maintenance"""

    def __init__(self, lookback_days: int = 30):
        self.lookback_days = lookback_days

    def create_features(self, production_df: pd.DataFrame,
                       maintenance_df: pd.DataFrame,
                       equipment_df: pd.DataFrame) -> pd.DataFrame:
        """
        Create features for predictive maintenance

        Features:
        - Rolling statistics (mean, std, min, max) for production metrics
        - Days since last maintenance
        - Maintenance frequency
        - Equipment age
        - Production trends (declining, stable, increasing)
        - Anomaly scores
        """

        # Merge datasets
        df = production_df.copy()

        # 1. Rolling statistics (7, 14, 30 days)
        for window in [7, 14, 30]:
            df[f'oil_mean_{window}d'] = df.groupby('well_id')['oil_volume'].transform(
                lambda x: x.rolling(window=window, min_periods=1).mean()
            )
            df[f'oil_std_{window}d'] = df.groupby('well_id')['oil_volume'].transform(
                lambda x: x.rolling(window=window, min_periods=1).std()
            )
            df[f'gas_mean_{window}d'] = df.groupby('well_id')['gas_volume'].transform(
                lambda x: x.rolling(window=window, min_periods=1).mean()
            )
            df[f'water_mean_{window}d'] = df.groupby('well_id')['water_volume'].transform(
                lambda x: x.rolling(window=window, min_periods=1).mean()
            )
            df[f'pressure_mean_{window}d'] = df.groupby('well_id')['pressure'].transform(
                lambda x: x.rolling(window=window, min_periods=1).mean()
            )

        # 2. Production trends (30-day slope)
        df['oil_trend'] = df.groupby('well_id')['oil_volume'].transform(
            lambda x: self._calculate_trend(x, window=30)
        )
        df['gas_trend'] = df.groupby('well_id')['gas_volume'].transform(
            lambda x: self._calculate_trend(x, window=30)
        )

        # 3. Days since last maintenance
        df = df.merge(
            self._calculate_days_since_maintenance(maintenance_df),
            on=['well_id', 'date'],
            how='left'
        )

        # 4. Maintenance frequency (count in last 90 days)
        df = df.merge(
            self._calculate_maintenance_frequency(maintenance_df),
            on=['well_id', 'date'],
            how='left'
        )

        # 5. Equipment age
        df = df.merge(
            equipment_df[['well_id', 'install_date']],
            on='well_id',
            how='left'
        )
        df['equipment_age_days'] = (df['date'] - df['install_date']).dt.days
        df.drop('install_date', axis=1, inplace=True)

        # 6. Coefficient of variation (volatility)
        df['oil_cv'] = df['oil_std_30d'] / (df['oil_mean_30d'] + 1e-6)
        df['gas_cv'] = df['gas_std_30d'] / (df['gas_mean_30d'] + 1e-6)

        # 7. Production decline rate
        df['oil_decline_rate'] = (df['oil_mean_7d'] - df['oil_mean_30d']) / (df['oil_mean_30d'] + 1e-6)

        # 8. Anomaly score (Z-score)
        df['oil_zscore'] = (df['oil_volume'] - df['oil_mean_30d']) / (df['oil_std_30d'] + 1e-6)
        df['pressure_zscore'] = (df['pressure'] - df['pressure_mean_30d']) / (df['pressure_mean_30d'] + 1e-6)

        return df

    def _calculate_trend(self, series: pd.Series, window: int) -> pd.Series:
        """Calculate linear regression slope over window"""
        def slope(y):
            if len(y) < 2:
                return 0
            x = np.arange(len(y))
            return np.polyfit(x, y, 1)[0]

        return series.rolling(window=window, min_periods=2).apply(slope, raw=False)

    def _calculate_days_since_maintenance(self, maintenance_df: pd.DataFrame) -> pd.DataFrame:
        """Calculate days since last maintenance for each well"""
        # Implementation details...
        pass

    def _calculate_maintenance_frequency(self, maintenance_df: pd.DataFrame,
                                        window: int = 90) -> pd.DataFrame:
        """Calculate maintenance frequency in rolling window"""
        # Implementation details...
        pass
```

#### Training Pipeline

```python
# apps/ml/src/training/train_maintenance.py
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import classification_report, roc_auc_score, precision_recall_curve
import joblib
from datetime import datetime, timedelta
from .feature_engineering import MaintenanceFeatureEngineer
from ..utils.db import get_db_connection

class MaintenanceModelTrainer:
    """Train predictive maintenance model"""

    def __init__(self, prediction_window: int = 14):
        """
        Args:
            prediction_window: Days ahead to predict failures (default 14)
        """
        self.prediction_window = prediction_window
        self.feature_engineer = MaintenanceFeatureEngineer()
        self.model = None
        self.feature_names = None

    def load_data(self, start_date: str, end_date: str) -> pd.DataFrame:
        """Load production, maintenance, and equipment data"""
        conn = get_db_connection()

        # Production data
        production_query = """
            SELECT
                well_id,
                date,
                oil_volume,
                gas_volume,
                water_volume,
                pressure,
                temperature
            FROM production_data
            WHERE date BETWEEN %s AND %s
            ORDER BY well_id, date
        """
        production_df = pd.read_sql(production_query, conn,
                                   params=(start_date, end_date))

        # Maintenance data
        maintenance_query = """
            SELECT
                well_id,
                maintenance_date,
                maintenance_type,
                is_failure
            FROM maintenance_records
            WHERE maintenance_date BETWEEN %s AND %s
        """
        maintenance_df = pd.read_sql(maintenance_query, conn,
                                     params=(start_date, end_date))

        # Equipment data
        equipment_query = """
            SELECT
                well_id,
                equipment_type,
                install_date,
                manufacturer
            FROM equipment
        """
        equipment_df = pd.read_sql(equipment_query, conn)

        conn.close()

        return production_df, maintenance_df, equipment_df

    def create_labels(self, df: pd.DataFrame,
                     maintenance_df: pd.DataFrame) -> pd.DataFrame:
        """
        Create binary labels: 1 if failure occurs within prediction_window days
        """
        df['failure_upcoming'] = 0

        for _, failure in maintenance_df[maintenance_df['is_failure']].iterrows():
            well_id = failure['well_id']
            failure_date = failure['maintenance_date']

            # Mark all dates within prediction_window before failure
            mask = (
                (df['well_id'] == well_id) &
                (df['date'] < failure_date) &
                (df['date'] >= failure_date - timedelta(days=self.prediction_window))
            )
            df.loc[mask, 'failure_upcoming'] = 1

        return df

    def train(self, start_date: str, end_date: str):
        """Train the model"""
        print(f"Loading data from {start_date} to {end_date}...")
        production_df, maintenance_df, equipment_df = self.load_data(start_date, end_date)

        print("Engineering features...")
        df = self.feature_engineer.create_features(
            production_df, maintenance_df, equipment_df
        )

        print("Creating labels...")
        df = self.create_labels(df, maintenance_df)

        # Remove rows with NaN
        df = df.dropna()

        # Select features
        feature_cols = [col for col in df.columns if col not in [
            'well_id', 'date', 'failure_upcoming'
        ]]
        self.feature_names = feature_cols

        X = df[feature_cols]
        y = df['failure_upcoming']

        print(f"Dataset shape: {X.shape}")
        print(f"Failure rate: {y.mean():.2%}")

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # Handle class imbalance with class weights
        print("Training Random Forest with GridSearchCV...")
        param_grid = {
            'n_estimators': [100, 200],
            'max_depth': [10, 20, None],
            'min_samples_split': [2, 5],
            'min_samples_leaf': [1, 2],
            'class_weight': ['balanced', 'balanced_subsample']
        }

        rf = RandomForestClassifier(random_state=42, n_jobs=-1)
        grid_search = GridSearchCV(
            rf, param_grid, cv=5, scoring='roc_auc', n_jobs=-1, verbose=2
        )
        grid_search.fit(X_train, y_train)

        self.model = grid_search.best_estimator_
        print(f"Best parameters: {grid_search.best_params_}")

        # Evaluate
        y_pred = self.model.predict(X_test)
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]

        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        print(f"ROC-AUC Score: {roc_auc_score(y_test, y_pred_proba):.4f}")

        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': feature_cols,
            'importance': self.model.feature_importances_
        }).sort_values('importance', ascending=False)

        print("\nTop 10 Features:")
        print(feature_importance.head(10))

        return self.model, feature_importance

    def save_model(self, path: str):
        """Save trained model"""
        joblib.dump({
            'model': self.model,
            'feature_names': self.feature_names,
            'prediction_window': self.prediction_window
        }, path)
        print(f"Model saved to {path}")

    @staticmethod
    def load_model(path: str):
        """Load trained model"""
        return joblib.load(path)
```

#### Model Serving

```python
# apps/ml/src/models/predictive_maintenance.py
import pandas as pd
import numpy as np
from typing import Dict, List
import joblib
from datetime import datetime, timedelta
from ..utils.db import get_db_connection
from ..training.feature_engineering import MaintenanceFeatureEngineer

class PredictiveMaintenanceModel:
    """Serve predictive maintenance predictions"""

    def __init__(self, model_path: str):
        self.model_data = joblib.load(model_path)
        self.model = self.model_data['model']
        self.feature_names = self.model_data['feature_names']
        self.prediction_window = self.model_data['prediction_window']
        self.feature_engineer = MaintenanceFeatureEngineer()

    async def predict(self, well_id: str, tenant_id: str) -> Dict:
        """
        Predict failure probability for a well

        Returns:
            {
                'well_id': str,
                'failure_probability': float,
                'risk_level': str,  # 'low', 'medium', 'high', 'critical'
                'predicted_failure_date': str | None,
                'confidence': float,
                'top_factors': List[Dict]
            }
        """
        # Load recent production data
        df = await self._load_well_data(well_id, tenant_id)

        if df.empty:
            raise ValueError(f"No data found for well {well_id}")

        # Engineer features
        df_features = self.feature_engineer.create_features(
            df['production'], df['maintenance'], df['equipment']
        )

        # Get latest record
        latest = df_features.iloc[-1]
        X = latest[self.feature_names].values.reshape(1, -1)

        # Predict
        failure_prob = self.model.predict_proba(X)[0, 1]

        # Risk level
        risk_level = self._calculate_risk_level(failure_prob)

        # Predicted failure date (if high risk)
        predicted_date = None
        if failure_prob > 0.5:
            days_ahead = int(self.prediction_window * (1 - failure_prob))
            predicted_date = (datetime.now() + timedelta(days=days_ahead)).isoformat()

        # Top contributing factors
        feature_importance = self.model.feature_importances_
        top_factors = self._get_top_factors(
            latest[self.feature_names],
            feature_importance
        )

        return {
            'well_id': well_id,
            'failure_probability': float(failure_prob),
            'risk_level': risk_level,
            'predicted_failure_date': predicted_date,
            'confidence': float(1 - abs(failure_prob - 0.5) * 2),  # Higher at extremes
            'top_factors': top_factors,
            'last_updated': datetime.now().isoformat()
        }

    async def predict_batch(self, tenant_id: str) -> List[Dict]:
        """Predict for all wells in tenant"""
        conn = get_db_connection()
        wells_query = "SELECT id FROM wells WHERE tenant_id = %s AND deleted_at IS NULL"
        wells_df = pd.read_sql(wells_query, conn, params=(tenant_id,))
        conn.close()

        predictions = []
        for well_id in wells_df['id']:
            try:
                pred = await self.predict(well_id, tenant_id)
                predictions.append(pred)
            except Exception as e:
                print(f"Error predicting for well {well_id}: {e}")

        return predictions

    def _calculate_risk_level(self, probability: float) -> str:
        """Map probability to risk level"""
        if probability < 0.25:
            return 'low'
        elif probability < 0.50:
            return 'medium'
        elif probability < 0.75:
            return 'high'
        else:
            return 'critical'

    def _get_top_factors(self, features: pd.Series,
                        importance: np.ndarray, top_n: int = 5) -> List[Dict]:
        """Get top contributing factors"""
        importance_df = pd.DataFrame({
            'factor': features.index,
            'value': features.values,
            'importance': importance
        }).sort_values('importance', ascending=False).head(top_n)

        return importance_df.to_dict('records')

    async def _load_well_data(self, well_id: str, tenant_id: str) -> Dict:
        """Load production, maintenance, and equipment data for well"""
        # Implementation...
        pass
```

#### API Endpoint

```python
# apps/ml/src/api/predictions.py
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import List, Optional
from ..models.predictive_maintenance import PredictiveMaintenanceModel
from ..services import prediction_service

router = APIRouter()

class PredictionRequest(BaseModel):
    well_id: str
    tenant_id: str

class PredictionResponse(BaseModel):
    well_id: str
    failure_probability: float
    risk_level: str
    predicted_failure_date: Optional[str]
    confidence: float
    top_factors: List[dict]
    last_updated: str

@router.post("/maintenance", response_model=PredictionResponse)
async def predict_maintenance(
    request: PredictionRequest,
    x_api_key: str = Header(..., alias="X-API-Key")
):
    """Predict equipment failure for a well"""
    # Validate API key
    if x_api_key != prediction_service.settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        model = prediction_service.get_model('maintenance')
        prediction = await model.predict(request.well_id, request.tenant_id)
        return prediction
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@router.post("/maintenance/batch", response_model=List[PredictionResponse])
async def predict_maintenance_batch(
    tenant_id: str,
    x_api_key: str = Header(..., alias="X-API-Key")
):
    """Predict equipment failures for all wells in tenant"""
    if x_api_key != prediction_service.settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        model = prediction_service.get_model('maintenance')
        predictions = await model.predict_batch(tenant_id)
        return predictions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")
```

### 9.3 ML Use Case 2: Production Optimization

**Goal**: Identify underperforming wells and recommend optimization strategies.

```python
# apps/ml/src/models/production_optimizer.py
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from typing import Dict, List
import joblib

class ProductionOptimizerModel:
    """Identify underperforming wells and optimization opportunities"""

    def __init__(self, model_path: str):
        self.model_data = joblib.load(model_path)
        self.model = self.model_data['model']
        self.feature_names = self.model_data['feature_names']

    async def analyze_well(self, well_id: str, tenant_id: str) -> Dict:
        """
        Analyze well performance and recommend optimizations

        Returns:
            {
                'well_id': str,
                'actual_production': float,
                'predicted_production': float,
                'performance_gap': float,  # percentage
                'performance_category': str,  # 'overperforming', 'on_target', 'underperforming'
                'optimization_opportunities': List[Dict],
                'estimated_uplift': float  # barrels/day
            }
        """
        # Load well data
        df = await self._load_well_data(well_id, tenant_id)

        # Engineer features
        X = self._create_features(df)

        # Predict optimal production
        predicted_production = self.model.predict(X)[0]
        actual_production = df['oil_volume'].iloc[-30:].mean()  # 30-day avg

        # Calculate gap
        performance_gap = ((actual_production - predicted_production) / predicted_production) * 100

        # Categorize
        if performance_gap > 10:
            category = 'overperforming'
        elif performance_gap < -10:
            category = 'underperforming'
        else:
            category = 'on_target'

        # Find optimization opportunities
        opportunities = await self._find_opportunities(df, predicted_production, actual_production)

        # Estimate potential uplift
        estimated_uplift = max(0, predicted_production - actual_production)

        return {
            'well_id': well_id,
            'actual_production': float(actual_production),
            'predicted_production': float(predicted_production),
            'performance_gap': float(performance_gap),
            'performance_category': category,
            'optimization_opportunities': opportunities,
            'estimated_uplift': float(estimated_uplift)
        }

    async def _find_opportunities(self, df: pd.DataFrame,
                                 predicted: float, actual: float) -> List[Dict]:
        """Identify specific optimization opportunities"""
        opportunities = []

        # Check gas-oil ratio
        gor = df['gas_volume'].iloc[-30:].mean() / (df['oil_volume'].iloc[-30:].mean() + 1e-6)
        if gor > 1500:  # High GOR indicates gas interference
            opportunities.append({
                'type': 'gas_lift_optimization',
                'severity': 'high',
                'description': 'High gas-oil ratio detected. Consider gas lift optimization.',
                'expected_impact': '5-15% production increase'
            })

        # Check water cut
        water_cut = df['water_volume'].iloc[-30:].mean() / (
            df['oil_volume'].iloc[-30:].mean() + df['water_volume'].iloc[-30:].mean() + 1e-6
        )
        if water_cut > 0.7:
            opportunities.append({
                'type': 'water_management',
                'severity': 'high',
                'description': f'High water cut ({water_cut:.1%}). Consider water shutoff treatment.',
                'expected_impact': '10-20% production increase'
            })

        # Check pressure decline
        pressure_trend = np.polyfit(range(30), df['pressure'].iloc[-30:].values, 1)[0]
        if pressure_trend < -5:  # Declining >5 psi/day
            opportunities.append({
                'type': 'pressure_maintenance',
                'severity': 'medium',
                'description': 'Rapid pressure decline detected. Consider injection or artificial lift.',
                'expected_impact': '15-25% production increase'
            })

        # Check production consistency
        cv = df['oil_volume'].iloc[-30:].std() / (df['oil_volume'].iloc[-30:].mean() + 1e-6)
        if cv > 0.3:
            opportunities.append({
                'type': 'operational_consistency',
                'severity': 'low',
                'description': 'High production volatility. Review operational procedures.',
                'expected_impact': '5-10% production increase'
            })

        return opportunities
```

### 9.4 ML Use Case 3: Anomaly Detection

**Goal**: Detect unusual production patterns that may indicate leaks, theft, or equipment issues.

```python
# apps/ml/src/models/anomaly_detector.py
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
from typing import Dict, List
import joblib

class AnomalyDetectorModel:
    """Detect anomalies in production data"""

    def __init__(self, model_path: str):
        self.model_data = joblib.load(model_path)
        self.model = self.model_data['model']
        self.scaler = self.model_data['scaler']
        self.feature_names = self.model_data['feature_names']

    async def detect_anomalies(self, well_id: str, tenant_id: str,
                              days: int = 30) -> Dict:
        """
        Detect anomalies in recent production data

        Returns:
            {
                'well_id': str,
                'anomalies_detected': int,
                'anomaly_dates': List[str],
                'anomaly_scores': List[float],
                'anomaly_types': List[Dict],
                'severity': str  # 'none', 'low', 'medium', 'high'
            }
        """
        # Load data
        df = await self._load_well_data(well_id, tenant_id, days)

        # Create features
        X = self._create_features(df)
        X_scaled = self.scaler.transform(X)

        # Detect anomalies
        predictions = self.model.predict(X_scaled)  # -1 for anomalies, 1 for normal
        anomaly_scores = self.model.score_samples(X_scaled)  # Lower = more anomalous

        # Filter anomalies
        anomaly_mask = predictions == -1
        anomaly_dates = df.loc[anomaly_mask, 'date'].dt.strftime('%Y-%m-%d').tolist()
        anomaly_scores_list = anomaly_scores[anomaly_mask].tolist()

        # Classify anomaly types
        anomaly_types = await self._classify_anomalies(df[anomaly_mask])

        # Calculate severity
        severity = self._calculate_severity(len(anomaly_dates), anomaly_scores_list)

        return {
            'well_id': well_id,
            'anomalies_detected': len(anomaly_dates),
            'anomaly_dates': anomaly_dates,
            'anomaly_scores': [float(s) for s in anomaly_scores_list],
            'anomaly_types': anomaly_types,
            'severity': severity
        }

    async def _classify_anomalies(self, anomaly_df: pd.DataFrame) -> List[Dict]:
        """Classify types of anomalies"""
        types = []

        for _, row in anomaly_df.iterrows():
            anomaly_type = {
                'date': row['date'].strftime('%Y-%m-%d'),
                'categories': []
            }

            # Production drop
            if row['oil_volume'] < row['oil_mean_30d'] * 0.5:
                anomaly_type['categories'].append({
                    'type': 'production_drop',
                    'description': f"Oil production dropped to {row['oil_volume']:.0f} bbl (50% below average)",
                    'severity': 'high'
                })

            # Unexpected spike
            if row['oil_volume'] > row['oil_mean_30d'] * 2:
                anomaly_type['categories'].append({
                    'type': 'production_spike',
                    'description': f"Unusual oil production spike to {row['oil_volume']:.0f} bbl",
                    'severity': 'medium'
                })

            # Pressure anomaly
            if abs(row['pressure_zscore']) > 3:
                anomaly_type['categories'].append({
                    'type': 'pressure_anomaly',
                    'description': f"Abnormal pressure: {row['pressure']:.0f} psi (Z-score: {row['pressure_zscore']:.1f})",
                    'severity': 'high'
                })

            # Water cut spike (potential leak)
            water_cut = row['water_volume'] / (row['oil_volume'] + row['water_volume'] + 1e-6)
            if water_cut > 0.9:
                anomaly_type['categories'].append({
                    'type': 'water_cut_spike',
                    'description': f"Extremely high water cut: {water_cut:.1%}. Possible leak or equipment issue.",
                    'severity': 'critical'
                })

            types.append(anomaly_type)

        return types

    def _calculate_severity(self, count: int, scores: List[float]) -> str:
        """Calculate overall anomaly severity"""
        if count == 0:
            return 'none'

        avg_score = np.mean(scores) if scores else 0

        if count > 5 or avg_score < -0.5:
            return 'high'
        elif count > 2 or avg_score < -0.3:
            return 'medium'
        else:
            return 'low'
```

### 9.5 ML Use Case 4: Decline Curve Analysis

**Goal**: Forecast future production using decline curve models (Arps equations).

```python
# apps/ml/src/models/decline_curve.py
import pandas as pd
import numpy as np
from scipy.optimize import curve_fit
from typing import Dict, List
import joblib

class DeclineCurveModel:
    """Production forecasting using decline curve analysis"""

    def __init__(self):
        pass

    async def forecast(self, well_id: str, tenant_id: str,
                      forecast_months: int = 12) -> Dict:
        """
        Forecast production using Arps decline curves

        Arps equation: q(t) = q_i / (1 + b * D_i * t)^(1/b)
        - q(t): Production rate at time t
        - q_i: Initial production rate
        - D_i: Initial decline rate
        - b: Decline exponent (0=exponential, 0<b<1=hyperbolic, b=1=harmonic)

        Returns:
            {
                'well_id': str,
                'model_type': str,  # 'exponential', 'hyperbolic', 'harmonic'
                'parameters': Dict,
                'forecast': List[Dict],  # [{month, oil_forecast, p10, p50, p90}]
                'eur': float,  # Estimated Ultimate Recovery
                'decline_rate': float
            }
        """
        # Load historical production
        df = await self._load_production_history(well_id, tenant_id)

        if len(df) < 6:
            raise ValueError("Insufficient production history (minimum 6 months required)")

        # Prepare data
        t = np.arange(len(df))  # Time in months
        q = df['oil_volume'].values  # Production rate

        # Fit decline curve models
        models = self._fit_models(t, q)

        # Select best model (lowest RMSE)
        best_model = min(models, key=lambda m: m['rmse'])

        # Generate forecast
        t_forecast = np.arange(len(df), len(df) + forecast_months)
        q_forecast = best_model['func'](t_forecast, *best_model['params'])

        # Monte Carlo simulation for P10/P50/P90
        forecast_with_uncertainty = self._monte_carlo_forecast(
            t_forecast, best_model, n_simulations=1000
        )

        # Calculate EUR
        eur = self._calculate_eur(best_model, economic_limit=10)  # 10 bbl/month cutoff

        return {
            'well_id': well_id,
            'model_type': best_model['type'],
            'parameters': best_model['params_dict'],
            'forecast': forecast_with_uncertainty,
            'eur': float(eur),
            'decline_rate': float(best_model['params_dict']['Di']),
            'r_squared': float(best_model['r_squared'])
        }

    def _fit_models(self, t: np.ndarray, q: np.ndarray) -> List[Dict]:
        """Fit exponential, hyperbolic, and harmonic models"""
        models = []

        # 1. Exponential decline (b = 0)
        def exponential(t, qi, Di):
            return qi * np.exp(-Di * t)

        try:
            params_exp, _ = curve_fit(exponential, t, q, p0=[q[0], 0.05], maxfev=10000)
            q_pred = exponential(t, *params_exp)
            rmse = np.sqrt(np.mean((q - q_pred) ** 2))
            r_squared = 1 - (np.sum((q - q_pred) ** 2) / np.sum((q - np.mean(q)) ** 2))

            models.append({
                'type': 'exponential',
                'func': exponential,
                'params': params_exp,
                'params_dict': {'qi': params_exp[0], 'Di': params_exp[1], 'b': 0},
                'rmse': rmse,
                'r_squared': r_squared
            })
        except:
            pass

        # 2. Hyperbolic decline (0 < b < 1)
        def hyperbolic(t, qi, Di, b):
            return qi / ((1 + b * Di * t) ** (1 / b))

        try:
            params_hyp, _ = curve_fit(hyperbolic, t, q,
                                     p0=[q[0], 0.05, 0.5],
                                     bounds=([0, 0, 0], [np.inf, 1, 1]),
                                     maxfev=10000)
            q_pred = hyperbolic(t, *params_hyp)
            rmse = np.sqrt(np.mean((q - q_pred) ** 2))
            r_squared = 1 - (np.sum((q - q_pred) ** 2) / np.sum((q - np.mean(q)) ** 2))

            models.append({
                'type': 'hyperbolic',
                'func': hyperbolic,
                'params': params_hyp,
                'params_dict': {'qi': params_hyp[0], 'Di': params_hyp[1], 'b': params_hyp[2]},
                'rmse': rmse,
                'r_squared': r_squared
            })
        except:
            pass

        # 3. Harmonic decline (b = 1)
        def harmonic(t, qi, Di):
            return qi / (1 + Di * t)

        try:
            params_harm, _ = curve_fit(harmonic, t, q, p0=[q[0], 0.05], maxfev=10000)
            q_pred = harmonic(t, *params_harm)
            rmse = np.sqrt(np.mean((q - q_pred) ** 2))
            r_squared = 1 - (np.sum((q - q_pred) ** 2) / np.sum((q - np.mean(q)) ** 2))

            models.append({
                'type': 'harmonic',
                'func': harmonic,
                'params': params_harm,
                'params_dict': {'qi': params_harm[0], 'Di': params_harm[1], 'b': 1},
                'rmse': rmse,
                'r_squared': r_squared
            })
        except:
            pass

        return models

    def _monte_carlo_forecast(self, t: np.ndarray, model: Dict,
                             n_simulations: int = 1000) -> List[Dict]:
        """Monte Carlo simulation for forecast uncertainty"""
        forecasts = []

        # Add noise to parameters (±10%)
        for _ in range(n_simulations):
            noisy_params = [
                p * np.random.normal(1.0, 0.1) for p in model['params']
            ]
            q_sim = model['func'](t, *noisy_params)
            forecasts.append(q_sim)

        forecasts = np.array(forecasts)

        # Calculate percentiles
        result = []
        for i, month in enumerate(t):
            result.append({
                'month': int(month),
                'oil_forecast': float(np.median(forecasts[:, i])),  # P50
                'p10': float(np.percentile(forecasts[:, i], 10)),
                'p50': float(np.percentile(forecasts[:, i], 50)),
                'p90': float(np.percentile(forecasts[:, i], 90))
            })

        return result

    def _calculate_eur(self, model: Dict, economic_limit: float = 10) -> float:
        """Calculate Estimated Ultimate Recovery (EUR)"""
        # Forecast until economic limit
        t = 0
        eur = 0
        while True:
            q = model['func'](t, *model['params'])
            if q < economic_limit:
                break
            eur += q
            t += 1
            if t > 600:  # Max 50 years
                break

        return eur
```

### 9.6 ML Use Case 5: Emissions Prediction

**Goal**: Predict methane and CO2 emissions for ESG compliance.

```python
# apps/ml/src/models/emissions_predictor.py
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from typing import Dict
import joblib

class EmissionsPredictorModel:
    """Predict emissions based on production data"""

    def __init__(self, model_path: str):
        self.model_data = joblib.load(model_path)
        self.ch4_model = self.model_data['ch4_model']
        self.co2_model = self.model_data['co2_model']
        self.feature_names = self.model_data['feature_names']

    async def predict_emissions(self, well_id: str, tenant_id: str,
                               forecast_days: int = 30) -> Dict:
        """
        Predict CH4 and CO2 emissions

        Features:
        - Oil/gas production volumes
        - Flaring activity
        - Equipment type
        - Well age
        - Historical emissions

        Returns:
            {
                'well_id': str,
                'forecast_start_date': str,
                'forecast_end_date': str,
                'ch4_emissions_kg': float,
                'co2_emissions_kg': float,
                'methane_intensity': float,  # kg CH4 per BOE
                'co2_intensity': float,  # kg CO2 per BOE
                'compliance_status': str
            }
        """
        # Load data
        df = await self._load_well_data(well_id, tenant_id)

        # Create features
        X = self._create_features(df)

        # Predict daily emissions
        ch4_daily = self.ch4_model.predict(X)
        co2_daily = self.co2_model.predict(X)

        # Sum over forecast period
        ch4_total = np.sum(ch4_daily[-forecast_days:])
        co2_total = np.sum(co2_daily[-forecast_days:])

        # Calculate intensities
        total_boe = df['oil_volume'].iloc[-forecast_days:].sum() + \
                   (df['gas_volume'].iloc[-forecast_days:].sum() / 6)  # 6 Mcf = 1 BOE

        methane_intensity = ch4_total / (total_boe + 1e-6)
        co2_intensity = co2_total / (total_boe + 1e-6)

        # Check compliance (EPA target: <0.2% methane intensity)
        compliance_status = 'compliant' if methane_intensity < 2.0 else 'non_compliant'

        return {
            'well_id': well_id,
            'forecast_start_date': df['date'].iloc[-forecast_days].strftime('%Y-%m-%d'),
            'forecast_end_date': df['date'].iloc[-1].strftime('%Y-%m-%d'),
            'ch4_emissions_kg': float(ch4_total),
            'co2_emissions_kg': float(co2_total),
            'methane_intensity': float(methane_intensity),
            'co2_intensity': float(co2_intensity),
            'compliance_status': compliance_status
        }
```

### 9.7 ESG Compliance Module

#### Emissions Calculations (EPA Emission Factors)

```python
# apps/ml/src/services/esg_service.py
import pandas as pd
import numpy as np
from typing import Dict, List
from datetime import datetime, timedelta
from ..utils.db import get_db_connection

class ESGService:
    """ESG emissions calculations and compliance reporting"""

    # EPA emission factors (kg/Mcf for natural gas)
    EMISSION_FACTORS = {
        'flaring': {
            'ch4': 0.0054,  # kg CH4 per Mcf flared
            'co2': 53.06    # kg CO2 per Mcf flared
        },
        'venting': {
            'ch4': 19.36,   # kg CH4 per Mcf vented (100% methane)
            'co2': 0.0
        },
        'fugitive': {
            'ch4': 0.016,   # kg CH4 per component per year
            'co2': 0.0
        },
        'combustion': {
            'ch4': 0.001,   # kg CH4 per Mcf burned (engines)
            'co2': 53.06
        }
    }

    async def calculate_emissions(self, well_id: str, tenant_id: str,
                                 start_date: str, end_date: str) -> Dict:
        """
        Calculate total emissions by source

        Returns:
            {
                'well_id': str,
                'period': {'start': str, 'end': str},
                'emissions': {
                    'flaring': {'ch4': float, 'co2': float, 'co2e': float},
                    'venting': {...},
                    'fugitive': {...},
                    'combustion': {...},
                    'total': {'ch4': float, 'co2': float, 'co2e': float}
                },
                'intensities': {
                    'methane_intensity': float,  # kg CH4 per BOE
                    'carbon_intensity': float    # kg CO2e per BOE
                },
                'production': {
                    'oil_bbl': float,
                    'gas_mcf': float,
                    'total_boe': float
                }
            }
        """
        conn = get_db_connection()

        # Load production data
        prod_query = """
            SELECT
                date,
                oil_volume,
                gas_volume,
                flared_gas,
                vented_gas
            FROM production_data
            WHERE well_id = %s AND tenant_id = %s
            AND date BETWEEN %s AND %s
            ORDER BY date
        """
        prod_df = pd.read_sql(prod_query, conn,
                             params=(well_id, tenant_id, start_date, end_date))

        # Load equipment data (for fugitive emissions)
        equip_query = """
            SELECT
                component_type,
                component_count
            FROM well_equipment
            WHERE well_id = %s AND tenant_id = %s
        """
        equip_df = pd.read_sql(equip_query, conn, params=(well_id, tenant_id))

        conn.close()

        if prod_df.empty:
            raise ValueError(f"No production data for well {well_id}")

        # Calculate emissions by source
        emissions = {
            'flaring': self._calculate_flaring_emissions(prod_df),
            'venting': self._calculate_venting_emissions(prod_df),
            'fugitive': self._calculate_fugitive_emissions(equip_df,
                                                          len(prod_df)),
            'combustion': self._calculate_combustion_emissions(prod_df)
        }

        # Total emissions
        total_ch4 = sum(e['ch4'] for e in emissions.values())
        total_co2 = sum(e['co2'] for e in emissions.values())
        total_co2e = sum(e['co2e'] for e in emissions.values())

        emissions['total'] = {
            'ch4': total_ch4,
            'co2': total_co2,
            'co2e': total_co2e
        }

        # Production totals
        total_oil = prod_df['oil_volume'].sum()
        total_gas = prod_df['gas_volume'].sum()
        total_boe = total_oil + (total_gas / 6)  # 6 Mcf = 1 BOE

        # Intensities
        methane_intensity = total_ch4 / (total_boe + 1e-6)
        carbon_intensity = total_co2e / (total_boe + 1e-6)

        return {
            'well_id': well_id,
            'period': {
                'start': start_date,
                'end': end_date
            },
            'emissions': emissions,
            'intensities': {
                'methane_intensity': float(methane_intensity),
                'carbon_intensity': float(carbon_intensity)
            },
            'production': {
                'oil_bbl': float(total_oil),
                'gas_mcf': float(total_gas),
                'total_boe': float(total_boe)
            }
        }

    def _calculate_flaring_emissions(self, df: pd.DataFrame) -> Dict:
        """Calculate flaring emissions"""
        total_flared = df['flared_gas'].sum()  # Mcf

        ch4 = total_flared * self.EMISSION_FACTORS['flaring']['ch4']
        co2 = total_flared * self.EMISSION_FACTORS['flaring']['co2']
        co2e = (ch4 * 25) + co2  # CH4 GWP = 25 (100-year horizon)

        return {
            'ch4': float(ch4),
            'co2': float(co2),
            'co2e': float(co2e),
            'source_volume_mcf': float(total_flared)
        }

    def _calculate_venting_emissions(self, df: pd.DataFrame) -> Dict:
        """Calculate venting emissions"""
        total_vented = df['vented_gas'].sum()  # Mcf

        ch4 = total_vented * self.EMISSION_FACTORS['venting']['ch4']
        co2 = total_vented * self.EMISSION_FACTORS['venting']['co2']
        co2e = (ch4 * 25) + co2

        return {
            'ch4': float(ch4),
            'co2': float(co2),
            'co2e': float(co2e),
            'source_volume_mcf': float(total_vented)
        }

    def _calculate_fugitive_emissions(self, equip_df: pd.DataFrame,
                                     days: int) -> Dict:
        """Calculate fugitive emissions from equipment"""
        # Annual emission factor * (days / 365) * component count
        total_ch4 = 0

        for _, row in equip_df.iterrows():
            ch4_annual = self.EMISSION_FACTORS['fugitive']['ch4'] * row['component_count']
            ch4_period = ch4_annual * (days / 365)
            total_ch4 += ch4_period

        co2 = 0  # Fugitive emissions are primarily methane
        co2e = total_ch4 * 25

        return {
            'ch4': float(total_ch4),
            'co2': float(co2),
            'co2e': float(co2e),
            'component_count': int(equip_df['component_count'].sum())
        }

    def _calculate_combustion_emissions(self, df: pd.DataFrame) -> Dict:
        """Calculate combustion emissions (engines, heaters)"""
        # Assume 5% of gas production is used for combustion
        total_combusted = df['gas_volume'].sum() * 0.05

        ch4 = total_combusted * self.EMISSION_FACTORS['combustion']['ch4']
        co2 = total_combusted * self.EMISSION_FACTORS['combustion']['co2']
        co2e = (ch4 * 25) + co2

        return {
            'ch4': float(ch4),
            'co2': float(co2),
            'co2e': float(co2e),
            'source_volume_mcf': float(total_combusted)
        }

    async def generate_regulatory_report(self, tenant_id: str,
                                        report_type: str,
                                        year: int) -> Dict:
        """
        Generate regulatory reports

        Args:
            report_type: 'texas_rrc' or 'new_mexico_ocd'
            year: Reporting year

        Returns formatted report data
        """
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        conn = get_db_connection()
        wells_query = "SELECT id FROM wells WHERE tenant_id = %s AND deleted_at IS NULL"
        wells_df = pd.read_sql(wells_query, conn, params=(tenant_id,))
        conn.close()

        # Calculate emissions for all wells
        well_emissions = []
        for well_id in wells_df['id']:
            try:
                emissions = await self.calculate_emissions(
                    well_id, tenant_id, start_date, end_date
                )
                well_emissions.append(emissions)
            except Exception as e:
                print(f"Error calculating emissions for well {well_id}: {e}")

        # Format report
        if report_type == 'texas_rrc':
            return self._format_texas_rrc_report(well_emissions, year)
        elif report_type == 'new_mexico_ocd':
            return self._format_new_mexico_ocd_report(well_emissions, year)
        else:
            raise ValueError(f"Unknown report type: {report_type}")

    def _format_texas_rrc_report(self, well_emissions: List[Dict],
                                year: int) -> Dict:
        """Format Texas RRC emissions report"""
        total_ch4 = sum(e['emissions']['total']['ch4'] for e in well_emissions)
        total_co2 = sum(e['emissions']['total']['co2'] for e in well_emissions)
        total_flared = sum(e['emissions']['flaring']['source_volume_mcf']
                          for e in well_emissions)

        return {
            'report_type': 'Texas Railroad Commission Annual Emissions Report',
            'year': year,
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_wells': len(well_emissions),
                'total_ch4_kg': float(total_ch4),
                'total_co2_kg': float(total_co2),
                'total_flared_mcf': float(total_flared),
                'total_co2e_metric_tons': float((total_ch4 * 25 + total_co2) / 1000)
            },
            'wells': [
                {
                    'well_id': e['well_id'],
                    'ch4_emissions_kg': e['emissions']['total']['ch4'],
                    'co2_emissions_kg': e['emissions']['total']['co2'],
                    'flared_gas_mcf': e['emissions']['flaring']['source_volume_mcf'],
                    'vented_gas_mcf': e['emissions']['venting']['source_volume_mcf'],
                    'methane_intensity': e['intensities']['methane_intensity']
                }
                for e in well_emissions
            ]
        }

    def _format_new_mexico_ocd_report(self, well_emissions: List[Dict],
                                     year: int) -> Dict:
        """Format New Mexico OCD emissions report"""
        # Similar to Texas but with different format requirements
        # Implementation details...
        pass
```

#### ESG Dashboard Frontend

```typescript
// apps/web/app/(dashboard)/esg/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, LineChart } from '@/components/charts';
import { esgRepository } from '@/lib/repositories/esg-repository';

export default function ESGDashboardPage() {
  const { data: emissions, isLoading } = useQuery({
    queryKey: ['esg', 'emissions', 'summary'],
    queryFn: () => esgRepository.getEmissionsSummary()
  });

  const { data: compliance } = useQuery({
    queryKey: ['esg', 'compliance', 'status'],
    queryFn: () => esgRepository.getComplianceStatus()
  });

  if (isLoading) return <div>Loading ESG data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">ESG Compliance</h1>
        <Badge variant={compliance?.status === 'compliant' ? 'success' : 'destructive'}>
          {compliance?.status}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>CH4 Emissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {emissions?.total_ch4_kg.toLocaleString()} kg
            </div>
            <p className="text-sm text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CO2 Emissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {emissions?.total_co2_kg.toLocaleString()} kg
            </div>
            <p className="text-sm text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Methane Intensity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {emissions?.methane_intensity.toFixed(2)} kg/BOE
            </div>
            <p className="text-sm text-muted-foreground">
              Target: &lt; 2.0 kg/BOE
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CO2e (Total)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(emissions?.total_co2e_metric_tons || 0).toFixed(1)} MT
            </div>
            <p className="text-sm text-muted-foreground">Metric tons</p>
          </CardContent>
        </Card>
      </div>

      {/* Emissions Breakdown */}
      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">By Source</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="wells">By Well</TabsTrigger>
          <TabsTrigger value="reports">Regulatory Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle>Emissions by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                data={[
                  { name: 'Flaring', ch4: emissions?.flaring_ch4, co2: emissions?.flaring_co2 },
                  { name: 'Venting', ch4: emissions?.venting_ch4, co2: emissions?.venting_co2 },
                  { name: 'Fugitive', ch4: emissions?.fugitive_ch4, co2: emissions?.fugitive_co2 },
                  { name: 'Combustion', ch4: emissions?.combustion_ch4, co2: emissions?.combustion_co2 }
                ]}
                xKey="name"
                yKeys={['ch4', 'co2']}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          {/* Monthly trends chart */}
        </TabsContent>

        <TabsContent value="wells">
          {/* Well-by-well breakdown */}
        </TabsContent>

        <TabsContent value="reports">
          {/* Regulatory reports download */}
        </TabsContent>
      </Tabs>

      {/* Compliance Alerts */}
      {compliance?.alerts?.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Compliance Alerts</h2>
          {compliance.alerts.map((alert: any) => (
            <Alert key={alert.id} variant={alert.severity}>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Sprint 10: Admin Portal & Production Launch

**Duration**: Weeks 21-24
**Focus**: Multi-tenant admin portal, billing integration, production deployment

### 10.1 Admin Portal Setup

```bash
# Create admin app
cd apps
npx create-next-app@latest admin --typescript --tailwind --app --no-src-dir
cd admin

# Install dependencies
pnpm add @tanstack/react-query @tanstack/react-query-devtools
pnpm add zustand
pnpm add zod
pnpm add date-fns
pnpm add recharts
pnpm add lucide-react
pnpm add stripe
pnpm add @stripe/stripe-js
```

#### Directory Structure

```
apps/admin/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── tenants/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── usage/page.tsx
│   │   │   │   └── billing/page.tsx
│   │   │   └── new/page.tsx
│   │   ├── billing/
│   │   ├── analytics/
│   │   ├── support/
│   │   └── layout.tsx
│   ├── api/
│   │   └── webhooks/
│   │       └── stripe/route.ts
│   └── layout.tsx
├── components/
│   ├── tenants/
│   ├── billing/
│   ├── analytics/
│   └── ui/
├── lib/
│   ├── repositories/
│   ├── hooks/
│   └── utils/
└── package.json
```

### 10.2 Tenant Management

#### Backend: Tenant Provisioning

```typescript
// apps/api/src/application/tenants/commands/create-tenant.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantRepository } from '@/domain/repositories/tenant.repository';
import { DatabaseRepository } from '@/domain/repositories/database.repository';
import { Tenant } from '@/domain/tenants/tenant.entity';

export class CreateTenantCommand {
  constructor(
    public readonly name: string,
    public readonly subdomain: string,
    public readonly adminEmail: string,
    public readonly plan: 'starter' | 'professional' | 'enterprise'
  ) {}
}

@CommandHandler(CreateTenantCommand)
@Injectable()
export class CreateTenantHandler implements ICommandHandler<CreateTenantCommand> {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly databaseRepo: DatabaseRepository,
    private readonly dataSource: DataSource
  ) {}

  async execute(command: CreateTenantCommand): Promise<Tenant> {
    // 1. Create tenant record
    const tenant = await this.tenantRepo.create({
      name: command.name,
      subdomain: command.subdomain,
      plan: command.plan,
      status: 'provisioning'
    });

    try {
      // 2. Create tenant database schema
      await this.databaseRepo.createSchema(tenant.id);

      // 3. Run migrations for tenant schema
      await this.databaseRepo.runMigrations(tenant.id);

      // 4. Seed initial data
      await this.seedTenantData(tenant.id, command.adminEmail);

      // 5. Update tenant status
      tenant.status = 'active';
      await this.tenantRepo.update(tenant);

      // 6. Send welcome email
      // await this.emailService.sendWelcomeEmail(command.adminEmail, tenant);

      return tenant;
    } catch (error) {
      // Rollback on failure
      tenant.status = 'failed';
      await this.tenantRepo.update(tenant);
      throw error;
    }
  }

  private async seedTenantData(tenantId: string, adminEmail: string) {
    // Create admin user
    // Create default roles
    // Create sample data (optional)
  }
}
```

```typescript
// apps/api/src/infrastructure/database/database.repository.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabaseRepository as IDatabaseRepository } from '@/domain/repositories/database.repository';

@Injectable()
export class DatabaseRepository implements IDatabaseRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createSchema(tenantId: string): Promise<void> {
    const schemaName = `tenant_${tenantId}`;
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  }

  async runMigrations(tenantId: string): Promise<void> {
    const schemaName = `tenant_${tenantId}`;

    // Set search path to tenant schema
    await this.dataSource.query(`SET search_path TO "${schemaName}"`);

    // Run migrations
    await this.dataSource.runMigrations();

    // Reset search path
    await this.dataSource.query('RESET search_path');
  }

  async dropSchema(tenantId: string): Promise<void> {
    const schemaName = `tenant_${tenantId}`;
    await this.dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  }
}
```

#### Frontend: Tenant Management UI

```typescript
// apps/admin/app/(dashboard)/tenants/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tenantRepository } from '@/lib/repositories/tenant-repository';
import { toast } from '@/components/ui/use-toast';

export default function NewTenantPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    adminEmail: '',
    plan: 'professional'
  });

  const createMutation = useMutation({
    mutationFn: () => tenantRepository.create(formData),
    onSuccess: (tenant) => {
      toast({
        title: 'Tenant created',
        description: `${tenant.name} has been provisioned successfully.`
      });
      router.push(`/tenants/${tenant.id}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create New Tenant</h1>

      <Card>
        <CardHeader>
          <CardTitle>Tenant Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input
                id="subdomain"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                placeholder="acme"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Will be accessible at: {formData.subdomain || 'subdomain'}.wellpulse.app
              </p>
            </div>

            <div>
              <Label htmlFor="adminEmail">Admin Email</Label>
              <Input
                id="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="plan">Plan</Label>
              <Select
                value={formData.plan}
                onValueChange={(value) => setFormData({ ...formData, plan: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter - $99/month</SelectItem>
                  <SelectItem value="professional">Professional - $299/month</SelectItem>
                  <SelectItem value="enterprise">Enterprise - Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Tenant'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 10.3 Stripe Billing Integration

#### Backend: Stripe Setup

```typescript
// apps/api/src/infrastructure/billing/stripe.service.ts
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2023-10-16' }
    );
  }

  async createCustomer(email: string, name: string, tenantId: string): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email,
      name,
      metadata: { tenantId }
    });
  }

  async createSubscription(
    customerId: string,
    priceId: string
  ): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    tenantId: string
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${this.configService.get('APP_URL')}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get('APP_URL')}/billing/cancel`,
      metadata: { tenantId }
    });
  }

  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    timestamp?: number
  ): Promise<Stripe.UsageRecord> {
    return this.stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        action: 'set'
      }
    );
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.cancel(subscriptionId);
  }

  async getUpcomingInvoice(customerId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.retrieveUpcoming({
      customer: customerId
    });
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
```

#### Webhook Handler

```typescript
// apps/api/src/presentation/webhooks/stripe.controller.ts
import { Controller, Post, Body, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { StripeService } from '@/infrastructure/billing/stripe.service';
import { TenantRepository } from '@/domain/repositories/tenant.repository';
import Stripe from 'stripe';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly tenantRepo: TenantRepository
  ) {}

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string
  ) {
    const payload = req.rawBody;

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(payload, signature);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata.tenantId;
    await this.tenantRepo.updateBilling(tenantId, {
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata.tenantId;
    await this.tenantRepo.updateBilling(tenantId, {
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata.tenantId;
    await this.tenantRepo.suspend(tenantId, 'subscription_cancelled');
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    // Log successful payment
    // Update tenant billing status
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    // Notify tenant of payment failure
    // Implement grace period logic
  }
}
```

#### Usage-Based Billing

```typescript
// apps/api/src/application/billing/commands/record-usage.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { StripeService } from '@/infrastructure/billing/stripe.service';
import { TenantRepository } from '@/domain/repositories/tenant.repository';
import { Cron, CronExpression } from '@nestjs/schedule';

export class RecordUsageCommand {
  constructor(
    public readonly tenantId: string,
    public readonly metricType: 'api_calls' | 'storage_gb' | 'wells',
    public readonly quantity: number
  ) {}
}

@Injectable()
export class UsageBillingService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly tenantRepo: TenantRepository
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async recordDailyUsage() {
    const tenants = await this.tenantRepo.findAll();

    for (const tenant of tenants) {
      if (!tenant.stripeSubscriptionItemId) continue;

      try {
        // Calculate usage metrics
        const apiCalls = await this.calculateApiCalls(tenant.id);
        const storageGb = await this.calculateStorage(tenant.id);
        const wellCount = await this.calculateWells(tenant.id);

        // Record to Stripe
        await this.stripeService.createUsageRecord(
          tenant.stripeSubscriptionItemId,
          apiCalls + (storageGb * 100) + (wellCount * 10)  // Weighted formula
        );

        console.log(`Recorded usage for tenant ${tenant.id}: ${apiCalls} API calls, ${storageGb} GB storage, ${wellCount} wells`);
      } catch (error) {
        console.error(`Failed to record usage for tenant ${tenant.id}:`, error);
      }
    }
  }

  private async calculateApiCalls(tenantId: string): Promise<number> {
    // Query API request logs for past 24 hours
    // Return count
    return 0;
  }

  private async calculateStorage(tenantId: string): Promise<number> {
    // Calculate total storage used
    return 0;
  }

  private async calculateWells(tenantId: string): Promise<number> {
    // Count active wells
    return 0;
  }
}
```

### 10.4 Usage Analytics Dashboard

```typescript
// apps/admin/app/(dashboard)/analytics/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, BarChart } from '@/components/charts';
import { analyticsRepository } from '@/lib/repositories/analytics-repository';

export default function AnalyticsPage() {
  const { data: metrics } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => analyticsRepository.getOverview()
  });

  const { data: trends } = useQuery({
    queryKey: ['analytics', 'trends', '30d'],
    queryFn: () => analyticsRepository.getTrends(30)
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Platform Analytics</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.totalTenants}</div>
            <p className="text-sm text-muted-foreground">
              +{metrics?.newTenantsThisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.activeUsers}</div>
            <p className="text-sm text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(metrics?.apiRequests / 1000000).toFixed(1)}M
            </div>
            <p className="text-sm text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${metrics?.mrr.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">
              Monthly Recurring Revenue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trends */}
      <Card>
        <CardHeader>
          <CardTitle>User Activity Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            data={trends?.dailyActiveUsers || []}
            xKey="date"
            yKeys={['users']}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Top Tenants by Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={metrics?.topTenantsByUsage || []}
              xKey="tenant"
              yKeys={['apiCalls']}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage by Tenant</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={metrics?.storageByTenant || []}
              xKey="tenant"
              yKeys={['storageGb']}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### 10.5 Production Deployment (Azure)

#### Azure Container Apps Configuration

```yaml
# azure-container-apps.yaml
apiVersion: apps.azure.com/v1
kind: ContainerApp
metadata:
  name: wellpulse-api
spec:
  configuration:
    activeRevisionsMode: Single
    ingress:
      external: true
      targetPort: 3001
      transport: auto
      corsPolicy:
        allowedOrigins:
          - https://wellpulse.app
          - https://*.wellpulse.app
    secrets:
      - name: database-url
        value: ${DATABASE_URL}
      - name: jwt-secret
        value: ${JWT_SECRET}
      - name: stripe-secret
        value: ${STRIPE_SECRET_KEY}
  template:
    containers:
      - name: api
        image: wellpulse.azurecr.io/api:latest
        env:
          - name: NODE_ENV
            value: production
          - name: DATABASE_URL
            secretRef: database-url
          - name: JWT_SECRET
            secretRef: jwt-secret
          - name: STRIPE_SECRET_KEY
            secretRef: stripe-secret
        resources:
          cpu: 1.0
          memory: 2Gi
    scale:
      minReplicas: 2
      maxReplicas: 10
      rules:
        - name: http-scaling
          http:
            metadata:
              concurrentRequests: "100"
---
apiVersion: apps.azure.com/v1
kind: ContainerApp
metadata:
  name: wellpulse-web
spec:
  configuration:
    ingress:
      external: true
      targetPort: 3000
  template:
    containers:
      - name: web
        image: wellpulse.azurecr.io/web:latest
        env:
          - name: NEXT_PUBLIC_API_URL
            value: https://api.wellpulse.app
        resources:
          cpu: 0.5
          memory: 1Gi
    scale:
      minReplicas: 2
      maxReplicas: 10
---
apiVersion: apps.azure.com/v1
kind: ContainerApp
metadata:
  name: wellpulse-ml
spec:
  configuration:
    ingress:
      external: false
      targetPort: 8000
  template:
    containers:
      - name: ml
        image: wellpulse.azurecr.io/ml:latest
        env:
          - name: DATABASE_URL
            secretRef: database-url
        resources:
          cpu: 2.0
          memory: 4Gi
    scale:
      minReplicas: 1
      maxReplicas: 5
```

#### Dockerfile for ML Service

```dockerfile
# apps/ml/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create models directory
RUN mkdir -p /app/models

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### GitHub Actions CI/CD

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]

env:
  AZURE_CONTAINER_REGISTRY: wellpulse
  RESOURCE_GROUP: wellpulse-prod

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Build and push API
        run: |
          az acr build --registry ${{ env.AZURE_CONTAINER_REGISTRY }} \
            --image api:${{ github.sha }} \
            --image api:latest \
            --file apps/api/Dockerfile \
            apps/api

      - name: Build and push Web
        run: |
          az acr build --registry ${{ env.AZURE_CONTAINER_REGISTRY }} \
            --image web:${{ github.sha }} \
            --image web:latest \
            --file apps/web/Dockerfile \
            apps/web

      - name: Build and push ML
        run: |
          az acr build --registry ${{ env.AZURE_CONTAINER_REGISTRY }} \
            --image ml:${{ github.sha }} \
            --image ml:latest \
            --file apps/ml/Dockerfile \
            apps/ml

      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --name wellpulse-api \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --image wellpulse.azurecr.io/api:${{ github.sha }}

          az containerapp update \
            --name wellpulse-web \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --image wellpulse.azurecr.io/web:${{ github.sha }}

          az containerapp update \
            --name wellpulse-ml \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --image wellpulse.azurecr.io/ml:${{ github.sha }}

      - name: Run Database Migrations
        run: |
          az containerapp exec \
            --name wellpulse-api \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --command "pnpm db:migrate"
```

---

## Production Readiness

### Checklist

#### Infrastructure
- [ ] Azure Container Apps configured
- [ ] Azure PostgreSQL database provisioned
- [ ] Azure Container Registry created
- [ ] Application Insights enabled
- [ ] Azure Front Door configured (CDN + WAF)
- [ ] Custom domain (wellpulse.app) configured
- [ ] SSL certificates provisioned
- [ ] Environment variables configured
- [ ] Secrets stored in Azure Key Vault

#### Security
- [ ] Rate limiting enabled (multi-tier)
- [ ] CORS configured correctly
- [ ] CSP headers implemented
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented
- [ ] Input validation on all endpoints
- [ ] Audit logging enabled
- [ ] Encryption at rest configured
- [ ] TLS 1.3 enforced

#### Performance
- [ ] Database indexes optimized
- [ ] Query performance tested (no N+1)
- [ ] React Query caching configured
- [ ] CDN configured for static assets
- [ ] Image optimization enabled
- [ ] Code splitting implemented
- [ ] Lazy loading for routes
- [ ] API response times < 200ms (p95)

#### Monitoring
- [ ] Application Insights dashboards created
- [ ] Error tracking (Sentry) configured
- [ ] Uptime monitoring enabled
- [ ] Performance metrics tracked
- [ ] Log aggregation configured
- [ ] Alerts configured for critical errors
- [ ] Database monitoring enabled
- [ ] ML model performance tracking

#### Testing
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Load testing completed (1000 concurrent users)
- [ ] Security testing completed
- [ ] ML model validation completed

#### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] User guides created
- [ ] Admin guides created
- [ ] Deployment runbook
- [ ] Incident response plan
- [ ] Backup/restore procedures

#### Compliance
- [ ] Privacy policy created
- [ ] Terms of service created
- [ ] GDPR compliance verified
- [ ] Data retention policy defined
- [ ] Backup strategy implemented (daily)
- [ ] Disaster recovery plan tested

---

## Beta Onboarding

### Onboarding Checklist

1. **Pre-Launch (Week 21)**
   - [ ] Identify 5-10 beta customers
   - [ ] Schedule onboarding calls
   - [ ] Prepare demo data
   - [ ] Create onboarding materials
   - [ ] Set up support channels (Slack/Discord)

2. **Tenant Provisioning (Week 22)**
   - [ ] Create tenant accounts
   - [ ] Configure custom subdomains
   - [ ] Import customer data (wells, production history)
   - [ ] Train ML models on customer data
   - [ ] Set up billing accounts

3. **User Training (Week 23)**
   - [ ] Conduct training sessions
   - [ ] Provide user guides
   - [ ] Share video tutorials
   - [ ] Set up feedback channels
   - [ ] Schedule weekly check-ins

4. **Feedback Collection (Week 24)**
   - [ ] Send feedback surveys
   - [ ] Conduct user interviews
   - [ ] Track feature requests
   - [ ] Monitor usage analytics
   - [ ] Identify pain points

### Beta Success Metrics

- **Activation**: 80% of users log in within first week
- **Engagement**: 60% weekly active users
- **Feature Adoption**: 50% use at least 3 core features
- **NPS Score**: ≥ 40
- **Time to Value**: Users see first insight within 1 hour
- **Support Tickets**: < 5 per week per tenant
- **Uptime**: 99.5% during beta period

---

## Post-MVP Roadmap

### Q1 2026: Optimization & Scale

**Features**:
- Advanced ML models (neural networks for production forecasting)
- Mobile app (React Native)
- Public API for third-party integrations
- Advanced analytics (custom dashboards)
- White-label solution

**Infrastructure**:
- Multi-region deployment
- Redis caching layer
- GraphQL API
- Real-time collaboration features
- Advanced monitoring (distributed tracing)

### Q2 2026: Ecosystem & Integrations

**Features**:
- Integrations with SCADA systems
- Integration with accounting software (QuickBooks, Xero)
- Integration with land management systems
- Marketplace for third-party apps
- Advanced ESG features (Scope 3 emissions)

**Platform**:
- Plugin architecture
- Webhook system
- Event-driven architecture
- Microservices migration (if needed)

### Q3 2026: AI & Automation

**Features**:
- AI assistant (ChatGPT integration)
- Automated work order generation
- Smart scheduling optimization
- Predictive budgeting
- Automated compliance reporting

**ML Enhancements**:
- Deep learning models
- Reinforcement learning for optimization
- Computer vision (equipment inspection)
- Natural language processing (document extraction)

### Q4 2026: Enterprise & Scale

**Features**:
- Enterprise SSO (SAML, OIDC)
- Advanced RBAC (custom roles)
- Multi-tenant reporting
- Data warehouse integration
- Advanced audit logging

**Scale**:
- Support for 1000+ tenants
- 10,000+ wells per tenant
- 99.99% uptime SLA
- Global deployment

---

## Phase 3 Completion Criteria

### Sprint 9 (ML & ESG)
- [ ] Python ML service deployed and accessible
- [ ] All 5 ML use cases implemented and tested
- [ ] ML models trained on sample data
- [ ] Prediction accuracy ≥ 80% (validation set)
- [ ] ESG emissions calculations verified (EPA standards)
- [ ] Regulatory reports generated (TX RRC, NM OCD formats)
- [ ] ML insights page functional
- [ ] ESG compliance dashboard functional
- [ ] API endpoints documented
- [ ] Performance: ML predictions < 5 seconds

### Sprint 10 (Admin & Launch)
- [ ] Admin portal deployed
- [ ] Tenant provisioning working (create, suspend, activate)
- [ ] Database schema creation automated
- [ ] Stripe integration complete
- [ ] Subscription checkout flow working
- [ ] Webhook handlers tested
- [ ] Usage-based billing implemented
- [ ] Analytics dashboard showing metrics
- [ ] Azure deployment complete
- [ ] Production environment stable
- [ ] Custom domain configured
- [ ] SSL certificates active
- [ ] Monitoring dashboards created
- [ ] Beta customers onboarded
- [ ] Documentation complete

### Overall Phase 3
- [ ] All production readiness items checked
- [ ] Beta feedback collected and reviewed
- [ ] Critical bugs fixed
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Legal compliance verified
- [ ] Incident response plan tested
- [ ] Ready for public launch

---

## Summary

Phase 3 completes the WellPulse MVP by adding:

1. **Intelligence**: 5 ML use cases providing predictive insights
2. **Compliance**: ESG emissions calculations and regulatory reporting
3. **Platform**: Multi-tenant admin portal with billing
4. **Production**: Fully deployed, monitored, and secure infrastructure

**Deliverables**:
- Python FastAPI ML service with trained models
- ESG compliance module with regulatory reports
- Admin portal with tenant and billing management
- Production deployment on Azure
- Beta customers onboarded
- Documentation complete

**Outcome**: WellPulse is ready for public launch with predictive capabilities, ESG compliance, and production-grade infrastructure supporting multiple paying customers.

**Next Step**: Public launch, customer acquisition, and continuous improvement based on user feedback.
