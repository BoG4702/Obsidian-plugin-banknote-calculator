import {
  ItemView,
  Notice,
  TAbstractFile,
  WorkspaceLeaf,
} from "obsidian";
import { calcTotal } from "../core/calculator";
import { LogEntry, OperationKind, WalletState } from "../core/types";
import type CashSavingsPlugin from "../main";

export const DASHBOARD_VIEW_TYPE = "cash-savings-dashboard";

export class DashboardView extends ItemView {
  private refreshTimer: number | null = null;
  private listenersBound = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: CashSavingsPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Cash & Savings";
  }

  getIcon(): string {
    return "calculator";
  }

  async onOpen(): Promise<void> {
    this.bindRefreshListenersOnce();
    await this.refresh();
  }

  async onClose(): Promise<void> {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.contentEl.empty();
  }

  async refresh(): Promise<void> {
    await this.render();
  }

  private bindRefreshListenersOnce(): void {
    if (this.listenersBound) {
      return;
    }

    const onChange = (file: TAbstractFile): void => {
      if (this.isRelevantPath(file.path)) {
        this.scheduleRefresh();
      }
    };

    this.registerEvent(this.app.vault.on("create", onChange));
    this.registerEvent(this.app.vault.on("modify", onChange));
    this.registerEvent(this.app.vault.on("delete", onChange));
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        onChange(file);
      }),
    );

    this.listenersBound = true;
  }

  private isRelevantPath(path: string): boolean {
    const walletPath = this.plugin.walletRepository.getWalletPath();
    if (path === walletPath) {
      return true;
    }

    const logsFolder = this.plugin.settings.logsFolder;
    return path === logsFolder || path.startsWith(`${logsFolder}/`);
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      void this.refresh();
    }, 200);
  }

  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();

    let wallet: WalletState;

    try {
      await this.plugin.walletRepository.ensureWalletExists();
      wallet = await this.plugin.walletRepository.loadWallet();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load wallet.";
      this.renderWalletError(contentEl, message);
      return;
    }

    this.renderHeader(contentEl);
    this.renderCountsTable(contentEl, wallet);

    const total = calcTotal(wallet);
    contentEl.createDiv({
      cls: "cash-savings-total",
      text: `Total: ${this.formatMoney(total, wallet.currency)}`,
    });

    this.renderPlanSection(contentEl, wallet, total);

    try {
      await this.renderRecentLogs(contentEl, wallet.currency);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load recent logs.";
      contentEl.createEl("p", { text: message });
    }
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "cash-savings-header" });
    header.createEl("h2", { text: "Cash & Savings" });

    const actions = header.createDiv({ cls: "cash-savings-row-actions" });
    this.createActionButton(actions, "+ Deposit", "deposit");
    this.createActionButton(actions, "- Withdraw", "withdraw");
    this.createActionButton(actions, "Set counts", "set");
  }

  private renderWalletError(container: HTMLElement, message: string): void {
    container.createEl("h2", { text: "Cash & Savings" });
    container.createEl("h3", { text: "Wallet error" });
    container.createEl("p", { text: `Wallet file: ${this.plugin.walletRepository.getWalletPath()}` });
    container.createEl("p", { text: message });

    const actions = container.createDiv({ cls: "cash-savings-row-actions" });
    const resetButton = actions.createEl("button", {
      text: "Reset wallet YAML to defaults",
      cls: "mod-warning",
    });

    resetButton.onclick = () => {
      void this.handleResetWallet();
    };
  }

  private async handleResetWallet(): Promise<void> {
    const confirmReset = window.confirm(
      "Reset wallet YAML to defaults? Current wallet frontmatter will be replaced.",
    );

    if (!confirmReset) {
      return;
    }

    try {
      await this.plugin.walletRepository.resetWalletToDefaults();
      new Notice("Wallet YAML reset to defaults.");
      await this.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset wallet.";
      new Notice(message);
    }
  }

  private createActionButton(container: HTMLElement, label: string, kind: OperationKind): void {
    const button = container.createEl("button", { text: label });
    button.onclick = () => {
      void this.plugin.openOperationModal(kind);
    };
  }

  private renderCountsTable(container: HTMLElement, wallet: WalletState): void {
    container.createEl("h3", { text: "Cash breakdown" });
    const table = container.createEl("table", { cls: "cash-savings-table" });
    const thead = table.createEl("thead");
    const headRow = thead.createEl("tr");
    headRow.createEl("th", { text: "Denomination" });
    headRow.createEl("th", { text: "Count" });
    headRow.createEl("th", { text: "Amount" });

    const tbody = table.createEl("tbody");
    this.renderGroupRows(tbody, wallet, "banknotes", "Banknotes");
    this.renderGroupRows(tbody, wallet, "coins", "Coins");
  }

  private renderGroupRows(
    tbody: HTMLElement,
    wallet: WalletState,
    group: "banknotes" | "coins",
    title: string,
  ): void {
    const titleRow = tbody.createEl("tr");
    const titleCell = titleRow.createEl("td", { attr: { colspan: "3" } });
    titleCell.createEl("strong", { text: title });

    for (const denom of wallet.denoms[group]) {
      const key = String(denom);
      const count = wallet.counts[group][key] ?? 0;
      const amount = denom * count;

      const row = tbody.createEl("tr");
      row.createEl("td", { text: String(denom), attr: { "data-label": "Denomination" } });
      row.createEl("td", { text: String(count), attr: { "data-label": "Count" } });
      row.createEl("td", {
        text: this.formatMoney(amount, wallet.currency),
        attr: { "data-label": "Amount" },
      });
    }
  }

  private renderPlanSection(container: HTMLElement, wallet: WalletState, total: number): void {
    const block = container.createDiv({ cls: "cash-savings-plan" });
    block.createEl("h3", { text: "Plan" });

    const monthlyValue = wallet.plan?.monthly ?? 0;
    const monthsValue = wallet.plan?.months ?? 0;

    const monthlyWrap = block.createDiv();
    monthlyWrap.createEl("label", { text: "Monthly" });
    const monthlyInput = monthlyWrap.createEl("input");
    monthlyInput.type = "number";
    monthlyInput.min = "0";
    monthlyInput.step = "0.01";
    monthlyInput.value = String(monthlyValue);
    monthlyInput.style.width = "100%";

    const monthsWrap = block.createDiv();
    monthsWrap.createEl("label", { text: "Months" });
    const monthsInput = monthsWrap.createEl("input");
    monthsInput.type = "number";
    monthsInput.min = "0";
    monthsInput.step = "1";
    monthsInput.value = String(monthsValue);
    monthsInput.style.width = "100%";

    const planButtonRow = block.createDiv({ cls: "cash-savings-modal-buttons" });
    const savePlanButton = planButtonRow.createEl("button", { text: "Save Plan", cls: "mod-cta" });
    savePlanButton.onclick = () => {
      void this.handleSavePlan(monthlyInput.value, monthsInput.value);
    };

    const projected = this.plugin.planService.calcProjection(total, monthlyValue, monthsValue);
    block.createEl("div", {
      cls: "cash-savings-projection",
      text: `Projected total: ${this.formatMoney(projected, wallet.currency)}`,
    });

    const goalBlock = block.createDiv();
    goalBlock.createEl("h4", { text: "Goal (optional)" });

    const goalTargetWrap = goalBlock.createDiv();
    goalTargetWrap.createEl("label", { text: "Target" });
    const goalTargetInput = goalTargetWrap.createEl("input");
    goalTargetInput.type = "number";
    goalTargetInput.min = "0";
    goalTargetInput.step = "0.01";
    goalTargetInput.value = String(wallet.goal?.target ?? 0);
    goalTargetInput.style.width = "100%";

    const goalDeadlineWrap = goalBlock.createDiv();
    goalDeadlineWrap.createEl("label", { text: "Deadline (YYYY-MM-DD)" });
    const goalDeadlineInput = goalDeadlineWrap.createEl("input");
    goalDeadlineInput.type = "date";
    goalDeadlineInput.value = wallet.goal?.deadline ?? "";
    goalDeadlineInput.style.width = "100%";

    const goalButtonRow = goalBlock.createDiv({ cls: "cash-savings-modal-buttons" });
    const saveGoalButton = goalButtonRow.createEl("button", { text: "Save Goal" });
    saveGoalButton.onclick = () => {
      void this.handleSaveGoal(goalTargetInput.value, goalDeadlineInput.value);
    };

    if (wallet.goal && wallet.goal.target > 0 && wallet.goal.deadline) {
      const required = this.plugin.planService.calcRequiredToDeadline(
        total,
        wallet.goal.target,
        wallet.goal.deadline,
      );

      goalBlock.createEl("div", {
        text: `Remaining: ${this.formatMoney(required.remaining, wallet.currency)}`,
      });
      goalBlock.createEl("div", { text: `Days left: ${required.daysLeft}` });

      if (required.isDeadlinePassed) {
        goalBlock.createEl("div", { text: "Deadline has passed." });
      } else {
        goalBlock.createEl("div", {
          text: `Required/day: ${this.formatMoney(required.requiredPerDay, wallet.currency)}`,
        });
        goalBlock.createEl("div", {
          text: `Required/week: ${this.formatMoney(required.requiredPerWeek, wallet.currency)}`,
        });
        goalBlock.createEl("div", {
          text: `Required/month: ${this.formatMoney(required.requiredPerMonth, wallet.currency)}`,
        });
      }
    }
  }

  private async handleSavePlan(monthlyRaw: string, monthsRaw: string): Promise<void> {
    const monthly = Number(monthlyRaw);
    const months = Number(monthsRaw);

    if (!Number.isFinite(monthly) || monthly < 0) {
      new Notice("Monthly must be a non-negative number.");
      return;
    }

    if (!Number.isInteger(months) || months < 0) {
      new Notice("Months must be a non-negative integer.");
      return;
    }

    await this.plugin.walletRepository.updateWallet((fm: any) => {
      if (typeof fm.plan !== "object" || fm.plan === null) {
        fm.plan = {};
      }

      fm.plan.monthly = monthly;
      fm.plan.months = months;
    });

    new Notice("Plan saved.");
    await this.refresh();
  }

  private async handleSaveGoal(targetRaw: string, deadlineRaw: string): Promise<void> {
    const target = Number(targetRaw);
    const deadline = deadlineRaw.trim();

    if (!Number.isFinite(target) || target < 0) {
      new Notice("Target must be a non-negative number.");
      return;
    }

    if (target > 0 && deadline.length === 0) {
      new Notice("Deadline is required when target is greater than 0.");
      return;
    }

    if (deadline.length > 0 && Number.isNaN(Date.parse(deadline))) {
      new Notice("Deadline must be a valid date.");
      return;
    }

    await this.plugin.walletRepository.updateWallet((fm: any) => {
      if (target <= 0 && deadline.length === 0) {
        if ("goal" in fm) {
          delete fm.goal;
        }
        return;
      }

      if (typeof fm.goal !== "object" || fm.goal === null) {
        fm.goal = {};
      }

      fm.goal.target = target;
      fm.goal.deadline = deadline;
    });

    new Notice("Goal saved.");
    await this.refresh();
  }

  private async renderRecentLogs(container: HTMLElement, currency: string): Promise<void> {
    container.createEl("h3", { text: "Recent logs" });

    const logs = await this.plugin.ledgerRepository.listRecentLogs(
      10,
      this.plugin.walletRepository.getWalletPath(),
    );

    if (logs.length === 0) {
      container.createEl("p", {
        text: "No recent logs (or metadata cache is not ready yet).",
      });
      return;
    }

    const table = container.createEl("table", { cls: "cash-savings-table" });
    const thead = table.createEl("thead");
    const headRow = thead.createEl("tr");
    headRow.createEl("th", { text: "ts" });
    headRow.createEl("th", { text: "kind" });
    headRow.createEl("th", { text: "deltaSummary" });
    headRow.createEl("th", { text: "comment" });
    headRow.createEl("th", { text: "total_after" });

    const tbody = table.createEl("tbody");

    for (const entry of logs) {
      const row = tbody.createEl("tr");
      const file = this.plugin.ledgerRepository.getLogFileById(entry.id);
      if (file) {
        row.style.cursor = "pointer";
        row.onclick = () => {
          void this.app.workspace.getLeaf(true).openFile(file);
        };
      }

      row.createEl("td", { text: entry.ts, attr: { "data-label": "Timestamp" } });
      row.createEl("td", { text: entry.kind, attr: { "data-label": "Kind" } });
      row.createEl("td", {
        text: this.buildDeltaSummary(entry),
        attr: { "data-label": "Delta" },
      });
      row.createEl("td", {
        text: entry.comment || "-",
        attr: { "data-label": "Comment" },
      });
      row.createEl("td", {
        text: this.formatMoney(entry.total_after, currency),
        attr: { "data-label": "Total after" },
      });
    }
  }

  private buildDeltaSummary(entry: LogEntry): string {
    const parts: { denom: number; text: string }[] = [];

    for (const group of ["banknotes", "coins"] as const) {
      for (const [key, value] of Object.entries(entry.delta[group])) {
        if (!Number.isFinite(value) || value === 0) {
          continue;
        }

        const denom = Number(key);
        const sign = value > 0 ? "+" : "-";
        const abs = Math.abs(value);
        parts.push({
          denom: Number.isFinite(denom) ? denom : 0,
          text: `${sign}${key}x${abs}`,
        });
      }
    }

    if (parts.length === 0) {
      return "0";
    }

    parts.sort((a, b) => b.denom - a.denom);
    return parts.map((part) => part.text).join(", ");
  }

  private formatMoney(value: number, currency: string): string {
    const safe = Number.isFinite(value) ? value : 0;
    return `${safe.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${currency}`;
  }
}
