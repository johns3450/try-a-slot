const axios = require('axios');
const cron = require('node-cron');
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'games.db'));
db.pragma('journal_mode = WAL');

db.prepare(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type_slug TEXT,
    thumb TEXT,
    url TEXT,
    updated_at TEXT  /* ISO8601 string from API */
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
  

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGameData() {
  let page = 1, allGames = [];
  while (true) {
    const url = `https://slotslaunch.com/api/games?token=RbG9QL8cCFe376wMMYFzU19hNWTmT5uTNHcQ2WUgWdnv90PXxd&published=1&page=${page}&per_page=150`;
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

    db.prepare('DELETE FROM games').run();
    db.prepare('DELETE FROM types').run();

const insertGame = db.prepare(
  `INSERT INTO games 
     (id, name, type_slug, thumb, url, updated_at) 
   VALUES (?, ?, ?, ?, ?, ?)`
);

const gameTx = db.transaction(games => {
  games.forEach(g => {
    insertGame.run(
      g.id,
      g.name,
      g.type_slug || 'misc',
      g.thumb || '',
      g.url || '',
      g.updated_at || ''
    );
  });
});
gameTx(games);

const counts = {};
const names = {};

games.forEach(g => {
  const slug = g.type_slug || 'misc';
  const name = g.type || 'Misc';
  counts[slug] = (counts[slug] || 0) + 1;
  if (!names[slug]) names[slug] = name;
});

const insertType = db.prepare('INSERT INTO types (slug, name, count) VALUES (?, ?, ?)');
const typeTx = db.transaction(() => {
  Object.keys(counts).forEach(slug => {
    insertType.run(slug, names[slug], counts[slug]);
  });
});
typeTx();


    console.log(`✅ Cache updated — ${games.length} games, ${Object.keys(counts).length} types`);
  } catch (err) {
    console.error('❌ Cache update failed:', err.message);
  }
}

const pinnedGameIds = [
    2782, 1043, 3031, 3179, 2440, 3390, 3021, 2538, 2523, 3264,
    2572, 2769, 2714, 1078, 2095, 2602, 1095, 1106, 1391, 1045,
    1036, 1232, 1741, 3055, 2435, 2515, 1332, 3276, 2521, 1459,
    2130, 2200, 1129, 1052, 2414, 3020, 2633, 1301, 1361, 3030,
    1155, 1175, 1344, 3185, 3311, 1443, 1346, 1081, 1281, 1067,
    1452, 1279, 2512, 3115, 3237, 1275, 1132, 1073
  ];
  
  const insertPinned = db.prepare('INSERT OR IGNORE INTO pinned (id) VALUES (?)');
  const pinTx = db.transaction(() => {
    pinnedGameIds.forEach(id => insertPinned.run(id));
  });
  pinTx();
  

cron.schedule('1 0 * * *', updateCache);
updateCache();

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
  
  function getAllGames(limit, offset) {
    const base = `
      SELECT * FROM games
      LEFT JOIN pinned ON games.id = pinned.id
      ORDER BY pinned.id DESC, updated_at DESC
    `;
  
    if (typeof limit !== 'undefined' && typeof offset !== 'undefined') {
      return db.prepare(`${base} LIMIT ? OFFSET ?`).all(limit, offset);
    }
  
    return db.prepare(base).all();
  }  
  
  function getTypes() {
    return db
      .prepare('SELECT * FROM types ORDER BY name ASC')
      .all();
  }
  
  module.exports = {
    searchGames,
    getTypes,
    getAllGames
  };
