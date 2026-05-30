use agent::{AgentError, verdict::handle};
use shared::{
    models::VerdictTask,
    protocol::{FrameId, receive, send},
};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<(), AgentError> {
    let listener = TcpListener::bind("127.0.0.1:3000").await?;

    loop {
        let (mut stream, _addr) = tokio::select! {
            result = listener.accept() => result?,
            _ = tokio::signal::ctrl_c() => break,
        };

        let (id, task): (FrameId, VerdictTask) = receive(&mut stream).await?;

        let res = match task.language {
            shared::models::Language::Cpp => handle::<agent::verdict::cpp::Cpp>(id, task).await,
        };

        send(&mut stream, id, res).await?;
    }

    Ok(())
}
