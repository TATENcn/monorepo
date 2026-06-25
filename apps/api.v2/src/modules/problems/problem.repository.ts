import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, count, eq, inArray, isNull, like } from "drizzle-orm";
import type { Difficulty, TestCaseType } from "../database/database.enum";
// biome-ignore lint/style/useImportType: Module injection
import { DatabaseService } from "../database/database.service";
import { schema } from "../database/database.schema";

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

@Injectable()
export class ProblemRepository {
	private logger: Logger;

	constructor(private readonly db: DatabaseService) {
		this.logger = new Logger(ProblemRepository.name);
	}

	public async listProblems(filters: ProblemListFilters): Promise<ProblemListItem[]> {
		const conditions = [isNull(schema.problems.deletedAt)];
		if (filters.searchQuery) conditions.push(like(schema.problems.title, `%${filters.searchQuery}%`));
		if (filters.difficulty) conditions.push(eq(schema.problems.difficulty, filters.difficulty));
		if (filters.tagId)
			conditions.push(
				inArray(
					schema.problems.id,
					this.db.db.select({ problemId: schema.problemTags.problemId }).from(schema.problemTags).where(eq(schema.problemTags.tagId, filters.tagId)),
				),
			);

		const rows = await this.db.db
			.select({
				id: schema.problems.id,
				title: schema.problems.title,
				difficulty: schema.problems.difficulty,
			})
			.from(schema.problems)
			.where(and(...conditions))
			.limit(filters.limit)
			.offset(filters.offset);

		if (rows.length === 0) return [];

		const tagRows = await this.db.db
			.select({
				problemId: schema.problemTags.problemId,
				tagId: schema.problemTags.tagId,
			})
			.from(schema.problemTags)
			.where(
				inArray(
					schema.problemTags.problemId,
					rows.map((p) => p.id),
				),
			);

		return rows.map((p) => ({
			id: p.id,
			title: p.title,
			difficulty: p.difficulty,
			tags: tagRows.filter((t) => t.problemId === p.id).map((t) => t.tagId),
		}));
	}

	public async getProblemsStat(): Promise<{ total: number }> {
		const [result] = await this.db.db.select({ total: count() }).from(schema.problems).where(isNull(schema.problems.deletedAt));

		if (!result) throw new Error("count returned no rows");
		return result;
	}

	public async getProblemDetail(id: string): Promise<ProblemDetail | null> {
		const [problem] = await this.db.db
			.select()
			.from(schema.problems)
			.where(and(isNull(schema.problems.deletedAt), eq(schema.problems.id, id)))
			.limit(1);

		if (!problem) return null;

		const tagRows = await this.db.db.select({ tagId: schema.problemTags.tagId }).from(schema.problemTags).where(eq(schema.problemTags.problemId, id));

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
	}

	public async getTestCases(problemId: string, viewerId: string): Promise<TestCaseRow[]> {
		const [problem] = await this.db.db
			.select()
			.from(schema.problems)
			.where(and(isNull(schema.problems.deletedAt), eq(schema.problems.id, problemId)))
			.limit(1);

		if (!problem) throw new NotFoundException();

		const isAuthor = viewerId === problem.authorId;
		const rows = await this.db.db
			.select({
				id: schema.testCases.id,
				input: schema.testCases.input,
				output: schema.testCases.output,
				type: schema.testCases.type,
			})
			.from(schema.testCases)
			.where(and(eq(schema.testCases.problemId, problemId), isAuthor ? undefined : eq(schema.testCases.type, "example")));

		return rows;
	}

	public async createProblem(input: CreateProblemInput, authorId: string): Promise<{ id: string }> {
		const [created] = await this.db.db
			.insert(schema.problems)
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
			.returning({ id: schema.problems.id });

		if (!created) throw new Error("failed to insert problem");

		if (input.tagIds.length > 0) {
			await this.db.db.insert(schema.problemTags).values(input.tagIds.map((tagId) => ({ tagId, problemId: created.id })));
		}

		this.logger.log("Problem created", { id: created.id, authorId });
		return created;
	}

	public async updateProblem(id: string, authorId: string, patch: UpdateProblemPatch): Promise<void> {
		const [problem] = await this.db.db
			.select()
			.from(schema.problems)
			.where(and(isNull(schema.problems.deletedAt), eq(schema.problems.id, id), eq(schema.problems.authorId, authorId)))
			.limit(1);

		if (!problem) throw new NotFoundException();

		await this.db.db.transaction(async (tx) => {
			const setData: Record<string, unknown> = {};
			if (patch.title) setData.title = patch.title;
			if (patch.description) setData.description = patch.description;
			if (patch.difficulty) setData.difficulty = patch.difficulty;
			if (patch.limitCpuTimeMs) setData.limitCpuTimeMs = patch.limitCpuTimeMs;
			if (patch.limitWallTimeMs) setData.limitWallTimeMs = patch.limitWallTimeMs;
			if (patch.limitMemoryBytes) setData.limitMemoryBytes = patch.limitMemoryBytes;
			if (patch.limitOutputBytes) setData.limitOutputBytes = patch.limitOutputBytes;

			await tx
				.update(schema.problems)
				.set(setData)
				.where(and(eq(schema.problems.id, id), eq(schema.problems.authorId, authorId)));

			if (patch.tagIds) {
				await tx.delete(schema.problemTags).where(eq(schema.problemTags.problemId, id));
				if (patch.tagIds.length > 0) {
					await tx.insert(schema.problemTags).values(patch.tagIds.map((tagId) => ({ tagId, problemId: id })));
				}
			}
		});

		this.logger.log("Problem updated", { id, authorId });
	}

	public async deleteProblem(id: string, authorId: string): Promise<void> {
		const [problem] = await this.db.db
			.select()
			.from(schema.problems)
			.where(and(isNull(schema.problems.deletedAt), eq(schema.problems.id, id), eq(schema.problems.authorId, authorId)))
			.limit(1);

		if (!problem) throw new NotFoundException();

		await this.db.db
			.update(schema.problems)
			.set({ deletedAt: new Date() })
			.where(and(eq(schema.problems.id, id), eq(schema.problems.authorId, authorId)));

		this.logger.log("Problem deleted", { id, authorId });
	}

	public async replaceTestCases(problemId: string, authorId: string, cases: TestCaseInput[]): Promise<void> {
		const [problem] = await this.db.db
			.select()
			.from(schema.problems)
			.where(and(isNull(schema.problems.deletedAt), eq(schema.problems.id, problemId), eq(schema.problems.authorId, authorId)))
			.limit(1);

		if (!problem) throw new NotFoundException();

		await this.db.db.transaction(async (tx) => {
			await tx.delete(schema.testCases).where(eq(schema.testCases.problemId, problemId));
			if (cases.length > 0) {
				await tx.insert(schema.testCases).values(
					cases.map((c) => ({
						problemId,
						input: c.input,
						output: c.output,
						type: c.type,
					})),
				);
			}
		});

		this.logger.log("Test cases replaced", { problemId, authorId, count: cases.length });
	}
}
