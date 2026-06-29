use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::enums::{CaseType, Difficulty};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProblemQueries {
    pub limit: Option<u64>,
    pub offset: Option<u64>,
    pub query: Option<String>,
    pub difficulty: Option<Difficulty>,
    // TODO: Redesign this query
    // pub tag: Option<Vec<Uuid>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProblemResponseItem {
    pub id: Uuid,
    pub title: String,
    pub difficulty: Difficulty,
    pub tags: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProblemResponse {
    pub problems: Vec<ListProblemResponseItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemStatResponse {
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemLimit {
    pub cpu_time_ms: u64,
    pub wall_time_ms: u64,
    pub memory_bytes: u64,
    pub output_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetailResponse {
    pub id: Uuid,
    pub author_id: Uuid,
    pub title: String,
    pub description: String,
    pub difficulty: Difficulty,
    pub tags: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub limit: ProblemLimit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestCaseSuccessfulResponse {
    pub id: Uuid,
    pub input: String,
    pub output: String,
    #[serde(rename = "type")]
    pub case_type: CaseType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProblemRequest {
    pub title: String,
    pub description: String,
    pub difficulty: Difficulty,
    pub limit: ProblemLimit,
    pub tags: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProblemRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub difficulty: Option<Difficulty>,
    pub limit: Option<ProblemLimit>,
    pub tags: Option<Vec<Uuid>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceTestCasesRequest {
    pub cases: Vec<TestCaseInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestCaseInput {
    pub input: String,
    pub output: String,
    #[serde(rename = "type")]
    pub case_type: CaseType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProblemResponse {
    pub id: Uuid,
}
