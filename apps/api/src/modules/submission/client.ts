import { JudgeCoreClient } from "judge-core-sdk";

export const judgeClient = new JudgeCoreClient(process.env.JUDGE_CORE_URL);
