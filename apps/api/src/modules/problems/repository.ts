import { and, count, eq, inArray, isNull, like } from "drizzle-orm";
import type { Difficulty, TestCaseType } from "../db/enums";
import type { Database } from "../db/schema";
import { problems, problemTags, testCases } from "../db/schema";

export interface ProblemListFilters {
	limit: number;
	offset: number;
	searchQuery?: string;
	difficulty?: Difficulty;
	tagId?: string;
}

export interface ProblemListItem {
	id: string;
	title: string;
	difficulty: Difficulty;
	tags: string[];
}

export interface ProblemDetail {
	id: string;
	authorId: string;
	title: string;
	description: string;
	difficulty: Difficulty;
	tags: string[];
	createdAt: string;
	updatedAt: string;
	limit: {
		cpuTimeMs: number;
		wallTimeMs: number;
		memoryBytes: number;
		outputBytes: number;
	};
}

export interface TestCaseRow {
	id: string;
	input: string;
	output: string;
	type: TestCaseType;
}

export interface CreateProblemInput {
	title: string;
	description: string;
	difficulty: Difficulty;
	limitCpuTimeMs: number;
	limitWallTimeMs: number;
	limitMemoryBytes: number;
	limitOutputBytes: number;
	tagIds: string[];
}

export interface UpdateProblemPatch {
	title?: string;
	description?: string;
	difficulty?: Difficulty;
	limitCpuTimeMs?: number;
	limitWallTimeMs?: number;
	limitMemoryBytes?: number;
	limitOutputBytes?: number;
	tagIds?: string[];
}

export interface TestCaseInput {
	input: string;
	output: string;
	type: TestCaseType;
}

export const listProblems = async (db: Database, filters: ProblemListFilters): Promise<ProblemListItem[]> => {
	const conditions = [isNull(problems.deletedAt)];
	if (filters.searchQuery) conditions.push(like(problems.title, `%${filters.searchQuery}%`));
	if (filters.difficulty) conditions.push(eq(problems.difficulty, filters.difficulty));
	if (filters.tagId)
		conditions.push(inArray(problems.id, db.select({ problemId: problemTags.problemId }).from(problemTags).where(eq(problemTags.tagId, filters.tagId))));

	const rows = await db
		.select({
			id: problems.id,
			title: problems.title,
			difficulty: problems.difficulty,
		})
		.from(problems)
		.where(and(...conditions))
		.limit(filters.limit)
		.offset(filters.offset);

	if (rows.length === 0) return [];

	const tagRows = await db
		.select({
			problemId: problemTags.problemId,
			tagId: problemTags.tagId,
		})
		.from(problemTags)
		.where(
			inArray(
				problemTags.problemId,
				rows.map((p) => p.id),
			),
		);

	return rows.map((p) => ({
		id: p.id,
		title: p.title,
		difficulty: p.difficulty,
		tags: tagRows.filter((t) => t.problemId === p.id).map((t) => t.tagId),
	}));
};

export const getProblemsStat = async (db: Database): Promise<{ total: number }> => {
	const [result] = await db.select({ total: count() }).from(problems).where(isNull(problems.deletedAt));

	if (!result) throw new Error("count returned no rows");
	return result;
};

export const getProblemDetail = async (db: Database, id: string): Promise<ProblemDetail | null> => {
	const [problem] = await db
		.select()
		.from(problems)
		.where(and(isNull(problems.deletedAt), eq(problems.id, id)))
		.limit(1);

	if (!problem) return null;

	const tagRows = await db.select({ tagId: problemTags.tagId }).from(problemTags).where(eq(problemTags.problemId, id));

	return {
		id: problem.id,
		authorId: problem.authorId,
		title: problem.title,
		description: problem.description,
		difficulty: problem.difficulty,
		tags: tagRows.map((t) => t.tagId),
		createdAt: problem.createdAt.toISOString(),
		updatedAt: problem.updatedAt.toISOString(),
		limit: {
			cpuTimeMs: problem.limitCpuTimeMs,
			wallTimeMs: problem.limitWallTimeMs,
			memoryBytes: problem.limitMemoryBytes,
			outputBytes: problem.limitOutputBytes,
		},
	};
};

