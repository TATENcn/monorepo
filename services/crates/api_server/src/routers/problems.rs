use std::sync::Arc;

use api_server_db::{
    models::http::{
        CreateProblemRequest, CreateProblemResponse, ListProblemQueries, ListProblemResponse, ProblemDetailResponse, ProblemStatResponse,
        ReplaceTestCasesRequest, TestCaseSuccessfulResponse, UpdateProblemRequest,
    },
    repositories::RepoError,
};
use auth::extractor::{Auth, Identity};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
};
use uuid::Uuid;

use crate::routers::ApiServerState;

pub fn router() -> Router<Arc<ApiServerState>> {
    Router::new()
        .route("/", get(list_problems).post(create_problem))
        .route("/stat", get(get_stat))
        .route("/{id}", get(get_problem).patch(update_problem).delete(delete_problem))
        .route("/{id}/cases", get(get_test_cases).put(replace_test_cases))
}

#[derive(Debug, thiserror::Error)]
enum ProblemApiError {
    #[error("not found")]
    NotFound,
    #[error("forbidden")]
    Forbidden,
    #[error("internal error: {0}")]
    Internal(RepoError),
}

impl IntoResponse for ProblemApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, body) = match self {
            Self::NotFound => (StatusCode::NOT_FOUND, "not found"),
            Self::Forbidden => (StatusCode::FORBIDDEN, "forbidden"),
            Self::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal server error"),
        };
        (status, body).into_response()
    }
}

impl From<RepoError> for ProblemApiError {
    fn from(e: RepoError) -> Self {
        match e {
            RepoError::NotFound => Self::NotFound,
            RepoError::Forbidden => Self::Forbidden,
            RepoError::Internal(_) => Self::Internal(e),
        }
    }
}

async fn list_problems(
    State(state): State<Arc<ApiServerState>>,
    Query(params): Query<ListProblemQueries>,
) -> Result<Json<ListProblemResponse>, ProblemApiError> {
    let res = state.problems_repo.list(params).await?;
    Ok(Json(res))
}

async fn create_problem(
    State(state): State<Arc<ApiServerState>>,
    Auth(identity): Auth<Identity>,
    Json(req): Json<CreateProblemRequest>,
) -> Result<(StatusCode, Json<CreateProblemResponse>), ProblemApiError> {
    let res = state.problems_repo.create(req, identity.user_id).await?;
    Ok((StatusCode::CREATED, Json(res)))
}

async fn get_stat(State(state): State<Arc<ApiServerState>>) -> Result<Json<ProblemStatResponse>, ProblemApiError> {
    let res = state.problems_repo.get_stat().await?;
    Ok(Json(res))
}

async fn get_problem(State(state): State<Arc<ApiServerState>>, Path(id): Path<Uuid>) -> Result<Json<ProblemDetailResponse>, ProblemApiError> {
    let res = state.problems_repo.get_by_id(id).await?;
    Ok(Json(res))
}

async fn update_problem(
    State(state): State<Arc<ApiServerState>>,
    Auth(identity): Auth<Identity>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateProblemRequest>,
) -> Result<StatusCode, ProblemApiError> {
    state.problems_repo.update(id, identity.user_id, req).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_problem(State(state): State<Arc<ApiServerState>>, Auth(identity): Auth<Identity>, Path(id): Path<Uuid>) -> Result<StatusCode, ProblemApiError> {
    state.problems_repo.delete(id, identity.user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn get_test_cases(
    State(state): State<Arc<ApiServerState>>,
    Auth(identity): Auth<Identity>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<TestCaseSuccessfulResponse>>, ProblemApiError> {
    let res = state.test_cases_repo.get_by_problem_id(id, identity.user_id).await?;
    Ok(Json(res))
}

async fn replace_test_cases(
    State(state): State<Arc<ApiServerState>>,
    Auth(identity): Auth<Identity>,
    Path(id): Path<Uuid>,
    Json(req): Json<ReplaceTestCasesRequest>,
) -> Result<StatusCode, ProblemApiError> {
    // Verification
    let problem = state.problems_repo.get_by_id(id).await?;
    if problem.author_id != identity.user_id {
        return Err(ProblemApiError::Forbidden);
    }

    state.test_cases_repo.replace(id, req).await?;
    Ok(StatusCode::NO_CONTENT)
}
