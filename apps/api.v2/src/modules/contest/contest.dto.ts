import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsISO8601, IsNumberString, IsOptional, IsString, IsUUID, Length } from "class-validator";
import { type ContestType, contestTypeEnumLiteral } from "../database/database.enum";

export class CreateContestRequest {
	@ApiProperty({ description: "Contest type", type: "string", enum: contestTypeEnumLiteral })
	@IsString()
	@IsEnum(Object.fromEntries(contestTypeEnumLiteral.map((v) => [v, v])))
	type!: ContestType;

	@ApiProperty({ description: "Contest title" })
	@IsString()
	title!: string;

	@ApiProperty({ description: "Contest description" })
	@IsString()
	description!: string;

	@ApiProperty({ description: "Contest start time" })
	@IsISO8601()
	startedAt!: Date;

	@ApiProperty({ description: "Contest finish time" })
	@IsISO8601()
	finishedAt!: Date;
}

export class UpdateContestFieldsRequest {
	@ApiProperty({ description: "Contest type", type: "string", enum: contestTypeEnumLiteral })
	@IsOptional()
	@IsString()
	@IsEnum(Object.fromEntries(contestTypeEnumLiteral.map((v) => [v, v])))
	type?: ContestType;

	@ApiProperty({ description: "Contest title" })
	@IsOptional()
	@IsString()
	title?: string;

	@ApiProperty({ description: "Contest description" })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiProperty({ description: "Contest start time" })
	@IsOptional()
	@IsISO8601()
	startedAt?: Date;

	@ApiProperty({ description: "Contest finish time" })
	@IsOptional()
	@IsISO8601()
	finishedAt?: Date;
}

export class UpdateContestFieldsParams {
	@ApiProperty({ description: "Contest id" })
	@IsUUID()
	id!: string;
}

export class DeleteContestRequest {
	@ApiProperty({ description: "Contest id" })
	@IsUUID()
	id!: string;
}

export class GetContestListParams {
	@ApiProperty({ description: "Query limit" })
	@IsOptional()
	@IsNumberString()
	@Length(0, 50)
	limit?: number;

	@ApiProperty({ description: "Query offset" })
	@IsOptional()
	@Length(0)
	@IsNumberString()
	offset?: number;
}

export class GetContestParams {
	@ApiProperty({ description: "Contest id" })
	@IsUUID()
	id!: string;
}

export class ApproveContestRequest {
	@ApiProperty({ description: "Contest id" })
	@IsUUID()
	id!: string;
}

export class CreateContestResponse {
	@ApiProperty({ description: "Contest id" })
	id!: string;
}

export class ContestResponse {
	@ApiProperty({ description: "Contest id" })
	id!: string;

	@ApiProperty({ description: "Contest type", type: "string", enum: contestTypeEnumLiteral })
	type!: ContestType;

	@ApiProperty({ description: "Creator id" })
	creatorId!: string;

	@ApiProperty({ description: "Contest title" })
	title!: string;

	@ApiProperty({ description: "Contest description" })
	description!: string;

	@ApiProperty({ description: "Approval status" })
	approved!: boolean;

	@ApiProperty({ description: "Approver id" })
	approverId!: string | null;

	@ApiProperty({ description: "Approved at" })
	approvedAt!: Date | null;

	@ApiProperty({ description: "Created at" })
	createdAt!: Date;

	@ApiProperty({ description: "Updated at" })
	updatedAt!: Date;

	@ApiProperty({ description: "Deleted at" })
	deletedAt!: Date | null;

	@ApiProperty({ description: "Started at" })
	startedAt!: Date;

	@ApiProperty({ description: "Finished at" })
	finishedAt!: Date;
}
