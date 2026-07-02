use config::{Config, ConfigError, Environment, File};
use serde::{Deserialize, Serialize};

#[config_macro::config]
#[derive(Debug, Deserialize, Serialize)]
pub struct ApiServerConfig {
    #[serde(default)]
    pub database: DatabaseConfig,
}

#[config_macro::config]
#[derive(Debug, Deserialize, Serialize)]
pub struct DatabaseConfig {
    #[config_val(default = "postgresql://postgres:postgres@localhost:5432/taten".into())]
    pub database_url: String,
}

const DEFAULT_CONFIG_PATH: &str = "./config/api_server.toml";
const CONFIG_PATH_ENV: &str = "API_SERVER_CONFIG_PATH";
const ENV_PREFIX: &str = "API_SERVER";

impl ApiServerConfig {
    pub fn load() -> Result<Self, ConfigError> {
        let config_path = std::env::var(CONFIG_PATH_ENV).unwrap_or_else(|_| DEFAULT_CONFIG_PATH.into());

        let config = Config::builder()
            .add_source(File::with_name(&config_path).required(false))
            .add_source(Environment::with_prefix(ENV_PREFIX).separator("__"))
            .build()?;

        config.try_deserialize()
    }
}
