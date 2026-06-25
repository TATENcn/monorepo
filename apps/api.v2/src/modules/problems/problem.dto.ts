import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from "class-validator";
import type { Difficulty, TestCaseType } from "../database/database.enum";
import { difficultyEnumLiteral, testCaseTypeEnumLiteral } from "../database/database.enum";

export class ProblemIdParams {
	@ApiProperty({ description: "Problem ID", format: "uuid" })
	@IsUUID()
	id!: string;
}

export class GetProblemListParams {
	@ApiProperty({ description: "Maximum number of results", default: 10, minimum: 5, maximum: 50 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(5)
	@Max(50)
	limit?: number;

	@ApiProperty({ description: "Number of results to skip", default: 0, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset?: number;

	@ApiProperty({ description: "Full-text search query", maxLength: 255 })
	@IsOptional()
	@IsString()
	query?: string;

	@ApiProperty({ description: "Filter by difficulty", type: "string", enum: difficultyEnumLiteral })
	@IsOptional()
	@IsString()
	@IsEnum(Object.fromEntries(difficultyEnumLiteral.map((v) => [v, v])))
	difficulty?: Difficulty;

	@ApiProperty({ description: "Filter by tag ID", format: "uuid" })
	@IsOptional()
	@IsUUID()
	tagId?: string;
}

class LimitDto {
	@ApiProperty({ description: "CPU time limit in milliseconds" })
	@IsInt()
	cpuTimeMs!: number;

	@ApiProperty({ description: "Wall-clock time limit in milliseconds" })
	@IsInt()
	wallTimeMs!: number;

	@ApiProperty({ description: "Memory limit in bytes" })
	@IsInt()
	memoryBytes!: number;

	@ApiProperty({ description: "Output limit in bytes" })
	@IsInt()
	outputBytes!: number;
}

export class CreateProblemRequest {
	@ApiProperty({ description: "Problem title" })
	@IsString()
	title!: string;

	@ApiProperty({ description: "Problem description" })
	@IsString()
	description!: string;

	@ApiProperty({ description: "Problem difficulty", type: "string", enum: difficultyEnumLiteral })
	@IsString()
	@IsEnum(Object.fromEntries(difficultyEnumLiteral.map((v) => [v, v])))
	difficulty!: Difficulty;

	@ApiProperty({ description: "Resource limits" })
	@ValidateNested()
	@Type(() => LimitDto)
	limit!: LimitDto;

	@ApiProperty({ description: "Tag IDs", format: "uuid", isArray: true })
	@IsArray()
	@IsUUID("4", { each: true })
	tags!: string[];
}

export class UpdateProblemRequest {
	@ApiProperty({ description: "Problem title" })
	@IsOptional()
	@IsString()
	title?: string;

	@ApiProperty({ description: "Problem description" })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiProperty({ description: "Problem difficulty", type: "string", enum: difficultyEnumLiteral })
	@IsOptional()
	@IsString()
	@IsEnum(Object.fromEntries(difficultyEnumLiteral.map((v) => [v, v])))
	difficulty?: Difficulty;

	@ApiProperty({ description: "Resource limits" })
	@IsOptional()
	@ValidateNested()
	@Type(() => LimitDto)
	limit?: LimitDto;

	@ApiProperty({ description: "Tag IDs", format: "uuid", isArray: true })
	@IsOptional()
	@IsArray()
	@IsUUID("4", { each: true })
	tags?: string[];
}

class TestCaseInputDto {
	@ApiProperty({ description: "Test case input" })
	@IsString()
	input!: string;

	@ApiProperty({ description: "Test case expected output" })
	@IsString()
	output!: string;

	@ApiProperty({ description: "Test case visibility", type: "string", enum: testCaseTypeEnumLiteral })
	@IsString()
	@IsEnum(Object.fromEntries(testCaseTypeEnumLiteral.map((v) => [v, v])))
	type!: TestCaseType;
}

export class ReplaceTestCasesRequest {
	@ApiProperty({ description: "Test cases to replace with", type: [TestCaseInputDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => TestCaseInputDto)
	cases!: TestCaseInputDto[];
}

export class ProblemListItemResponse {
	@ApiProperty({ description: "Problem ID", format: "uuid" })
	id!: string;

	@ApiProperty({ description: "Problem title" })
	title!: string;

	@ApiProperty({ description: "Problem difficulty", type: "string", enum: difficultyEnumLiteral })
	difficulty!: Difficulty;

	@ApiProperty({ description: "Associated tag IDs", format: "uuid", isArray: true })
	tags!: string[];
}

class LimitResponse {
	@ApiProperty({ description: "CPU time limit in milliseconds" })
	cpuTimeMs!: number;

	@ApiProperty({ description: "Wall-clock time limit in milliseconds" })
	wallTimeMs!: number;

	@ApiProperty({ description: "Memory limit in bytes" })
	memoryBytes!: number;

	@ApiProperty({ description: "Output limit in bytes" })
	outputBytes!: number;
}

export class ProblemDetailResponse {
	@ApiProperty({ description: "Problem ID", format: "uuid" })
	id!: string;

	@ApiProperty({ description: "Author ID", format: "uuid" })
	authorId!: string;

	@ApiProperty({ description: "Problem title" })
	title!: string;

	@ApiProperty({ description: "Problem description" })
	description!: string;

	@ApiProperty({ description: "Problem difficulty", type: "string", enum: difficultyEnumLiteral })
	difficulty!: Difficulty;

	@ApiProperty({ description: "Associated tag IDs", format: "uuid", isArray: true })
	tags!: string[];

	@ApiProperty({ description: "Creation timestamp", format: "date-time" })
	createdAt!: string;

	@ApiProperty({ description: "Last update timestamp", format: "date-time" })
	updatedAt!: string;

	@ApiProperty({ description: "Resource limits" })
	limit!: LimitResponse;
}

export class ProblemStatResponse {
	@ApiProperty({ description: "Total number of problems" })
	total!: number;
}

export class TestCaseRowResponse {
	@ApiProperty({ description: "Test case ID", format: "uuid" })
	id!: string;

	@ApiProperty({ description: "Test case input" })
	input!: string;

	@ApiProperty({ description: "Test case expected output" })
	output!: string;

	@ApiProperty({ description: "Test case visibility", type: "string", enum: testCaseTypeEnumLiteral })
	type!: TestCaseType;
}

export class CreateProblemResponse {
	@ApiProperty({ description: "Created problem ID", format: "uuid" })
	id!: string;
}
