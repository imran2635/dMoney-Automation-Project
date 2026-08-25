import { expect } from '@playwright/test';
import { BaseService } from './base.service.js';
import { AuthService } from './auth.service.js';

/** Agent-role actions: login, balance check, and depositing to a customer. */
export class AgentService extends BaseService {
  constructor(page) {
    super(page);
    this.auth = new AuthService(page);
  }

  async login(email, password) {
    await this.auth.login(email, password);
  }

  /** Reads the agent's current balance from their profile page. */
  async getBalance() {
    await this.goto('/profile');

    const balanceField = this.page.getByLabel('Current Balance (BDT)', { exact: false });
    const rawValue = await balanceField
      .inputValue()
      .catch(() => balanceField.textContent());

    const numeric = parseFloat((rawValue ?? '').replace(/[^0-9.]/g, ''));

    if (Number.isNaN(numeric)) {
      throw new Error(`Could not parse a numeric balance from "${rawValue}".`);
    }

    return numeric;
  }

  /** Asserts the agent's current balance equals the expected amount. */
  async expectBalance(expectedAmount) {
    const balance = await this.getBalance();
    expect(balance).toBe(expectedAmount);
  }

  async depositToCustomer(customerPhone, amount) {
    await this.performCashIn(customerPhone, amount);
    await this.expectBannerVisible('Deposit successful');
  }
}
