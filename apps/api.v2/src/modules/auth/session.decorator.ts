import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Session as AuthSession, User as AuthUser } from "better-auth";
import type { FastifyRequest } from "fastify";

export const REQUIRE_AUTH_KEY = "requireAuth";

/**
 * Mark a route or controller as requiring authentication
 */
export const Auth = () => SetMetadata(REQUIRE_AUTH_KEY, true);

/**
 * Session payload
 */
export interface SessionPayload {
	session: AuthSession;
	user: AuthUser;
}

declare module "fastify" {
	interface FastifyRequest {
		/**
		 * Populated by SessionGuard. `null` when no valid session cookie is present
		 */
		session: SessionPayload | null;
	}
}

/**
 * Extract the full payload injected by SessionGuard (or `null` if unauthenticated)
 */
export const Session = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionPayload | null => {
	return ctx.switchToHttp().getRequest<FastifyRequest>().session;
});

/**
 * Extract just the authenticated user (or `null` if unauthenticated)
 */
export const User = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | null => {
	return ctx.switchToHttp().getRequest<FastifyRequest>().session?.user ?? null;
});
