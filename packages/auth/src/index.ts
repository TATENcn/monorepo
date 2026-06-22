import { betterAuth } from "better-auth";
import type { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { ac, adminRole, userRole } from "./permissions";

export interface CreateAuthOptions {
	baseURL: string;
	// REVIEW: This syntax will cause this type to become any
	// // database: NonNullable<BetterAuthOptions["database"]>;
	database: ReturnType<typeof drizzleAdapter>;
}

export const createAuth = (options: CreateAuthOptions) => {
	return betterAuth({
		...options,
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
};
