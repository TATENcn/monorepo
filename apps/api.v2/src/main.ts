import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

@Module({})
class RootModule {}

const app = await NestFactory.create(RootModule);

await app.listen(3699);
