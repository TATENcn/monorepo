import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ContestController } from "./contest.controller";
import { ContestRepository } from "./contest.repository";

@Module({
	imports: [DatabaseModule],
	controllers: [ContestController],
	providers: [ContestRepository],
})
export class ContestModule {}
