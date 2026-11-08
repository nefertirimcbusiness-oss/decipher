// Startup configuration that must never have a silent default.
//
// Both the login route and the auth middleware used to read
//
//     const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
//
// so a deployment with no JWT_SECRET still booted, and every token signed with
// that published string was accepted — anyone could mint a token for any account.
// This module has no fallback: it throws at import time, which stops the process
// before it can listen. Missing configuration is a startup failure, not a
// permissive default.
import 'dotenv/config';

function requireSecret(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `${name} is not set. The API refuses to start without it: a missing secret ` +
        `used to fall back to a value published in this repository, which let anyone ` +
        `sign a token for any account. Set ${name} in decipher-api/.env and restart.`
    );
  }
  return value;
}

export const JWT_SECRET = requireSecret('JWT_SECRET');

// Known-public strings that must never be accepted as a signing secret.
const PUBLISHED_SECRETS = new Set(['your-secret-key', 'decipher-secret-2026', 'secret', 'changeme']);

if (PUBLISHED_SECRETS.has(JWT_SECRET)) {
  throw new Error(
    `JWT_SECRET is set to a published value (${JWT_SECRET}). Anyone can sign tokens with it. ` +
      `Generate a new one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  );
}

if (JWT_SECRET.length < 32) {
  console.warn(
    `WARNING: JWT_SECRET is only ${JWT_SECRET.length} characters. Use at least 32 random bytes.`
  );
}
