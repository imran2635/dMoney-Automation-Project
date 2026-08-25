import { expect } from '@playwright/test';
import { BaseService } from './base.service.js';
import { AuthService } from './auth.service.js';

/**
 * Admin-role actions. Composes AuthService for login instead of duplicating
 * login logic — Admin skips the OTP step, but that's handled transparently
 * inside AuthService.login(), so this class doesn't need to know or care.
 */
export class AdminService extends BaseService {
  constructor(page) {
    super(page);
    this.auth = new AuthService(page);
  }

  async login(email, password) {
    await this.auth.login(email, password);
  }

  /**
   * Finds the newly registered agent in the User List by their unique
   * email, opens their detail page, switches into edit mode, and changes
   * Account Status from Pending to Active.
   *
   * There's no direct "Activate" button — the real flow is
   * VIEW -> Edit User -> Account Status dropdown -> Active -> Save Changes.
   */
  async activateAgent(agentEmail) {
    await this.goto('/admin/users');

    // This is a shared practice platform — other students register test
    // agents concurrently, so a freshly-registered agent isn't reliably on
    // page 1 (that assumption caused real CI failures). Use the actual
    // search feature instead: open "Search Type", pick "Search by Email",
    // type the email, and click Search.
    //
    // Note: this page has two comboboxes once pagination shows up —
    // "Search Type" (top) and "Rows per page" (pagination footer, bottom).
    // Search Type always renders first in the DOM, so .first() reliably
    // grabs the right one.
    await this.page.getByRole('combobox').first().click();
    await this.page.getByRole('option', { name: 'Search by Email', exact: false }).click();

    await this.fillByLabel('Enter Email', agentEmail);
    await this.clickByRole('button', 'Search');

    const agentRow = this.page.getByRole('row', { name: agentEmail, exact: false });
    await agentRow.getByRole('button', { name: 'View', exact: false }).click();

    await this.clickByRole('button', 'Edit User');

    // "Account Status" isn't programmatically linked to its combobox, and
    // this page has two comboboxes (Role, Account Status). Rather than
    // rely on DOM position/order (which proved fragile), filter directly
    // by the combobox's current text — at this point in the flow we're
    // always activating a freshly-registered agent, so it reliably shows
    // "Pending".
    await this.page.getByRole('combobox').filter({ hasText: 'Pending' }).click();

    await this.page.getByRole('option', { name: 'Active', exact: true }).click();
    await this.clickByRole('button', 'Save Changes');

    // The generic expectBannerVisible() helper is too loose here — "Active"
    // legitimately appears in more than one place on this page after
    // saving. The status Chip specifically renders literal uppercase
    // "ACTIVE" text (not just CSS styling), so match on that exactly.
    await expect(this.page.getByText('ACTIVE', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  }
}
