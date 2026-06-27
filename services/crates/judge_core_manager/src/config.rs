use std::{path::Path, time::Duration};

use config::{Config, ConfigError, Environment, File};
use config_macro::config;
use serde::Deserialize;

const DEFAULT_CONFIG_PATH: &str = "./config/manager.toml";
const CONFIG_PATH_ENV: &str = "JC_MANAGER_CONFIG_PATH";
const ENV_PREFIX: &str = "JC_MANAGER";

#[config]
#[derive(Debug, Clone, Deserialize)]
pub struct PoolConfig {
    #[config_val(default = 1000)]
    pub max_queue_size: usize,
    #[config_val(default = 3)]
    pub max_retries: u32,
    #[config_val(default_secs = 45)]
    pub task_timeout: Duration,
    #[config_val(default_secs = 5)]
    pub health_check_interval: Duration,
    #[config_val(default = 3)]
    pub health_check_failure_threshold: u32,
    #[config_val(default = 5)]
    pub max_concurrent_per_agent: u32,
    #[config_val(default = 5)]
    pub drain_check_interval_secs: u64,
}

#[config]
#[derive(Debug, Clone, Deserialize)]
pub struct ScalerConfig {
    #[config_val(default = 2)]
    pub min_agents: usize,
    #[config_val(default = 10)]
    pub max_agents: usize,
    #[config_val(default = 0.3)]
    pub scale_down_utilization_pct: f64,
    #[config_val(default = 5)]
    pub scale_up_cooldown_secs: u64,
    #[config_val(default = 300)]
    pub scale_down_cooldown_secs: u64,
    #[config_val(default = 10)]
    pub check_interval_secs: u64,
    #[config_val(default = 30)]
    pub provision_time_secs: u64,
    #[config_val(default = 3)]
    pub max_scale_up_batch: usize,
    #[config_val(default = 3)]
    pub scale_down_confirm_ticks: u32,
    #[config_val(default = 0.3)]
    pub ema_alpha: f64,
    #[config_val(default = 5)]
    pub max_concurrent_per_agent: u32,
}

#[config]
#[derive(Debug, Clone, Deserialize)]
pub struct ProvisionerConfig {
    #[config_val(default = "judge-core".into())]
    pub namespace: String,
    #[config_val(default = "io.containerd.runc.v2".into())]
    pub runtime: String,
}

#[config]
#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    #[config_val(default = "0.0.0.0:8000".into())]
    pub bind_address: String,
    #[config_val(default = "/run/containerd/containerd.sock".into())]
    pub containerd_socket: String,
    #[config_val(default = "docker.io/library/judge-core:latest".into())]
    pub image: String,
}

#[derive(Debug, Deserialize)]
pub struct ManagerConfig {
    #[serde(default)]
    pub pool: PoolConfig,
    #[serde(default)]
    pub scaler: ScalerConfig,
    #[serde(default)]
    pub server: ServerConfig,
    #[serde(default)]
    pub provisioner: ProvisionerConfig,
}

impl ManagerConfig {
    pub fn load() -> Result<Self, ConfigError> {
        let config_path = std::env::var(CONFIG_PATH_ENV).unwrap_or_else(|_| DEFAULT_CONFIG_PATH.into());

        let config = Config::builder()
            .add_source(File::with_name(&config_path).required(false))
            .add_source(Environment::with_prefix(ENV_PREFIX).separator("__"))
            .build()?;

        config.try_deserialize()
    }

    #[allow(dead_code)]
    pub fn load_from(path: impl AsRef<Path>) -> Result<Self, ConfigError> {
        let config = Config::builder()
            .add_source(File::with_name(path.as_ref().to_str().unwrap()).required(false))
            .add_source(Environment::with_prefix(ENV_PREFIX).separator("__"))
            .build()?;

        config.try_deserialize()
    }
}
