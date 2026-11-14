// Sessions: issuing a token, and ending one.
//
// Tokens are stateless, so ending a session used to be purely a browser-side
// gesture — the token stayed valid until it expired, seven days later. Every
// token now carries an id (`jti`), and signing out records that id in
// `revoked_tokens`; the auth middleware refuses a token whose id is listed.
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { JWT_SECRET, SESSION_TTL, SESSION_TTL_SECONDS } from './config.js';

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function issueToken(userId) {
  return jwt.sign({ userId, jti: uuidv4() }, JWT_SECRET, { expiresIn: SESSION_TTL });
}

export function isRevoked(jti) {
  if (!jti) return true;
  const rows = query('SELECT jti FROM revoked_tokens WHERE jti = ?', [jti]);
  return rows.length > 0;
}

// Record a token as ended, and drop any revocation rows that have outlived their
// token (they can no longer match anything, so keeping them only grows the table).
export function revokeToken({ jti, userId, exp }) {
  const expiresAt = Number.isFinite(exp) ? exp : nowSeconds() + SESSION_TTL_SECONDS;
  query('INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at) VALUES (?, ?, ?)', [
    jti,
    userId || null,
    expiresAt
  ]);
  query('DELETE FROM revoked_tokens WHERE expires_at < ?', [nowSeconds()]);
}
