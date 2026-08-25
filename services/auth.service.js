import { expect } from '@playwright/test';
import { BaseService } from './base.service.js';
import { GmailOtpReader } from '../utils/gmail-otp-reader.js';

/**
 * Handles everything shared across roles: registration and login.
 * Admin/System accounts skip OTP entirely; Agent/Customer/Merchant accounts
 * are challenged with a 4-digit emailed OTP. login() detects which case it's
 * in rather than assuming, since that behaviour is role-dependent server-side.
 */
export class AuthService extends BaseService {
  constructor(page) {
    super(page);
    this.otpReader = new GmailOtpReader();
  }

  /**
   * Registers a brand-new Agent (or other role) account from the landing
   * page's SignUp flow, resolving the OTP verification step automatically.
   */
  async signup(data, role) {
    // The landing page has two "Sign Up" links (header nav + hero CTA),
    // both pointing to /register — rather than disambiguate which one to
    // click, just navigate straight to the destination.
    await this.goto('/register');

    await this.fillByLabel('Full Name', data.fullName);
    await this.fillByLabel('Email', data.email);
    await this.fillByLabel('Password', data.password);
    await this.fillByLabel('Phone Number', data.phone);
    await this.fillByLabel('National ID', data.nid);

    await this.selectRole(role);

    const requestedAt = new Date();
    await this.clickByRole('button', 'Create Account');

    // Some flows verify OTP immediately as part of registration; resolve it
    // if the OTP screen shows up.
    await this.resolveOtpIfPresent(requestedAt);
  }

  /**
   * Logs in as any role. Automatically detects and resolves the OTP step
   * for roles that require it (Agent/Customer/Merchant); Admin and SYSTEM
   * accounts log straight in.
   */
  async login(email, password) {
    await this.goto('/login');
    await this.fillByLabel('Email', email);
    await this.fillByLabel('Password', password);

    const requestedAt = new Date();
    await this.clickByRole('button', 'Login');

    await this.resolveOtpIfPresent(requestedAt);
  }

  /** Picks the account type / role during signup. */
  async selectRole(role) {
    // "Account Type (Role)" has no real label association (no for/
    // aria-labelledby link to the visible text), so getByLabel can't find
    // it. It's the only combobox on the register page, so target it by
    // role directly instead.
    await this.page.getByRole('combobox').click();
    await this.page.getByRole('option', { name: role, exact: false }).click();
  }

  /**
   * If an OTP field is visible, fetches the code from Gmail and submits it.
   * Uses a short existence check so it's a no-op for roles that skip OTP.
   *
   * Because this depends on real email delivery timing, the fetched OTP
   * can occasionally already be expired/superseded by a newer one by the
   * time it's submitted (the site issues a fresh code that invalidates the
   * old one). Rather than fail outright, retry with a freshly-fetched OTP
   * a couple of times before giving up.
   */
  async resolveOtpIfPresent(requestedAt) {
    const otpInput = this.page.getByLabel('OTP', { exact: false });

    const otpStepAppeared = await otpInput
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!otpStepAppeared) {
      return;
    }

    const maxAttempts = 3;
    let searchFrom = requestedAt;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const otp = await this.otpReader.getLatestOtp(searchFrom);
      await otpInput.fill(otp);
      await this.clickByRole('button', 'Verify');

      const invalidOtpShown = await this.page
        .getByText('Invalid OTP', { exact: false })
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false);

      if (!invalidOtpShown) {
        // Either it succeeded, or something unrelated is wrong — confirm
        // we actually navigated away before declaring victory.
        await expect(this.page).not.toHaveURL(/login|verify-otp/, { timeout: 10_000 });
        return;
      }

      // That OTP had already been superseded by a newer one. Search again,
      // but only for emails newer than this failed attempt, and clear the
      // field before retrying.
      searchFrom = new Date();
      await otpInput.fill('');
    }

    throw new Error(`OTP verification kept failing after ${maxAttempts} attempts.`);
  }
}
