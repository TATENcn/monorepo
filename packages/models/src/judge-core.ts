// Mirrors shared::models::ResourcesLimit
export interface ResourcesLimit {
	cpu_time_ms: number;
	wall_time_ms: number;
	memory_bytes: number;
	output_bytes: number;
}

// Mirrors shared::models::ResourcesUsage
export interface ResourcesUsage {
	cpu_time_ms: number;
	wall_time_ms: number;
	memory_bytes: number;
}

// Mirrors shared::models::Case
export interface Case {
	input: string;
	output: string;
}

// Mirrors shared::models::Language
export enum Language {
	Cpp = "Cpp",
}

// Mirrors shared::models::VerdictTask
export interface VerdictTask {
	source: string;
	cases: Case[];
	limits: ResourcesLimit;
	language: Language;
	stop_on_first_error: boolean;
}

// Mirrors shared::models::KilledReason (serde internally-tagged enum)
export type KilledReason = "MemoryLimitExceeded" | "WallTimeLimitExceeded" | "CpuTimeLimitExceeded" | "OutputLimitExceeded" | { Signaled: { signal: number } };

// Mirrors http::CaseVerdictResponse (serde tag = "case_status")
export type CaseVerdictResponse =
	| { case_status: "accepted"; usage: ResourcesUsage }
	| { case_status: "killed"; reason: KilledReason; stdout: string; stderr: string }
	| { case_status: "wrong_answer"; wrong_case: Case; received: string; stderr: string }
	| { case_status: "runtime_error"; stderr: string; exit_code: number };

// Mirrors http::VerdictResponse (serde tag = "status")
export type VerdictResponse =
	| { status: "stopped"; verdict: CaseVerdictResponse }
	| { status: "all_passed"; max_usage: ResourcesUsage }
	| { status: "collected"; cases: CaseVerdictResponse[] }
	| { status: "internal"; message: string }
	| { status: "compilation_error"; message: string };

// Mirrors manager::router::AcceptablezResponse
export interface AcceptablezResponse {
	acceptable: boolean;
	metrics: PoolMetrics;
}

// Mirrors pool::PoolMetrics
export interface PoolMetrics {
	queue_size: number;
	agent_count: number;
	healthy_agent_count: number;
	active_tasks: number;
	draining_agent_count: number;
	unhealthy_agent_count: number;
}

// Mirrors http::SuccessResponse<T>
export interface SuccessResponse<T> {
	data: T;
	message: string;
}

// Mirrors http::ErrorResponse
export interface ErrorResponse {
	error: { code: string };
	message: string;
}
