import { z } from "zod";
import {
  CashLogFrontmatter,
  CountMap,
  Counts,
  Delta,
  DenomSet,
  LogEntry,
  WalletFrontmatter,
  WalletStateInput,
  WalletState,
} from "./types";

export const SCHEMA_VERSION = 1;
export const DEFAULT_CURRENCY = "RUB";
export const DEFAULT_WALLET_PATH = "Finance/Wallet.md";
export const DEFAULT_LOGS_FOLDER = "Finance/Logs";
export const DEFAULT_GOAL_DEADLINE = "2026-12-31";

export const DEFAULT_BANKNOTES = [5000, 2000, 1000, 500, 200, 100, 50, 10, 5];
export const DEFAULT_COINS = [10, 5, 2, 1];

const positiveIntSchema = z.coerce.number().int().positive();
const nonNegativeIntSchema = z.coerce.number().int().min(0);
const nonNegativeNumberSchema = z.coerce.number().min(0);
const anyIntSchema = z.coerce.number().int();
const countMapSchema = z.record(z.string(), nonNegativeIntSchema);
const deltaMapSchema = z.record(z.string(), anyIntSchema);

export const denomSetSchema = z.object({
  banknotes: z.array(positiveIntSchema).min(1),
  coins: z.array(positiveIntSchema).min(1),
});

export const walletPlanSchema = z.object({
  monthly: nonNegativeNumberSchema,
  months: nonNegativeIntSchema,
});

export const walletGoalSchema = z.object({
  target: nonNegativeNumberSchema,
  deadline: z.string().trim().min(1),
});

export const walletFrontmatterSchema = z.object({
  type: z.literal("cash_wallet"),
  schema_version: z.literal(1),
  currency: z.string().trim().min(1),
  denoms: denomSetSchema,
  counts: z.object({
    banknotes: countMapSchema.default({}),
    coins: countMapSchema.default({}),
  }),
  plan: walletPlanSchema.optional(),
  goal: walletGoalSchema.optional(),
}).passthrough();

export const logEntryFrontmatterSchema = z.object({
  id: z.string().trim().min(1).optional(),
  type: z.literal("cash_log"),
  schema_version: z.literal(1),
  wallet_path: z.string().trim().min(1),
  ts: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Expected a valid ISO datetime string",
  }),
  kind: z.enum(["deposit", "withdraw", "set"]),
  delta: z.object({
    banknotes: deltaMapSchema.default({}),
    coins: deltaMapSchema.default({}),
  }),
  total_before: nonNegativeNumberSchema.optional(),
  total_after: nonNegativeNumberSchema,
  comment: z.string(),
}).passthrough();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatSchemaError(entity: string, error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
  return `Invalid ${entity}: ${details}`;
}

function toNonNegativeNumber(value: unknown): number {
  const parsed = nonNegativeNumberSchema.safeParse(value);
  return parsed.success ? parsed.data : 0;
}

function toNonNegativeInt(value: unknown): number {
  const parsed = nonNegativeIntSchema.safeParse(value);
  return parsed.success ? parsed.data : 0;
}

function normalizeDenomList(values: number[], fallback: number[]): number[] {
  const unique = new Set<number>();

  for (const value of values) {
    const parsed = positiveIntSchema.safeParse(value);
    if (parsed.success) {
      unique.add(parsed.data);
    }
  }

  const result = Array.from(unique).sort((a, b) => b - a);
  return result.length > 0 ? result : [...fallback];
}

function normalizeCountsByDenoms(denoms: number[], source: CountMap): CountMap {
  const counts: CountMap = {};
  for (const denom of denoms) {
    const key = String(denom);
    counts[key] = toNonNegativeInt(source[key]);
  }
  return counts;
}

function cloneCountMap(source: CountMap): CountMap {
  return { ...source };
}

export function createZeroCounts(denoms: DenomSet): Counts {
  return {
    banknotes: Object.fromEntries(denoms.banknotes.map((denom) => [String(denom), 0])),
    coins: Object.fromEntries(denoms.coins.map((denom) => [String(denom), 0])),
  };
}

export function createEmptyDelta(): Delta {
  return {
    banknotes: {},
    coins: {},
  };
}

