import Elysia from "elysia";
import { database } from "./connect";

export const databasePlugin = new Elysia({ name: "database" }).decorate("db", database);
