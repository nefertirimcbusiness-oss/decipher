import { query, DB_PATH } from './db.js';

// ADD COLUMN if the column is not already there. SQLite has no
// "ADD COLUMN IF NOT EXISTS", so the current shape is read first.
function addColumnIfMissing(table, column, definition) {
  const columns = query(`PRAGMA table_info(${table})`);
  if (columns.some((row) => row.name === column)) return;
  query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function initializeDatabase() {
  // The product's data lives in its own file, not in the team's coordination
  // database. Printing the path at boot makes that checkable at a glance.
  console.log(`Initializing database at ${DB_PATH} ...`);

  // Users table
  query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      stripe_customer_id TEXT,
      subscription_status TEXT DEFAULT 'inactive',
      is_adult INTEGER,
      terms_version TEXT,
      terms_accepted_at TEXT,
      accepted_ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Databases created before the age gate and the consent record existed need the
  // new columns added in place. ADD COLUMN is additive and leaves existing rows
  // alone; their values are NULL, which is the honest answer for a row written
  // when neither was asked.
  addColumnIfMissing('users', 'is_adult', 'INTEGER');
  addColumnIfMissing('users', 'terms_version', 'TEXT');
  addColumnIfMissing('users', 'terms_accepted_at', 'TEXT');
  addColumnIfMissing('users', 'accepted_ip', 'TEXT');

  // Entries table
  query(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Evidence files table
  query(`
    CREATE TABLE IF NOT EXISTS evidence_files (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id)
    )
  `);

  // Edits table
  query(`
    CREATE TABLE IF NOT EXISTS edits (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      previous_content TEXT,
      edit_reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id)
    )
  `);

  // Savid conversations table
  query(`
    CREATE TABLE IF NOT EXISTS savid_conversations (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id)
    )
  `);

  // Subscriptions table
  query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stripe_subscription_id TEXT UNIQUE,
      status TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      current_period_end DATETIME,
      trial_end DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Sessions ended by signing out.
  //
  // A token is a signed statement, not a handle: before this table existed,
  // "log out" only removed the copy in the browser, and the token itself stayed
  // valid for its full lifetime — so anyone who had it (a shared laptop, a stolen
  // backup, an extension) could keep reading a trauma journal. Signing out now
  // records the token's id here, and the auth middleware refuses it. Rows expire
  // with the token, and are cleared out as they do.
  query(`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      user_id TEXT,
      expires_at INTEGER NOT NULL,
      revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes for the lookups the API makes on nearly every request. The shared
  // coordination database had none of these because it was never designed to hold
  // the product's rows.
  query('CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id, created_at DESC)');
  query('CREATE INDEX IF NOT EXISTS idx_evidence_entry ON evidence_files(entry_id)');
  query('CREATE INDEX IF NOT EXISTS idx_edits_entry ON edits(entry_id)');
  query('CREATE INDEX IF NOT EXISTS idx_savid_entry ON savid_conversations(entry_id, created_at)');
  query('CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id)');

  console.log('Database initialization complete.');
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}
