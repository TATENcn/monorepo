use containerd_client::{
    connect,
    services::v1::version_client,
    tonic::transport::{self, Channel},
};
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), ManagerError> {
    tracing_subscriber::fmt::init();

    let connection = connect("/run/containerd/containerd.sock").await?;

    info!(version = containerd_version(connection).await?, "containerd connected");

    Ok(())
}

async fn containerd_version(connection: Channel) -> Result<String, ManagerError> {
    let mut version_client = version_client::VersionClient::new(connection);
    let version = version_client.version(()).await?.into_inner().version;

    Ok(version)
}

#[derive(Debug, thiserror::Error)]
pub enum ManagerError {
    #[error(transparent)]
    Connect(#[from] transport::Error),
    #[error("Rpc error: {0}")]
    Rpc(containerd_client::tonic::Code, String),
}

impl From<containerd_client::tonic::Status> for ManagerError {
    fn from(value: containerd_client::tonic::Status) -> Self {
        let code = value.code();
        let message = value.message();

        Self::Rpc(code, message.to_owned())
    }
}
