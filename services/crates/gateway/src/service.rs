use std::{future::Future, pin::Pin, sync::Arc, time::Duration};

use bytes::Bytes;
use http_body_util::{BodyExt, Full, combinators::BoxBody};
use hyper::{Request, Response, StatusCode, body::Incoming};
use tracing::error;

use crate::{
    config::RouteConfig,
    router::{self, ProxyError},
};

pub struct ProxyService {
    routes: Arc<Vec<RouteConfig>>,
    timeout: Duration,
}

impl ProxyService {
    pub fn new(routes: Vec<RouteConfig>, timeout: Duration) -> Self {
        Self {
            routes: Arc::new(routes),
            timeout,
        }
    }
}

async fn handle_request(
    req: Request<Incoming>,
    matched: router::RouteMatch<'_>,
    timeout: Duration,
) -> Result<Response<BoxBody<Bytes, hyper::Error>>, ProxyError> {
    router::proxy(req, &matched, timeout).await
}

fn into_boxed_body(bytes: Bytes) -> BoxBody<Bytes, hyper::Error> {
    Full::new(bytes).map_err(|_| unreachable!()).boxed()
}

impl hyper::service::Service<Request<Incoming>> for ProxyService {
    type Response = Response<BoxBody<Bytes, hyper::Error>>;
    type Error = hyper::http::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn call(&self, req: Request<Incoming>) -> Self::Future {
        let routes = self.routes.clone();
        let timeout = self.timeout;

        Box::pin(async move {
            let path = req.uri().path().to_string();

            let matched = match router::match_route(&routes, &path) {
                Some(m) => m,
                None => return Ok(error_response(StatusCode::NOT_FOUND, "no route matched")),
            };

            match handle_request(req, matched, timeout).await {
                Ok(resp) => Ok(resp),
                Err(e) => {
                    error!(?e, "proxy error");
                    Ok(error_response(e.status_code(), &e.to_string()))
                }
            }
        })
    }
}

fn error_response(status: StatusCode, msg: &str) -> Response<BoxBody<Bytes, hyper::Error>> {
    Response::builder()
        .status(status)
        .body(into_boxed_body(Bytes::from(msg.to_string())))
        .expect("building error response")
}
