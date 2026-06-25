import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import type { User as AuthUser } from "better-auth";
import { Auth, User } from "../auth/session.decorator";
// biome-ignore lint/style/useImportType: Injection
import {
	ApproveContestRequest,
	ContestResponse,
	CreateContestRequest,
	CreateContestResponse,
	DeleteContestRequest,
	GetContestListParams,
	GetContestParams,
	UpdateContestFieldsParams,
	UpdateContestFieldsRequest,
} from "./contest.dto";
// biome-ignore lint/style/useImportType: Injection
import { ContestRepository } from "./contest.repository";

@Controller("api/contests")
export class ContestController {
	constructor(private readonly repository: ContestRepository) {}

	@Post()
	@Auth()
	public async createContest(@Body() body: CreateContestRequest, @User() user: AuthUser): Promise<CreateContestResponse> {
		const id = await this.repository.createContest(body, user.id);
		return { id };
	}

	@Get()
	public async getContests(@Query() query: GetContestListParams): Promise<ContestResponse[]> {
		return this.repository.getContests(query);
	}

	@Get(":id")
	public async getContest(@Param() params: GetContestParams): Promise<ContestResponse | null> {
		return this.repository.getContest(params);
	}

	@Patch(":id")
	@Auth()
	public async updateContestFields(@Param() params: UpdateContestFieldsParams, @Body() body: UpdateContestFieldsRequest, @User() user: AuthUser) {
		await this.repository.updateContestFields(body, params, user.id);
	}

	@Delete(":id")
	@Auth()
	@HttpCode(HttpStatus.NO_CONTENT)
	public async deleteContest(@Param() params: DeleteContestRequest, @User() user: AuthUser) {
		await this.repository.deleteContest(params, user.id);
	}

	@Post(":id/approve")
	@Auth()
	@HttpCode(HttpStatus.NO_CONTENT)
	public async approveContest(@Param() params: ApproveContestRequest, @User() user: AuthUser) {
		await this.repository.approveContest(params, user.id);
	}
}
