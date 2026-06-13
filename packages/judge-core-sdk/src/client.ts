import type {
	AcceptablezResponse,
	ErrorResponse,
	PoolMetrics,
	SuccessResponse,
	VerdictResponse,
	VerdictTask,
} from "./types";

export class JudgeCoreError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly status: number,
	) {
		super(message);
		this.name = "JudgeCoreError";
	}
}

export class JudgeCoreClient {
	private baseUrl: string;

	constructor(baseUrl = "http://0.0.0.0:8000") {
		this.baseUrl = baseUrl.replace(/\/+$/, "");
	}

	async getMetrics(): Promise<SuccessResponse<PoolMetrics>> {
		return this.get("/metricsz");
	}

	async getAcceptablez(): Promise<SuccessResponse<AcceptablezResponse>> {
		return this.get("/acceptablez");
	}

	async submitTask(
		task: VerdictTask,
	): Promise<SuccessResponse<VerdictResponse>> {
		return this.post("/task", task);
	}

	private async get<T>(path: string): Promise<SuccessResponse<T>> {
		const res = await fetch(`${this.baseUrl}${path}`);
		if (!res.ok) {
			await this.handleError(res);
		}
		return res.json() as Promise<SuccessResponse<T>>;
	}

	private async post<T>(
		path: string,
		body: unknown,
	): Promise<SuccessResponse<T>> {
		const res = await fetch(`${this.baseUrl}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			await this.handleError(res);
		}
		return res.json() as Promise<SuccessResponse<T>>;
	}

	private async handleError(res: Response): Promise<never> {
		let body: ErrorResponse | null = null;
		try {
			body = (await res.json()) as ErrorResponse;
		} catch {
			// body not JSON
		}
		throw new JudgeCoreError(
			body?.message ?? res.statusText,
			body?.error.code ?? "UNKNOWN",
			res.status,
		);
	}
}
