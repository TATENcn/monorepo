import { Elysia } from "elysia";
import { authRoutePlugin } from "./modules/auth";

new Elysia().use(authRoutePlugin).listen({ port: 3080 });
