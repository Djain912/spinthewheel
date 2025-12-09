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

// Log environment variable status on startup
console.log('=== Environment Check ===');
console.log('PORT:', PORT);
console.log('GMAIL_USER:', process.env.GMAIL_USER ? '✓ Set' : '✗ NOT SET');
console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✓ Set' : '✗ NOT SET');
console.log('=========================');

// Database Setup - Use /tmp for Render compatibility
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
const dbPath = isProduction
    ? '/tmp/zootechx.db'  // Render's writable directory
    : path.join(__dirname, 'zootechx.db');

console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database at:', dbPath);
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
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Spins table ready.');
        }
    });
}

// Email Sending Logic with better error handling
async function sendCouponEmail(name, email, domain, discount, couponCode) {
    console.log(`\n=== Attempting to send email to: ${email} ===`);

    if (!email) {
        console.log("❌ No email provided, skipping email send.");
        return { success: false, error: 'No email provided' };
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.log("❌ Gmail credentials not configured!");
        console.log("   GMAIL_USER:", process.env.GMAIL_USER ? 'Set' : 'MISSING');
        console.log("   GMAIL_APP_PASSWORD:", process.env.GMAIL_APP_PASSWORD ? 'Set' : 'MISSING');
        return { success: false, error: 'Gmail credentials not configured' };
    }

    console.log(`📧 Sending email from: ${process.env.GMAIL_USER}`);

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
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${email}`);
        console.log(`   Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`❌ Email Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Health check endpoint - useful for debugging on Render
app.get('/api/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: {
            port: PORT,
            gmailUser: process.env.GMAIL_USER ? 'configured' : 'NOT SET',
            gmailPassword: process.env.GMAIL_APP_PASSWORD ? 'configured' : 'NOT SET',
            nodeEnv: process.env.NODE_ENV || 'development',
            isRender: !!process.env.RENDER
        },
        database: dbPath
    };
    res.json(health);
});

// Get all spins (for debugging)
app.get('/api/spins', (req, res) => {
    db.all("SELECT id, name, email, domain, discount, couponCode, createdAt FROM spins ORDER BY createdAt DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ count: rows.length, spins: rows });
    });
});

// API Endpoint
app.post('/api/spin', (req, res) => {
    const { name, email, domain, discount, couponCode } = req.body;

    console.log(`\n=== New Spin Request ===`);
    console.log(`Name: ${name}, Email: ${email}, Domain: ${domain}`);

    if (!name || !email) {
        return res.status(400).json({ allowed: false, message: "Name and Email are required." });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ allowed: false, message: "Please enter a valid email address." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    db.get("SELECT * FROM spins WHERE email = ?", [normalizedEmail], (err, row) => {
        if (err) {
            console.error('Database query error:', err.message);
            return res.status(500).json({ allowed: false, message: "Database Error" });
        }

        if (row) {
            console.log(`❌ Email ${normalizedEmail} already used.`);
            return res.json({ allowed: false, message: "You have already spun the wheel with this email address." });
        }

        // Save new spin
        const stmt = db.prepare("INSERT INTO spins (name, email, domain, discount, couponCode) VALUES (?, ?, ?, ?, ?)");
        stmt.run(name, normalizedEmail, domain, discount, couponCode, function (err) {
            if (err) {
                console.error('Database insert error:', err.message);
                return res.status(500).json({ allowed: false, message: "Database Save Error" });
            }

            console.log(`✅ Spin saved for ${normalizedEmail} (ID: ${this.lastID})`);

            // Send Email (Fire and forget to avoid blocking response)
            sendCouponEmail(name, email, domain, discount, couponCode);

            res.json({ allowed: true, success: true });
        });
        stmt.finalize();
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
