const { DatabaseSync } = require('node:sqlite');
try {
  const db = new DatabaseSync('./art_workspace.db');
  console.log("SQL Schema for users:");
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").all();
  console.log(schema[0].sql);

  console.log("\nSQL Schema for all indexes:");
  const indexes = db.prepare("SELECT sql, name FROM sqlite_master WHERE type='index' AND tbl_name='users'").all();
  console.log(indexes);
} catch (err) {
  console.error(err);
}
