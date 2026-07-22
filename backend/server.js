const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS and rich JSON parsing for base64 map uploads
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Database configuration
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'emporium',
  port: parseInt(process.env.PGPORT || '5432'),
});

// Database initialization helper
const initDb = async () => {
  let retries = 5;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          username VARCHAR(100) PRIMARY KEY,
          password VARCHAR(255) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS games (
          id VARCHAR(20) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          dm_username VARCHAR(100) NOT NULL,
          store JSONB DEFAULT '[]'::jsonb,
          shops JSONB DEFAULT '[]'::jsonb,
          locations JSONB NOT NULL,
          party_location VARCHAR(100) NOT NULL,
          travel_state JSONB DEFAULT NULL,
          map_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS characters (
          username VARCHAR(100) NOT NULL,
          game_id VARCHAR(20) NOT NULL,
          name VARCHAR(255) NOT NULL,
          race VARCHAR(100) NOT NULL,
          class VARCHAR(100) NOT NULL,
          level INT DEFAULT 1,
          hp_max INT NOT NULL,
          hp_current INT NOT NULL,
          stats JSONB NOT NULL,
          gold JSONB NOT NULL,
          inventory JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (username, game_id)
        );

        CREATE TABLE IF NOT EXISTS logs (
          id SERIAL PRIMARY KEY,
          game_id VARCHAR(20) NOT NULL,
          sender VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Database tables successfully initialized!');
      client.release();
      break;
    } catch (err) {
      console.error(`Database connection failed. Retries remaining: ${retries - 1}. Error:`, err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

// 1. AUTHENTICATION ENDPOINTS
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const userCheck = await pool.query('SELECT username FROM users WHERE username = $1', [username.trim()]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username.trim(), hashedPassword]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    res.json({ success: true, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. CAMPAIGNS (GAMES) ENDPOINTS
app.get('/api/games', async (req, res) => {
  try {
    const gamesResult = await pool.query('SELECT * FROM games ORDER BY created_at DESC');
    // Map list to key-value objects matching frontend getGames expectations
    const gamesMap = {};
    gamesResult.rows.forEach(game => {
      gamesMap[game.id] = {
        id: game.id,
        name: game.name,
        description: game.description,
        dm: game.dm_username,
        store: game.store,
        shops: game.shops,
        locations: game.locations,
        partyLocation: game.party_location,
        travelState: game.travel_state,
        mapUrl: game.map_url
      };
    });
    res.json(gamesMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/games/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const gameResult = await pool.query('SELECT * FROM games WHERE id = $1', [id.toUpperCase()]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }
    const game = gameResult.rows[0];
    res.json({
      id: game.id,
      name: game.name,
      description: game.description,
      dm: game.dm_username,
      store: game.store,
      shops: game.shops,
      locations: game.locations,
      partyLocation: game.party_location,
      travelState: game.travel_state,
      mapUrl: game.map_url
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/games', async (req, res) => {
  const { name, description, dmUsername } = req.body;
  if (!name || !dmUsername) {
    return res.status(400).json({ error: 'Name and DM username are required.' });
  }
  const gameId = 'GAME' + Math.floor(1000 + Math.random() * 9000);
  const defaultLocations = [
    {
      id: 'loc_start',
      name: 'Town of Phandalin',
      description: 'A small frontier town nestled in the foothills of the Sword Mountains. Home of the Stonehill Inn.',
      x: 215,
      y: 285
    }
  ];
  try {
    await pool.query(
      `INSERT INTO games (id, name, description, dm_username, locations, party_location)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [gameId, name, description, dmUsername, JSON.stringify(defaultLocations), 'loc_start']
    );
    res.json({
      id: gameId,
      name,
      description,
      dm: dmUsername,
      locations: defaultLocations,
      partyLocation: 'loc_start',
      store: [],
      shops: [],
      travelState: null,
      mapUrl: null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/games/:id/join', async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  try {
    const gameResult = await pool.query('SELECT * FROM games WHERE id = $1', [id.toUpperCase()]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign code not found.' });
    }
    const game = gameResult.rows[0];
    if (game.dm_username === username) {
      return res.status(400).json({ error: 'You are the Dungeon Master of this campaign.' });
    }

    const charResult = await pool.query('SELECT username FROM characters WHERE game_id = $1 AND username = $2', [id.toUpperCase(), username]);
    const characterExists = charResult.rows.length > 0;

    res.json({
      success: true,
      characterExists,
      game: {
        id: game.id,
        name: game.name,
        description: game.description,
        dm: game.dm_username,
        store: game.store,
        shops: game.shops,
        locations: game.locations,
        partyLocation: game.party_location,
        travelState: game.travel_state,
        mapUrl: game.map_url
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. CHARACTERS ENDPOINTS
app.get('/api/games/:id/characters', async (req, res) => {
  const { id } = req.params;
  try {
    const charResult = await pool.query('SELECT * FROM characters WHERE game_id = $1 ORDER BY name ASC', [id.toUpperCase()]);
    const characters = charResult.rows.map(c => ({
      username: c.username,
      name: c.name,
      race: c.race,
      class: c.class,
      level: c.level,
      hpMax: c.hp_max,
      hpCurrent: c.hp_current,
      stats: c.stats,
      gold: c.gold,
      inventory: c.inventory
    }));
    res.json(characters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/games/:id/characters/:username', async (req, res) => {
  const { id, username } = req.params;
  try {
    const charResult = await pool.query('SELECT * FROM characters WHERE game_id = $1 AND username = $2', [id.toUpperCase(), username]);
    if (charResult.rows.length === 0) {
      return res.status(404).json({ error: 'Character sheet not found.' });
    }
    const c = charResult.rows[0];
    res.json({
      username: c.username,
      name: c.name,
      race: c.race,
      class: c.class,
      level: c.level,
      hpMax: c.hp_max,
      hpCurrent: c.hp_current,
      stats: c.stats,
      gold: c.gold,
      inventory: c.inventory
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/games/:id/characters', async (req, res) => {
  const { id } = req.params;
  const { username, name, race, class: className, level, hpMax, hpCurrent, stats, gold, inventory } = req.body;
  try {
    await pool.query(
      `INSERT INTO characters (username, game_id, name, race, class, level, hp_max, hp_current, stats, gold, inventory)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [username, id.toUpperCase(), name, race, className, level || 1, hpMax, hpCurrent, JSON.stringify(stats), JSON.stringify(gold), JSON.stringify(inventory || [])]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/games/:id/characters/:username', async (req, res) => {
  const { id, username } = req.params;
  const { name, race, class: className, level, hpMax, hpCurrent, stats, gold, inventory } = req.body;
  try {
    await pool.query(
      `UPDATE characters 
       SET name = $1, race = $2, class = $3, level = $4, hp_max = $5, hp_current = $6, stats = $7, gold = $8, inventory = $9
       WHERE game_id = $10 AND username = $11`,
      [name, race, className, level, hpMax, hpCurrent, JSON.stringify(stats), JSON.stringify(gold), JSON.stringify(inventory), id.toUpperCase(), username]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/games/:id/characters/:username', async (req, res) => {
  const { id, username } = req.params;
  try {
    await pool.query('DELETE FROM characters WHERE game_id = $1 AND username = $2', [id.toUpperCase(), username]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. MAP, TRAVEL AND STORES ENDPOINTS
app.put('/api/games/:id/store', async (req, res) => {
  const { id } = req.params;
  const { store } = req.body;
  try {
    await pool.query('UPDATE games SET store = $1 WHERE id = $2', [JSON.stringify(store), id.toUpperCase()]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/games/:id/shops', async (req, res) => {
  const { id } = req.params;
  const { shops } = req.body;
  try {
    await pool.query('UPDATE games SET shops = $1 WHERE id = $2', [JSON.stringify(shops), id.toUpperCase()]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/games/:id/locations', async (req, res) => {
  const { id } = req.params;
  const { locations } = req.body;
  try {
    await pool.query('UPDATE games SET locations = $1 WHERE id = $2', [JSON.stringify(locations), id.toUpperCase()]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/games/:id/map-url', async (req, res) => {
  const { id } = req.params;
  const { mapUrl } = req.body;
  try {
    await pool.query('UPDATE games SET map_url = $1 WHERE id = $2', [mapUrl, id.toUpperCase()]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/games/:id/travel', async (req, res) => {
  const { id } = req.params;
  const { partyLocation, travelState } = req.body;
  try {
    await pool.query(
      'UPDATE games SET party_location = $1, travel_state = $2 WHERE id = $3',
      [partyLocation, JSON.stringify(travelState), id.toUpperCase()]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. CHRONICLED LOGS ENDPOINTS
app.get('/api/games/:id/logs', async (req, res) => {
  const { id } = req.params;
  try {
    const logsResult = await pool.query('SELECT * FROM logs WHERE game_id = $1 ORDER BY timestamp ASC', [id.toUpperCase()]);
    const logs = logsResult.rows.map(l => ({
      sender: l.sender,
      message: l.message,
      timestamp: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/games/:id/logs', async (req, res) => {
  const { id } = req.params;
  const { sender, message } = req.body;
  try {
    await pool.query(
      'INSERT INTO logs (game_id, sender, message) VALUES ($1, $2, $3)',
      [id.toUpperCase(), sender, message]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server listener and database initialization
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  await initDb();
});
