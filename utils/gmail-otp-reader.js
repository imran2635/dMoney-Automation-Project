import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { env } from './env.js';

/**
 * Reads OTP codes straight out of a real Gmail inbox over IMAP.
 *
 * dMoney genuinely emails the OTP (confirmed by inspecting the DMoney API
 * Integration Testing backend: the OTP is only console-logged server-side
 * for non-Gmail addresses, and actually emailed for Gmail addresses). Since
 * dmoneyportal.roadtocareer.net requires a Gmail address, this is the
 * reliable way to retrieve it in an automated run instead of a human
 * copy-pasting it from an inbox.
 *
 * The OTP is only valid for 2 minutes, so this polls aggressively rather
 * than waiting for one long timeout.
 */
export class GmailOtpReader {
  /**
   * Connects to Gmail, polls for the newest "DMoney" OTP email received
   * after `sentAfter`, extracts the 4-digit code, and disconnects.
   *
   * @param sentAfter   Only consider emails that arrived after this time.
   *                    Prevents accidentally matching a stale/previous OTP.
   * @param timeoutMs   Give up after this long (default 60s — OTP expires
   *                    at 2 minutes, so this leaves margin to use it).
   * @param pollIntervalMs How often to re-check the inbox while waiting.
   */
  async getLatestOtp(
    sentAfter,
    timeoutMs = 60_000,
    pollIntervalMs = 3_000
  ) {
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: env.gmailBaseEmail,
        pass: env.gmailAppPassword,
      },
      logger: false,
    });

    await client.connect();

    try {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const lock = await client.getMailboxLock('INBOX');
        try {
          const uids = await client.search(
            {
              subject: 'OTP',
              since: sentAfter,
            },
            { uid: true }
          );

          if (uids && uids.length > 0) {
            // Search results come back in ascending UID order, so the last
            // one is the most recently arrived matching email.
            const latestUid = uids[uids.length - 1];

            const message = await client.fetchOne(
              String(latestUid),
              { source: true },
              { uid: true }
            );

            if (message && message.source) {
              const parsed = await simpleParser(message.source);
              const bodyText = parsed.text ?? '';
              const otp = this.extractOtp(bodyText);

              if (otp) {
                return otp;
              }
            }
          }
        } finally {
          lock.release();
        }

        await this.sleep(pollIntervalMs);
      }

      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for a DMoney OTP email to arrive in ${env.gmailBaseEmail}.`
      );
    } finally {
      await client.logout();
    }
  }

  /**
   * Pulls the 4-digit OTP out of the email body. The email reads:
   * "Your One-Time Password (OTP) for DMoney login is:\n\n  6888\n\n..."
   * so we anchor on "is:" first, and fall back to any bare 4-digit number.
   */
  extractOtp(bodyText) {
    const anchored = bodyText.match(/is:\s*\n*\s*(\d{4})/i);
    if (anchored) {
      return anchored[1];
    }

    const fallback = bodyText.match(/\b(\d{4})\b/);
    return fallback ? fallback[1] : null;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
