//! Health monitoring system for SCADA connections
//!
//! Provides comprehensive connection health tracking including:
//! - Connection status monitoring
//! - Automatic reconnection with exponential backoff
//! - Circuit breaker pattern
//! - Health metrics and statistics

use crate::adapters::{ProtocolAdapter, ProtocolError};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Connection health status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionStatus {
    /// Connection is healthy and operational
    Connected,
    /// Connection is disconnected
    Disconnected,
    /// Connection is attempting to reconnect
    Reconnecting,
    /// Circuit breaker is open (too many failures)
    CircuitOpen,
}

/// Connection health state
#[derive(Debug, Clone)]
pub struct ConnectionHealth {
    pub connection_id: Uuid,
    pub tenant_id: Uuid,
    pub status: ConnectionStatus,
    pub last_successful_reading: Option<DateTime<Utc>>,
    pub last_connection_attempt: Option<DateTime<Utc>>,
    pub consecutive_failures: u32,
    pub total_failures: u64,
    pub total_successes: u64,
    pub uptime_seconds: u64,
    pub circuit_breaker_state: CircuitBreakerState,
}

/// Circuit breaker state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitBreakerState {
    /// Circuit is closed, connection is healthy
    Closed,
    /// Circuit is open, too many failures
    Open,
    /// Circuit is half-open, testing if connection is recovered
    HalfOpen,
}

/// Reconnection configuration
#[derive(Debug, Clone)]
pub struct ReconnectionConfig {
    /// Initial backoff delay in milliseconds
    pub initial_backoff_ms: u64,
    /// Maximum backoff delay in milliseconds
    pub max_backoff_ms: u64,
    /// Backoff multiplier (exponential)
    pub backoff_multiplier: f64,
    /// Maximum retry attempts (0 = infinite)
    pub max_retry_attempts: u32,
    /// Circuit breaker failure threshold
    pub circuit_breaker_threshold: u32,
    /// Circuit breaker timeout (seconds before moving to half-open)
    pub circuit_breaker_timeout_secs: u64,
}

impl Default for ReconnectionConfig {
    fn default() -> Self {
        Self {
            initial_backoff_ms: 1000,
            max_backoff_ms: 60000,
            backoff_multiplier: 2.0,
            max_retry_attempts: 10,
            circuit_breaker_threshold: 5,
            circuit_breaker_timeout_secs: 300, // 5 minutes
        }
    }
}

/// Health monitor for a single connection
pub struct HealthMonitor {
    health: Arc<RwLock<ConnectionHealth>>,
    config: ReconnectionConfig,
    circuit_breaker_opened_at: Arc<RwLock<Option<DateTime<Utc>>>>,
}

impl HealthMonitor {
    /// Create a new health monitor
    pub fn new(connection_id: Uuid, tenant_id: Uuid, config: ReconnectionConfig) -> Self {
        let health = ConnectionHealth {
            connection_id,
            tenant_id,
            status: ConnectionStatus::Disconnected,
            last_successful_reading: None,
            last_connection_attempt: None,
            consecutive_failures: 0,
            total_failures: 0,
            total_successes: 0,
            uptime_seconds: 0,
            circuit_breaker_state: CircuitBreakerState::Closed,
        };

        Self {
            health: Arc::new(RwLock::new(health)),
            config,
            circuit_breaker_opened_at: Arc::new(RwLock::new(None)),
        }
    }

    /// Record a successful operation
    pub async fn record_success(&self) {
        let mut health = self.health.write().await;
        health.last_successful_reading = Some(Utc::now());
        health.consecutive_failures = 0;
        health.total_successes += 1;
        health.status = ConnectionStatus::Connected;

        // Close circuit breaker on success
        if health.circuit_breaker_state != CircuitBreakerState::Closed {
            info!(
                connection_id = %health.connection_id,
                "Circuit breaker closed after successful operation"
            );
            health.circuit_breaker_state = CircuitBreakerState::Closed;
            *self.circuit_breaker_opened_at.write().await = None;
        }
    }

