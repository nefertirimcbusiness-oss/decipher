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

// Every token belonging to one account is ended by a single row, written under
// this prefix instead of a token id. It is what lets an account deletion kill
// sessions this server was never told about — the other device, the tab opened
// last week — without keeping a register of every token ever issued.
const USER_MARKER_PREFIX = 'user:';

export function isRevoked(jti, userId) {
  if (!jti) return true;
  const marker = userId ? `${USER_MARKER_PREFIX}${userId}` : null;
  const rows = marker
    ? query('SELECT jti FROM revoked_tokens WHERE jti = ? OR jti = ?', [jti, marker])
    : query('SELECT jti FROM revoked_tokens WHERE jti = ?', [jti]);
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

// End every session one user holds, not just the one making the request. Used by
// account deletion: the account is gone, so every token that could reach it must
// be refused, including tokens on devices that never come back to sign out.
//
// The row lives as long as the longest token that could already have been issued,
// so it is dropped by the cleanup above once no token it could match is valid.
export function revokeAllForUser(userId) {
  if (!userId) throw new Error('revokeAllForUser needs a user id');
  query('INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at) VALUES (?, ?, ?)', [
    `${USER_MARKER_PREFIX}${userId}`,
    userId,
    nowSeconds() + SESSION_TTL_SECONDS
  ]);
  query('DELETE FROM revoked_tokens WHERE expires_at < ?', [nowSeconds()]);
}
