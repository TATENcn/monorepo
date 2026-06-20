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
    #[error("RABBIT_MQ_URL environment variable not set")]
    MissingRabbitMqUrl,
    #[error("JUDGE_CORE_URL environment variable not set")]
    MissingJudgeCoreUrl,
}