    /// Record a failed operation
    pub async fn record_failure(&self, error: &ProtocolError) {
        let mut health = self.health.write().await;
        health.consecutive_failures += 1;
        health.total_failures += 1;
        health.status = ConnectionStatus::Disconnected;

        warn!(
            connection_id = %health.connection_id,
            consecutive_failures = health.consecutive_failures,
            error = %error,
            "Connection failure recorded"
        );

        // Check if we should open the circuit breaker
        if health.consecutive_failures >= self.config.circuit_breaker_threshold
            && health.circuit_breaker_state == CircuitBreakerState::Closed
        {
            error!(
                connection_id = %health.connection_id,
                threshold = self.config.circuit_breaker_threshold,
                "Circuit breaker opened due to consecutive failures"
            );
            health.circuit_breaker_state = CircuitBreakerState::Open;
            health.status = ConnectionStatus::CircuitOpen;
            *self.circuit_breaker_opened_at.write().await = Some(Utc::now());
        }
    }

    /// Record a connection attempt
    pub async fn record_connection_attempt(&self) {
        let mut health = self.health.write().await;
        health.last_connection_attempt = Some(Utc::now());
        health.status = ConnectionStatus::Reconnecting;
    }

    /// Check if connection is healthy
    pub async fn is_healthy(&self) -> bool {
        let health = self.health.read().await;
        health.status == ConnectionStatus::Connected
    }

