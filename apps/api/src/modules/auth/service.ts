import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import * as schema from "../db/auth.schema";
import { database } from "../db/connection";

export const auth = betterAuth({
	baseURL: process.env.BASE_URL,
	database: drizzleAdapter(database, { provider: "pg", schema }),
	emailAndPassword: {
		enabled: true,
	},
});
