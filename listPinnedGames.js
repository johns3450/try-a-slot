const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'games.db'));

const pinnedIds = [
  2782, 1043, 3031, 3179, 2440, 3390, 3021, 2538, 2523, 3264,
  2572, 2769, 2714, 1078, 2095, 2602, 1095, 1106, 1391, 1045,
  1036, 1232, 1741, 3055, 2435, 2515, 1332, 3276, 2521, 1459,
  2130, 2200, 1129, 1052, 2414, 3020, 2633, 1301, 1361, 3030,
  1155, 1175, 1344, 3185, 3311, 1443, 1346, 1081, 1281, 1067,
  1452, 1279, 2512, 3115, 3237, 1275, 1132, 1073
];

const stmt = db.prepare(`SELECT id, name FROM games WHERE id IN (${pinnedIds.map(() => '?').join(',')})`);
const games = stmt.all(...pinnedIds);

console.table(games);
