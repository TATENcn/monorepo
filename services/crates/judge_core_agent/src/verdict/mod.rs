pub mod cpp;

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use judge_core_shared::models::{Case, CaseVerdict, ResourcesLimit, ResourcesUsage, VerdictTask, VerdictTaskResult};
use tokio::io;
use tokio::task::JoinSet;
use tracing::{debug, error, info, instrument};

pub enum CompileResult {
    Success,
    Timeout,
    CompilationError { message: String },
}

pub trait Verdict: Sized + Send + Sync {
    /// Create workdir, setting up environments
    fn prepare(workdir: &Path, id: u64) -> impl std::future::Future<Output = Result<Self, VerdictError>> + Send;

    /// Compile source code to executable
    fn compile(&self, source: &str) -> impl std::future::Future<Output = Result<CompileResult, VerdictError>> + Send;

    /// Verdict test case
    fn verdict(&self, case: Case, limit: &ResourcesLimit, id: u64) -> impl std::future::Future<Output = Result<CaseVerdict, VerdictError>> + Send;

    /// Cleanup workdir and environments
    fn cleanup(&self) -> impl std::future::Future<Output = Result<(), VerdictError>> + Send;
}

#[derive(Debug, thiserror::Error)]
pub enum VerdictError {
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error(transparent)]
    Cgroup(#[from] cgroups_rs::fs::error::Error),
}

#[instrument(skip(task), fields(task_id = id))]
pub async fn handle<T: Verdict + 'static>(id: u64, task: VerdictTask) -> VerdictTaskResult {
    let workdir = Path::new("/work").join(id.to_string());

    debug!(work_dir = %workdir.display(), "preparing workdir");

    let judge = match T::prepare(&workdir, id).await {
        Ok(judge) => judge,
        Err(e) => {
            error!(error = %e, "prepare failed");
            return VerdictTaskResult::Internal { message: e.to_string() };
        }
    };

    debug!(source_len = task.source.len(), "compiling");

    let compile_result = match judge.compile(&task.source).await {
        Ok(result) => result,
        Err(e) => {
            error!(error = %e, "compile failed");
            let _ = judge.cleanup().await;
            return VerdictTaskResult::Internal { message: e.to_string() };
        }
    };

    match compile_result {
        CompileResult::CompilationError { message } => {
            info!(message_len = message.len(), "compilation error");
            let _ = judge.cleanup().await;
            return VerdictTaskResult::CompilationError { message };
        }
        CompileResult::Timeout => {
            info!("compilation timeout");
            let _ = judge.cleanup().await;
            return VerdictTaskResult::CompilationError { message: "Timeout".into() };
        }
        CompileResult::Success => {
            debug!("compilation succeeded");
        }
    }

    const BATCH_MAX: usize = 8;

    let judge = Arc::new(judge);

    static VERDICT_ID: AtomicU64 = AtomicU64::new(0);

    let mut cases = task.cases;
    let limits = task.limits;
    let stop_on_first = task.stop_on_first_error;
    let mut case_idx: usize = 0;
    let mut collected: Option<Vec<CaseVerdict>> = if stop_on_first { None } else { Some(Vec::with_capacity(cases.len())) };
    let mut max_usage: Option<ResourcesUsage> = None;

    while !cases.is_empty() {
        let batch_size = BATCH_MAX.min(cases.len());
        let batch: Vec<_> = cases.drain(..batch_size).collect();
        let mut join_set = JoinSet::new();

        for case in batch {
            let j = Arc::clone(&judge);
            let limits = limits.clone();
            let verdict_id = VERDICT_ID.fetch_add(1, Ordering::Relaxed);

            info!(case_idx, input_len = case.input.len(), "running case");

            join_set.spawn(async move { j.verdict(case, &limits, verdict_id).await });

            case_idx += 1;
        }

        while let Some(result) = join_set.join_next().await {
            match result {
                Ok(Ok(verdict)) => {
                    debug!(result = ?verdict, "case completed");

                    if stop_on_first && !matches!(verdict, CaseVerdict::Accepted { .. }) {
                        info!("stopping on first error");
                        join_set.abort_all();
                        let _ = judge.cleanup().await;
                        return VerdictTaskResult::Stopped { verdict };
                    }

                    if let CaseVerdict::Accepted { ref usage } = verdict {
                        match &mut max_usage {
                            Some(m) => {
                                m.cpu_time_ms = m.cpu_time_ms.max(usage.cpu_time_ms);
                                m.wall_time_ms = m.wall_time_ms.max(usage.wall_time_ms);
                                m.memory_bytes = m.memory_bytes.max(usage.memory_bytes);
                            }
                            None => max_usage = Some(usage.clone()),
                        }
                    }

                    if let Some(ref mut col) = collected {
                        col.push(verdict);
                    }
                }
                Ok(Err(e)) => {
                    error!(error = %e, "verdict error");
                    join_set.abort_all();
                    let _ = judge.cleanup().await;
                    return VerdictTaskResult::Internal { message: e.to_string() };
                }
                Err(e) if e.is_cancelled() => continue,
                Err(e) => {
                    error!(error = %e, "verdict task panicked");
                    join_set.abort_all();
                    let _ = judge.cleanup().await;
                    return VerdictTaskResult::Internal { message: e.to_string() };
                }
            }
        }
    }

    debug!("cleaning up");
    let _ = judge.cleanup().await;

    if stop_on_first {
        let final_result = VerdictTaskResult::AllPassed { max_usage: max_usage.unwrap() };
        info!(result = ?final_result, "verdict completed");
        final_result
    } else {
        let cases = collected.unwrap();
        let case_count = cases.len();
        let final_result = VerdictTaskResult::Collected { cases };
        info!(case_count, "verdict completed");
        final_result
    }
}
