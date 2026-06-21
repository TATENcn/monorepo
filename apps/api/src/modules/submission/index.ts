import Elysia, { t } from "elysia";
import type { ResultMessage, SubmitMessage } from "models/message";
import { AMQP_TOPOLOGY } from "models/message";
import { authPlugin } from "../auth";
import { databasePlugin } from "../db";
import { acceptableLanguageEnumLiteral } from "../db/enums";
import { mqPlugin } from "./amqp";
import { getSubmissionResult, handleVerdictResult, submitSolution } from "./repository";

const acceptableLanguageEnum = t.Enum(Object.fromEntries(acceptableLanguageEnumLiteral.map((v) => [v, v])));

export const submissionPlugin = new Elysia({ name: "submission" })
	.use(databasePlugin)
	.use(mqPlugin)
	.use(authPlugin)
	.onStart(async (app) => {
		const { channel } = app.decorator.mq;
		const db = app.decorator.db;
		await channel.consume(
			AMQP_TOPOLOGY.RESULT_QUEUE,
			async (msg) => {
				if (!msg) return;
				try {
					const { submission_id, result }: ResultMessage = JSON.parse(msg.content.toString());
					await handleVerdictResult(db, submission_id, result);
					channel.ack(msg);
				} catch (err) {
					console.error("failed to process verdict result:", err);
					channel.nack(msg);
				}
			},
			{ noAck: false },
		);
	})
	.post(
		"/",
		async ({ db, user, mq, body, status }) => {
			const res = await submitSolution(db, body.problemId, user.id, body.sourceCode, body.language);
			if (!res) return status(404, undefined);

			const msg: SubmitMessage = { submission_id: res.submissionId, task: res.verdictTask };
			mq.channel.publish(AMQP_TOPOLOGY.EXCHANGE_NAME, AMQP_TOPOLOGY.SUBMIT_ROUTE, Buffer.from(JSON.stringify(msg)));

			return status(202, { id: res.submissionId });
		},
		{
			auth: true,
			body: t.Object({
				sourceCode: t.String(),
				problemId: t.String({ format: "uuid" }),
				language: acceptableLanguageEnum,
			}),
			response: {
				202: t.Object({ id: t.String({ format: "uuid" }) }),
				404: t.Undefined(),
			},
			detail: { description: "Submit a solution for judging", tags: ["Submissions"] },
		},
	)
	.get(
		"/:id",
		async ({ db, params: { id }, status }) => {
			const result = await getSubmissionResult(db, id);
			if (result === null) return status(404, undefined);
			if (result === "pending") return status(202, undefined);
			return result;
		},
		{
			auth: true,
			params: t.Object({ id: t.String({ format: "uuid" }) }),
			response: {
				202: t.Undefined(),
				404: t.Undefined(),
			},
			detail: { description: "Get submission verdict", tags: ["Submissions"] },
		},
	);
