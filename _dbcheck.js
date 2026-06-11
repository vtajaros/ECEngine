
const Database = require('better-sqlite3');
const db = new Database('./data/ecengine.db', { readonly: true });
const rows = db.prepare('SELECT day, correct_count, total_count, count FROM study_activity ORDER BY day DESC LIMIT 15').all();
console.log(JSON.stringify(rows, null, 2));
db.close();
