const express = require('express');
const router = express.Router();
const { loadUsers, saveUsers, sendVerificationEmail } = require('./utils');

router.post('/register', async (req, res) => {
    try {
        const { email, country, captcha } = req.body;
        if (!email || !country || !captcha) {
            return res.status(400).json({ success: false, message: 'Missing fields.' });
        }
        if (captcha !== 'ABC123') {
            return res.status(400).json({ success: false, message: 'Captcha incorrect.' });
        }

        let users = loadUsers();
        const existingUser = users.find(u => u.email === email);
if (existingUser) {
    if (existingUser.verified) {
        return res.status(400).json({ success: false, message: 'You email is already verified.' });
    } else {
        return res.json({ success: true, message: 'Please verify your email.' });
    }
}

        users.push({ email, country, verified: false });
        saveUsers(users);

        const verificationUrl = `${process.env.BASE_URL}/api/verify?email=${encodeURIComponent(email)}`;

        await sendVerificationEmail(email, verificationUrl);
        console.log(`Verification email sent to ${email}`);

        res.json({ success: true });
    } catch (err) {
        console.error('Error in /api/register:', err);
        res.status(500).json({ error: 'Internal Server Error in /api/register' });
    }
});

module.exports = router;
