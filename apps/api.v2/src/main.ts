import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AuthModule } from "./modules/auth/auth.module";
import { ContestModule } from "./modules/contest/contest.module";
import { ProblemsModule } from "./modules/problems/problem.module";

@Module({
	imports: [ContestModule, ProblemsModule, AuthModule],
})
class RootModule {}

const app = await NestFactory.create<NestFastifyApplication>(RootModule, new FastifyAdapter());

app.useGlobalPipes(
	new ValidationPipe({
		whitelist: true,
		forbidNonWhitelisted: true,
		forbidUnknownValues: true,
		transform: true,
	}),
);

const config = new DocumentBuilder()
	.setTitle("TATEN Online Judge Platform")
	.setDescription("The platform API references")
	.setVersion("0.1.0-unstable")
	.addTag("Contest")
	.addTag("Problems")
	.build();
const documentFactory = () => SwaggerModule.createDocument(app, config);
SwaggerModule.setup("api", app, documentFactory);

await app.listen(3699);
