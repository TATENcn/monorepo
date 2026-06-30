pub mod problems;
pub mod test_cases;

use sea_orm::DbErr;

#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("not found")]
    NotFound,
    #[error("forbidden")]
    Forbidden,
    #[error(transparent)]
    Internal(#[from] DbErr),
}
