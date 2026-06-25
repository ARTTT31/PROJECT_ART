const { DatabaseSync } = require('node:sqlite');
try {
  const db = new DatabaseSync('./art_workspace.db');
  console.log("Tables:");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(tables);

  console.log("\nUsers columns:");
  const columns = db.prepare("PRAGMA table_info(users)").all();
  console.log(columns);

  console.log("\nUsers count:");
  const count = db.prepare("SELECT COUNT(*) as count FROM users").all();
  console.log(count);

  console.log("\nUsers data:");
  const users = db.prepare("SELECT id, email, username, display_name, name, role, is_active, is_locked FROM users").all();
  console.log(users);
} catch (err) {
  console.error(err);
}
