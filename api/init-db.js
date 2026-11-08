import { query, DB_PATH } from './db.js';

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
