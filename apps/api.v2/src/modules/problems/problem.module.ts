import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ProblemController } from "./problem.controller";
import { ProblemRepository } from "./problem.repository";

@Module({
	imports: [DatabaseModule],
	controllers: [ProblemController],
	providers: [ProblemRepository],
})
export class ProblemsModule {}
