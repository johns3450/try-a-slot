const axios    = require('axios');
const cron     = require('node-cron');
const Database = require('better-sqlite3');
const path     = require('path');
const db       = new Database(path.join(__dirname, 'games.db'));
db.pragma('journal_mode = WAL');

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
db.prepare(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type_slug TEXT,
    thumb TEXT,
    url TEXT,
    updated_at TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS types (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    count INTEGER DEFAULT 0
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS pinned (
    id INTEGER PRIMARY KEY
  )
`).run();

// ─── UTILS ────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Your 60 pinned IDs in the exact desired order:
const pinnedGameIds = [
  12643, 359, 17845, 3272, 3311, 1045, 4622, 2570, 1052, 17680,
  2782, 1873, 761, 2521, 2411, 9914, 4447, 3276, 9759, 1081,
  2523, 3352, 3959, 1301, 15239, 13092, 893, 9980, 3387, 1850,
  16678, 1116, 16716, 16630, 13437, 11461, 5483, 9155, 1264, 3672,
  11466, 2775, 2572, 3328, 5516, 9499, 5397, 1067, 3302, 15961,
  6416, 1232, 742, 9760, 2781, 1443, 5987, 16711, 10045, 9650
];

// ─── DATA FETCH & CACHE ───────────────────────────────────────────────────────
async function fetchGameData() {
  let page = 1, allGames = [];
  while (true) {
    const url =
      `https://slotslaunch.com/api/games?token=RbG9QL8cCFe376wMMYFzU19hNWTmT5uTNHcQ2WUgWdnv90PXxd&published=1&page=${page}&per_page=150`;
    try {
      const res = await axios.get(url, {
        headers: {
          'Origin': 'https://tryaslot.com',
          'Accept': 'application/json'
        }
      });
      const data = res.data.data;
      if (!data || data.length === 0) break;
      allGames = allGames.concat(data);
      console.log(`✅ Fetched page ${page} — ${data.length} games`);
      page++;
      await sleep(200);
    } catch (err) {
      console.error(`❌ Error fetching page ${page}:`, err.message);
      break;
    }
  }
  return allGames;
}

async function updateCache() {
  try {
    console.log('🔄 Updating game and type cache...');
    const games = await fetchGameData();

    // clear old data
    db.prepare('DELETE FROM games').run();
    db.prepare('DELETE FROM types').run();
    db.prepare('DELETE FROM pinned').run();

    // insert games
    const insertGame = db.prepare(`
      INSERT INTO games (id, name, type_slug, thumb, url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const gameTx = db.transaction(all => {
      for (const g of all) {
        insertGame.run(
          g.id,
          g.name,
          g.type_slug || 'misc',
          g.thumb || '',
          g.url || '',
          g.updated_at || ''
        );
      }
    });
    gameTx(games);

    // build & insert types
    const counts = {}, names = {};
    for (const g of games) {
      const slug = g.type_slug || 'misc';
      counts[slug] = (counts[slug] || 0) + 1;
      if (!names[slug]) names[slug] = g.type || 'Misc';
    }
    const insertType = db.prepare('INSERT INTO types (slug, name, count) VALUES (?, ?, ?)');
    const typeTx = db.transaction(() => {
      for (const slug of Object.keys(counts)) {
        insertType.run(slug, names[slug], counts[slug]);
      }
    });
    typeTx();

    // re‑insert your pins in order
    const insertPinned = db.prepare('INSERT INTO pinned (id) VALUES (?)');
    const pinTx = db.transaction(() => {
      for (const id of pinnedGameIds) {
        insertPinned.run(id);
      }
    });
    pinTx();

    console.log(
      `✅ Cache updated — ${games.length} games, ` +
      `${Object.keys(counts).length} types, ` +
      `${pinnedGameIds.length} pinned`
    );
  } catch (err) {
    console.error('❌ Cache update failed:', err.message);
  }
}

// schedule & initial run
cron.schedule('1 0 * * *', updateCache);
updateCache();

// ─── QUERY FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * Hot/All page: pinned first (in your custom order), then everything else by updated_at DESC.
 */
function getAllGames(limit, offset) {
  // build a CASE expression that ranks pinned IDs 0..59, all others 60
  const whenClauses = pinnedGameIds
    .map((id, idx) => `WHEN ${id} THEN ${idx}`)
    .join(' ');
  const rankExpr = `CASE id ${whenClauses} ELSE ${pinnedGameIds.length} END`;

  let sql = `
    SELECT *
      FROM games
     ORDER BY
       ${rankExpr} ASC,
       updated_at DESC
  `;

  if (limit != null && offset != null) {
    sql += ' LIMIT ? OFFSET ?';
    return db.prepare(sql).all(limit, offset);
  }
  return db.prepare(sql).all();
}

/**
 * Category pages: only games of a given type, most-recent-first.
 */
function getGamesByType(typeSlug, limit, offset) {
  let sql = `
    SELECT *
      FROM games
     WHERE type_slug = ?
     ORDER BY updated_at DESC
  `;

  if (limit != null && offset != null) {
    sql += ' LIMIT ? OFFSET ?';
    return db.prepare(sql).all(typeSlug, limit, offset);
  }
  return db.prepare(sql).all(typeSlug);
}

/**
 * Search UI: pure updated_at DESC (ignoring pinned entirely).
 */
function searchGames(query) {
  if (!query) {
    return db
      .prepare('SELECT * FROM games ORDER BY updated_at DESC')
      .all();
  }
  return db
    .prepare(
      'SELECT * FROM games WHERE lower(name) LIKE ? ORDER BY updated_at DESC'
    )
    .all(`%${query.toLowerCase()}%`);
}

function getTypes() {
  return db.prepare('SELECT * FROM types ORDER BY name ASC').all();
}

module.exports = {
  getAllGames,     // for hot/all only!
  getGamesByType,  // for each category page
  searchGames,     // for search bar
  getTypes
};
