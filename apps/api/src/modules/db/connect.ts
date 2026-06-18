import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

const client = new SQL({ url: process.env.DATABASE_URL });
const database = drizzle({ client });
await migrate(database, { migrationsFolder: "./drizzle" });

export { database };
