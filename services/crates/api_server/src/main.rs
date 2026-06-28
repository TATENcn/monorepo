use std::sync::Arc;

use api_server::{ApiServerError, config::ApiServerConfig};
use auth::router::{jwks_router, router};
use axum::Router;
use sea_orm::Database;
use tokio::net::TcpListener;
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
    let connection = Database::connect(&config.database.database_url).await?;
    let auth_state = Arc::new(config.to_auth_app_state(connection.clone()).await?);

    let listener = TcpListener::bind("localhost:3080").await?;
    let router = Router::new()
        .nest("/api/v1/auth", router(auth_state.clone()))
        .nest("/.well-known", jwks_router(auth_state));

    axum::serve(listener, router)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.expect("failed to listen for `ctrl_c`");
            info!("shutdown signal received, stopping HTTP server");
        })
        .await?;

    Ok(())
}