    /// Check if circuit breaker allows connection attempt
    pub async fn can_attempt_connection(&self) -> bool {
        let health = self.health.read().await;

        match health.circuit_breaker_state {
            CircuitBreakerState::Closed => true,
            CircuitBreakerState::Open => {
                // Check if enough time has passed to try half-open
                if let Some(opened_at) = *self.circuit_breaker_opened_at.read().await {
                    let elapsed = Utc::now().signed_duration_since(opened_at).num_seconds() as u64;
                    if elapsed >= self.config.circuit_breaker_timeout_secs {
                        drop(health);
                        self.transition_to_half_open().await;
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            CircuitBreakerState::HalfOpen => true,
        }
    }

    /// Transition circuit breaker to half-open state
    async fn transition_to_half_open(&self) {
        let mut health = self.health.write().await;
        if health.circuit_breaker_state == CircuitBreakerState::Open {
            info!(
                connection_id = %health.connection_id,
                "Circuit breaker transitioning to half-open state"
            );
            health.circuit_breaker_state = CircuitBreakerState::HalfOpen;
            health.consecutive_failures = 0; // Reset for retry attempt
        }
    }

    /// Calculate next backoff delay
    pub async fn next_backoff_delay(&self) -> Duration {
        let health = self.health.read().await;
        let attempt = health.consecutive_failures as u32;

        let delay_ms = (self.config.initial_backoff_ms as f64
            * self.config.backoff_multiplier.powi(attempt as i32)) as u64;

        let delay_ms = delay_ms.min(self.config.max_backoff_ms);

        Duration::from_millis(delay_ms)
    }

    /// Check if maximum retry attempts reached
    pub async fn is_max_retries_reached(&self) -> bool {
        if self.config.max_retry_attempts == 0 {
            return false; // Infinite retries
        }

        let health = self.health.read().await;
        health.consecutive_failures >= self.config.max_retry_attempts
    }

    /// Get current health status
    pub async fn get_health(&self) -> ConnectionHealth {
        self.health.read().await.clone()
    }

    /// Calculate uptime percentage
    pub async fn uptime_percentage(&self) -> f64 {
        let health = self.health.read().await;
        let total_operations = health.total_successes + health.total_failures;

        if total_operations == 0 {
            return 0.0;
        }

        (health.total_successes as f64 / total_operations as f64) * 100.0
    }
}

/// Reconnection strategy
pub struct ReconnectionStrategy {
    monitor: Arc<HealthMonitor>,
}

impl ReconnectionStrategy {
    pub fn new(monitor: Arc<HealthMonitor>) -> Self {
        Self { monitor }
    }

    /// Attempt to reconnect with exponential backoff
    pub async fn reconnect<F, Fut>(&self, mut connect_fn: F) -> Result<(), ProtocolError>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<(), ProtocolError>>,
    {
        loop {
            // Check if circuit breaker allows connection
            if !self.monitor.can_attempt_connection().await {
                let delay = Duration::from_secs(10);
                debug!(
                    delay_secs = delay.as_secs(),
                    "Circuit breaker open, waiting before retry"
                );
                tokio::time::sleep(delay).await;
                continue;
            }

            // Check if max retries reached
            if self.monitor.is_max_retries_reached().await {
                error!("Maximum retry attempts reached, giving up");
                return Err(ProtocolError::ConnectionFailed(
                    "Maximum retry attempts reached".to_string(),
                ));
            }

            // Record connection attempt
            self.monitor.record_connection_attempt().await;

            // Attempt connection
            match connect_fn().await {
                Ok(()) => {
                    info!("Reconnection successful");
                    self.monitor.record_success().await;
                    return Ok(());
                }
                Err(e) => {
                    self.monitor.record_failure(&e).await;

                    let backoff = self.monitor.next_backoff_delay().await;
                    warn!(
                        error = %e,
                        backoff_ms = backoff.as_millis(),
                        "Connection failed, backing off"
                    );

                    tokio::time::sleep(backoff).await;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_monitor_creation() {
        let config = ReconnectionConfig::default();
        let monitor = HealthMonitor::new(Uuid::new_v4(), Uuid::new_v4(), config);

        let health = monitor.get_health().await;
        assert_eq!(health.status, ConnectionStatus::Disconnected);
        assert_eq!(health.consecutive_failures, 0);
        assert_eq!(health.circuit_breaker_state, CircuitBreakerState::Closed);
    }

    #[tokio::test]
    async fn test_record_success() {
        let config = ReconnectionConfig::default();
        let monitor = HealthMonitor::new(Uuid::new_v4(), Uuid::new_v4(), config);

        monitor.record_success().await;

        let health = monitor.get_health().await;
        assert_eq!(health.status, ConnectionStatus::Connected);
        assert_eq!(health.total_successes, 1);
        assert_eq!(health.consecutive_failures, 0);
        assert!(health.last_successful_reading.is_some());
    }

    #[tokio::test]
    async fn test_record_failure() {
        let config = ReconnectionConfig::default();
        let monitor = HealthMonitor::new(Uuid::new_v4(), Uuid::new_v4(), config);

        let error = ProtocolError::ConnectionFailed("test error".to_string());
        monitor.record_failure(&error).await;

        let health = monitor.get_health().await;
        assert_eq!(health.status, ConnectionStatus::Disconnected);
        assert_eq!(health.total_failures, 1);
        assert_eq!(health.consecutive_failures, 1);
    }

    #[tokio::test]
    async fn test_circuit_breaker_opens() {
        let config = ReconnectionConfig {
            circuit_breaker_threshold: 3,
            ..Default::default()
        };
        let monitor = HealthMonitor::new(Uuid::new_v4(), Uuid::new_v4(), config);

        let error = ProtocolError::ConnectionFailed("test error".to_string());

        // Record failures up to threshold
        for _ in 0..3 {
            monitor.record_failure(&error).await;
        }

        let health = monitor.get_health().await;
        assert_eq!(health.circuit_breaker_state, CircuitBreakerState::Open);
        assert_eq!(health.status, ConnectionStatus::CircuitOpen);
    }

    #[tokio::test]
    async fn test_backoff_calculation() {
        let config = ReconnectionConfig {
            initial_backoff_ms: 100,
            backoff_multiplier: 2.0,
            max_backoff_ms: 1000,
            ..Default::default()
        };
        let monitor = HealthMonitor::new(Uuid::new_v4(), Uuid::new_v4(), config);

        let error = ProtocolError::ConnectionFailed("test error".to_string());

        // First failure: 100ms
        monitor.record_failure(&error).await;
        let delay = monitor.next_backoff_delay().await;
        assert_eq!(delay.as_millis(), 200); // 100 * 2^1

        // Second failure: 200ms
        monitor.record_failure(&error).await;
        let delay = monitor.next_backoff_delay().await;
        assert_eq!(delay.as_millis(), 400); // 100 * 2^2
    }

    #[tokio::test]
    async fn test_uptime_percentage() {
        let config = ReconnectionConfig::default();
        let monitor = HealthMonitor::new(Uuid::new_v4(), Uuid::new_v4(), config);

        // 7 successes, 3 failures = 70% uptime
        for _ in 0..7 {
            monitor.record_success().await;
        }
        let error = ProtocolError::ConnectionFailed("test error".to_string());
        for _ in 0..3 {
            monitor.record_failure(&error).await;
        }

        let uptime = monitor.uptime_percentage().await;
        assert!((uptime - 70.0).abs() < 0.01);
    }
}
