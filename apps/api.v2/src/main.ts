import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ContestModule } from "./modules/contest/contest.module";

@Module({
	imports:[ContestModule]
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
	.addTag("contest")
	.build();
const documentFactory = () => SwaggerModule.createDocument(app, config);
SwaggerModule.setup("api", app, documentFactory);

await app.listen(3699);
