//! Resource limiter — process-wide semaphore front-end for Tauri commands.
//!
//! Extracted from `utils/resilience.rs` to keep each module under 300 lines.

use std::sync::{Arc, OnceLock};
use tokio::sync::{Semaphore, SemaphorePermit};

/// Permits granted to a single process. Defaults to `cpus-1`, clamped to
/// `[1, 8]`.
fn default_permits() -> usize {
    let env_val = std::env::var("FABLR_RESOURCE_PERMITS")
        .or_else(|_| std::env::var("STORYFAB_RESOURCE_PERMITS"));
    if let Ok(raw) = env_val {
        if let Ok(n) = raw.parse::<usize>() {
            if n > 0 {
                return n.clamp(1, 32);
            }
        }
    }
    let logical = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    logical.saturating_sub(1).clamp(1, 8)
}

fn shared_semaphore() -> &'static Arc<Semaphore> {
    static SEM: OnceLock<Arc<Semaphore>> = OnceLock::new();
    SEM.get_or_init(|| {
        let permits = default_permits();
        tracing::info!(
            "[resilience] resource limiter initialized with {} permits (cpus={})",
            permits,
            std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(0)
        );
        Arc::new(Semaphore::new(permits))
    })
}

/// Cheap, clone-friendly handle to a `Semaphore`-backed limiter.
#[derive(Clone)]
pub struct ResourceLimiter {
    sem: Arc<Semaphore>,
    total: usize,
}

impl ResourceLimiter {
    /// Handle to the process-wide shared limiter.
    pub fn shared() -> Self {
        let sem = shared_semaphore().clone();
        Self { sem, total: 0 }
    }

    /// Create an **independent** limiter with a specific permit count.
    pub fn with_capacity(permits: usize) -> Self {
        let permits = permits.max(1);
        Self {
            sem: Arc::new(Semaphore::new(permits)),
            total: permits,
        }
    }
}

impl ResourceLimiter {
    /// Acquire a permit.
    pub async fn acquire(&self) -> Result<SemaphorePermit<'_>, ResourceError> {
        self.sem
            .acquire()
            .await
            .map_err(|_| ResourceError::ShuttingDown)
    }

    /// Try to acquire a permit without waiting.
    pub fn try_acquire(&self) -> Option<SemaphorePermit<'_>> {
        self.sem.try_acquire().ok()
    }

    /// Number of permits currently available.
    pub fn available_permits(&self) -> usize {
        self.sem.available_permits()
    }

    /// Total permits this limiter was configured with.
    pub fn total_permits(&self) -> usize {
        if self.total > 0 {
            return self.total;
        }
        static TOTAL: OnceLock<usize> = OnceLock::new();
        *TOTAL.get_or_init(default_permits)
    }
}

/// Errors emitted by [`ResourceLimiter::acquire`].
#[derive(Debug, thiserror::Error)]
pub enum ResourceError {
    #[error("resource limiter is shutting down")]
    ShuttingDown,
}

impl ResourceError {
    pub fn to_user_message(&self) -> &'static str {
        match self {
            ResourceError::ShuttingDown => "应用正在关闭，请稍后重试",
        }
    }
}

pub fn resource_error_to_user_message(err: ResourceError) -> String {
    err.to_user_message().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_permits_is_at_least_one() {
        let n = default_permits();
        assert!(n >= 1, "default permits must be ≥ 1, got {n}");
    }

    #[test]
    fn limiter_clone_share_state() {
        let a = ResourceLimiter::with_capacity(3);
        let b = a.clone();
        let total_before = a.available_permits();
        let permit = a.try_acquire();
        assert!(permit.is_some(), "expected to acquire a permit on idle limiter");
        assert_eq!(b.available_permits(), total_before - 1);
        drop(permit);
        assert_eq!(b.available_permits(), total_before);
    }

    #[test]
    fn permit_released_on_drop() {
        let l = ResourceLimiter::with_capacity(3);
        let total = l.total_permits();
        {
            let p = l.try_acquire().expect("idle limiter must yield a permit");
            assert_eq!(l.available_permits(), total - 1);
            drop(p);
        }
        assert_eq!(l.available_permits(), total);
    }

    #[test]
    fn try_acquire_saturates() {
        let l = ResourceLimiter::with_capacity(3);
        let total = l.total_permits();
        assert_eq!(total, 3);

        let mut held = Vec::with_capacity(total);
        for _ in 0..total {
            held.push(
                l.try_acquire()
                    .expect("permit must be available while pool is not exhausted"),
            );
        }
        assert!(
            l.try_acquire().is_none(),
            "try_acquire must return None after exhausting the pool"
        );
        held.clear();
        assert_eq!(l.available_permits(), total);
    }

    #[test]
    fn independent_limiters_do_not_share_state() {
        let a = ResourceLimiter::with_capacity(2);
        let b = ResourceLimiter::with_capacity(2);
        let _pa1 = a.try_acquire().unwrap();
        let _pa2 = a.try_acquire().unwrap();
        assert!(a.try_acquire().is_none(), "a must be exhausted");
        assert_eq!(b.available_permits(), 2, "b must be untouched");
    }

    #[tokio::test]
    async fn acquire_awaits_and_releases() {
        let l = ResourceLimiter::with_capacity(3);
        let total = l.total_permits();
        let permit = l.acquire().await.expect("acquire must succeed");
        assert_eq!(l.available_permits(), total - 1);
        drop(permit);
        assert_eq!(l.available_permits(), total);
    }
}
