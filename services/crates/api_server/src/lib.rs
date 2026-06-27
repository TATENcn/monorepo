use ::config::ConfigError;

pub mod config;

#[derive(Debug, thiserror::Error)]
pub enum ApiServerError {
    #[error(transparent)]
    Config(#[from] ConfigError),
}
