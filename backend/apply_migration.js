const { DatabaseSync } = require('node:sqlite');
try {
  const db = new DatabaseSync('./art_workspace.db');
  
  // Start transaction
  db.exec("BEGIN TRANSACTION;");
  
  // Rename old table
  db.exec("ALTER TABLE users RENAME TO users_old;");
  
  // Create new table
  db.exec(`
    CREATE TABLE users (
      id INTEGER NOT NULL, 
      email VARCHAR(255), 
      username VARCHAR(255),
      display_name VARCHAR(255),
      hashed_password VARCHAR(255) NOT NULL, 
      name VARCHAR(255) NOT NULL, 
      avatar TEXT, 
      role VARCHAR(50) NOT NULL, 
      quick_links TEXT, 
      is_active BOOLEAN NOT NULL, 
      is_locked BOOLEAN NOT NULL, 
      last_login DATETIME, 
      last_login_ip VARCHAR(45), 
      last_login_device VARCHAR(255), 
      failed_login_attempts INTEGER NOT NULL, 
      locked_until DATETIME, 
      created_at DATETIME NOT NULL, 
      updated_at DATETIME NOT NULL, 
      PRIMARY KEY (id)
    );
  `);
  
  // Copy data
  db.exec(`
    INSERT INTO users (
      id, email, username, display_name, hashed_password, name, avatar, role, 
      quick_links, is_active, is_locked, last_login, last_login_ip, 
      last_login_device, failed_login_attempts, locked_until, created_at, updated_at
    )
    SELECT 
      id, email, NULL, NULL, hashed_password, name, avatar, role, 
      quick_links, is_active, is_locked, last_login, last_login_ip, 
      last_login_device, failed_login_attempts, locked_until, created_at, updated_at 
    FROM users_old;
  `);
  
  // Drop old table
  db.exec("DROP TABLE users_old;");

  // Create indexes
  db.exec("CREATE UNIQUE INDEX ix_users_email ON users (email);");
  db.exec("CREATE UNIQUE INDEX ix_users_username ON users (username);");
  db.exec("CREATE INDEX ix_users_id ON users (id);");
  
  // Commit
  db.exec("COMMIT;");
  
  console.log("Migration applied successfully!");
} catch (err) {
  console.error("Migration failed:", err);
}
