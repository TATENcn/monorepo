import { eq } from "drizzle-orm";
import type { VerdictResponse, VerdictTask } from "models/judge-core";
import type { AcceptableLanguage } from "../db/enums";
import type { Database } from "../db/schema";
import { problems, submissions, testCases } from "../db/schema";

export type SubmissionResult = VerdictResponse | "pending" | null;

export const submitSolution = async (
	db: Database,
	problemId: string,
	userId: string,
	sourceCode: string,
	language: AcceptableLanguage,
): Promise<{ submissionId: string; verdictTask: VerdictTask } | null> => {
	const [problem] = await db
		.select({
			limitCpuTimeMs: problems.limitCpuTimeMs,
			limitWallTimeMs: problems.limitWallTimeMs,
			limitMemoryBytes: problems.limitMemoryBytes,
			limitOutputBytes: problems.limitOutputBytes,
		})
		.from(problems)
		.where(eq(problems.id, problemId))
		.limit(1);
	if (!problem) return null;

	const cases = await db.select({ input: testCases.input, output: testCases.output }).from(testCases).where(eq(testCases.problemId, problemId));

	const [submission] = await db.insert(submissions).values({ problemId, userId, sourceCode, language }).returning({ id: submissions.id });
	if (!submission) throw new Error("failed to insert submission");

	const verdictTask: VerdictTask = {
		source: sourceCode,
		language,
		cases: cases.map((tc) => ({ input: tc.input, output: tc.output })),
		limits: {
			cpu_time_ms: problem.limitCpuTimeMs,
			wall_time_ms: problem.limitWallTimeMs,
			memory_bytes: problem.limitMemoryBytes,
			output_bytes: problem.limitOutputBytes,
		},
	};

	return { submissionId: submission.id, verdictTask };
};

export const handleVerdictResult = async (db: Database, submissionId: string, result: VerdictResponse): Promise<void> => {
	await db.update(submissions).set({ status: "completed", result, completedAt: new Date() }).where(eq(submissions.id, submissionId));
};

export const getSubmissionResult = async (db: Database, id: string): Promise<SubmissionResult> => {
	const [submission] = await db
		.select({ id: submissions.id, status: submissions.status, result: submissions.result })
		.from(submissions)
		.where(eq(submissions.id, id))
		.limit(1);
	if (!submission) return null;
	if (submission.status === "pending") return "pending";
	return submission.result;
};
