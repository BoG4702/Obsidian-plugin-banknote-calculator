import { App, TFile, normalizePath, parseYaml, stringifyYaml } from "obsidian";
import {
  applyWalletToFrontmatter,
  getDefaultWalletFrontmatter,
  normalizeWallet,
  parseWalletFrontmatter,
} from "../core/schema";
import {
  CashSavingsSettings,
  WalletState,
  ensureCashSavingsSettings,
} from "../core/types";

export class WalletRepository {
  private readonly settings: CashSavingsSettings;

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

  getWalletFile(): TFile | null {
    const abstractFile = this.app.vault.getAbstractFileByPath(this.settings.walletPath);
    return abstractFile instanceof TFile ? abstractFile : null;
  }

  getWalletPath(): string {
    return this.settings.walletPath;
  }

  async ensureWalletExists(): Promise<TFile> {
    const existing = this.app.vault.getAbstractFileByPath(this.settings.walletPath);

    if (existing instanceof TFile) {
      return existing;
    }

    if (existing) {
      throw new Error(`Wallet path is not a file: ${this.settings.walletPath}`);
    }

    const folderPath = this.settings.walletPath.split("/").slice(0, -1).join("/");
    if (folderPath.length > 0) {
      await this.ensureFolder(folderPath);
    }

    const defaultWallet = getDefaultWalletFrontmatter(this.settings.currency);
    const frontmatterText = stringifyYaml(defaultWallet);
    const initialContent = `---\n${frontmatterText}---\n\n`;

    return this.app.vault.create(this.settings.walletPath, initialContent);
  }

  async loadWallet(): Promise<WalletState> {
    const walletFile = await this.ensureWalletExists();
    const frontmatter = await this.readWalletFrontmatter(walletFile);

    return normalizeWallet(parseWalletFrontmatter(frontmatter));
  }

  async resetWalletToDefaults(): Promise<WalletState> {
    const walletFile = await this.ensureWalletExists();
    const defaultWallet = getDefaultWalletFrontmatter(this.settings.currency);

    try {
      await this.app.fileManager.processFrontMatter(walletFile, (fm) => {
        if (!isRecord(fm)) {
          throw new Error("Wallet frontmatter must be a YAML object.");
        }

        applyWalletToFrontmatter(fm, defaultWallet);
      });
    } catch {
      const frontmatterText = stringifyYaml(defaultWallet);
      const content = `---\n${frontmatterText}---\n\n`;
      await this.app.vault.modify(walletFile, content);
    }

    return this.loadWallet();
  }

  async updateWallet(mutator: (draftFm: any) => void): Promise<WalletState> {
    const walletFile = await this.ensureWalletExists();

    await this.app.fileManager.processFrontMatter(walletFile, (fm) => {
      mutator(fm);
    });

    return this.loadWallet();
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

  private async readFrontmatterFromCache(file: TFile): Promise<Record<string, unknown> | null> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter) {
        return cache.frontmatter as Record<string, unknown>;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return null;
  }

  private async readWalletFrontmatter(file: TFile): Promise<Record<string, unknown>> {
    const fromCache = await this.readFrontmatterFromCache(file);
    if (fromCache) {
      return fromCache;
    }

    const content = await this.app.vault.cachedRead(file);
    const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);

    if (!match) {
      throw new Error(
        `Wallet frontmatter is missing in ${file.path}. Use "Reset wallet YAML to defaults".`,
      );
    }

    try {
      const parsed = parseYaml(match[1]);
      if (!isRecord(parsed)) {
        throw new Error("Wallet frontmatter must be a YAML object.");
      }
      return parsed;
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unknown YAML parse error.";
      throw new Error(
        `Wallet YAML is invalid in ${file.path}: ${details}. Use "Reset wallet YAML to defaults".`,
      );
    }
  }
}

// Compatibility export for older imports.
export { WalletRepository as WalletRepo };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
