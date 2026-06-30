use std::sync::Arc;

use axum::{
    extract::{Extension, FromRequestParts},
    http::{StatusCode, header, request::Parts},
    response::{IntoResponse, Response},
};
use uuid::Uuid;

use crate::{router::AppState, token};

/// Authenticated user identity extracted from a valid JWT
#[derive(Debug, Clone)]
pub struct Identity {
    pub user_id: Uuid,
}

/// NOTES:
/// - [`Auth<Identity>`] requires a valid access token
/// - [`Auth<Option<Identity>>`] yields [`Option::None`] when no header is present (but still rejects malformed or expired tokens)
#[derive(Debug)]
pub struct Auth<T>(pub T);

impl<S> FromRequestParts<S> for Auth<Identity>
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth_state = get_auth_state(parts, state).await?;
        let identity = extract_identity(parts, &auth_state).await?;
        Ok(Auth(identity))
    }
}

impl<S> FromRequestParts<S> for Auth<Option<Identity>>
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth_state = get_auth_state(parts, state).await?;

        let Some(auth_header) = parts.headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()) else {
            return Ok(Auth(None));
        };

        let identity = verify_bearer(auth_header, &auth_state)?;

        Ok(Auth(Some(identity)))
    }
}

/// [RFC 6750#3.1](https://datatracker.ietf.org/doc/html/rfc6750#section-3.1)
#[derive(Debug, Clone, Copy)]
pub enum AuthError {
    StateNotConfigured,
    MissingHeader,
    InvalidHeader,
    InvalidToken,
    BadSubject,
}

impl Into<StatusCode> for AuthError {
    fn into(self) -> StatusCode {
        match self {
            Self::StateNotConfigured | Self::BadSubject => StatusCode::INTERNAL_SERVER_ERROR,
            Self::MissingHeader | Self::InvalidHeader | Self::InvalidToken => StatusCode::UNAUTHORIZED,
        }
    }
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let mut res = Into::<StatusCode>::into(self).into_response();

        if let Some(err) = self.www_auth_error() {
            let www_auth = WwwAuthenticate::bearer("api", err);
            res.headers_mut().insert(header::WWW_AUTHENTICATE, www_auth.to_header_value());
        }

        res
    }
}

impl AuthError {
    /// [RFC 6750#3.1](https://datatracker.ietf.org/doc/html/rfc6750#section-3.1)
    fn www_auth_error(self) -> Option<WwwAuthError> {
        match self {
            Self::StateNotConfigured | Self::BadSubject => None,
            Self::MissingHeader | Self::InvalidHeader | Self::InvalidToken => Some(WwwAuthError::InvalidToken),
        }
    }
}

/// [RFC 6750#3.1](https://datatracker.ietf.org/doc/html/rfc6750#section-3.1)
#[derive(Debug, Clone, Copy)]
pub enum WwwAuthError {
    InvalidToken,
    InvalidRequest,
    InsufficientScope,
}

impl WwwAuthError {
    fn as_str(self) -> &'static str {
        match self {
            Self::InvalidToken => "invalid_token",
            Self::InvalidRequest => "invalid_request",
            Self::InsufficientScope => "insufficient_scope",
        }
    }
}

/// [RFC 7235](https://datatracker.ietf.org/doc/html/rfc7235#section-4.1),
/// [RFC 6750#3.1](https://datatracker.ietf.org/doc/html/rfc6750#section-3.1)
/// `WWW-Authenticate` header builder
#[derive(Debug, Clone)]
pub struct WwwAuthenticate {
    scheme: &'static str,
    params: Vec<(&'static str, &'static str)>,
}

impl WwwAuthenticate {
    pub fn bearer(realm: &'static str, error: WwwAuthError) -> Self {
        Self {
            scheme: "Bearer",
            params: vec![("realm", realm), ("error", error.as_str())],
        }
    }

    pub fn to_header_value(&self) -> axum::http::HeaderValue {
        let value = self.params.iter().map(|(k, v)| format!("{k}=\"{v}\"")).collect::<Vec<_>>().join(", ");
        format!("{} {}", self.scheme, value).parse().unwrap()
    }
}

async fn get_auth_state<S: Send + Sync>(parts: &mut Parts, state: &S) -> Result<Arc<AppState>, Response> {
    Extension::<Arc<AppState>>::from_request_parts(parts, state)
        .await
        .map(|e| e.0)
        .map_err(|_| AuthError::StateNotConfigured.into_response())
}

async fn extract_identity(parts: &mut Parts, auth_state: &Arc<AppState>) -> Result<Identity, Response> {
    let auth_header = parts
        .headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AuthError::MissingHeader.into_response())?;

    verify_bearer(auth_header, auth_state)
}

fn verify_bearer(auth_header: &str, auth_state: &Arc<AppState>) -> Result<Identity, Response> {
    let token = auth_header.strip_prefix("Bearer ").ok_or_else(|| AuthError::InvalidHeader.into_response())?;
    // [RFC 6749#1.5](https://datatracker.ietf.org/doc/html/rfc6749#section-1.5)
    let data = token::verify(token, token::TokenType::Access, &auth_state.public_key_pem).map_err(|_| AuthError::InvalidToken.into_response())?;

    let user_id = Uuid::parse_str(&data.claims.sub).map_err(|_| AuthError::BadSubject.into_response())?;

    Ok(Identity { user_id })
}
