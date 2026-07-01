use bytes::Bytes;
use http_body_util::Full;
use hyper::{Request, Response, body::Incoming};
use hyper_util::rt::{TokioExecutor, TokioIo};
use hyper_util::server::conn::auto::Builder as AutoBuilder;
use tokio::io;
use tokio::net::TcpListener;
use tracing::{error, info};

pub mod config;

async fn handle_request(req: Request<Incoming>) -> Result<Response<Full<Bytes>>, hyper::http::Error> {
    info!(method = ?req.method(), uri = ?req.uri(), version = ?req.version(), "received connection");

    let body = format!("Hello world!\n");

    Response::builder()
        .status(200)
        .header("Content-Type", "text/plain")
        .body(Full::new(Bytes::from(body)))
}

#[tokio::main]
async fn main() -> Result<(), GatewayError> {
    tracing_subscriber::fmt::init();

    let config = config::GatewayConfig::load()?;
    let listener = TcpListener::bind(config.addr).await?;

    loop {
        let (stream, addr) = listener.accept().await?;
        info!(?addr, "accepted connection");

        tokio::spawn(async move {
            if let Err(err) = AutoBuilder::new(TokioExecutor::new())
                .serve_connection(TokioIo::new(stream), hyper::service::service_fn(handle_request))
                .await
            {
                error!(?err, "unexpected error occurred")
            }
        });
    }

    Ok(())
}

#[derive(Debug, thiserror::Error)]
pub enum GatewayError {
    #[error(transparent)]
    Config(#[from] ::config::ConfigError),
    #[error(transparent)]
    Io(#[from] io::Error),
}
