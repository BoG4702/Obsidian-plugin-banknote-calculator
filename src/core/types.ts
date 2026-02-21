export type DenomGroup = "banknotes" | "coins";
export type OperationKind = "deposit" | "withdraw" | "set";

export interface DenomSet {
  banknotes: number[];
  coins: number[];
}

export type CountMap = Record<string, number>;

export interface Counts {
  banknotes: CountMap;
  coins: CountMap;
}

export interface WalletPlan {
  monthly: number;
  months: number;
}

export interface WalletGoal {
  target: number;
  deadline: string;
}

export interface WalletState {
  type: "cash_wallet";
  schema_version: 1;
  currency: string;
  denoms: DenomSet;
  counts: Counts;
  plan: WalletPlan;
  goal?: WalletGoal;
}

export interface WalletStateInput {
  type: "cash_wallet";
  schema_version: 1;
  currency: string;
  denoms: DenomSet;
  counts: Counts;
  plan?: WalletPlan;
  goal?: WalletGoal;
}

export interface Delta {
  banknotes: CountMap;
  coins: CountMap;
}

export interface OperationInput {
  kind: OperationKind;
  // Stage 4 API
  countsDelta?: Delta;
  countsAbsolute?: Counts;
  // Backward-compat field used by earlier stages/services.
  values?: Delta;
  comment?: string;
}

export interface LogEntry {
  id: string;
  type: "cash_log";
  schema_version: 1;
  wallet_path: string;
  ts: string;
  kind: OperationKind;
  delta: Delta;
  total_before?: number;
  total_after: number;
  comment: string;
}

export interface CashSavingsSettings {
  walletPath: string;
  logsFolder: string;
  currency: string;
}

export const DEFAULT_CASH_SAVINGS_SETTINGS: CashSavingsSettings = {
  walletPath: "Finance/Wallet.md",
  logsFolder: "Finance/Logs",
  currency: "RUB",
};

export function ensureCashSavingsSettings(input: unknown): CashSavingsSettings {
  const source =
    typeof input === "object" && input !== null
      ? (input as Partial<CashSavingsSettings>)
      : {};

  const walletPath =
    typeof source.walletPath === "string" && source.walletPath.trim().length > 0
      ? source.walletPath.trim()
      : DEFAULT_CASH_SAVINGS_SETTINGS.walletPath;

  const logsFolder =
    typeof source.logsFolder === "string" && source.logsFolder.trim().length > 0
      ? source.logsFolder.trim()
      : DEFAULT_CASH_SAVINGS_SETTINGS.logsFolder;

  const currency =
    typeof source.currency === "string" && source.currency.trim().length > 0
      ? source.currency.trim().toUpperCase()
      : DEFAULT_CASH_SAVINGS_SETTINGS.currency;

  return {
    walletPath,
    logsFolder,
    currency,
  };
}

export interface DenomRow {
  group: DenomGroup;
  denom: number;
  count: number;
  subtotal: number;
}

export interface SavingsProjection {
  currentTotal: number;
  monthly: number;
  months: number;
  projectedTotal: number;
}

export interface GoalProjection {
  remaining: number;
  daysLeft: number;
  requiredPerDay: number;
  requiredPerWeek: number;
  requiredPerMonth: number;
  isDeadlinePassed: boolean;
}

export interface OperationResult {
  wallet: WalletState;
  delta: Delta;
  totalAfter: number;
}

// Compatibility aliases for existing imports in later stages.
export type DenomsByGroup = DenomSet;
export type CountsByDenom = CountMap;
export type CountsByGroup = Counts;
export type WalletFrontmatter = WalletState;
export type CashLogFrontmatter = LogEntry;
export type PluginSettings = CashSavingsSettings;
