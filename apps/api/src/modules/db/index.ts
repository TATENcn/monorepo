import Elysia from "elysia";
import { createDatabase } from "./connection";

export const database = await createDatabase(process.env.DATABASE_URL!);

export const databasePlugin = new Elysia({ name: "database" }).decorate("db", database);