export const getTestCases = async (db: Database, problemId: string, viewerId: string): Promise<TestCaseRow[] | null> => {
	const [problem] = await db
		.select()
		.from(problems)
		.where(and(isNull(problems.deletedAt), eq(problems.id, problemId)))
		.limit(1);

	if (!problem) return null;

	const isAuthor = viewerId === problem.authorId;
	const rows = await db
		.select({
			id: testCases.id,
			input: testCases.input,
			output: testCases.output,
			type: testCases.type,
		})
		.from(testCases)
		.where(and(eq(testCases.problemId, problemId), isAuthor ? undefined : eq(testCases.type, "example")));

	return rows;
};

export const createProblem = async (db: Database, input: CreateProblemInput, authorId: string): Promise<{ id: string }> => {
	const [created] = await db
		.insert(problems)
		.values({
			title: input.title,
			description: input.description,
			difficulty: input.difficulty,
			authorId,
			limitCpuTimeMs: input.limitCpuTimeMs,
			limitWallTimeMs: input.limitWallTimeMs,
			limitMemoryBytes: input.limitMemoryBytes,
			limitOutputBytes: input.limitOutputBytes,
		})
		.returning({ id: problems.id });

	if (!created) throw new Error("failed to insert problem");

	if (input.tagIds.length > 0) {
		await db.insert(problemTags).values(input.tagIds.map((tagId) => ({ tagId, problemId: created.id })));
	}

	return created;
};

export const updateProblem = async (db: Database, id: string, authorId: string, patch: UpdateProblemPatch): Promise<boolean> => {
	const [problem] = await db
		.select()
		.from(problems)
		.where(and(isNull(problems.deletedAt), eq(problems.id, id), eq(problems.authorId, authorId)))
		.limit(1);

	if (!problem) return false;

	await db.transaction(async (tx) => {
		const setData: Record<string, unknown> = {};
		if (patch.title) setData.title = patch.title;
		if (patch.description) setData.description = patch.description;
		if (patch.difficulty) setData.difficulty = patch.difficulty;
		if (patch.limitCpuTimeMs) setData.limitCpuTimeMs = patch.limitCpuTimeMs;
		if (patch.limitWallTimeMs) setData.limitWallTimeMs = patch.limitWallTimeMs;
		if (patch.limitMemoryBytes) setData.limitMemoryBytes = patch.limitMemoryBytes;
		if (patch.limitOutputBytes) setData.limitOutputBytes = patch.limitOutputBytes;

		await tx
			.update(problems)
			.set(setData)
			.where(and(eq(problems.id, id), eq(problems.authorId, authorId)));

		if (patch.tagIds) {
			await tx.delete(problemTags).where(eq(problemTags.problemId, id));
			if (patch.tagIds.length > 0) {
				await tx.insert(problemTags).values(patch.tagIds.map((tagId) => ({ tagId, problemId: id })));
			}
		}
	});

	return true;
};

export const deleteProblem = async (db: Database, id: string, authorId: string): Promise<boolean> => {
	const [problem] = await db
		.select()
		.from(problems)
		.where(and(isNull(problems.deletedAt), eq(problems.id, id), eq(problems.authorId, authorId)))
		.limit(1);

	if (!problem) return false;

	await db
		.update(problems)
		.set({ deletedAt: new Date() })
		.where(and(eq(problems.id, id), eq(problems.authorId, authorId)));

	return true;
};

export const replaceTestCases = async (db: Database, problemId: string, authorId: string, cases: TestCaseInput[]): Promise<boolean> => {
	const [problem] = await db
		.select()
		.from(problems)
		.where(and(isNull(problems.deletedAt), eq(problems.id, problemId), eq(problems.authorId, authorId)))
		.limit(1);

	if (!problem) return false;

	await db.transaction(async (tx) => {
		await tx.delete(testCases).where(eq(testCases.problemId, problemId));
		if (cases.length > 0) {
			await tx.insert(testCases).values(
				cases.map((c) => ({
					problemId,
					input: c.input,
					output: c.output,
					type: c.type,
				})),
			);
		}
	});

	return true;
};
