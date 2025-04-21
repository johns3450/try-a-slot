const fs = require('fs');
const path = require('path');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const USERS_FILE = path.join(__dirname, 'users.json');

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

async function sendVerificationEmail(toEmail, verificationUrl) {

    const msg = {
        to: toEmail,
        from: { email: process.env.SENDER_EMAIL, name: "TRY'A'SLOT" },
        subject: "Verify Your Email for TRY'A'SLOT",
        text: `Please verify your email by clicking this link: ${verificationUrl}`,
        html: `
            <!-- Pre‑header: hidden snippet for inbox preview -->
            <div style="
                display:none;
                font-size:1px;
                color:#f2f2f2;
                line-height:1px;
                max-height:0;
                max-width:0;
                opacity:0;
                overflow:hidden;
            ">
                Click to verify your email and unlock 25,000+ slot demo games instantly!
            </div>

            <div style="background-color:#f2f2f2;padding:40px;">
                <div style="
                    max-width:600px;
                    margin:0 auto;
                    background-color:#fff;
                    padding:20px;
                    border-radius:8px;
                    text-align:center;
                    font-family:Arial,sans-serif;
                    font-size:14px;
                    color:#111;
                ">
                    <img
  src="https://tryaslot.com/assets/logo.png"
  alt="TRY'A'SLOT"
  width="175"
  style="width:100%; max-width:175px; height:auto; margin:0 auto 20px; display:block;"
/>
                    <h2>Verify Your Email 🚀</h2>
                    <p>
                        Please verify your email for <strong>TRY'A'SLOT</strong> by clicking the button below:
                    </p>
                    <p style="text-align:center;">
                        <a
                            href="${verificationUrl}"
                            style="
                                display:inline-block;
                                background-color:#eb2f06;
                                color:#fff;
                                font-weight:600;
                                font-size:16px;
                                padding:8px 25px;
                                text-decoration:none;
                                border-radius:4px;
                            "
                        >
                            Verify Email
                        </a>
                    </p>
                    <p>
                        Once you verify, you’ll be able to play
                        <strong>25,000+ slot demo games</strong> from
                        <strong>400+ providers</strong> instantly.
                    </p>
                    <p style="font-size:14px;color:#111;">
                        If the button doesn’t work, copy and paste this link into your browser:
                    </p>
                    <p style="font-size:14px;color:#111;">
                        ${verificationUrl}
                    </p>
                    <p style="font-size:12px;color:#ccc;margin-top:30px;">
  Didn't request this email?
  <a href="https://tryaslot.com/delete.html?email=${toEmail}" style="color:#ccc;text-decoration:none;">
    Click here
  </a> to permanently remove all data associated with your email.
</p>
                </div>
            </div>
        `,
        
    };

    return sgMail.send(msg);
}

module.exports = { loadUsers, saveUsers, sendVerificationEmail };
