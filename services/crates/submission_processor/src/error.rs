use judge_core_sdk::JudgeCoreError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("AMQP error: {0}")]
    Amqp(#[from] lapin::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("judge-core error: {0}")]
    JudgeCore(#[from] JudgeCoreError),
    #[error("config error: {0}")]
    Config(#[from] config::ConfigError),
}
