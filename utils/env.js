import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Reads a required environment variable or throws a clear error.
 * Fails fast at startup instead of failing deep inside a test with a
 * confusing "undefined" error.
 */
function required(key) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${key}". Did you copy .env.example to .env and fill it in?`
    );
  }
  return value;
}

export const env = {
  baseUrl: required('BASE_URL'),

  adminEmail: required('ADMIN_EMAIL'),
  adminPassword: required('ADMIN_PASSWORD'),

  systemEmail: required('SYSTEM_EMAIL'),
  systemPassword: required('SYSTEM_PASSWORD'),

  gmailBaseEmail: required('GMAIL_BASE_EMAIL'),
  gmailAppPassword: required('GMAIL_APP_PASSWORD'),

  existingCustomerPhone: required('EXISTING_CUSTOMER_PHONE'),
};
