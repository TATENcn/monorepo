use std::sync::LazyLock;

use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};

static ALGORITHM: LazyLock<Argon2> = LazyLock::new(Argon2::default);

/// Hash a plaintext
pub fn hash(plain: &str) -> Result<String, argon2::password_hash::Error> {
    ALGORITHM.hash_password(plain.as_bytes()).map(|h| h.to_string())
}

/// Verify a plaintext
pub fn verify(plain: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
    let parsed = PasswordHash::new(hash)?;
    Ok(ALGORITHM.verify_password(plain.as_bytes(), &parsed).is_ok())
}