export function normalizeWallet(state: WalletStateInput): WalletState {
  const denoms: DenomSet = {
    banknotes: normalizeDenomList(state.denoms.banknotes, DEFAULT_BANKNOTES),
    coins: normalizeDenomList(state.denoms.coins, DEFAULT_COINS),
  };

  const counts: Counts = {
    banknotes: normalizeCountsByDenoms(denoms.banknotes, state.counts.banknotes),
    coins: normalizeCountsByDenoms(denoms.coins, state.counts.coins),
  };

  const currency = state.currency.trim().toUpperCase() || DEFAULT_CURRENCY;
  const goal = state.goal
    ? {
        target: toNonNegativeNumber(state.goal.target),
        deadline: state.goal.deadline.trim() || DEFAULT_GOAL_DEADLINE,
      }
    : undefined;

  return {
    type: "cash_wallet",
    schema_version: 1,
    currency,
    denoms,
    counts,
    plan: {
      monthly: toNonNegativeNumber(state.plan?.monthly),
      months: toNonNegativeInt(state.plan?.months),
    },
    goal,
  };
}

export function parseWalletFrontmatter(fm: any): WalletState {
  const prepared = prepareWalletFrontmatterInput(fm);
  const parsed = walletFrontmatterSchema.safeParse(prepared);
  if (!parsed.success) {
    throw new Error(formatSchemaError("wallet frontmatter", parsed.error));
  }

  return normalizeWallet({
    type: parsed.data.type,
    schema_version: parsed.data.schema_version,
    currency: parsed.data.currency,
    denoms: parsed.data.denoms,
    counts: parsed.data.counts,
    plan: parsed.data.plan,
    goal: parsed.data.goal,
  });
}

function prepareWalletFrontmatterInput(fm: any): any {
  if (!isRecord(fm)) {
    return fm;
  }

  const prepared: Record<string, unknown> = { ...fm };
  const rawVersion = prepared.schema_version;

  if (rawVersion === undefined || rawVersion === null || rawVersion === "") {
    prepared.schema_version = 1;
    return prepared;
  }

  const numericVersion =
    typeof rawVersion === "number"
      ? rawVersion
      : typeof rawVersion === "string"
        ? Number(rawVersion)
        : NaN;

  if (Number.isFinite(numericVersion) && numericVersion > 1) {
    throw new Error(
      `Wallet schema_version ${numericVersion} is not supported. This plugin supports schema_version 1.`,
    );
  }

  if (numericVersion === 1) {
    prepared.schema_version = 1;
  }

  return prepared;
}

export function parseLogFrontmatter(fm: any): LogEntry {
  const parsed = logEntryFrontmatterSchema.safeParse(fm);
  if (!parsed.success) {
    throw new Error(formatSchemaError("log frontmatter", parsed.error));
  }

  const fallbackId = `${parsed.data.ts}_${parsed.data.kind}`;

  return {
    id: parsed.data.id ?? fallbackId,
    type: parsed.data.type,
    schema_version: parsed.data.schema_version,
    wallet_path: parsed.data.wallet_path,
    ts: parsed.data.ts,
    kind: parsed.data.kind,
    delta: {
      banknotes: cloneCountMap(parsed.data.delta.banknotes),
      coins: cloneCountMap(parsed.data.delta.coins),
    },
    total_before: parsed.data.total_before,
    total_after: parsed.data.total_after,
    comment: parsed.data.comment,
  };
}

export function getDefaultWalletFrontmatter(currency = DEFAULT_CURRENCY): WalletFrontmatter {
  const denoms: DenomSet = {
    banknotes: [...DEFAULT_BANKNOTES],
    coins: [...DEFAULT_COINS],
  };

  const base: WalletState = {
    type: "cash_wallet",
    schema_version: 1,
    currency,
    denoms,
    counts: createZeroCounts(denoms),
    plan: {
      monthly: 0,
      months: 0,
    },
  };

  return normalizeWallet(base);
}

