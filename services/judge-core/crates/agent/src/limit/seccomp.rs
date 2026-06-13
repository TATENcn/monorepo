use libseccomp::{ScmpAction, ScmpArch, ScmpFilterContext, ScmpSyscall, error::SeccompError};
use shared::models::Language;

fn cpp_seccomp_filter() -> Result<ScmpFilterContext, SeccompError> {
    let mut filter = ScmpFilterContext::new(ScmpAction::Errno(libc::EPERM))?;
    filter.add_arch(ScmpArch::X8664)?;

    let allowed = [
        "read",
        "write",
        "openat",
        "close",
        "fstat",
        "newfstatat",
        "lseek",
        "mmap",
        "munmap",
        "mprotect",
        "brk",
        "pread64",
        "pwrite64",
        "exit_group",
        "exit",
        "arch_prctl",
        "set_tid_address",
        "set_robust_list",
        "futex",
        "rt_sigaction",
        "rt_sigprocmask",
        "sigaltstack",
        "getrandom",
        "clock_gettime",
        "gettimeofday",
        "time",
        "getpid",
        "getppid",
        "sched_getaffinity",
        "access",
        "faccessat",
        "getcwd",
        "readlink",
        "readlinkat",
        "ioctl",
        "fcntl",
        "dup",
        "dup2",
        "pipe",
        "pipe2",
        "statx",
        // REVIEW: we need it for execve user program
        "execve",
    ];

    for name in &allowed {
        let syscall = ScmpSyscall::from_name(name)?;
        filter.add_rule(ScmpAction::Allow, syscall)?;
    }

    Ok(filter)
}

pub fn seccomp_filter(language: Language) -> Result<ScmpFilterContext, SeccompError> {
    match language {
        Language::Cpp => cpp_seccomp_filter(),
    }
}
