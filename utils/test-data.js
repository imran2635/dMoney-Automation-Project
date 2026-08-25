import { env } from './env.js';

/**
 * Generates a random Bangladeshi-style mobile number: 01[3-9]XXXXXXXX (11 digits).
 * Random each run so repeated CI executions never collide on a "phone already
 * registered" validation error.
 */
function randomBdPhone() {
  const operatorDigit = Math.floor(Math.random() * 7) + 3; // 3-9
  let rest = '';
  for (let i = 0; i < 8; i++) {
    rest += Math.floor(Math.random() * 10);
  }
  return `01${operatorDigit}${rest}`;
}

/** Generates a random 9-10 digit National ID number. */
function randomNid() {
  let nid = '';
  for (let i = 0; i < 10; i++) {
    nid += Math.floor(Math.random() * 10);
  }
  return nid;
}

/**
 * Builds a brand-new Agent registration payload for a single test run.
 *
 * Uses Gmail's "+" alias trick (base+unique@gmail.com) so every run gets a
 * unique, valid Gmail address while all OTP emails still land in the same
 * inbox that GmailOtpReader polls.
 */
export function generateAgentData() {
  const uniqueSuffix = Date.now();
  const [localPart, domain] = env.gmailBaseEmail.split('@');

  return {
    fullName: `TestAgent${uniqueSuffix}`,
    email: `${localPart}+${uniqueSuffix}@${domain}`,
    password: 'Test@1234',
    phone: randomBdPhone(),
    nid: randomNid(),
  };
}
