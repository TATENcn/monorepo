import { All, Controller, type RawBodyRequest, Req, Res } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
// biome-ignore lint/style/useImportType: Injection
import { AuthService } from "./auth.service";

@Controller("api/auth")
export class AuthController {
	constructor(private authService: AuthService) {}

	@All("*")
	public async authHandler(@Req() req: RawBodyRequest<FastifyRequest>, @Res() res: FastifyReply) {
		const request = this.toStandardRequest(req);
		const response = await this.authService.auth.handler(request);
		this.sendStandardResponse(res, response);
	}

	private toStandardRequest(req: RawBodyRequest<FastifyRequest>) {
		const { protocol, host, method, rawBody: body, headers } = req;
		const url = new URL(req.url, `${protocol}://${host}`);

		const request = new Request(url.toString(), {
			body,
			method,
			headers: fromNodeHeaders(headers),
		});

		return request;
	}

	private sendStandardResponse(rep: FastifyReply, res: Response) {
		if (res.bodyUsed) {
			throw new Error("body used");
		}

		rep.status(res.status);
		rep.headers(Object.fromEntries(res.headers.entries()));

		if (res.body) {
			rep.send(res.body);
		} else {
			rep.send(undefined);
		}
	}
}
