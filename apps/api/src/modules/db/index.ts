import Elysia from "elysia";
import { database } from "./connection";

export const databasePlugin = new Elysia({ name: "database" }).decorate("db", database);
