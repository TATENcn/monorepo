use judge_core_shared::models::{VerdictTask, http::VerdictResponse};
use serde::{Deserialize, Serialize};

/// Message received from the submit queue — mirrors `packages/models/src/message.ts`.
#[derive(Debug, Deserialize)]
pub struct SubmitMessage {
    pub submission_id: String,
    pub task: VerdictTask,
}

/// Message published to the result routing key — mirrors `packages/models/src/message.ts`.
#[derive(Debug, Serialize)]
pub struct ResultMessage {
    pub submission_id: String,
    pub result: VerdictResponse,
}
