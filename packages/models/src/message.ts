import type { VerdictResponse, VerdictTask } from "./judge-core";

export type SubmitMessage = { submission_id: string; task: VerdictTask };
export type ResultMessage = { submission_id: string; result: VerdictResponse };
