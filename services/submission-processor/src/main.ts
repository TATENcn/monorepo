import { connect } from "amqplib";
import type { VerdictTask } from "judge-core-sdk";
import { JudgeCoreClient } from "judge-core-sdk";
import { pino } from "pino";

const logger = pino({ name: "submission-processor" });

const SUBMIT_QUEUE = "submit.queue";
const RESULT_QUEUE = "result.queue";
const SUBMIT_ROUTE = "submit";
const RESULT_ROUTE = "result";
const EXCHANGE_NAME = "online-judge.exchange";

const connection = await connect(process.env.RABBIT_MQ_URL!);
logger.info("connected rabbitmq");

const channel = await connection.createChannel();
await channel.assertExchange(EXCHANGE_NAME, "direct", { durable: true });
await channel.assertQueue(SUBMIT_QUEUE, { durable: true });
await channel.assertQueue(RESULT_QUEUE, { durable: true });
await channel.bindQueue(SUBMIT_QUEUE, EXCHANGE_NAME, SUBMIT_ROUTE);
await channel.bindQueue(RESULT_QUEUE, EXCHANGE_NAME, RESULT_ROUTE);
await channel.prefetch(1);
logger.info("configured rabbit mq");

const client = new JudgeCoreClient(process.env.JUDGE_CORE_URL!);
await client.getAcceptablez();
logger.info("judge-core available");

await channel.consume(
	SUBMIT_QUEUE,
	async (msg) => {
		if (!msg) return;

		const task: VerdictTask = JSON.parse(msg.content.toString());
		const result = await client.submitTask(task);

		channel.publish(
			EXCHANGE_NAME,
			RESULT_ROUTE,
			Buffer.from(JSON.stringify(result)),
		);

		logger.info("finished task");

		channel.ack(msg);
	},
	{ noAck: true },
);
