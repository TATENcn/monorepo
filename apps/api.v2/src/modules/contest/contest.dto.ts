import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsISO8601, IsNumberString, IsOptional, IsString, IsUUID, Length } from "class-validator";
import { type ContestType, contestTypeEnumLiteral } from "../database/database.enum";

export class CreateContestRequest {
	@ApiProperty({ name: "Contest type" })
	@IsString()
	@IsEnum(Object.fromEntries(contestTypeEnumLiteral.map((v) => [v, v])))
	type!: ContestType;

	@ApiProperty({ name: "Contest title" })
	@IsString()
	title!: string;

	@ApiProperty({ name: "Contest description" })
	@IsString()
	description!: string;

	@ApiProperty({ name: "Contest start time" })
	@IsISO8601()
	startedAt!: Date;

	@ApiProperty({ name: "Contest finish time" })
	@IsISO8601()
	finishedAt!: Date;
}

export class UpdateContestFieldsRequest {
	@ApiProperty({ name: "Contest id" })
	@IsUUID()
	id!: string;

	@ApiProperty({ name: "Contest type" })
	@IsOptional()
	@IsString()
	@IsEnum(Object.fromEntries(contestTypeEnumLiteral.map((v) => [v, v])))
	type?: ContestType;

	@ApiProperty({ name: "Contest title" })
	@IsOptional()
	@IsString()
	title?: string;

	@ApiProperty({ name: "Contest description" })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiProperty({ name: "Contest start time" })
	@IsOptional()
	@IsISO8601()
	startedAt?: Date;

	@ApiProperty({ name: "Contest finish time" })
	@IsOptional()
	@IsISO8601()
	finishedAt?: Date;
}

export class DeleteContestRequest {
	@ApiProperty({ name: "Contest id" })
	@IsUUID()
	id!: string;
}

export class GetContestListParams {
	@ApiProperty({ name: "Query limit" })
	@IsOptional()
	@IsNumberString()
	@Length(0, 50)
	limit?: number;

	@ApiProperty({ name: "Query offset" })
	@IsOptional()
	@Length(0)
	@IsNumberString()
	offset?: number;
}

export class GetContestParams {
	@ApiProperty({ name: "Contest id" })
	@IsUUID()
	id!: string;
}

export class ApproveContestRequest {
	@ApiProperty({ name: "Contest id" })
	@IsUUID()
	id!: string;
}
