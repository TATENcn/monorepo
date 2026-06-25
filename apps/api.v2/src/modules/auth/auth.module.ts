import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "../database/database.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionGuard } from "./session.guard";

@Module({
	imports: [DatabaseModule],
	providers: [AuthService, SessionGuard, { provide: APP_GUARD, useExisting: SessionGuard }],
	exports: [AuthService],
	controllers: [AuthController],
})
export class AuthModule {}
