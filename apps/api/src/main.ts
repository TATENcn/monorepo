import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import { authRoutePlugin } from "./modules/auth";
import { problemsPlugin } from "./modules/problems";
import { submissionPlugin } from "./modules/submission";

new Elysia()
	.use(authRoutePlugin)
	.use(openapi({ provider: "scalar" }))
	.group("/api/v1/problems", (app) => app.use(problemsPlugin))
	.group("/api/v1/submissions", (app) => app.use(submissionPlugin))
	.listen({ port: 3080 });
