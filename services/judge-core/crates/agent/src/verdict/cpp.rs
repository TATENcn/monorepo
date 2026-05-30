use std::{path::PathBuf, process::Stdio, time::Duration};

use tokio::{fs, io::AsyncReadExt, process, time::timeout};

use crate::verdict::Verdict;

pub struct Cpp {
    work_dir: PathBuf,
}

impl Verdict for Cpp {
    async fn prepare(workdir: &std::path::Path, _id: u64) -> Result<Self, super::VerdictError> {
        fs::create_dir_all(workdir).await?;

        Ok(Self {
            work_dir: workdir.to_path_buf(),
        })
    }

    async fn compile(&self, source: &str) -> Result<super::CompileResult, super::VerdictError> {
        let source_path = self.work_dir.join("source.cpp");
        fs::write(&source_path, source).await?;

        let mut cmd = process::Command::new("g++");
        cmd.arg("-std=c++23")
            .arg("-w")
            .arg(source_path.display().to_string())
            .arg("-o")
            .arg("executable")
            .current_dir(&self.work_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // TODO: Apply resource limits

        let mut child = cmd.spawn()?;
        let result = timeout(Duration::from_secs(10), child.wait()).await;
        match result {
            Ok(status) => {
                let status = status?;
                if status.success() {
                    Ok(super::CompileResult::Success)
                } else {
                    let mut message = String::new();
                    if let Some(mut stderr) = child.stderr.take() {
                        stderr.read_to_string(&mut message).await?;
                    }
                    Ok(super::CompileResult::CompilationError { message })
                }
            }
            Err(_) => {
                child.kill().await?;
                Ok(super::CompileResult::Timeout)
            }
        }
    }

    async fn verdict(
        &self,
        case: shared::models::Case,
        limit: &shared::models::ResourcesLimit,
    ) -> Result<shared::models::VerdictTaskResult, super::VerdictError> {
        todo!()
    }

    async fn cleanup(&self) -> Result<(), super::VerdictError> {
        fs::remove_dir_all(&self.work_dir).await?;

        Ok(())
    }
}
