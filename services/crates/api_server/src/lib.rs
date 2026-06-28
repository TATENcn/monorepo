use ::config::ConfigError;
use sea_orm::DbErr;
use tokio::io;

pub mod config;
pub mod models;

#[derive(Debug, thiserror::Error)]
pub enum ApiServerError {
    #[error(transparent)]
    Config(#[from] ConfigError),
    #[error(transparent)]
    Database(#[from] DbErr),
    #[error(transparent)]
    Io(#[from] io::Error),
}
