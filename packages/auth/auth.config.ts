/**
 * @fileoverview This file is used to generate the database structure; please do not import it or use it for any other purpose.
 */

import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAuth } from "./src";

const database = drizzle("postgresql://postgres:postgres@localhost:5432/taten");

export const auth = createAuth({
	baseURL: "http://localhost:3000",
	database: drizzleAdapter(database, { provider: "pg" }),
});
