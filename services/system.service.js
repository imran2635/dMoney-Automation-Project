import { BaseService } from './base.service.js';
import { AuthService } from './auth.service.js';

/** SYSTEM-role actions: login and depositing funds into an agent's wallet. */
export class SystemService extends BaseService {
  constructor(page) {
    super(page);
    this.auth = new AuthService(page);
  }

  async login(email, password) {
    await this.auth.login(email, password);
  }

  async depositToAgent(agentPhone, amount) {
    await this.performCashIn(agentPhone, amount);
    await this.expectBannerVisible('SYSTEM deposit to Agent successful');
  }
}
