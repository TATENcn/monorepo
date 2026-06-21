import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { database } from "../db";
import * as schema from "../db/auth.schema";
import { ac, adminRole, userRole } from "./permissions";

export const auth = betterAuth({
	baseURL: process.env.BASE_URL,
	database: drizzleAdapter(database, { provider: "pg", schema }),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		admin({
			defaultRole: "user",
			adminRoles: ["admin"],
			ac,
			roles: {
				admin: adminRole,
				user: userRole,
			},
		}),
	],
});
