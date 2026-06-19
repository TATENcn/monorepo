import type { VerdictTask } from "judge-core-sdk";
import { JudgeCoreClient } from "judge-core-sdk";
import { pino } from "pino";
import { initRabbitMq } from "utils";

const logger = pino({ name: "submission-processor" });

const { channel, config } = await initRabbitMq(process.env.RABBIT_MQ_URL!);
logger.info("configured rabbitmq");

const client = new JudgeCoreClient(process.env.JUDGE_CORE_URL!);
await client.getAcceptablez();
logger.info("judge-core available");

await channel.consume(
	config.SUBMIT_QUEUE,
	async (msg) => {
		if (!msg) return;

		const task: VerdictTask = JSON.parse(msg.content.toString());
		const result = await client.submitTask(task);

		channel.publish(
			config.EXCHANGE_NAME,
			config.RESULT_ROUTE,
			Buffer.from(JSON.stringify(result)),
		);

		logger.info("finished task");

		channel.ack(msg);
	},
	{ noAck: true },
);
