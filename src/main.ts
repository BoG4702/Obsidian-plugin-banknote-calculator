import { Notice, Plugin, normalizePath } from "obsidian";
import {
  CashSavingsSettings,
  DEFAULT_CASH_SAVINGS_SETTINGS,
  OperationKind,
  ensureCashSavingsSettings,
} from "./core/types";
import { OperationService } from "./services/operationService";
import { PlanService } from "./services/planService";
import { LedgerRepository } from "./storage/ledgerRepo";
import { WalletRepository } from "./storage/walletRepo";
import { DASHBOARD_VIEW_TYPE, DashboardView } from "./ui/dashboardView";
import { OperationModal } from "./ui/operationModal";
import { CashSavingsSettingTab } from "./ui/settingsTab";

export const DEFAULT_SETTINGS: CashSavingsSettings = DEFAULT_CASH_SAVINGS_SETTINGS;

export default class CashSavingsPlugin extends Plugin {
  settings: CashSavingsSettings = DEFAULT_SETTINGS;
  walletRepository!: WalletRepository;
  ledgerRepository!: LedgerRepository;
  operationService!: OperationService;
  planService!: PlanService;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.rebuildRepositories();
    await this.walletRepository.ensureWalletExists();

    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this),
    );

    this.addCommand({
      id: "cash-savings-open-dashboard",
      name: "Cash & Savings: Open Dashboard",
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: "cash-savings-add-operation",
      name: "Cash & Savings: Add Operation",
      callback: () => {
        void this.openOperationModal("deposit");
      },
    });

    this.addSettingTab(new CashSavingsSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
  }

  async activateView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    let leaf = leaves[0];

    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) {
        return;
      }

      await leaf.setViewState({
        type: DASHBOARD_VIEW_TYPE,
        active: true,
      });
    }

    this.app.workspace.revealLeaf(leaf);
  }

  async updateSettings(nextSettings: CashSavingsSettings): Promise<void> {
    this.settings = this.normalizeSettings(nextSettings);
    await this.saveData(this.settings);
    this.rebuildRepositories();
    await this.walletRepository.ensureWalletExists();
    await this.refreshDashboardViews();
  }

  async openOperationModal(kind: OperationKind): Promise<void> {
    try {
      await this.walletRepository.ensureWalletExists();
      const wallet = await this.walletRepository.loadWallet();

      const modal = new OperationModal(this.app, {
        kind,
        walletState: wallet,
        operationService: this.operationService,
        onCommitted: async () => {
          await this.refreshDashboardViews();
          new Notice("Operation committed.");
        },
      });

      modal.open();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open operation modal.";
      new Notice(message);
    }
  }

  private async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = this.normalizeSettings(loaded);
  }

  private normalizeSettings(raw: unknown): CashSavingsSettings {
    const source = ensureCashSavingsSettings(raw);

    const walletPath =
      source.walletPath.trim().length > 0
        ? normalizePath(source.walletPath.trim())
        : DEFAULT_SETTINGS.walletPath;

    const logsFolder =
      source.logsFolder.trim().length > 0
        ? normalizePath(source.logsFolder.trim())
        : DEFAULT_SETTINGS.logsFolder;

    const currency =
      source.currency.trim().length > 0
        ? source.currency.trim().toUpperCase()
        : DEFAULT_SETTINGS.currency;

    return {
      walletPath,
      logsFolder,
      currency,
    };
  }

  private rebuildRepositories(): void {
    this.walletRepository = new WalletRepository(this.app, this.settings);
    this.ledgerRepository = new LedgerRepository(this.app, this.settings);
    this.operationService = new OperationService(this.walletRepository, this.ledgerRepository);
    this.planService = new PlanService();
  }

  private async refreshDashboardViews(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);

    for (const leaf of leaves) {
      if (leaf.view instanceof DashboardView) {
        await leaf.view.refresh();
      }
    }
  }
}
