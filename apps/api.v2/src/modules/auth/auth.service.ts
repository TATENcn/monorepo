import { Injectable } from "@nestjs/common";
import { createAuth } from "auth";
import * as schema from "auth/schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
// biome-ignore lint/style/useImportType: Module injection
import { DatabaseService } from "../database/database.service";

@Injectable()
export class AuthService {
	private betterAuth;

	public constructor(db: DatabaseService) {
		this.betterAuth = createAuth({
			database: drizzleAdapter(db, { schema, provider: "pg" }),
			baseURL: process.env.BASE_URL!,
		});
	}

	public get auth() {
		return this.betterAuth;
	}
}
