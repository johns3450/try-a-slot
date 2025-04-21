require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch'); // Add for proxy

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const emailRoutes = require('./email');
const { searchGames, getTypes, getAllGames, getGamesByType } = require('./cache');

app.use(cors({
    origin: 'https://tryaslot.com'
}));

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.json());
app.use('/api', emailRoutes); // Mount email routes

// Proxy route for restcountries API
app.get('/api/countries', async (req, res) => {
    try {
        const response = await fetch('https://restcountries.com/v3.1/all?fields=cca2,name,flags');
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Error fetching countries:', err);
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
});

// Load/save helpers
function loadUsers() {
    const USERS_FILE = path.join(__dirname, 'users.json');
    if (!fs.existsSync(USERS_FILE)) return [];
    const data = fs.readFileSync(USERS_FILE, 'utf8').trim();
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch (err) {
        console.error('Error parsing users JSON. Resetting file to empty array.', err);
        return [];
    }
}

function saveUsers(users) {
    const USERS_FILE = path.join(__dirname, 'users.json');
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Login
app.post('/api/login', (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        let users = loadUsers();
        const existing = users.find(u => u.email === email);

        if (existing) {
            if (existing.verified) {
                return res.json({ status: 'verified' });
            } else {
                return res.json({ status: 'pending' });
            }
        } else {
            return res.json({ status: 'new' });
        }
    } catch (err) {
        console.error('Error in /api/login:', err);
        res.status(500).json({ error: 'Internal Server Error in /api/login' });
    }
});

// Check verification
app.post('/api/check-verification', (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        let users = loadUsers();
        const existing = users.find(u => u.email === email);
        if (existing && existing.verified) {
            return res.json({ verified: true });
        } else {
            return res.json({ verified: false });
        }
    } catch (err) {
        console.error('Error in /api/check-verification:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Email verification
app.get('/api/verify', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).send('Email parameter is required.');

    let users = loadUsers();
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex === -1) return res.send('User not found.');

    users[userIndex].verified = true;
    saveUsers(users);

    res.sendFile(path.join(__dirname, 'public/verified.html'));
});

// Search API
app.get('/api/search', (req, res) => {
    const q = req.query.q || '';
    const results = searchGames(q);
    res.json({ data: results });
});

// Types API
app.get('/api/types', (req, res) => {
    try {
        const types = getTypes();
        res.json({ data: types });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch types' });
    }
});

// Category API
app.get('/api/games/type/:slug', (req, res) => {
    const slug = req.params.slug;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : undefined;
    try {
        const games = getGamesByType(slug, limit, offset);
        res.json({ data: games });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch games for category' });
    }
});

// Hot/All games API
app.get('/api/games', (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : undefined;
        const games = getAllGames(limit, offset);
        res.json({ data: games });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Try'A'Slot server running on ${BASE_URL}`);
});