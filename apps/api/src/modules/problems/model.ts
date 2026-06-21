import { t } from "elysia";
import { difficultyEnumLiteral, testCaseTypeEnumLiteral } from "../db/enums";

export const difficultyEnum = t.Enum(Object.fromEntries(difficultyEnumLiteral.map((v) => [v, v])));
export const testCaseTypeEnum = t.Enum(Object.fromEntries(testCaseTypeEnumLiteral.map((v) => [v, v])));

export const problemIdParams = t.Object({
	id: t.String({ format: "uuid" }),
});

export const limitSchema = t.Object({
	cpuTimeMs: t.Integer(),
	wallTimeMs: t.Integer(),
	memoryBytes: t.Integer(),
	outputBytes: t.Integer(),
});

export const optionalLimitSchema = t.Object({
	cpuTimeMs: t.Optional(t.Integer()),
	wallTimeMs: t.Optional(t.Integer()),
	memoryBytes: t.Optional(t.Integer()),
	outputBytes: t.Optional(t.Integer()),
});

export const problemListItemSchema = t.Object({
	id: t.String({ format: "uuid" }),
	title: t.String(),
	difficulty: difficultyEnum,
	tags: t.Array(t.String({ format: "uuid" })),
});

export const problemDetailSchema = t.Object({
	id: t.String({ format: "uuid" }),
	authorId: t.String({ format: "uuid" }),
	title: t.String(),
	description: t.String(),
	difficulty: difficultyEnum,
	tags: t.Array(t.String({ format: "uuid" })),
	createdAt: t.String({ format: "date-time" }),
	updatedAt: t.String({ format: "date-time" }),
	limit: limitSchema,
});

export const createProblemBody = t.Object({
	title: t.String(),
	description: t.String(),
	difficulty: difficultyEnum,
	limit: limitSchema,
	tags: t.Array(t.String({ format: "uuid" })),
});

export const updateProblemBody = t.Object({
	title: t.Optional(t.String()),
	description: t.Optional(t.String()),
	difficulty: t.Optional(difficultyEnum),
	limit: t.Optional(optionalLimitSchema),
	tags: t.Optional(t.Array(t.String({ format: "uuid" }))),
});

export const testCaseSchema = t.Object({
	id: t.String({ format: "uuid" }),
	input: t.String(),
	output: t.String(),
	type: testCaseTypeEnum,
});

export const testCasesBody = t.Object({
	cases: t.Array(
		t.Object({
			input: t.String(),
			output: t.String(),
			type: testCaseTypeEnum,
		}),
	),
});
