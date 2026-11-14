import express from 'express';
const router = express.Router();
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { rateLimit, clientIp, emailKey } from '../lib/rate-limit.js';
import { issueToken, revokeToken } from '../lib/session.js';
import auth from '../middleware/auth.js';

// The Terms and Privacy Policy are not lawyered yet; when the lawyer returns a
// revised version this string becomes "v2" and the record of what each person
// agreed to stays true.
export const TERMS_VERSION = 'v1';

// Public, unauthenticated, and expensive (bcrypt). Two budgets per route: one per
// client address, one per account being attempted. The address alone is not
// enough — an attacker rotating addresses still hammers one account — and the
// account alone is not enough, since it lets a caller spray many accounts.
const signupLimit = rateLimit([
  {
    name: 'signup:ip',
    key: clientIp,
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Too many accounts created from here. Please try again later.'
  }
]);

const loginLimit = rateLimit([
  {
    name: 'login:ip',
    key: clientIp,
    windowMs: 5 * 60 * 1000,
    max: 20,
    message: 'Too many sign-in attempts. Please wait a few minutes and try again.'
  },
  {
    name: 'login:email',
    key: emailKey,
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many sign-in attempts for this account. Please wait a few minutes and try again.'
  }
]);

router.post('/signup', signupLimit, async (req, res) => {
  const { email, password } = req.body || {};

  // The age gate. Decipher is a space for adults, and no account is created
  // unless that has been affirmed — the client asks the question before it calls
  // this route, and the answer is checked here too so the rule does not depend on
  // the client being the one we shipped.
  if (req.body?.isAdult !== true) {
    return res.status(403).json({
      error: 'Decipher is a space for adults. Are you 18 or older?',
      code: 'ADULT_CONFIRMATION_REQUIRED'
    });
  }

  // Consent. The checkbox sits directly above the signup button and is unticked
  // by default; the acceptance is recorded with the version of the Terms that was
  // on screen, the moment it was given, and the address it was given from.
  if (req.body?.acceptedTerms !== true) {
    return res.status(403).json({
      error: "I'm 18 or older, and I agree to the Terms and Privacy Policy.",
      code: 'TERMS_ACCEPTANCE_REQUIRED'
    });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const existing = query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    query(
      `INSERT INTO users (id, email, password_hash, is_adult, terms_version, terms_accepted_at, accepted_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, email, passwordHash, 1, TERMS_VERSION, new Date().toISOString(), clientIp(req)]
    );

    const token = issueToken(id);
    res.status(201).json({ token, userId: id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', loginLimit, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const results = query('SELECT * FROM users WHERE email = ?', [email]);
    if (results.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = results[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = issueToken(user.id);
    res.json({ token, userId: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sign out.
//
// This is what makes signing out mean something: the token is revoked here, on
// the server, so a copy of it taken from the browser before signing out stops
// working immediately instead of at the end of its lifetime. Answering 200 even
// for an already-dead token keeps the client's sign-out simple — it is being told
// the session is over, which is what it asked for.
router.post('/logout', auth, (req, res) => {
  try {
    revokeToken({ jti: req.tokenId, userId: req.userId, exp: req.tokenExp });
    return res.json({ message: 'Signed out' });
  } catch (error) {
    console.error('Logout failed:', error.message);
    return res.status(500).json({ error: 'Could not sign out, please retry' });
  }
});

export default router;
