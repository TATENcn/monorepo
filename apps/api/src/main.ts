import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import { authRoutePlugin } from "./modules/auth";
import { problemsPlugin } from "./modules/problems";
import { submissionPlugin } from "./modules/submission";

new Elysia()
	.use(authRoutePlugin)
	.use(openapi({ provider: "scalar" }))
	.group("/problems", (app) => app.use(problemsPlugin))
	.group("/submissions", (app) => app.use(submissionPlugin))
	.listen({ port: 3080 });
