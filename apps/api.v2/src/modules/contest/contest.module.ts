import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ContestRepository } from "./contest.repository";

@Module({
	imports: [DatabaseModule],
	providers: [ContestRepository],
})
export class ContestModule {}
