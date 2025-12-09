require('dotenv').config();
const express = require('express');
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
console.log('TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL ? '✓ Set' : '✗ NOT SET (using local SQLite)');
console.log('=========================');

// Database Setup - Use Turso if configured, otherwise local SQLite
let db;
let useTurso = false;

async function initDatabase() {
    if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
        // Use Turso Cloud Database
        console.log('🌐 Using Turso Cloud Database...');
        const { createClient } = require('@libsql/client');
        db = createClient({
            url: process.env.TURSO_DATABASE_URL,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });
        useTurso = true;

        // Create table in Turso
        try {
            await db.execute(`CREATE TABLE IF NOT EXISTS spins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE,
                domain TEXT,
                discount INTEGER,
                couponCode TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log('✅ Turso database table ready.');
        } catch (err) {
            console.error('Turso table creation error:', err.message);
        }
    } else {
        // Use local SQLite
        console.log('💾 Using local SQLite database...');
        const sqlite3 = require('sqlite3').verbose();
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;
        const dbPath = isProduction
            ? '/tmp/zootechx.db'
            : path.join(__dirname, 'zootechx.db');

        console.log('Database path:', dbPath);

        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database', err.message);
            } else {
                console.log('✅ Connected to SQLite database.');
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
        });
    }
}

// Database helper functions
async function checkEmailExists(email) {
    if (useTurso) {
        const result = await db.execute({
            sql: "SELECT * FROM spins WHERE email = ?",
            args: [email]
        });
        return result.rows.length > 0 ? result.rows[0] : null;
    } else {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM spins WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

async function insertSpin(name, email, domain, discount, couponCode) {
    if (useTurso) {
        await db.execute({
            sql: "INSERT INTO spins (name, email, domain, discount, couponCode) VALUES (?, ?, ?, ?, ?)",
            args: [name, email, domain, discount, couponCode]
        });
        return true;
    } else {
        return new Promise((resolve, reject) => {
            db.run(
                "INSERT INTO spins (name, email, domain, discount, couponCode) VALUES (?, ?, ?, ?, ?)",
                [name, email, domain, discount, couponCode],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }
}

async function getAllSpins() {
    if (useTurso) {
        const result = await db.execute("SELECT * FROM spins ORDER BY createdAt DESC");
        return result.rows;
    } else {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM spins ORDER BY createdAt DESC", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
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
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false
        },
        // Add specific timeouts
        connectionTimeout: 10000,
        greetingTimeout: 10000
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

// Health check endpoint
app.get('/api/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: {
            port: PORT,
            gmailUser: process.env.GMAIL_USER ? 'configured' : 'NOT SET',
            gmailPassword: process.env.GMAIL_APP_PASSWORD ? 'configured' : 'NOT SET',
            database: useTurso ? 'Turso Cloud' : 'Local SQLite',
            tursoUrl: process.env.TURSO_DATABASE_URL ? 'configured' : 'NOT SET'
        }
    };
    res.json(health);
});

// Get all spins
app.get('/api/spins', async (req, res) => {
    try {
        const spins = await getAllSpins();
        res.json({ count: spins.length, spins });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Endpoint
app.post('/api/spin', async (req, res) => {
    const { name, email, domain, discount, couponCode } = req.body;

    console.log(`\n=== New Spin Request ===`);
    console.log(`Name: ${name}, Email: ${email}, Domain: ${domain}`);

    if (!name || !email) {
        return res.status(400).json({ allowed: false, message: "Name and Email are required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ allowed: false, message: "Please enter a valid email address." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
        // Check if email already exists
        const existingRow = await checkEmailExists(normalizedEmail);

        if (existingRow) {
            console.log(`❌ Email ${normalizedEmail} already used.`);
            return res.json({ allowed: false, message: "You have already spun the wheel with this email address." });
        }

        // Save new spin
        await insertSpin(name, normalizedEmail, domain, discount, couponCode);
        console.log(`✅ Spin saved for ${normalizedEmail}`);

        // Send Email (Fire and forget)
        sendCouponEmail(name, email, domain, discount, couponCode);

        res.json({ allowed: true, success: true });
    } catch (err) {
        console.error('Database error:', err.message);
        res.status(500).json({ allowed: false, message: "Database Error: " + err.message });
    }
});

// Initialize database and start server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
        console.log(`📋 View spins: http://localhost:${PORT}/api/spins`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
