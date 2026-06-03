use agent::{AgentError, verdict::handle};
use shared::{
    models::VerdictTask,
    protocol::{FrameId, receive, send},
};
use tokio::net::TcpListener;
use tracing::{debug, info};

#[tokio::main]
async fn main() -> Result<(), AgentError> {
    tracing_subscriber::fmt::init();

    let listener = TcpListener::bind("127.0.0.1:3000").await?;

    loop {
        let (mut stream, _addr) = tokio::select! {
            result = listener.accept() => result?,
            _ = tokio::signal::ctrl_c() => {
                info!("shutting down");
                break;
            }
        };

        let (id, task): (FrameId, VerdictTask) = receive(&mut stream).await?;

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
