import { expect } from '@playwright/test';

/**
 * Shared base class for every role-specific service (Auth, Admin, System,
 * Agent). Holds the common Playwright plumbing so each subclass only needs
 * to describe *what* it does on the page, not *how* to click/fill/wait.
 */
export class BaseService {
  constructor(page) {
    this.page = page;
  }

  async goto(path) {
    await this.page.goto(path);
    await this.waitOutCloudflareChallengeIfPresent();
  }

/**
 * The target site is behind Cloudflare, which occasionally challenges
 * automated sessions with a "Performing security verification"
 * interstitial — seen specifically on /admin routes when run from CI's
 * shared IP ranges. Some Cloudflare challenges auto-clear after a few
 * seconds; give it a chance to before continuing, rather than letting
 * whatever locator runs next sit and time out against a stuck challenge
 * page with no explanation.
 */
  async waitOutCloudflareChallengeIfPresent() {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const challengeShown = await this.page
        .getByText('Performing security verification', { exact: false })
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => true)
        .catch(() => false);

      if (!challengeShown) {
        return;
      }

      await this.page.waitForTimeout(8_000);
      await this.page.reload();
    }
  }

  /**
   * Fills a field by its visible label, falling back to placeholder text.
   * The site's form fields render label-like text (e.g. "Amount (BDT) *")
   * that may be a real <label> or just a placeholder — this covers both
   * without needing to know the exact markup ahead of time.
   */
  async fillByLabel(label, value) {
    const byLabel = this.page.getByLabel(label, { exact: false });
    if (await byLabel.count()) {
      await byLabel.first().fill(value);
      return;
    }
    await this.page.getByPlaceholder(label, { exact: false }).first().fill(value);
  }

  async clickByRole(role, name) {
    await this.page.getByRole(role, { name, exact: false }).click();
  }

  /** Asserts a success/confirmation banner containing the given text is visible. */
  async expectBannerVisible(text) {
    await expect(this.page.getByText(text, { exact: false })).toBeVisible({
      timeout: 15_000,
    });
  }

  /**
   * The "Cash In" form (phone number + amount) is visually and structurally
   * identical whether SYSTEM is depositing to an Agent or an Agent is
   * depositing to a Customer — only which account is logged in differs.
   * Both SystemService and AgentService reuse this rather than duplicating
   * the same three lines.
   */
  async performCashIn(recipientPhone, amount) {
    await this.goto('/agent/cash-in');
    await this.fillByLabel('Phone Number', recipientPhone);
    await this.fillByLabel('Amount (BDT)', String(amount));
    await this.clickByRole('button', 'Cash In');
  }
}
