const express = require('express');
const router = express.Router();
const { loadUsers, saveUsers, sendVerificationEmail } = require('./utils');

router.post('/register', async (req, res) => {
    try {
        const { email, country, captcha } = req.body;
        if (!email || !country || !captcha) {
            return res.status(400).json({ success: false, message: 'Missing fields.' });
        }
        // Dummy captcha check
        if (captcha !== 'ABC123') {
            return res.status(400).json({ success: false, message: 'Captcha incorrect.' });
        }

        let users = loadUsers();
        if (users.some(u => u.email === email)) {
            return res.status(400).json({ success: false, message: 'User already exists.' });
        }

        // Save new user
        users.push({ email, country, verified: false });
        saveUsers(users);

        // Build verification URL
        const verificationUrl = `${process.env.BASE_URL}/api/verify?email=${encodeURIComponent(email)}`;

        // Send the email
        await sendVerificationEmail(email, verificationUrl);
        console.log(`Verification email sent to ${email}`);

        res.json({ success: true });
    } catch (err) {
        console.error('Error in /api/register:', err);
        res.status(500).json({ error: 'Internal Server Error in /api/register' });
    }
});

module.exports = router;