import { test } from '@playwright/test';
import { AuthService } from '../services/auth.service.js';
import { AdminService } from '../services/admin.service.js';
import { SystemService } from '../services/system.service.js';
import { AgentService } from '../services/agent.service.js';
import { generateAgentData } from '../utils/test-data.js';
import { env } from '../utils/env.js';

/**
 * Full Agent lifecycle, matching the assignment steps 1-7 exactly:
 *   1. Visit the site
 *   2-3. Sign up as a new Agent
 *   4. Admin activates the new agent
 *   5. SYSTEM deposits 2000 Tk to the agent
 *   6. Agent logs in and balance shows 2000 Tk
 *   7. Agent deposits 500 Tk to an existing customer, transaction succeeds
 *
 * Uses test.describe.serial because each step depends on state created by
 * the previous one (you can't activate an agent that doesn't exist yet).
 * If an early step fails, Playwright skips the rest rather than cascading
 * confusing failures.
 */
test.describe.serial('dMoney Agent Lifecycle', () => {
  let agentData;

  test('1-3. New agent can sign up', async ({ page }) => {
    const auth = new AuthService(page);
    agentData = generateAgentData();

    await auth.signup(agentData, 'Agent');
  });

  test('4. Admin activates the newly created agent', async ({ page }) => {
    const admin = new AdminService(page);

    await admin.login(env.adminEmail, env.adminPassword);
    await admin.activateAgent(agentData.email);
  });

  test('5. SYSTEM deposits 2000 Tk to the agent', async ({ page }) => {
    const system = new SystemService(page);

    await system.login(env.systemEmail, env.systemPassword);
    await system.depositToAgent(agentData.phone, 2000);
  });

  test('6. Agent balance shows 2000 Tk after login', async ({ page }) => {
    const agent = new AgentService(page);

    await agent.login(agentData.email, agentData.password);
    await agent.expectBalance(2000);
  });

  test('7. Agent deposits 500 Tk to an existing customer successfully', async ({ page }) => {
    const agent = new AgentService(page);

    await agent.login(agentData.email, agentData.password);
    await agent.depositToCustomer(env.existingCustomerPhone, 500);
  });
});
