use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use tokio::time::interval;
use tracing::{debug, error, info};

use crate::pool::AgentPool;

#[derive(Debug, Clone)]
pub struct ScalerConfig {
    pub min_agents: usize,
    pub max_agents: usize,
    pub scale_up_threshold: usize,
    pub scale_down_threshold: usize,
    pub cooldown_secs: u64,
    pub check_interval_secs: u64,
}

impl Default for ScalerConfig {
    fn default() -> Self {
        Self {
            min_agents: 2,
            max_agents: 10,
            scale_up_threshold: 5,
            scale_down_threshold: 3,
            cooldown_secs: 60,
            check_interval_secs: 10,
        }
    }
}

pub struct AutoScaler;

impl AutoScaler {
    #[tracing::instrument(skip(pool, config))]
    pub async fn run(pool: Arc<AgentPool>, config: ScalerConfig) {
        let mut ticker = interval(Duration::from_secs(config.check_interval_secs));
        let mut last_scale = Instant::now() - Duration::from_secs(config.cooldown_secs);

        loop {
            ticker.tick().await;

            let metrics = pool.metrics().await;

            let idle_agents = metrics.agent_count.saturating_sub(metrics.active_tasks as usize);

            debug!(
                queue_size = metrics.queue_size,
                agent_count = metrics.agent_count,
                healthy_agents = metrics.healthy_agent_count,
                active_tasks = metrics.active_tasks,
                idle_agents,
                "scaler evaluation"
            );

            let now = Instant::now();
            if now.duration_since(last_scale).as_secs() < config.cooldown_secs {
                debug!("cooldown active, skipping");
                continue;
            }

            let needs_scale_up = if metrics.agent_count == 0 {
                metrics.queue_size > 0
            } else {
                metrics.queue_size > config.scale_up_threshold
            };

            if needs_scale_up && metrics.agent_count < config.max_agents {
                info!(
                    queue_size = metrics.queue_size,
                    agent_count = metrics.agent_count,
                    "scaling up: creating new agent"
                );
                last_scale = now;

                match pool.provisioner.create().await {
                    Ok((id, socket_path)) => {
                        pool.add_agent(id, socket_path).await;
                    }
                    Err(e) => {
                        error!(error = %e, "failed to create agent during scale-up");
                    }
                }
            } else if idle_agents > config.scale_down_threshold && metrics.agent_count > config.min_agents {
                info!(idle_agents, agent_count = metrics.agent_count, "scaling down: destroying idle agent");

                if let Some(agent) = pool.find_oldest_idle_agent().await {
                    let id = agent.id.clone();
                    last_scale = now;

                    match pool.remove_agent(&id).await {
                        Ok(_) => {
                            if let Err(e) = pool.provisioner.destroy(&id).await {
                                error!(agent_id = %id, error = %e, "failed to destroy agent during scale-down");
                            }
                        }
                        Err(e) => {
                            error!(agent_id = %id, error = %e, "failed to remove agent during scale-down");
                        }
                    }
                }
            }
        }
    }
}
