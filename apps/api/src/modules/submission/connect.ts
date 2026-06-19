import { initRabbitMq } from "utils";

const { channel, config } = await initRabbitMq(process.env.RABBIT_MQ_URL!);
