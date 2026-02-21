import {
  CountMap,
  Counts,
  Delta,
  DenomRow,
  DenomSet,
  OperationInput,
  WalletState,
} from "./types";

const GROUPS = ["banknotes", "coins"] as const;

function getCount(counts: CountMap, key: string): number {
  const value = counts[key];
  return Number.isFinite(value) ? value : 0;
}

function cloneCounts(counts: Counts): Counts {
  return {
    banknotes: { ...counts.banknotes },
    coins: { ...counts.coins },
  };
}

function cloneState(state: WalletState): WalletState {
  return {
    ...state,
    denoms: {
      banknotes: [...state.denoms.banknotes],
      coins: [...state.denoms.coins],
    },
    counts: cloneCounts(state.counts),
    plan: { ...state.plan },
    goal: state.goal ? { ...state.goal } : undefined,
  };
}

function ensureOperationPayload(op: OperationInput): { countsDelta?: Delta; countsAbsolute?: Counts } {
  return {
    countsDelta: op.countsDelta ?? op.values,
    countsAbsolute: op.countsAbsolute,
  };
}

export function calcBreakdown(state: WalletState): {
  banknotes: Record<string, number>;
  coins: Record<string, number>;
} {
  const breakdown: { banknotes: Record<string, number>; coins: Record<string, number> } = {
    banknotes: {},
    coins: {},
  };

  for (const group of GROUPS) {
    for (const denom of state.denoms[group]) {
      const key = String(denom);
      const count = getCount(state.counts[group], key);
      breakdown[group][key] = denom * count;
    }
  }

  return breakdown;
}

export function calcTotal(state: WalletState): number {
  const breakdown = calcBreakdown(state);
  let total = 0;

  for (const group of GROUPS) {
    for (const value of Object.values(breakdown[group])) {
      total += value;
    }
  }

  return total;
}

export function diffCounts(prevCounts: Counts, nextCounts: Counts): Delta {
  const delta: Delta = {
    banknotes: {},
    coins: {},
  };

  for (const group of GROUPS) {
    const keys = new Set<string>([
      ...Object.keys(prevCounts[group]),
      ...Object.keys(nextCounts[group]),
    ]);

    for (const key of keys) {
      const prev = getCount(prevCounts[group], key);
      const next = getCount(nextCounts[group], key);
      const diff = next - prev;

      if (diff !== 0) {
        delta[group][key] = diff;
      }
    }
  }

  return delta;
}

export function applyOperation(state: WalletState, op: OperationInput): { next: WalletState; delta: Delta } {
  const next = cloneState(state);
  const payload = ensureOperationPayload(op);

  for (const group of GROUPS) {
    for (const denom of state.denoms[group]) {
      const key = String(denom);
      const prevValue = getCount(state.counts[group], key);
      let nextValue = prevValue;

      if (op.kind === "deposit") {
        const value = payload.countsDelta ? getCount(payload.countsDelta[group], key) : 0;
        nextValue = prevValue + value;
      } else if (op.kind === "withdraw") {
        const value = payload.countsDelta ? getCount(payload.countsDelta[group], key) : 0;
        nextValue = prevValue - value;
      } else {
        if (!payload.countsAbsolute) {
          throw new Error("Set operation requires countsAbsolute.");
        }
        nextValue = getCount(payload.countsAbsolute[group], key);
      }

      if (nextValue < 0) {
        throw new Error(`Negative count is not allowed for ${group} ${key}.`);
      }

      next.counts[group][key] = nextValue;
    }
  }

  return {
    next,
    delta: diffCounts(state.counts, next.counts),
  };
}

// Backward-compatible helpers used by previous stage files.
export function calculateGroupTotal(denoms: number[], counts: CountMap): number {
  let total = 0;

  for (const denom of denoms) {
    total += denom * getCount(counts, String(denom));
  }

  return total;
}

export function calculateWalletTotal(wallet: WalletState): number {
  return calcTotal(wallet);
}

export function buildDenomRows(wallet: WalletState): DenomRow[] {
  const rows: DenomRow[] = [];
  const breakdown = calcBreakdown(wallet);

  for (const group of GROUPS) {
    for (const denom of wallet.denoms[group]) {
      const key = String(denom);
      rows.push({
        group,
        denom,
        count: getCount(wallet.counts[group], key),
        subtotal: getCount(breakdown[group], key),
      });
    }
  }

  return rows;
}

export function createZeroCountsByDenoms(denoms: DenomSet): Counts {
  return {
    banknotes: Object.fromEntries(denoms.banknotes.map((denom) => [String(denom), 0])),
    coins: Object.fromEntries(denoms.coins.map((denom) => [String(denom), 0])),
  };
}
