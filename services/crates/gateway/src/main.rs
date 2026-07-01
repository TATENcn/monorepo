pub mod config;

#[tokio::main]
async fn main() -> Result<(), GatewayError> {
    let config = config::GatewayConfig::load()?;

    Ok(())
}

#[derive(Debug, thiserror::Error)]
pub enum GatewayError {
    #[error(transparent)]
    Config(#[from] ::config::ConfigError),
}
