import { Injectable, Logger } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { schema } from "../database/database.schema";
// biome-ignore lint/style/useImportType: Module injection
import { DatabaseService } from "../database/database.service";
import type {
	ApproveContestRequest,
	CreateContestRequest,
	DeleteContestRequest,
	GetContestListParams,
	GetContestParams,
	UpdateContestFieldsParams,
	UpdateContestFieldsRequest,
} from "./contest.dto";

@Injectable()
export class ContestRepository {
	private logger: Logger;
	private db: DatabaseService;

	public constructor(db: DatabaseService) {
		this.db = db;
		this.logger = new Logger(ContestRepository.name);
	}

	public async createContest(options: CreateContestRequest, creatorId: string): Promise<string> {
		const id = await this.db.db
			.insert(schema.contests)
			.values({
				...options,
				creatorId,
			})
			.returning({ id: schema.contests.id })
			.then((v) => v.map((i) => i.id).at(0)!);

		this.logger.log("Contest created", { id, creatorId });
		return id;
	}

	public async updateContestFields(fields: UpdateContestFieldsRequest, params: UpdateContestFieldsParams, creatorId: string): Promise<void> {
		const { id } = params;

		await this.db.db
			.update(schema.contests)
			.set(fields)
			.where(and(eq(schema.contests.id, id), eq(schema.contests.creatorId, creatorId)));

		this.logger.log("Contest fields updated", { id, creatorId });
	}

	public async getContest(options: GetContestParams) {
		const result = await this.db.db
			.select()
			.from(schema.contests)
			.where(eq(schema.contests.id, options.id))
			.then((v) => v.at(0));

		return result ?? null;
	}

	public async getContests(options: GetContestListParams) {
		const { limit = 20, offset = 0 } = options;

		const result = await this.db.db.select().from(schema.contests).orderBy(desc(schema.contests.createdAt)).limit(limit).offset(offset);

		return result;
	}

	public async deleteContest(options: DeleteContestRequest, creatorId: string): Promise<void> {
		const { id } = options;

		await this.db.db
			.update(schema.contests)
			.set({ deletedAt: new Date() })
			.where(and(eq(schema.contests.id, id), eq(schema.contests.creatorId, creatorId)));

		this.logger.log("Contest deleted", { id, creatorId });
	}

	public async approveContest(options: ApproveContestRequest, approverId: string): Promise<void> {
		const { id } = options;

		await this.db.db
			.update(schema.contests)
			.set({
				approved: true,
				approverId,
				approvedAt: new Date(),
			})
			.where(eq(schema.contests.id, id));

		this.logger.log("Contest approved", { id, approverId });
	}
}
