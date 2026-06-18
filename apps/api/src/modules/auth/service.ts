import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { database } from "../db/connect";
import * as schema from "../db/schema";

export const auth = betterAuth({
	database: drizzleAdapter(database, { provider: "pg", schema }),
	emailAndPassword: {
		enabled: true,
	},
});
