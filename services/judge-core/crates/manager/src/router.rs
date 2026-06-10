use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use serde::Serialize;
use tower_http::trace::TraceLayer;
use tracing::error;

use crate::pool::{AgentPool, PoolError, PoolMetrics};
use shared::models::{VerdictTask, VerdictTaskResult};

pub fn create_router(pool: Arc<AgentPool>) -> Router {
    Router::new()
        .route("/metricsz", get(metricsz_handler))
        .route("/acceptablez", get(acceptablez_handler))
        .route("/task", post(task_handler))
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .with_state(pool)
}

#[derive(Serialize)]
struct AcceptablezResponse {
    acceptable: bool,
    metrics: PoolMetrics,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
}

async fn metricsz_handler(State(pool): State<Arc<AgentPool>>) -> Result<Json<PoolMetrics>, AppError> {
    let metrics = pool.metrics().await;
    Ok(Json(metrics))
}

async fn acceptablez_handler(State(pool): State<Arc<AgentPool>>) -> Result<Json<AcceptablezResponse>, AppError> {
    let metrics = pool.metrics().await;
    let acceptable = metrics.queue_size < 1000 && metrics.healthy_agent_count > 0;
    Ok(Json(AcceptablezResponse { acceptable, metrics }))
}

async fn task_handler(State(pool): State<Arc<AgentPool>>, Json(task): Json<VerdictTask>) -> Result<Json<VerdictTaskResult>, AppError> {
    let result = pool.submit(task).await?;
    Ok(Json(result))
}

struct AppError(PoolError);

impl From<PoolError> for AppError {
    fn from(err: PoolError) -> Self {
        AppError(err)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match &self.0 {
            PoolError::QueueFull => (StatusCode::SERVICE_UNAVAILABLE, self.0.to_string()),
            PoolError::MaxRetriesExceeded { .. } => (StatusCode::SERVICE_UNAVAILABLE, self.0.to_string()),
            PoolError::AgentUnavailable => (StatusCode::SERVICE_UNAVAILABLE, self.0.to_string()),
            PoolError::ShuttingDown => (StatusCode::SERVICE_UNAVAILABLE, self.0.to_string()),
            PoolError::TaskTimeout(_) => (StatusCode::GATEWAY_TIMEOUT, self.0.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, self.0.to_string()),
        };

        error!(error = %self.0, status = %status, "request failed");

        let body = Json(ErrorResponse {
            error: format!("{:?}", self.0),
            message,
        });

        (status, body).into_response()
    }
}
