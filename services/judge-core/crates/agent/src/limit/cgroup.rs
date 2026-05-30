use cgroups_rs::fs::cpu::CpuController;
use cgroups_rs::fs::error::Error as CgroupError;
use cgroups_rs::fs::memory::MemController;
use cgroups_rs::fs::{Cgroup, cgroup_builder::CgroupBuilder, hierarchies};
use shared::models::{ResourcesLimit, ResourcesUsage};
use tokio::time::Instant;

pub struct CgroupGuard {
    cgroup: Cgroup,

    start_time: Option<Instant>,
}

impl Drop for CgroupGuard {
    fn drop(&mut self) {
        let _ = self.cgroup.delete();
    }
}

impl CgroupGuard {
    pub fn new(id: &str, limit: &ResourcesLimit) -> Result<Self, CgroupError> {
        let hier = hierarchies::V2::new();
        let cgroup = CgroupBuilder::new(id)
            .memory()
            .memory_hard_limit(limit.memory_bytes as i64)
            .done()
            .build(Box::new(hier))?;

        Ok(Self { cgroup, start_time: None })
    }

    pub fn apply_current_process(&mut self) -> Result<(), CgroupError> {
        let pid = std::process::id() as u64;

        self.start_time = Some(Instant::now());
        self.cgroup.add_task(pid.into())
    }

    pub fn usage(&self) -> ResourcesUsage {
        let memory_controller: &MemController = self.cgroup.controller_of().unwrap();
        let memory_bytes = memory_controller.memory_stat().max_usage_in_bytes;

        let cpu_controller: &CpuController = self.cgroup.controller_of().unwrap();
        let cpu_time_ms = Self::parse_cpu_stat(cpu_controller.cpu().stat);

        let wall_time_ms = self.start_time.unwrap().elapsed().as_millis() as u64;

        ResourcesUsage {
            cpu_time_ms,
            wall_time_ms,
            memory_bytes,
        }
    }

    /// Parse cpu stat and returns cpu time (contains user and system usage)
    fn parse_cpu_stat(stat: String) -> u64 {
        for (_line_num, line) in stat.lines().enumerate() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() != 2 {
                panic!("Invalid cgroup format: {}", line);
            }

            let key = parts[0];
            if key != "usage_usec" {
                continue;
            }

            let value_str = parts[1];
            let value = match value_str.parse::<u64>() {
                Ok(v) => v,
                Err(e) => {
                    panic!("Invalid cgroup value: {}", e);
                }
            };

            return value / 1000;
        }

        panic!("Cannot find `usage_usec` in cpu stat")
    }
}
