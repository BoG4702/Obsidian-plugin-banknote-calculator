import { App, Modal, Notice } from "obsidian";
import { OperationService } from "../services/operationService";
import {
  Counts,
  OperationInput,
  OperationKind,
  WalletState,
} from "../core/types";

interface OperationModalOptions {
  kind: OperationKind;
  walletState: WalletState;
  operationService: OperationService;
  onCommitted?: () => Promise<void> | void;
}

const OPERATION_TITLE: Record<OperationKind, string> = {
  deposit: "Deposit",
  withdraw: "Withdraw",
  set: "Set counts",
};

export class OperationModal extends Modal {
  private readonly inputByGroup: {
    banknotes: Record<string, HTMLInputElement>;
    coins: Record<string, HTMLInputElement>;
  } = {
    banknotes: {},
    coins: {},
  };

  private commentEl!: HTMLTextAreaElement;

  constructor(app: App, private readonly options: OperationModalOptions) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: OPERATION_TITLE[this.options.kind] });
    contentEl.createEl("p", {
      text:
        this.options.kind === "set"
          ? "Enter absolute counts for each denomination."
          : "Enter delta counts for each denomination (default 0).",
    });

    this.renderGroupTable(contentEl, "banknotes", "Banknotes");
    this.renderGroupTable(contentEl, "coins", "Coins");

    contentEl.createEl("label", { text: "Comment" });
    this.commentEl = contentEl.createEl("textarea");
    this.commentEl.rows = 3;
    this.commentEl.style.width = "100%";

    const buttonsEl = contentEl.createDiv({ cls: "cash-savings-modal-buttons" });
    const saveBtn = buttonsEl.createEl("button", { text: "Save", cls: "mod-cta" });
    const cancelBtn = buttonsEl.createEl("button", { text: "Cancel" });

    cancelBtn.onclick = () => this.close();
    saveBtn.onclick = () => {
      void this.handleSave();
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderGroupTable(container: HTMLElement, group: "banknotes" | "coins", title: string): void {
    container.createEl("h3", { text: title });

    const table = container.createEl("table", { cls: "cash-savings-table" });
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { text: "Denomination" });
    headerRow.createEl("th", { text: "Current" });
    headerRow.createEl("th", {
      text: this.options.kind === "set" ? "New count" : "Delta",
    });

    const tbody = table.createEl("tbody");

    for (const denom of this.options.walletState.denoms[group]) {
      const key = String(denom);
      const current = this.options.walletState.counts[group][key] ?? 0;

      const row = tbody.createEl("tr");
      row.createEl("td", {
        text: String(denom),
        attr: { "data-label": "Denomination" },
      });
      row.createEl("td", {
        text: String(current),
        attr: { "data-label": "Current" },
      });

      const inputCell = row.createEl("td", {
        attr: {
          "data-label": this.options.kind === "set" ? "New count" : "Delta",
        },
      });
      const input = inputCell.createEl("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = "0";
      input.style.width = "100%";

      this.inputByGroup[group][key] = input;
    }
  }

  private buildCountsFromInputs(): Counts {
    const counts: Counts = {
      banknotes: {},
      coins: {},
    };

    for (const group of ["banknotes", "coins"] as const) {
      for (const denom of this.options.walletState.denoms[group]) {
        const key = String(denom);
        const input = this.inputByGroup[group][key];
        const raw = Number(input?.value ?? "0");

        if (!Number.isInteger(raw) || raw < 0) {
          throw new Error(`Invalid value for ${group} ${key}. Use non-negative integers.`);
        }

        counts[group][key] = raw;
      }
    }

    return counts;
  }

  private async handleSave(): Promise<void> {
    let counts: Counts;

    try {
      counts = this.buildCountsFromInputs();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid input.";
      new Notice(message);
      return;
    }

    const operation: OperationInput =
      this.options.kind === "set"
        ? {
            kind: "set",
            countsAbsolute: counts,
            comment: this.commentEl.value.trim(),
          }
        : {
            kind: this.options.kind,
            countsDelta: counts,
            comment: this.commentEl.value.trim(),
          };

    try {
      await this.options.operationService.commitOperation(operation);
      await this.options.onCommitted?.();
      this.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Operation failed.";
      new Notice(message);
    }
  }
}
