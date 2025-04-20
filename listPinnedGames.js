const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'games.db'));

const pinnedIds = [
    12643, 359, 17845, 3272, 3311, 1045, 4622, 2570, 1052, 17680,
    2782, 1873, 761, 2521, 2411, 9914, 4447, 3276, 9759, 1081,
    2523, 3352, 3959, 1301, 15239, 13092, 893, 9980, 3387, 1850,
    16678, 1116, 16716, 16630, 13437, 11461, 5483, 9155, 1264, 3672,
    11466, 2775, 2572, 3328, 5516, 9499, 5397, 1067, 3302, 15961,
    6416, 1232, 742, 9760, 2781, 1443, 5987, 16711, 10045, 9650
];

const stmt = db.prepare(`SELECT id, name FROM games WHERE id IN (${pinnedIds.map(() => '?').join(',')})`);
const games = stmt.all(...pinnedIds);

console.table(games);
