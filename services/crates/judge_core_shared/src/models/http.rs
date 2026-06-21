use serde::{Deserialize, Serialize};

use super::{Case, CaseVerdict, KilledReason, ResourcesUsage, VerdictTaskResult};

pub const METRICS_URL: &str = "/metricsz";
pub const ACCEPTABLE_URL: &str = "/acceptablez";
pub const TASK_URL: &str = "/task";

pub const ERR_QUEUE_FULL: &str = "QUEUE_FULL";
pub const ERR_MAX_RETRIES_EXCEEDED: &str = "MAX_RETRIES_EXCEEDED";
pub const ERR_AGENT_UNAVAILABLE: &str = "AGENT_UNAVAILABLE";
pub const ERR_SHUTTING_DOWN: &str = "SHUTTING_DOWN";
pub const ERR_TASK_TIMEOUT: &str = "TASK_TIMEOUT";
pub const ERR_CONNECTION_FAILED: &str = "CONNECTION_FAILED";
pub const ERR_PROTOCOL_ERROR: &str = "PROTOCOL_ERROR";
pub const ERR_PROVISION_ERROR: &str = "PROVISION_ERROR";
pub const ERR_AGENT_BUSY: &str = "AGENT_BUSY";

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(tag = "case_status")]
pub enum CaseVerdictResponse {
    #[serde(rename = "accepted")]
    Accepted { usage: ResourcesUsage },
    #[serde(rename = "killed")]
    Killed { reason: KilledReason, stdout: String, stderr: String },
    #[serde(rename = "wrong_answer")]
    WrongAnswer { wrong_case: Case, received: String, stderr: String },
    #[serde(rename = "runtime_error")]
    RuntimeError { stderr: String, exit_code: i32 },
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(tag = "status")]
pub enum VerdictResponse {
    #[serde(rename = "stopped")]
    Stopped { verdict: CaseVerdictResponse },
    #[serde(rename = "all_passed")]
    AllPassed { max_usage: ResourcesUsage },
    #[serde(rename = "collected")]
    Collected { cases: Vec<CaseVerdictResponse> },
    #[serde(rename = "internal")]
    Internal { message: String },
    #[serde(rename = "compilation_error")]
    CompilationError { message: String },
}

impl From<CaseVerdict> for CaseVerdictResponse {
    fn from(v: CaseVerdict) -> Self {
        match v {
            CaseVerdict::Accepted { usage } => CaseVerdictResponse::Accepted { usage },
            CaseVerdict::WrongAnswer { wrong_case, received, stderr } => CaseVerdictResponse::WrongAnswer { wrong_case, received, stderr },
            CaseVerdict::Killed { reason, stdout, stderr } => CaseVerdictResponse::Killed { reason, stdout, stderr },
            CaseVerdict::RuntimeError { stderr, exit_code } => CaseVerdictResponse::RuntimeError { stderr, exit_code },
        }
    }
}

impl From<CaseVerdictResponse> for CaseVerdict {
    fn from(v: CaseVerdictResponse) -> Self {
        match v {
            CaseVerdictResponse::Accepted { usage } => CaseVerdict::Accepted { usage },
            CaseVerdictResponse::WrongAnswer { wrong_case, received, stderr } => CaseVerdict::WrongAnswer { wrong_case, received, stderr },
            CaseVerdictResponse::Killed { reason, stdout, stderr } => CaseVerdict::Killed { reason, stdout, stderr },
            CaseVerdictResponse::RuntimeError { stderr, exit_code } => CaseVerdict::RuntimeError { stderr, exit_code },
        }
    }
}

impl From<VerdictTaskResult> for VerdictResponse {
    fn from(v: VerdictTaskResult) -> Self {
        match v {
            VerdictTaskResult::CompilationError { message } => VerdictResponse::CompilationError { message },
            VerdictTaskResult::Internal { message } => VerdictResponse::Internal { message },
            VerdictTaskResult::Stopped { verdict } => VerdictResponse::Stopped { verdict: verdict.into() },
            VerdictTaskResult::AllPassed { max_usage } => VerdictResponse::AllPassed { max_usage },
            VerdictTaskResult::Collected { cases } => VerdictResponse::Collected {
                cases: cases.into_iter().map(Into::into).collect(),
            },
        }
    }
}

impl From<VerdictResponse> for VerdictTaskResult {
    fn from(v: VerdictResponse) -> Self {
        match v {
            VerdictResponse::CompilationError { message } => VerdictTaskResult::CompilationError { message },
            VerdictResponse::Internal { message } => VerdictTaskResult::Internal { message },
            VerdictResponse::Stopped { verdict } => VerdictTaskResult::Stopped { verdict: verdict.into() },
            VerdictResponse::AllPassed { max_usage } => VerdictTaskResult::AllPassed { max_usage },
            VerdictResponse::Collected { cases } => VerdictTaskResult::Collected {
                cases: cases.into_iter().map(Into::into).collect(),
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct ErrorBody {
    pub code: String,
}

#[derive(Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: ErrorBody,
    pub message: String,
}

#[derive(Serialize, Deserialize)]
pub struct SuccessResponse<T> {
    pub data: T,
    pub message: String,
}

#[derive(Serialize, Deserialize)]
pub struct AcceptablezResponse {
    pub acceptable: bool,
    pub metrics: PoolMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolMetrics {
    pub queue_size: usize,
    pub agent_count: usize,
    pub healthy_agent_count: usize,
    pub active_tasks: u32,
    pub draining_agent_count: usize,
    pub unhealthy_agent_count: usize,
}
