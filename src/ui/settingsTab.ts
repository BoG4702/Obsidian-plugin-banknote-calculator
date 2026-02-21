import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import { CashSavingsSettings } from "../core/types";
import type CashSavingsPlugin from "../main";

export class CashSavingsSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: CashSavingsPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Cash & Savings" });

    new Setting(containerEl)
      .setName("walletPath")
      .setDesc("Path to wallet note")
      .addText((text) =>
        text
          .setPlaceholder("Finance/Wallet.md")
          .setValue(this.plugin.settings.walletPath)
          .onChange(async (value) => {
            const nextSettings: CashSavingsSettings = {
              ...this.plugin.settings,
              walletPath: normalizePath(value.trim() || "Finance/Wallet.md"),
            };

            await this.plugin.updateSettings(nextSettings);
          }),
      );

    new Setting(containerEl)
      .setName("logsFolder")
      .setDesc("Folder for operation logs")
      .addText((text) =>
        text
          .setPlaceholder("Finance/Logs")
          .setValue(this.plugin.settings.logsFolder)
          .onChange(async (value) => {
            const nextSettings: CashSavingsSettings = {
              ...this.plugin.settings,
              logsFolder: normalizePath(value.trim() || "Finance/Logs"),
            };

            await this.plugin.updateSettings(nextSettings);
          }),
      );

    new Setting(containerEl)
      .setName("currency")
      .setDesc("Display currency code")
      .addText((text) =>
        text
          .setPlaceholder("RUB")
          .setValue(this.plugin.settings.currency)
          .onChange(async (value) => {
            const nextSettings: CashSavingsSettings = {
              ...this.plugin.settings,
              currency: value.trim().toUpperCase() || "RUB",
            };

            await this.plugin.updateSettings(nextSettings);
          }),
      );

    containerEl.createEl("p", {
      text: "Settings are saved automatically.",
    });
  }
}
