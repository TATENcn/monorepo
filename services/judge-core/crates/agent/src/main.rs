use agent::{AgentError, verdict::handle};
use shared::{
    models::VerdictTask,
    protocol::{receive, send},
};
use tokio::net::UnixListener;
use tracing::{debug, info};

#[tokio::main]
async fn main() -> Result<(), AgentError> {
    tracing_subscriber::fmt::init();

    let listener = UnixListener::bind("/run/judge-core/agent.sock")?;

    loop {
        let (mut stream, _addr) = tokio::select! {
            result = listener.accept() => result?,
            _ = tokio::signal::ctrl_c() => {
                info!("shutting down");
                break;
            }
        };

        let (id, task) = match receive::<VerdictTask, _>(&mut stream).await? {
            Some(pair) => pair,
            None => {
                debug!("heartbeat received, closing connection");
                continue;
            }
        };

        info!(task_id = id, language = ?task.language, "starting verdict");

        let res = match task.language {
            shared::models::Language::Cpp => handle::<agent::verdict::cpp::Cpp>(id, task).await,
        };

        info!(task_id = id, result = ?res, "verdict completed");

        send(&mut stream, id, res).await?;

        debug!(task_id = id, "response sent");
    }

    Ok(())
}
