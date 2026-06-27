use api_server::{ApiServerError, config::ApiServerConfig};
use tracing::{error, info};

#[tokio::main]
async fn main() -> Result<(), ApiServerError> {
    tracing_subscriber::fmt::init();

    let config = ApiServerConfig::load()?;
    if let Err(msg) = config.auth.validate() {
        error!("{msg}");
        return Err(ApiServerError::Config(config::ConfigError::Message(msg.into())));
    }
    info!(?config, "configuration loaded");

    Ok(())
}
