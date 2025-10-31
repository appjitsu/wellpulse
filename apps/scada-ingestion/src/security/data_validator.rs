//! Data validation for SCADA readings
//!
//! Provides comprehensive validation including:
//! - Range checks (min/max validation)
//! - Quality flag validation
//! - Statistical anomaly detection
//! - Data type validation

use crate::adapters::{ProtocolReading, ReadingQuality};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tracing::{debug, warn};

/// Validation configuration
#[derive(Debug, Clone)]
pub struct ValidationConfig {
    /// Whether to reject readings with Bad quality
    pub reject_bad_quality: bool,
    /// Whether to reject readings with Uncertain quality
    pub reject_uncertain_quality: bool,
    /// Standard deviations threshold for anomaly detection (0 = disabled)
    pub anomaly_std_dev_threshold: f64,
    /// Minimum sample size before anomaly detection kicks in
    pub anomaly_min_samples: usize,
}

impl Default for ValidationConfig {
    fn default() -> Self {
        Self {
            reject_bad_quality: true,
            reject_uncertain_quality: false,
            anomaly_std_dev_threshold: 3.0,
            anomaly_min_samples: 100,
        }
    }
}

/// Tag-specific validation rules
#[derive(Debug, Clone)]
pub struct TagValidationRule {
    pub tag_name: String,
    pub min_value: Option<f64>,
    pub max_value: Option<f64>,
}

/// Statistical tracker for anomaly detection
#[derive(Debug, Clone)]
struct StatisticalTracker {
    count: usize,
    sum: f64,
    sum_squared: f64,
}

impl StatisticalTracker {
    fn new() -> Self {
        Self {
            count: 0,
            sum: 0.0,
            sum_squared: 0.0,
        }
    }

    fn add_sample(&mut self, value: f64) {
        self.count += 1;
        self.sum += value;
        self.sum_squared += value * value;
    }

    fn mean(&self) -> f64 {
        if self.count == 0 {
            0.0
        } else {
            self.sum / self.count as f64
        }
    }

    fn std_dev(&self) -> f64 {
        if self.count < 2 {
            return 0.0;
        }

        let mean = self.mean();
        let variance = (self.sum_squared / self.count as f64) - (mean * mean);
        variance.max(0.0).sqrt()
    }

    fn is_anomaly(&self, value: f64, threshold: f64, min_samples: usize) -> bool {
        if self.count < min_samples {
            return false;
        }

        let mean = self.mean();
        let std_dev = self.std_dev();

        if std_dev == 0.0 {
            return false;
        }

        let z_score = (value - mean).abs() / std_dev;
        z_score > threshold
    }
}

/// Data validator for SCADA readings
pub struct DataValidator {
    config: ValidationConfig,
    tag_rules: HashMap<String, TagValidationRule>,
    // Tag name -> Statistical tracker
    statistics: Arc<RwLock<HashMap<String, StatisticalTracker>>>,
}

