use std::num::NonZeroU32;
use std::time::Duration;

use dashmap::DashMap;
use governor::{DefaultDirectRateLimiter, Quota};
use tracing::trace;

use super::RateLimiter;

pub struct InMemoryRateLimiter {
    limiters: DashMap<String, DefaultDirectRateLimiter>,
}

impl InMemoryRateLimiter {
    pub fn new(_eviction_ttl: Duration) -> Self {
        Self { limiters: DashMap::new() }
    }
}

impl RateLimiter for InMemoryRateLimiter {
    fn check(&self, key: &str, per_sec: u64, burst: u64) -> bool {
        let limiter = self.limiters.entry(key.to_string()).or_insert_with(|| {
            let per_sec = NonZeroU32::new(per_sec as u32).unwrap_or(NonZeroU32::new(1).unwrap());
            let burst = NonZeroU32::new(burst as u32).unwrap_or(NonZeroU32::new(1).unwrap());
            let quota = Quota::per_second(per_sec).allow_burst(burst);
            DefaultDirectRateLimiter::direct(quota)
        });

        match limiter.check() {
            Ok(_) => {
                trace!(key, status = "allowed", "rate limit check");
                true
            }
            Err(_) => {
                trace!(key, status = "denied", "rate limit check");
                false
            }
        }
    }
}
