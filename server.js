require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;


const USERS_FILE = path.join(__dirname, 'users.json');

const { searchGames, getTypes, getAllGames } = require('./cache'); // ✅ Updated import

app.use(cors({
    origin: 'https://tryaslot.com'
  }));

// SendGrid setup
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Load/save helpers
function loadUsers() {
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
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Updated /api/login endpoint
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
      // New email – trigger registration
      return res.json({ status: 'new' });
    }
  } catch (err) {
    console.error('Error in /api/login:', err);
    res.status(500).json({ error: 'Internal Server Error in /api/login' });
  }
});

// New /api/register endpoint
app.post('/api/register', (req, res) => {
  try {
    const { email, country, captcha } = req.body;
    if (!email || !country || !captcha) {
      return res.status(400).json({ success: false, message: 'Missing fields.' });
    }

    // Dummy captcha check; in production use real captcha verification
    if (captcha !== 'ABC123') {
      return res.status(400).json({ success: false, message: 'Captcha incorrect.' });
    }

    let users = loadUsers();
    const existing = users.find(u => u.email === email);
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists.' });
    }

    // Create new user record with verified set to false.
    const newUser = { email, country, verified: false };
    users.push(newUser);
    saveUsers(users);

    // Create the verification URL.
    const verificationUrl = `${BASE_URL}/api/verify?email=${encodeURIComponent(email)}`;

    // Prepare SendGrid message.
    const msg = {
      to: email,
      from: { email: process.env.SENDER_EMAIL, name: "TRY'A'SLOT" },
      subject: 'Verify Your Email for TRY\'A\'SLOT',
      text: `Please verify your email by clicking this link: ${verificationUrl}`,
      html: `
        <div style="display:none; font-size:1px; color:#f2f2f2; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
          Click to verify your email and unlock 25,000+ slot demo games instantly!
        </div>
        <div style="background-color: #f2f2f2; padding: 40px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; border-radius: 8px; text-align: center; font-family: Arial, sans-serif; font-size: 14px; color: #333;">
            <img src="https://yourdomain.com/assets/logo.png" alt="TRY'A'SLOT" style="max-width: 200px; margin: 0 auto 20px; display: block;">
            <h2>Verify Your Email</h2>
            <p>Hello,</p>
            <p>Please verify your email for <strong>TRY'A'SLOT</strong> by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" style="display: inline-block; background-color: #eb2f06; color: #fff; font-weight: 600; font-size: 16px; padding: 8px 25px; text-decoration: none; border-radius: 4px;">Verify Email</a>
            </p>
            <p>Once you verify, you’ll be able to play <strong>25,000+ slot demo games</strong> from <strong>400+ providers</strong> instantly.</p>
            <p style="font-size: 14px; color: #555;">If the button doesn’t work, copy and paste the following link into your browser:</p>
            <p style="font-size: 14px; color: #555;">${verificationUrl}</p>
          </div>
        </div>
      `
    };

    sgMail.send(msg)
      .then(() => console.log(`Verification email sent to ${email}`))
      .catch(error => console.error('Error sending verification email:', error));

    res.json({ success: true });
  } catch(err) {
    console.error('Error in /api/register:', err);
    res.status(500).json({ error: 'Internal Server Error in /api/register' });
  }
});

// New /api/check-verification endpoint
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
  } catch(err) {
    console.error('Error in /api/check-verification:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Dummy /api/verify endpoint to simulate verification
app.get('/api/verify', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).send('Email parameter is required.');

  let users = loadUsers();
  const userIndex = users.findIndex(u => u.email === email);
  if (userIndex === -1) return res.send('User not found.');

  users[userIndex].verified = true;
  saveUsers(users);
  res.send('Email verified! You can now close this window.');
});

// --- EXISTING ENDPOINTS BELOW ---

// Search API
app.get('/api/search', (req, res) => {
  const query = req.query.q || '';
  console.log(`Search endpoint received query: "${query}"`);
  const results = searchGames(query);
  console.log(`Search returning ${results.length} records.`);
  res.json({ data: results });
});

// Categories/types API
app.get('/api/types', (req, res) => {
  try {
    const types = getTypes();
    res.json({ data: types });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch types' });
  }
});

// All games API from local cache
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
