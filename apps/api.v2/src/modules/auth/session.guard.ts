import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Injection
import { Reflector } from "@nestjs/core";
import { fromNodeHeaders } from "better-auth/node";
// biome-ignore lint/style/useImportType: Injection
import { AuthService } from "./auth.service";
import { REQUIRE_AUTH_KEY } from "./session.decorator";

@Injectable()
export class SessionGuard implements CanActivate {
	constructor(
		private readonly authService: AuthService,
		private readonly reflector: Reflector,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const requireAuth = this.reflector.getAllAndOverride<boolean>(REQUIRE_AUTH_KEY, [context.getHandler(), context.getClass()]);

		const request = context.switchToHttp().getRequest();
		const headers = fromNodeHeaders(request.headers);

		request.session = await this.authService.auth.api.getSession({ headers });

		if (!requireAuth) {
			return true;
		}

		if (!request.session) {
			throw new UnauthorizedException();
		}

		return true;
	}
}
