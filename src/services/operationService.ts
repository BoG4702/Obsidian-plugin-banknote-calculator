import { TFile } from "obsidian";
import { applyOperation, calcTotal } from "../core/calculator";
import { LogEntry, OperationInput, WalletState } from "../core/types";
import { LedgerRepository } from "../storage/ledgerRepo";
import { WalletRepository } from "../storage/walletRepo";

export class OperationService {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly walletRepo: WalletRepository,
    private readonly ledgerRepo: LedgerRepository,
  ) {}

  commitOperation(op: OperationInput): Promise<{ wallet: WalletState; logFile?: TFile }> {
    return this.enqueue(async () => {
      const current = await this.walletRepo.loadWallet();
      const totalBefore = calcTotal(current);
      const { next, delta } = applyOperation(current, op);

      const wallet = await this.walletRepo.updateWallet((fm: any) => {
        fm.counts = {
          banknotes: { ...next.counts.banknotes },
          coins: { ...next.counts.coins },
        };
      });

      const ts = new Date().toISOString();
      const logId = `${ts}-${Math.random().toString(36).slice(2, 10)}`;

      const entry: LogEntry = {
        id: logId,
        type: "cash_log",
        schema_version: 1,
        wallet_path: this.walletRepo.getWalletPath(),
        ts,
        kind: op.kind,
        delta,
        total_before: totalBefore,
        total_after: calcTotal(wallet),
        comment: op.comment?.trim() ?? "",
      };

      const logFile = await this.ledgerRepo.appendLog(entry);

      return {
        wallet,
        logFile,
      };
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
