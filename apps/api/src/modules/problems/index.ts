import { and, count, eq, inArray, isNull, like } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { authPlugin } from "../auth";
import { databasePlugin } from "../db";
import { difficultyEnumLiteral, problems, problemTags, testCases, testCaseTypeEnumLiteral } from "../db/schema";

const difficultyTypeBoxEnum = t.Enum(Object.fromEntries(difficultyEnumLiteral.map((v) => [v, v])));
const testCaseTypeBoxEnum = t.Enum(Object.fromEntries(testCaseTypeEnumLiteral.map((v) => [v, v])));

export const problemsPlugin = new Elysia({ name: "problems" })
	.use(databasePlugin)
	.use(authPlugin)
	.get(
		"/problems",
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
				tags: tagRows.map((t) => t.tagId),
			}));
		},
		{
			query: t.Object({
				limit: t.Optional(t.Numeric({ maximum: 50, minimum: 5, default: 10 })),
				offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
				query: t.Optional(t.String({ maxLength: 255, default: "" })),
				difficulty: t.Optional(difficultyTypeBoxEnum),
				tagId: t.Optional(t.String({ format: "uuid" })),
			}),
			response: t.Array(
				t.Object({
					id: t.String({ format: "uuid" }),
					title: t.String(),
					difficulty: difficultyTypeBoxEnum,
					tags: t.Array(t.String({ format: "uuid" })),
				}),
			),
			detail: { description: "Get problem lists", tags: ["Problems"] },
		},
	)
	.get(
		"/problems/stat",
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
		"/problems/:id/test-cases",
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
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
			response: {
				200: t.Array(
					t.Object({
						id: t.String({ format: "uuid" }),
						input: t.String(),
						output: t.String(),
						type: testCaseTypeBoxEnum,
					}),
				),
				404: t.Undefined(),
			},
			detail: { description: "Get problem test cases (example cases returned if not authorized)", tags: ["Problems"] },
		},
	)
	.get(
		"/problems/:id",
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
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
			response: {
				200: t.Object({
					id: t.String({ format: "uuid" }),
					authorId: t.String({ format: "uuid" }),
					title: t.String(),
					description: t.String(),
					difficulty: difficultyTypeBoxEnum,
					tags: t.Array(t.String({ format: "uuid" })),

					createdAt: t.String({ format: "date-time" }),
					updatedAt: t.String({ format: "date-time" }),

					limit: t.Object({
						cpuTimeMs: t.Integer(),
						wallTimeMs: t.Integer(),
						memoryBytes: t.Integer(),
						outputBytes: t.Integer(),
					}),
				}),
				404: t.Undefined(),
			},
			detail: { description: "Get problem details", tags: ["Problems"] },
		},
	)
	.patch(
		"/problems/:id",
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
			body: t.Object({
				title: t.Optional(t.String()),
				description: t.Optional(t.String()),
				difficulty: t.Optional(difficultyTypeBoxEnum),
				limit: t.Optional(
					t.Object({
						cpuTimeMs: t.Optional(t.Integer()),
						wallTimeMs: t.Optional(t.Integer()),
						memoryBytes: t.Optional(t.Integer()),
						outputBytes: t.Optional(t.Integer()),
					}),
				),
				tags: t.Optional(t.Array(t.String({ format: "uuid" }))),
			}),
			response: {
				204: t.Undefined(),
				404: t.Undefined(),
			},
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
			detail: { description: "Update problem fields", tags: ["Problems"] },
		},
	)
	.delete(
		"/problems/:id",
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
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
			detail: { description: "Delete a problem", tags: ["Problems"] },
		},
	)
	.post(
		"/problems",
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
			body: t.Object({
				title: t.String(),
				description: t.String(),
				difficulty: difficultyTypeBoxEnum,
				limit: t.Object({
					cpuTimeMs: t.Integer(),
					wallTimeMs: t.Integer(),
					memoryBytes: t.Integer(),
					outputBytes: t.Integer(),
				}),
				tags: t.Array(t.String({ format: "uuid" })),
			}),
			response: {
				201: t.Object({
					id: t.String({ format: "uuid" }),
				}),
			},
			detail: { description: "Submit a problem", tags: ["Problems"] },
		},
	)
	.put(
		"/problems/:id/test-cases",
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
			params: t.Object({
				id: t.String({ format: "uuid" }),
			}),
			body: t.Object({
				cases: t.Array(
					t.Object({
						input: t.String(),
						output: t.String(),
						type: testCaseTypeBoxEnum,
					}),
				),
			}),
			response: {
				204: t.Undefined(),
				404: t.Undefined(),
			},
			detail: { description: "Put/override test cases", tags: ["Problems"] },
		},
	);
