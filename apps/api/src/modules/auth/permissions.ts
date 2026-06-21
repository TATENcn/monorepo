import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

const statement = {
	...defaultStatements,
	contest: ["create", "approve", "update", "delete"],
	problem: ["create", "update", "delete"],
	submission: ["post", "get"],
} as const;

export const ac = createAccessControl(statement);

/** Normal user */
export const userRole = ac.newRole({
	contest: ["create", "update", "delete"],
	problem: ["create", "update", "delete"],
	submission: ["post", "get"],
});

/** Admin */
export const adminRole = ac.newRole({
	...adminAc.statements,
	contest: ["create", "approve", "update", "delete"],
	problem: ["create", "update", "delete"],
	submission: ["post", "get"],
});
