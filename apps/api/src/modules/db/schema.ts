import { user } from "auth/schema";
import { defineRelations } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql/postgres/driver";
import { boolean, char, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { VerdictResponse } from "models/judge-core";
import { acceptableLanguageEnumLiteral, contestTypeEnumLiteral, difficultyEnumLiteral, submissionStatusEnumLiteral, testCaseTypeEnumLiteral } from "./enums";

export const difficultyEnum = pgEnum("difficulty", difficultyEnumLiteral);
export const testCaseTypeEnum = pgEnum("test_case_type", testCaseTypeEnumLiteral);
export const submissionStatusEnum = pgEnum("submission_status", submissionStatusEnumLiteral);
export const acceptableLanguageEnum = pgEnum("acceptable_language", acceptableLanguageEnumLiteral);
export const contestTypeEnum = pgEnum("contest_type", contestTypeEnumLiteral);

export const tags = pgTable("tags", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull().unique(),
	color: char("color", { length: 8 }).notNull(), // RGBA color
});

export const problems = pgTable("problems", {
	id: uuid("id").primaryKey().defaultRandom(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	difficulty: difficultyEnum("difficulty").notNull(),
	authorId: text("author_id")
		.notNull()
		.references(() => user.id),

	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	deletedAt: timestamp("deleted_at"),

	limitCpuTimeMs: integer("limit_cpu_time_ms").notNull(),
	limitWallTimeMs: integer("limit_wall_time_ms").notNull(),
	limitMemoryBytes: integer("limit_memory_bytes").notNull(),
	limitOutputBytes: integer("limit_output_bytes").notNull(),
});

export const problemTags = pgTable("problem_tags", {
	problemId: uuid("problem_id")
		.primaryKey()
		.notNull()
		.references(() => problems.id),
	tagId: uuid("tag_id")
		.primaryKey()
		.notNull()
		.references(() => tags.id),
});

export const testCases = pgTable("test_cases", {
	id: uuid("id").primaryKey().defaultRandom(),
	problemId: uuid("problem_id")
		.notNull()
		.references(() => problems.id),
	input: text("input").notNull(),
	output: text("output").notNull(),
	type: testCaseTypeEnum("type").notNull().default("hidden"),
});

export const submissions = pgTable("submissions", {
	id: uuid("id").primaryKey().defaultRandom(),
	problemId: uuid("problem_id")
		.notNull()
		.references(() => problems.id),
	userId: text("user_id")
		.notNull()
		.references(() => user.id),
	sourceCode: text("source_code").notNull(),
	status: submissionStatusEnum("submission_status").notNull().default("pending"),
	result: jsonb("result").$type<VerdictResponse>(),
	language: acceptableLanguageEnum("language").notNull(),
	submittedAt: timestamp("submitted_at").notNull().defaultNow(),
	completedAt: timestamp("completed_at"),
});

export const contests = pgTable("contests", {
	id: uuid("id").primaryKey().defaultRandom(),
	type: contestTypeEnum("type").notNull(),
	creatorId: text("creator_id")
		.notNull()
		.references(() => user.id),
	title: text("title").notNull(),
	description: text("description").notNull(),
	approved: boolean("approved").notNull().default(false),
	approverId: text("approver_id").references(() => user.id),

	approvedAt: timestamp("approved_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	deletedAt: timestamp("deleted_at"),
	startedAt: timestamp("started_at").notNull(),
	finishedAt: timestamp("finished_at").notNull(),
});

export const contestProblems = pgTable("contest_problems", {
	contestId: uuid("contest_id")
		.primaryKey()
		.notNull()
		.references(() => contests.id),
	problemId: uuid("problem_id")
		.primaryKey()
		.notNull()
		.references(() => problems.id),
	label: text("label").notNull(),
	order: integer("order").notNull(),
});

export const contestSubmissions = pgTable("contest_submissions", {
	problemId: uuid("problem_id")
		.primaryKey()
		.notNull()
		.references(() => problems.id),
	contestId: uuid("contest_id")
		.primaryKey()
		.notNull()
		.references(() => contests.id),
	submissionId: uuid("submission_id")
		.primaryKey()
		.notNull()
		.references(() => submissions.id),
});

export const contestRegistrations = pgTable("contest_registrations", {
	contestId: uuid("contest_id")
		.primaryKey()
		.notNull()
		.references(() => contests.id),
	userId: text("user_id")
		.primaryKey()
		.notNull()
		.references(() => user.id),
	registeredAt: timestamp("registered_at").notNull().defaultNow(),
});

export const schema = {
	tags,
	problems,
	problemTags,
	testCases,
	submissions,
	user,
	contests,
	contestProblems,
	contestSubmissions,
	contestRegistrations,
};

export const relations = defineRelations(
	{ tags, problems, problemTags, testCases, submissions, user, contests, contestProblems, contestSubmissions, contestRegistrations },
	(r) => ({
		problems: {
			problemTags: r.many.problemTags({
				from: r.problems.id,
				to: r.problemTags.problemId,
			}),
			testCases: r.many.testCases({
				from: r.problems.id,
				to: r.testCases.problemId,
			}),
			author: r.one.user({
				from: r.problems.authorId,
				to: r.user.id,
			}),
			submissions: r.many.submissions({
				from: r.problems.id,
				to: r.submissions.problemId,
			}),
			contestProblems: r.many.contestProblems({
				from: r.problems.id,
				to: r.contestProblems.problemId,
			}),
		},
		tags: {
			problemTags: r.many.problemTags({
				from: r.tags.id,
				to: r.problemTags.tagId,
			}),
		},
		problemTags: {
			problem: r.one.problems({
				from: r.problemTags.problemId,
				to: r.problems.id,
			}),
			tag: r.one.tags({
				from: r.problemTags.tagId,
				to: r.tags.id,
			}),
		},
		testCases: {
			problem: r.one.problems({
				from: r.testCases.problemId,
				to: r.problems.id,
			}),
		},
		submissions: {
			problem: r.one.problems({
				from: r.submissions.problemId,
				to: r.problems.id,
			}),
			user: r.one.user({
				from: r.submissions.userId,
				to: r.user.id,
			}),
			contestSubmissions: r.many.contestSubmissions({
				from: r.submissions.id,
				to: r.contestSubmissions.submissionId,
			}),
		},
		user: {
			problems: r.many.problems({
				from: r.user.id,
				to: r.problems.authorId,
			}),
			submissions: r.many.submissions({
				from: r.user.id,
				to: r.submissions.userId,
			}),
			createdContests: r.many.contests({
				from: r.user.id,
				to: r.contests.creatorId,
			}),
			approvedContests: r.many.contests({
				from: r.user.id,
				to: r.contests.approverId,
			}),
			contestRegistrations: r.many.contestRegistrations({
				from: r.user.id,
				to: r.contestRegistrations.userId,
			}),
		},
		contests: {
			creator: r.one.user({
				from: r.contests.creatorId,
				to: r.user.id,
			}),
			approver: r.one.user({
				from: r.contests.approverId,
				to: r.user.id,
			}),
			contestProblems: r.many.contestProblems({
				from: r.contests.id,
				to: r.contestProblems.contestId,
			}),
			contestSubmissions: r.many.contestSubmissions({
				from: r.contests.id,
				to: r.contestSubmissions.contestId,
			}),
			contestRegistrations: r.many.contestRegistrations({
				from: r.contests.id,
				to: r.contestRegistrations.contestId,
			}),
		},
		contestProblems: {
			contest: r.one.contests({
				from: r.contestProblems.contestId,
				to: r.contests.id,
			}),
			problem: r.one.problems({
				from: r.contestProblems.problemId,
				to: r.problems.id,
			}),
		},
		contestSubmissions: {
			contest: r.one.contests({
				from: r.contestSubmissions.contestId,
				to: r.contests.id,
			}),
			problem: r.one.problems({
				from: r.contestSubmissions.problemId,
				to: r.problems.id,
			}),
			submission: r.one.submissions({
				from: r.contestSubmissions.submissionId,
				to: r.submissions.id,
			}),
		},
		contestRegistrations: {
			contest: r.one.contests({
				from: r.contestRegistrations.contestId,
				to: r.contests.id,
			}),
			user: r.one.user({
				from: r.contestRegistrations.userId,
				to: r.user.id,
			}),
		},
	}),
);

export type Database = BunSQLDatabase<typeof schema, typeof relations>;

export const seedTags = async (database: Database) => {
	//	const tagValues: Omit<typeof tags.$inferInsert, "id">[] = [];
	//
	//	await database.insert(tags).values(tagValues).onConflictDoNothing();
};
