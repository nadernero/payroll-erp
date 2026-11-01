import db from '../server/db.js';

const idxs = db.prepare("PRAGMA index_list(attendance)").all();
console.log('Indices on attendance:', idxs);
for (const idx of idxs) {
  const info = db.prepare(`PRAGMA index_info(${idx.name})`).all();
  console.log(`Index ${idx.name} cols:`, info);
}
