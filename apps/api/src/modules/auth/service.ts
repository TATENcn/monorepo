import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createAuth } from "auth";
import * as schema from "auth/schema";
import { database } from "../db";

export const auth = createAuth({
	baseURL: process.env.BASE_URL!,
	database: drizzleAdapter(database, { schema, provider: "pg" }),
});
