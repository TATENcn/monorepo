import { JudgeCoreClient } from "judge-core-sdk";
import type { SubmitMessage } from "models/message";
import { pino } from "pino";
import { initRabbitMq } from "utils";

const logger = pino({ name: "submission-processor" });

const { channel, config } = await initRabbitMq(process.env.RABBIT_MQ_URL!);
logger.info("configured rabbitmq");

const usingStandalone = process.env.JUDGE_CORE_STANDALONE === "true";

const client = new JudgeCoreClient({
	baseUrl: process.env.JUDGE_CORE_URL!,
	usingStandalone,
});

if (!usingStandalone) {
	await client.getAcceptablez();
	logger.info("judge-core available");
} else {
	logger.info("judge-core standalone mode");
}

await channel.consume(
	config.SUBMIT_QUEUE,
	async (msg) => {
		if (!msg) return;

		const { submission_id, task }: SubmitMessage = JSON.parse(
			msg.content.toString(),
		);

		try {
			const { data: result } = await client.submitTask(task);

			channel.publish(
				config.EXCHANGE_NAME,
				config.RESULT_ROUTE,
				Buffer.from(JSON.stringify({ submission_id, result: result })),
			);

			channel.ack(msg);
			logger.info({ submission_id }, "finished task");
		} catch (err) {
			logger.error({ err, submission_id }, "failed to process task");
		}
	},
	{ noAck: false },
);
