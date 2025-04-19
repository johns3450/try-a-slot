const axios = require('axios');
const cron = require('node-cron');
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'games.db'));
db.pragma('journal_mode = WAL');

// Create tables
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
          'Origin': BASE_URL,
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

    // Insert games
    // adjust your INSERT statement to include updated_at
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
      g.updated_at || ''        // ← pull from API response
    );
  });
});
gameTx(games);


    // Count types and map names from game data
const counts = {};
const names = {};

games.forEach(g => {
  const slug = g.type_slug || 'misc';
  const name = g.type || 'Misc';
  counts[slug] = (counts[slug] || 0) + 1;
  if (!names[slug]) names[slug] = name;
});

// Insert all types regardless of count
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

// Daily schedule
cron.schedule('1 0 * * *', updateCache);
updateCache();

// Exported methods
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
    const base = 'SELECT * FROM games ORDER BY updated_at DESC';
  
    if (typeof limit !== 'undefined' && typeof offset !== 'undefined') {
      return db
        .prepare(`${base} LIMIT ? OFFSET ?`)
        .all(limit, offset);
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
  
