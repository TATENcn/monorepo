import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { User as AuthUser } from "better-auth";
import { Auth, User } from "../auth/session.decorator";
// biome-ignore lint/style/useImportType: Injection
import {
	CreateProblemRequest,
	CreateProblemResponse,
	GetProblemListParams,
	ProblemDetailResponse,
	ProblemIdParams,
	ProblemListItemResponse,
	ProblemStatResponse,
	ReplaceTestCasesRequest,
	TestCaseRowResponse,
	UpdateProblemRequest,
} from "./problem.dto";
// biome-ignore lint/style/useImportType: Injection
import { ProblemRepository } from "./problem.repository";

@ApiTags("Problems")
@Controller("api/problems")
export class ProblemController {
	constructor(private readonly repository: ProblemRepository) {}

	@Get()
	@ApiOkResponse({ description: "List of problems", type: ProblemListItemResponse, isArray: true })
	public async listProblems(@Query() query: GetProblemListParams): Promise<ProblemListItemResponse[]> {
		return this.repository.listProblems({
			limit: query.limit ?? 10,
			offset: query.offset ?? 0,
			searchQuery: query.query,
			difficulty: query.difficulty,
			tagId: query.tagId,
		});
	}

	@Get("stat")
	@ApiOkResponse({ description: "Problem count", type: ProblemStatResponse })
	public async getStat(): Promise<ProblemStatResponse> {
		return this.repository.getProblemsStat();
	}

	@Get(":id/test-cases")
	@ApiOkResponse({ description: "Problem test cases", type: TestCaseRowResponse, isArray: true })
	@ApiNotFoundResponse({ description: "Problem not found" })
	public async getTestCases(@Param() params: ProblemIdParams, @User() user: AuthUser): Promise<TestCaseRowResponse[]> {
		return this.repository.getTestCases(params.id, user.id);
	}

	@Get(":id")
	@ApiOkResponse({ description: "Problem details", type: ProblemDetailResponse })
	@ApiNotFoundResponse({ description: "Problem not found" })
	public async getProblem(@Param() params: ProblemIdParams): Promise<ProblemDetailResponse | null> {
		return this.repository.getProblemDetail(params.id);
	}

	@Patch(":id")
	@Auth()
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiNoContentResponse({ description: "Problem updated" })
	@ApiNotFoundResponse({ description: "Problem not found or not authorized" })
	public async updateProblem(@Param() params: ProblemIdParams, @Body() body: UpdateProblemRequest, @User() user: AuthUser): Promise<void> {
		await this.repository.updateProblem(params.id, user.id, {
			title: body.title,
			description: body.description,
			difficulty: body.difficulty,
			limitCpuTimeMs: body.limit?.cpuTimeMs,
			limitWallTimeMs: body.limit?.wallTimeMs,
			limitMemoryBytes: body.limit?.memoryBytes,
			limitOutputBytes: body.limit?.outputBytes,
			tagIds: body.tags,
		});
	}

	@Delete(":id")
	@Auth()
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiNoContentResponse({ description: "Problem deleted" })
	@ApiNotFoundResponse({ description: "Problem not found or not authorized" })
	public async deleteProblem(@Param() params: ProblemIdParams, @User() user: AuthUser): Promise<void> {
		await this.repository.deleteProblem(params.id, user.id);
	}

	@Post()
	@Auth()
	@HttpCode(HttpStatus.CREATED)
	@ApiCreatedResponse({ description: "Problem created", type: CreateProblemResponse })
	public async createProblem(@Body() body: CreateProblemRequest, @User() user: AuthUser): Promise<CreateProblemResponse> {
		return this.repository.createProblem(
			{
				title: body.title,
				description: body.description,
				difficulty: body.difficulty,
				limitCpuTimeMs: body.limit.cpuTimeMs,
				limitWallTimeMs: body.limit.wallTimeMs,
				limitMemoryBytes: body.limit.memoryBytes,
				limitOutputBytes: body.limit.outputBytes,
				tagIds: body.tags,
			},
			user.id,
		);
	}

	@Put(":id/test-cases")
	@Auth()
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiNoContentResponse({ description: "Test cases replaced" })
	@ApiNotFoundResponse({ description: "Problem not found or not authorized" })
	public async replaceTestCases(@Param() params: ProblemIdParams, @Body() body: ReplaceTestCasesRequest, @User() user: AuthUser): Promise<void> {
		await this.repository.replaceTestCases(params.id, user.id, body.cases);
	}
}
