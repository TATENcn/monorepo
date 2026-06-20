import type {
	AcceptablezResponse,
	ErrorResponse,
	PoolMetrics,
	SuccessResponse,
	VerdictResponse,
	VerdictTask,
} from "models/judge-core";

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

export interface JudgeCoreClientOptions {
	baseUrl?: string;
	usingStandalone?: boolean;
}

export class JudgeCoreClient {
	private baseUrl: string;
	private usingStandalone: boolean;

	constructor(options: JudgeCoreClientOptions = {}) {
		this.baseUrl = (options.baseUrl ?? "http://0.0.0.0:8000").replace(
			/\/+$/,
			"",
		);
		this.usingStandalone = options.usingStandalone ?? false;
	}

	async getMetrics(): Promise<SuccessResponse<PoolMetrics>> {
		this.assertNotStandalone();
		return this.get("/metricsz");
	}

	async getAcceptablez(): Promise<SuccessResponse<AcceptablezResponse>> {
		this.assertNotStandalone();
		return this.get("/acceptablez");
	}

	async submitTask(
		task: VerdictTask,
	): Promise<SuccessResponse<VerdictResponse>> {
		return this.post("/task", task);
	}

	private assertNotStandalone(): void {
		if (this.usingStandalone) {
			throw new JudgeCoreError(
				"endpoint not available in standalone mode",
				"STANDALONE_MODE",
				0,
			);
		}
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
