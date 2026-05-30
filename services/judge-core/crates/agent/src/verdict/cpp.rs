use crate::verdict::Verdict;

pub struct Cpp {}

impl Verdict for Cpp {
    async fn prepare(workdir: &std::path::Path, id: u64) -> Result<Self, super::VerdictError> {
        todo!()
    }

    async fn compile(&self, source: &str) -> Result<super::CompileResult, super::VerdictError> {
        todo!()
    }

    async fn verdict(
        &self,
        case: shared::models::Case,
        limit: &shared::models::ResourcesLimit,
    ) -> Result<shared::models::VerdictTaskResult, super::VerdictError> {
        todo!()
    }

    async fn cleanup(&self) -> Result<(), super::VerdictError> {
        todo!()
    }
}
