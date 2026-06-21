import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { type Database, relations, schema, seedTags } from "./schema";

export const createDatabase = async (url: string): Promise<Database> => {
	const client = new SQL({ url });
	const database = drizzle({ client, relations, schema });
	await migrate(database, { migrationsFolder: "./drizzle" });
	await seedTags(database);
	return database;
};