export function normalizeWalletFrontmatter(raw: unknown, fallbackCurrency = DEFAULT_CURRENCY): WalletFrontmatter {
  const fallback = getDefaultWalletFrontmatter(fallbackCurrency);
  if (!isRecord(raw)) {
    return fallback;
  }

  const source = raw as Record<string, unknown>;
  const denomsSource = isRecord(source.denoms) ? source.denoms : {};
  const countsSource = isRecord(source.counts) ? source.counts : {};
  const planSource = isRecord(source.plan) ? source.plan : {};
  const goalSource = isRecord(source.goal) ? source.goal : undefined;

  const candidate = {
    type: source.type === "cash_wallet" ? source.type : fallback.type,
    schema_version: source.schema_version === 1 ? source.schema_version : fallback.schema_version,
    currency:
      typeof source.currency === "string" && source.currency.trim().length > 0
        ? source.currency
        : fallback.currency,
    denoms: {
      banknotes: Array.isArray(denomsSource.banknotes) ? denomsSource.banknotes : fallback.denoms.banknotes,
      coins: Array.isArray(denomsSource.coins) ? denomsSource.coins : fallback.denoms.coins,
    },
    counts: {
      banknotes: isRecord(countsSource.banknotes) ? countsSource.banknotes : fallback.counts.banknotes,
      coins: isRecord(countsSource.coins) ? countsSource.coins : fallback.counts.coins,
    },
    plan: {
      monthly: planSource.monthly ?? 0,
      months: planSource.months ?? 0,
    },
    goal: goalSource
      ? {
          target: goalSource.target ?? 0,
          deadline:
            typeof goalSource.deadline === "string" && goalSource.deadline.trim().length > 0
              ? goalSource.deadline
              : DEFAULT_GOAL_DEADLINE,
        }
      : undefined,
  };

  return parseWalletFrontmatter(candidate);
}

export function cloneWallet(wallet: WalletFrontmatter): WalletFrontmatter {
  return {
    type: wallet.type,
    schema_version: wallet.schema_version,
    currency: wallet.currency,
    denoms: {
      banknotes: [...wallet.denoms.banknotes],
      coins: [...wallet.denoms.coins],
    },
    counts: {
      banknotes: { ...wallet.counts.banknotes },
      coins: { ...wallet.counts.coins },
    },
    plan: {
      monthly: wallet.plan.monthly,
      months: wallet.plan.months,
    },
    goal: wallet.goal
      ? {
          target: wallet.goal.target,
          deadline: wallet.goal.deadline,
        }
      : undefined,
  };
}

export function sanitizeOperationValues(values: Delta): Delta {
  const source = values ?? createEmptyDelta();
  const result: Delta = createEmptyDelta();

  for (const group of ["banknotes", "coins"] as const) {
    const groupSource = source[group] ?? {};

    for (const [key, value] of Object.entries(groupSource)) {
      const parsed = nonNegativeIntSchema.safeParse(value);
      if (parsed.success) {
        result[group][key] = parsed.data;
      }
    }
  }

  return result;
}

function clearObject(target: Record<string, unknown>): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
}

export function applyWalletToFrontmatter(frontmatter: Record<string, unknown>, wallet: WalletFrontmatter): void {
  clearObject(frontmatter);

  frontmatter.type = wallet.type;
  frontmatter.schema_version = wallet.schema_version;
  frontmatter.currency = wallet.currency;
  frontmatter.denoms = {
    banknotes: [...wallet.denoms.banknotes],
    coins: [...wallet.denoms.coins],
  };
  frontmatter.counts = {
    banknotes: { ...wallet.counts.banknotes },
    coins: { ...wallet.counts.coins },
  };
  frontmatter.plan = {
    monthly: wallet.plan.monthly,
    months: wallet.plan.months,
  };

  if (wallet.goal) {
    frontmatter.goal = {
      target: wallet.goal.target,
      deadline: wallet.goal.deadline,
    };
  }
}

export function applyLogToFrontmatter(frontmatter: Record<string, unknown>, log: CashLogFrontmatter): void {
  clearObject(frontmatter);

  frontmatter.id = log.id;
  frontmatter.type = log.type;
  frontmatter.schema_version = log.schema_version;
  frontmatter.wallet_path = log.wallet_path;
  frontmatter.ts = log.ts;
  frontmatter.kind = log.kind;
  frontmatter.delta = {
    banknotes: { ...log.delta.banknotes },
    coins: { ...log.delta.coins },
  };
  if (typeof log.total_before === "number") {
    frontmatter.total_before = log.total_before;
  }
  frontmatter.total_after = log.total_after;
  frontmatter.comment = log.comment;
}
