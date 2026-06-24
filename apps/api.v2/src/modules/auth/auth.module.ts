import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
	imports: [DatabaseModule],
	providers: [AuthService],
	exports: [AuthService],
	controllers: [AuthController],
})
export class AuthModule {}
