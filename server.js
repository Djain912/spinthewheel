require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Setup
const dbPath = path.join(__dirname, 'zootechx.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        createTable();
    }
});

function createTable() {
    db.run(`CREATE TABLE IF NOT EXISTS spins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        domain TEXT,
        discount INTEGER,
        couponCode TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}

// Email Sending Logic
async function sendCouponEmail(name, email, domain, discount, couponCode) {
    if (!email) {
        console.log("No email provided, skipping email send.");
        return;
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.log("Gmail credentials not configured. Check GMAIL_USER and GMAIL_APP_PASSWORD in .env");
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });

    const mailOptions = {
        from: `"ZooTechX" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: '🎉 Your ZooTechX Discount Coupon!',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; border-radius: 16px;">
                <h1 style="color: #00f2ff; text-align: center; font-size: 28px; margin-bottom: 10px;">🎊 Congratulations, ${name}!</h1>
                <p style="color: #ffffff; text-align: center; font-size: 18px; margin-bottom: 30px;">You just won a special discount from ZooTechX!</p>
                
                <div style="background: linear-gradient(135deg, #2a2a40 0%, #3a3a55 100%); padding: 30px; border-radius: 12px; text-align: center; border: 2px solid #00f2ff; margin-bottom: 30px;">
                    <p style="color: #bd00ff; font-size: 24px; font-weight: bold; margin: 0 0 10px 0;">${discount}% OFF</p>
                    <p style="color: #ffffff; font-size: 16px; margin: 0 0 20px 0;">on ${domain}</p>
                    <div style="background: #1a1a2e; padding: 15px 30px; border-radius: 8px; display: inline-block;">
                        <span style="color: #00f2ff; font-size: 28px; font-weight: bold; letter-spacing: 3px;">${couponCode}</span>
                    </div>
                </div>
                
                <p style="color: #aaaaaa; text-align: center; font-size: 14px;">Show this email at the ZooTechX desk to redeem your discount.</p>
                
                <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
                
                <p style="color: #666666; text-align: center; font-size: 12px;">Best regards,<br><strong style="color: #00f2ff;">ZooTechX Team</strong></p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${email}`);
    } catch (error) {
        console.error("Email Error:", error.message);
    }
}

// API Endpoint
app.post('/api/spin', (req, res) => {
    const { name, email, domain, discount, couponCode } = req.body;

    if (!name || !email) {
        return res.status(400).json({ allowed: false, message: "Name and Email are required." });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ allowed: false, message: "Please enter a valid email address." });
    }

    // Check if email already exists
    db.get("SELECT * FROM spins WHERE email = ?", [email.toLowerCase()], (err, row) => {
        if (err) {
            return res.status(500).json({ allowed: false, message: "Database Error" });
        }

        if (row) {
            return res.json({ allowed: false, message: "You have already spun the wheel with this email address." });
        }

        // Save new spin
        const stmt = db.prepare("INSERT INTO spins (name, email, domain, discount, couponCode) VALUES (?, ?, ?, ?, ?)");
        stmt.run(name, email.toLowerCase(), domain, discount, couponCode, function (err) {
            if (err) {
                return res.status(500).json({ allowed: false, message: "Database Save Error" });
            }

            // Send Email (Fire and forget to avoid blocking response)
            sendCouponEmail(name, email, domain, discount, couponCode);

            res.json({ allowed: true, success: true });
        });
        stmt.finalize();
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
