export interface IIcpcEntry {
	/** Team id */
	id: string;
	/** Solved problems */
	solvedProblems: number;
	/** Penalty counts (accepted submissions only) */
	penaltyCounts: number;
	/** Time using (seconds) */
	timeUsing: number;
}

export interface IIcpcOptions {
	/** Penalty seconds */
	penaltySeconds: number;
}

/**
 * Sort team entries by penalty
 * @param entries Team entries
 * @param options Icpc series algorithm options
 * @returns Sorted entries
 */
export const icpcRankSort = (entries: IIcpcEntry[], options: IIcpcOptions): IIcpcEntry[] => {
	return entries.toSorted((a, b) => {
		if (a.solvedProblems !== b.solvedProblems) {
			return b.solvedProblems - a.solvedProblems;
		}

		return icpcPenalty(a, options) - icpcPenalty(b, options);
	});
};

/**
 * Calculate total penalty
 * @param entry Team entry
 * @param options Icpc series algorithm options
 * @returns Total penalty
 */
export const icpcPenalty = (entry: IIcpcEntry, options: IIcpcOptions) => {
	return entry.timeUsing + entry.penaltyCounts * options.penaltySeconds;
};

/**
 * Assign ranks to teams
 * @param entries Team entries
 * @param options Icpc series algorithm options
 * @returns Team entries and rank (1,2,2,4 style)
 */
export const icpcAssignRanks = (entries: IIcpcEntry[], options: IIcpcOptions): { entry: IIcpcEntry; rank: number }[] => {
	const sorted = icpcRankSort(entries, options);

	const result: { entry: IIcpcEntry; rank: number }[] = [];
	let rank = 1;

	for (let i = 0; i < sorted.length; i++) {
		const current = sorted[i]!;

		if (i === 0) {
			result.push({ entry: current, rank });
			continue;
		}

		const previous = sorted[i - 1]!;
		const prevPenalty = icpcPenalty(previous, options);
		const currPenalty = icpcPenalty(current, options);

		const isTie = current.solvedProblems === previous.solvedProblems && currPenalty === prevPenalty;

		if (isTie) {
			result.push({ entry: current, rank });
		} else {
			rank = i + 1;
			result.push({ entry: current, rank });
		}
	}

	return result;
};
