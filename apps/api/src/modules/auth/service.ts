import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { database } from "../db";
import * as schema from "../db/auth.schema";

export const auth = betterAuth({
	baseURL: process.env.BASE_URL,
	database: drizzleAdapter(database, { provider: "pg", schema }),
	emailAndPassword: {
		enabled: true,
	},
});
