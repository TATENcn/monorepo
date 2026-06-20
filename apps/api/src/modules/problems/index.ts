import { and, count, eq, inArray, isNull, like } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { authPlugin } from "../auth";
import { databasePlugin } from "../db";
import { problems, problemTags, testCases } from "../db/schema";
import {
	createProblemBody,
	difficultyEnum,
	problemDetailSchema,
	problemIdParams,
	problemListItemSchema,
	testCaseSchema,
	testCasesBody,
	updateProblemBody,
} from "./model";

export const problemsPlugin = new Elysia({ name: "problems" })
	.use(databasePlugin)
	.use(authPlugin)
	.get(
		"/",
		async ({ query: { limit = 10, offset = 0, query: searchQuery, difficulty, tagId }, db }) => {
			const conditions = [isNull(problems.deletedAt)];
			if (searchQuery) conditions.push(like(problems.title, `%${searchQuery}%`));
			if (difficulty) conditions.push(eq(problems.difficulty, difficulty));
			if (tagId) conditions.push(inArray(problems.id, db.select({ problemId: problemTags.problemId }).from(problemTags).where(eq(problemTags.tagId, tagId))));
			const problemRows = await db
				.select({
					id: problems.id,
					title: problems.title,
					difficulty: problems.difficulty,
				})
				.from(problems)
				.where(and(...conditions))
				.limit(limit)
				.offset(offset);

			if (problemRows.length === 0) return [];

			const tagRows = await db
				.select({
					problemId: problemTags.problemId,
					tagId: problemTags.tagId,
				})
				.from(problemTags)
				.where(
					inArray(
						problemTags.problemId,
						problemRows.map((p) => p.id),
					),
				);

			return problemRows.map((p) => ({
				id: p.id,
				title: p.title,
				difficulty: p.difficulty,
				tags: tagRows.filter((t) => t.problemId === p.id).map((t) => t.tagId),
			}));
		},
		{
			query: t.Object({
				limit: t.Optional(t.Numeric({ maximum: 50, minimum: 5, default: 10 })),
				offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
				query: t.Optional(t.String({ maxLength: 255, default: "" })),
				difficulty: t.Optional(difficultyEnum),
				tagId: t.Optional(t.String({ format: "uuid" })),
			}),
			response: t.Array(problemListItemSchema),
			detail: { description: "Get problem lists", tags: ["Problems"] },
		},
	)
	.get(
		"/stat",
		async ({ db }) => {
			const [result] = await db.select({ total: count() }).from(problems).where(isNull(problems.deletedAt));
			if (!result) throw new Error("count returned no rows");
			return result;
		},
		{
			response: {
				200: t.Object({
					total: t.Integer(),
				}),
			},
			detail: { description: "Get problem stats", tags: ["Problems"] },
		},
	)
	.get(
		"/:id/test-cases",
		async ({ db, params: { id: problemId }, user, status }) => {
			const [problem] = await db
				.select()
				.from(problems)
				.where(and(isNull(problems.deletedAt), eq(problems.id, problemId)))
				.limit(1);

			if (!problem) return status("Not Found", undefined);

			const isAuthor = user.id === problem.authorId;
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
		},
		{
			auth: true,
			params: problemIdParams,
			response: {
				200: t.Array(testCaseSchema),
				404: t.Undefined(),
			},
			detail: { description: "Get problem test cases (example cases returned if not authorized)", tags: ["Problems"] },
		},
	)
	.get(
		"/:id",
		async ({ db, params: { id }, status }) => {
			const [problem] = await db
				.select()
				.from(problems)
				.where(and(isNull(problems.deletedAt), eq(problems.id, id)))
				.limit(1);

			if (!problem) return status("Not Found", undefined);

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
		},
		{
			params: problemIdParams,
			response: {
				200: problemDetailSchema,
				404: t.Undefined(),
			},
			detail: { description: "Get problem details", tags: ["Problems"] },
		},
	)
	.patch(
		"/:id",
		async ({ db, params: { id: problemId }, status, body, user: { id: userId } }) => {
			const [problem] = await db
				.select()
				.from(problems)
				.where(and(isNull(problems.deletedAt), eq(problems.id, problemId), eq(problems.authorId, userId)))
				.limit(1);

			if (!problem) return status("Not Found", undefined);

			await db.transaction(async (tx) => {
				const setData: Partial<typeof problems.$inferInsert> = {};
				if (body.title) setData.title = body.title;
				if (body.description) setData.description = body.description;
				if (body.difficulty) setData.difficulty = body.difficulty;
				if (body.limit?.cpuTimeMs) setData.limitCpuTimeMs = body.limit.cpuTimeMs;
				if (body.limit?.wallTimeMs) setData.limitWallTimeMs = body.limit.wallTimeMs;
				if (body.limit?.memoryBytes) setData.limitMemoryBytes = body.limit.memoryBytes;
				if (body.limit?.outputBytes) setData.limitOutputBytes = body.limit.outputBytes;
				await tx
					.update(problems)
					.set(setData)
					.where(and(eq(problems.id, problemId), eq(problems.authorId, userId)));

				if (body.tags) {
					await tx.delete(problemTags).where(eq(problemTags.problemId, problemId));
					if (body.tags.length > 0) {
						await tx.insert(problemTags).values(body.tags.map((tagId) => ({ tagId, problemId })));
					}
				}
			});

			return status("No Content", undefined);
		},
		{
			auth: true,
			body: updateProblemBody,
			response: {
				204: t.Undefined(),
				404: t.Undefined(),
			},
			params: problemIdParams,
			detail: { description: "Update problem fields", tags: ["Problems"] },
		},
	)
	.delete(
		"/:id",
		async ({ db, params: { id: problemId }, status, user: { id: userId } }) => {
			const [problem] = await db
				.select()
				.from(problems)
				.where(and(isNull(problems.deletedAt), eq(problems.id, problemId), eq(problems.authorId, userId)))
				.limit(1);

			if (!problem) return status("Not Found", undefined);

			await db
				.update(problems)
				.set({ deletedAt: new Date() })
				.where(and(eq(problems.id, problemId), eq(problems.authorId, userId)));

			return status("No Content", undefined);
		},
		{
			auth: true,
			response: {
				204: t.Undefined(),
				404: t.Undefined(),
			},
			params: problemIdParams,
			detail: { description: "Delete a problem", tags: ["Problems"] },
		},
	)
	.post(
		"/",
		async ({ db, body, user: { id: userId }, status }) => {
			const [created] = await db
				.insert(problems)
				.values({
					title: body.title,
					description: body.description,
					difficulty: body.difficulty,
					authorId: userId,
					limitCpuTimeMs: body.limit.cpuTimeMs,
					limitWallTimeMs: body.limit.wallTimeMs,
					limitMemoryBytes: body.limit.memoryBytes,
					limitOutputBytes: body.limit.outputBytes,
				})
				.returning({ id: problems.id });

			if (!created) throw new Error("failed to insert problem");

			if (body.tags.length > 0) {
				await db.insert(problemTags).values(body.tags.map((tagId) => ({ tagId, problemId: created.id })));
			}

			return status("Created", { id: created.id });
		},
		{
			auth: true,
			body: createProblemBody,
			response: {
				201: t.Object({
					id: t.String({ format: "uuid" }),
				}),
			},
			detail: { description: "Submit a problem", tags: ["Problems"] },
		},
	)
	.put(
		"/:id/test-cases",
		async ({ db, params: { id: problemId }, body, user: { id: userId }, status }) => {
			const [problem] = await db
				.select()
				.from(problems)
				.where(and(isNull(problems.deletedAt), eq(problems.id, problemId), eq(problems.authorId, userId)))
				.limit(1);

			if (!problem) return status("Not Found", undefined);

			await db.transaction(async (tx) => {
				await tx.delete(testCases).where(eq(testCases.problemId, problemId));
				if (body.cases.length > 0) {
					await tx.insert(testCases).values(
						body.cases.map((c) => ({
							problemId,
							input: c.input,
							output: c.output,
							type: c.type,
						})),
					);
				}
			});

			return status("No Content", undefined);
		},
		{
			auth: true,
			params: problemIdParams,
			body: testCasesBody,
			response: {
				204: t.Undefined(),
				404: t.Undefined(),
			},
			detail: { description: "Put/override test cases", tags: ["Problems"] },
		},
	);
