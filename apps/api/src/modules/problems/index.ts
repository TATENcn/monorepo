import Elysia, { t } from "elysia";
import { authPlugin } from "../auth";
import { databasePlugin } from "../db";
import { difficultyEnumLiteral, testCaseTypeEnumLiteral } from "../db/enums";
import { createProblem, deleteProblem, getProblemDetail, getProblemsStat, getTestCases, listProblems, replaceTestCases, updateProblem } from "./repository";

const difficultyEnum = t.Enum(Object.fromEntries(difficultyEnumLiteral.map((v) => [v, v])));
const testCaseTypeEnum = t.Enum(Object.fromEntries(testCaseTypeEnumLiteral.map((v) => [v, v])));
const problemIdParams = t.Object({ id: t.String({ format: "uuid" }) });

export const problemsPlugin = new Elysia({ name: "problems" })
	.use(databasePlugin)
	.use(authPlugin)
	// GET `/`
	.get(
		"/",
		async ({ query: { limit = 10, offset = 0, query: searchQuery, difficulty, tagId }, db }) => {
			return listProblems(db, { limit, offset, searchQuery, difficulty, tagId });
		},
		{
			query: t.Object({
				limit: t.Optional(t.Numeric({ maximum: 50, minimum: 5, default: 10 })),
				offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
				query: t.Optional(t.String({ maxLength: 255, default: "" })),
				difficulty: t.Optional(difficultyEnum),
				tagId: t.Optional(t.String({ format: "uuid" })),
			}),
			response: t.Array(
				t.Object({
					id: t.String({ format: "uuid" }),
					title: t.String(),
					difficulty: difficultyEnum,
					tags: t.Array(t.String({ format: "uuid" })),
				}),
			),
			detail: { description: "Get problem lists", tags: ["Problems"] },
		},
	)
	// GET `/stat`
	.get("/stat", async ({ db }) => getProblemsStat(db), {
		response: { 200: t.Object({ total: t.Integer() }) },
		detail: { description: "Get problem stats", tags: ["Problems"] },
	})
	// GET `/:id/test-cases`
	.get(
		"/:id/test-cases",
		async ({ db, params: { id: problemId }, user, status }) => {
			const rows = await getTestCases(db, problemId, user.id);
			if (rows === null) return status("Not Found", undefined);
			return rows;
		},
		{
			auth: true,
			params: problemIdParams,
			response: {
				200: t.Array(
					t.Object({
						id: t.String({ format: "uuid" }),
						input: t.String(),
						output: t.String(),
						type: testCaseTypeEnum,
					}),
				),
				404: t.Undefined(),
			},
			detail: {
				description: "Get problem test cases (example cases returned if not authorized)",
				tags: ["Problems"],
			},
		},
	)
	// GET `/:id`
	.get(
		"/:id",
		async ({ db, params: { id }, status }) => {
			const detail = await getProblemDetail(db, id);
			if (!detail) return status("Not Found", undefined);
			return detail;
		},
		{
			params: problemIdParams,
			response: {
				200: t.Object({
					id: t.String({ format: "uuid" }),
					authorId: t.String({ format: "uuid" }),
					title: t.String(),
					description: t.String(),
					difficulty: difficultyEnum,
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
	// PATCH `/:id`
	.patch(
		"/:id",
		async ({ db, params: { id: problemId }, body, user: { id: userId }, status }) => {
			const updated = await updateProblem(db, problemId, userId, {
				title: body.title,
				description: body.description,
				difficulty: body.difficulty,
				limitCpuTimeMs: body.limit?.cpuTimeMs,
				limitWallTimeMs: body.limit?.wallTimeMs,
				limitMemoryBytes: body.limit?.memoryBytes,
				limitOutputBytes: body.limit?.outputBytes,
				tagIds: body.tags,
			});

			if (!updated) return status("Not Found", undefined);
			return status("No Content", undefined);
		},
		{
			auth: true,
			body: t.Object({
				title: t.Optional(t.String()),
				description: t.Optional(t.String()),
				difficulty: t.Optional(difficultyEnum),
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
			response: { 204: t.Undefined(), 404: t.Undefined() },
			params: problemIdParams,
			detail: { description: "Update problem fields", tags: ["Problems"] },
		},
	)
	// DELETE `/:id`
	.delete(
		"/:id",
		async ({ db, params: { id: problemId }, user: { id: userId }, status }) => {
			const deleted = await deleteProblem(db, problemId, userId);
			if (!deleted) return status("Not Found", undefined);
			return status("No Content", undefined);
		},
		{
			auth: true,
			response: { 204: t.Undefined(), 404: t.Undefined() },
			params: problemIdParams,
			detail: { description: "Delete a problem", tags: ["Problems"] },
		},
	)
	// POST `/`
	.post(
		"/",
		async ({ db, body, user: { id: userId }, status }) => {
			const created = await createProblem(
				db,
				{
					title: body.title,
					description: body.description,
					difficulty: body.difficulty,
					limitCpuTimeMs: body.limit.cpuTimeMs,
					limitWallTimeMs: body.limit.wallTimeMs,
					limitMemoryBytes: body.limit.memoryBytes,
					limitOutputBytes: body.limit.outputBytes,
					tagIds: body.tags,
				},
				userId,
			);

			return status("Created", { id: created.id });
		},
		{
			auth: true,
			body: t.Object({
				title: t.String(),
				description: t.String(),
				difficulty: difficultyEnum,
				limit: t.Object({
					cpuTimeMs: t.Integer(),
					wallTimeMs: t.Integer(),
					memoryBytes: t.Integer(),
					outputBytes: t.Integer(),
				}),
				tags: t.Array(t.String({ format: "uuid" })),
			}),
			response: { 201: t.Object({ id: t.String({ format: "uuid" }) }) },
			detail: { description: "Submit a problem", tags: ["Problems"] },
		},
	)
	// PUT `/:id/test-cases`
	.put(
		"/:id/test-cases",
		async ({ db, params: { id: problemId }, body, user: { id: userId }, status }) => {
			const replaced = await replaceTestCases(db, problemId, userId, body.cases);
			if (!replaced) return status("Not Found", undefined);
			return status("No Content", undefined);
		},
		{
			auth: true,
			params: problemIdParams,
			body: t.Object({
				cases: t.Array(
					t.Object({
						input: t.String(),
						output: t.String(),
						type: testCaseTypeEnum,
					}),
				),
			}),
			response: { 204: t.Undefined(), 404: t.Undefined() },
			detail: { description: "Put/override test cases", tags: ["Problems"] },
		},
	);
