import { App, TFile, TFolder, normalizePath, stringifyYaml } from "obsidian";
import { parseLogFrontmatter } from "../core/schema";
import {
  CashSavingsSettings,
  LogEntry,
  ensureCashSavingsSettings,
} from "../core/types";

export class LedgerRepository {
  private readonly settings: CashSavingsSettings;
  private readonly fileByLogId = new Map<string, TFile>();

  constructor(
    private readonly app: App,
    settings: CashSavingsSettings,
  ) {
    const resolved = ensureCashSavingsSettings(settings);
    this.settings = {
      walletPath: normalizePath(resolved.walletPath),
      logsFolder: normalizePath(resolved.logsFolder),
      currency: resolved.currency,
    };
  }

  async ensureLogsFolder(): Promise<void> {
    await this.ensureFolder(this.settings.logsFolder);
  }

  async appendLog(entry: LogEntry): Promise<TFile> {
    await this.ensureLogsFolder();

    const normalizedEntry = parseLogFrontmatter(entry);
    const filePath = await this.nextLogFilePath(normalizedEntry.ts, normalizedEntry.kind);
    const yaml = stringifyYaml(normalizedEntry);
    const content = `---\n${yaml}---\n\n`;

    const file = await this.app.vault.create(filePath, content);
    this.fileByLogId.set(normalizedEntry.id, file);
    return file;
  }

  async listRecentLogs(limit: number, walletPath: string): Promise<LogEntry[]> {
    if (limit <= 0) {
      return [];
    }

    const folderAbstract = this.app.vault.getAbstractFileByPath(this.settings.logsFolder);
    if (!(folderAbstract instanceof TFolder)) {
      return [];
    }

    const normalizedWalletPath = normalizePath(walletPath);
    const entries: LogEntry[] = [];
    this.fileByLogId.clear();

    const files = this.collectMarkdownFiles(folderAbstract).sort(
      (a, b) => b.stat.mtime - a.stat.mtime,
    );

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;

      if (!fm) {
        continue;
      }

      try {
        const entry = parseLogFrontmatter(fm);
        if (normalizePath(entry.wallet_path) === normalizedWalletPath) {
          entries.push(entry);
          this.fileByLogId.set(entry.id, file);
          if (entries.length >= limit) {
            break;
          }
        }
      } catch {
        continue;
      }
    }

    entries.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
    return entries.slice(0, limit);
  }

  getLogFileById(id: string): TFile | undefined {
    return this.fileByLogId.get(id);
  }

  private async nextLogFilePath(ts: string, kind: string): Promise<string> {
    const stemBase = this.makeLogStem(ts, kind);
    let suffix = 0;

    while (true) {
      const suffixPart = suffix === 0 ? "" : `-${suffix}`;
      const candidate = normalizePath(
        `${this.settings.logsFolder}/${stemBase}${suffixPart}.md`,
      );

      if (!this.app.vault.getAbstractFileByPath(candidate)) {
        return candidate;
      }

      suffix += 1;
    }
  }

  private makeLogStem(ts: string, kind: string): string {
    const parsed = new Date(ts);
    const safeTsRaw = Number.isNaN(parsed.getTime())
      ? ts.replace(/[:.]/g, "-")
      : parsed.toISOString().slice(0, 19).replace(/:/g, "-");
    const safeTs = safeTsRaw.replace(/[<>:"/\\|?*]/g, "-");
    return `${safeTs}_${kind}`;
  }

  private async ensureFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (!normalized) {
      return;
    }

    const segments = normalized.split("/");
    let current = "";

    for (const segment of segments) {
      current = current.length > 0 ? `${current}/${segment}` : segment;
      const existing = this.app.vault.getAbstractFileByPath(current);

      if (!existing) {
        await this.app.vault.createFolder(current);
        continue;
      }

      if (existing instanceof TFile) {
        throw new Error(`Expected folder at ${current}, but found a file.`);
      }
    }
  }

  private collectMarkdownFiles(folder: TFolder): TFile[] {
    const result: TFile[] = [];
    const queue: TFolder[] = [folder];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      for (const child of current.children) {
        if (child instanceof TFile && child.extension === "md") {
          result.push(child);
          continue;
        }

        if (child instanceof TFolder) {
          queue.push(child);
        }
      }
    }

    return result;
  }
}

// Compatibility export for older imports.
export { LedgerRepository as LedgerRepo };
