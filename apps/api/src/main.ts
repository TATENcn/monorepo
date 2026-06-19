import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import { authRoutePlugin } from "./modules/auth";
import { problemsPlugin } from "./modules/problems";

new Elysia()
	.use(authRoutePlugin)
	.use(openapi({ provider: "scalar" }))
	.use(problemsPlugin)
	.listen({ port: 3080 });
