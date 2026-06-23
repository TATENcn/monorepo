import { Injectable } from "@nestjs/common";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

@Injectable()
export class DatabaseService {
	private drizzle;

	constructor() {
		const sql = new SQL({ url: process.env.DATABASE_URL! });
		this.drizzle = drizzle({ client: sql });
	}

	public get db() {
		return this.drizzle;
	}
}