impl DataValidator {
    /// Create new data validator
    pub fn new(config: ValidationConfig) -> Self {
        Self {
            config,
            tag_rules: Self::default_tag_rules(),
            statistics: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get default validation rules for common Oil & Gas tags
    fn default_tag_rules() -> HashMap<String, TagValidationRule> {
        let mut rules = HashMap::new();

        // Oil production rate (barrels per day)
        rules.insert(
            "oil_rate".to_string(),
            TagValidationRule {
                tag_name: "oil_rate".to_string(),
                min_value: Some(0.0),
                max_value: Some(10000.0),
            },
        );

        // Gas production rate (MCF per day)
        rules.insert(
            "gas_rate".to_string(),
            TagValidationRule {
                tag_name: "gas_rate".to_string(),
                min_value: Some(0.0),
                max_value: Some(50000.0),
            },
        );

        // Water production rate (barrels per day)
        rules.insert(
            "water_rate".to_string(),
            TagValidationRule {
                tag_name: "water_rate".to_string(),
                min_value: Some(0.0),
                max_value: Some(20000.0),
            },
        );

        // Tubing pressure (PSI)
        rules.insert(
            "tubing_pressure".to_string(),
            TagValidationRule {
                tag_name: "tubing_pressure".to_string(),
                min_value: Some(0.0),
                max_value: Some(5000.0),
            },
        );

        // Casing pressure (PSI)
        rules.insert(
            "casing_pressure".to_string(),
            TagValidationRule {
                tag_name: "casing_pressure".to_string(),
                min_value: Some(0.0),
                max_value: Some(5000.0),
            },
        );

        // Temperature (Fahrenheit)
        rules.insert(
            "temperature".to_string(),
            TagValidationRule {
                tag_name: "temperature".to_string(),
                min_value: Some(-40.0),
                max_value: Some(300.0),
            },
        );

        // Flow rate (barrels per minute)
        rules.insert(
            "flow_rate".to_string(),
            TagValidationRule {
                tag_name: "flow_rate".to_string(),
                min_value: Some(0.0),
                max_value: Some(500.0),
            },
        );

        rules
    }

    /// Add a custom validation rule for a tag
    pub fn add_tag_rule(&mut self, rule: TagValidationRule) {
        self.tag_rules.insert(rule.tag_name.clone(), rule);
    }

    /// Validate a reading
    pub fn validate_reading(&self, reading: &ProtocolReading) -> Result<(), String> {
        // 1. Validate quality flag
        self.validate_quality(reading)?;

        // 2. Validate range
        self.validate_range(reading)?;

        // 3. Validate for anomalies (statistical)
        self.validate_anomaly(reading)?;

        Ok(())
    }

    /// Validate quality flag
    fn validate_quality(&self, reading: &ProtocolReading) -> Result<(), String> {
        match reading.quality {
            ReadingQuality::Good => Ok(()),
            ReadingQuality::Bad => {
                if self.config.reject_bad_quality {
                    warn!(
                        tag_name = %reading.tag_name,
                        well_id = %reading.well_id,
                        "Rejecting reading with Bad quality"
                    );
                    Err(format!(
                        "Reading has Bad quality for tag {}",
                        reading.tag_name
                    ))
                } else {
                    Ok(())
                }
            }
            ReadingQuality::Uncertain => {
                if self.config.reject_uncertain_quality {
                    warn!(
                        tag_name = %reading.tag_name,
                        well_id = %reading.well_id,
                        "Rejecting reading with Uncertain quality"
                    );
                    Err(format!(
                        "Reading has Uncertain quality for tag {}",
                        reading.tag_name
                    ))
                } else {
                    Ok(())
                }
            }
        }
    }

    /// Validate value range
    fn validate_range(&self, reading: &ProtocolReading) -> Result<(), String> {
        if let Some(rule) = self.tag_rules.get(&reading.tag_name) {
            // Check minimum
            if let Some(min) = rule.min_value {
                if reading.value < min {
                    warn!(
                        tag_name = %reading.tag_name,
                        value = reading.value,
                        min = min,
                        "Value below minimum threshold"
                    );
                    return Err(format!(
                        "Value {} below minimum {} for tag {}",
                        reading.value, min, reading.tag_name
                    ));
                }
            }

            // Check maximum
            if let Some(max) = rule.max_value {
                if reading.value > max {
                    warn!(
                        tag_name = %reading.tag_name,
                        value = reading.value,
                        max = max,
                        "Value above maximum threshold"
                    );
                    return Err(format!(
                        "Value {} above maximum {} for tag {}",
                        reading.value, max, reading.tag_name
                    ));
                }
            }

            debug!(
                tag_name = %reading.tag_name,
                value = reading.value,
                "Value within valid range"
            );
        }

        Ok(())
    }

    /// Validate for statistical anomalies
    fn validate_anomaly(&self, reading: &ProtocolReading) -> Result<(), String> {
        if self.config.anomaly_std_dev_threshold <= 0.0 {
            return Ok(()); // Anomaly detection disabled
        }

        let mut stats = self.statistics.write().unwrap();
        let tracker = stats
            .entry(reading.tag_name.clone())
            .or_insert_with(StatisticalTracker::new);

        // Check if current value is an anomaly
        if tracker.is_anomaly(
            reading.value,
            self.config.anomaly_std_dev_threshold,
            self.config.anomaly_min_samples,
        ) {
            warn!(
                tag_name = %reading.tag_name,
                value = reading.value,
                mean = tracker.mean(),
                std_dev = tracker.std_dev(),
                "Statistical anomaly detected"
            );
            return Err(format!(
                "Statistical anomaly detected for tag {} (value: {}, mean: {:.2}, std_dev: {:.2})",
                reading.tag_name,
                reading.value,
                tracker.mean(),
                tracker.std_dev()
            ));
        }

        // Add sample to tracker
        tracker.add_sample(reading.value);

        Ok(())
    }

    /// Get statistics for a tag (for debugging/monitoring)
    pub fn get_tag_statistics(&self, tag_name: &str) -> Option<(f64, f64, usize)> {
        let stats = self.statistics.read().unwrap();
        stats
            .get(tag_name)
            .map(|tracker| (tracker.mean(), tracker.std_dev(), tracker.count))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn create_test_reading(tag_name: &str, value: f64, quality: ReadingQuality) -> ProtocolReading {
        ProtocolReading {
            timestamp: Utc::now(),
            tenant_id: Uuid::new_v4(),
            well_id: Uuid::new_v4(),
            tag_name: tag_name.to_string(),
            value,
            quality,
            source_protocol: "TEST".to_string(),
        }
    }

    #[test]
    fn test_validate_good_quality() {
        let config = ValidationConfig::default();
        let validator = DataValidator::new(config);

        let reading = create_test_reading("oil_rate", 500.0, ReadingQuality::Good);
        assert!(validator.validate_reading(&reading).is_ok());
    }

    #[test]
    fn test_reject_bad_quality() {
        let config = ValidationConfig {
            reject_bad_quality: true,
            ..Default::default()
        };
        let validator = DataValidator::new(config);

        let reading = create_test_reading("oil_rate", 500.0, ReadingQuality::Bad);
        assert!(validator.validate_reading(&reading).is_err());
    }

    #[test]
    fn test_validate_range() {
        let config = ValidationConfig::default();
        let validator = DataValidator::new(config);

        // Valid value
        let reading = create_test_reading("oil_rate", 500.0, ReadingQuality::Good);
        assert!(validator.validate_reading(&reading).is_ok());

        // Below minimum
        let reading = create_test_reading("oil_rate", -10.0, ReadingQuality::Good);
        assert!(validator.validate_reading(&reading).is_err());

        // Above maximum
        let reading = create_test_reading("oil_rate", 20000.0, ReadingQuality::Good);
        assert!(validator.validate_reading(&reading).is_err());
    }

    #[test]
    fn test_anomaly_detection() {
        let config = ValidationConfig {
            anomaly_std_dev_threshold: 3.0,
            anomaly_min_samples: 10,
            ..Default::default()
        };
        let validator = DataValidator::new(config);

        // Add 50 normal readings around 100
        for i in 0..50 {
            let value = 100.0 + (i as f64 % 10.0);
            let reading = create_test_reading("test_tag", value, ReadingQuality::Good);
            let _ = validator.validate_reading(&reading);
        }

        // Normal value should pass
        let reading = create_test_reading("test_tag", 105.0, ReadingQuality::Good);
        assert!(validator.validate_reading(&reading).is_ok());

        // Extreme outlier should fail
        let reading = create_test_reading("test_tag", 1000.0, ReadingQuality::Good);
        assert!(validator.validate_reading(&reading).is_err());
    }

    #[test]
    fn test_custom_tag_rule() {
        let config = ValidationConfig::default();
        let mut validator = DataValidator::new(config);

        validator.add_tag_rule(TagValidationRule {
            tag_name: "custom_tag".to_string(),
            min_value: Some(0.0),
            max_value: Some(100.0),
        });

        // Within range
        let reading = create_test_reading("custom_tag", 50.0, ReadingQuality::Good);
        assert!(validator.validate_reading(&reading).is_ok());

        // Out of range
        let reading = create_test_reading("custom_tag", 150.0, ReadingQuality::Good);
        assert!(validator.validate_reading(&reading).is_err());
    }
}
