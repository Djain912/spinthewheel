# ZooTechX Spin the Wheel

A promotional "Spin the Wheel" web application for ZooTechX.

## Features
- Interactive Spin Wheel with animations.
- SMS Integration (Fast2SMS / Twilio).
- Email Integration (Nodemailer).
- Lead capture (Name & Phone).
- SQLite Database for storing spins.
- Duplicate check (One spin per phone number).

## Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Variables**
    The project comes with a `.env` file pre-configured with the credentials provided (Fast2SMS, Twilio, Gmail).
    *Note: For Gmail sending to work, ensure the App Password in .env is valid and 2FA is enabled on the account.*

3.  **Run the Server**
    ```bash
    npm start
    ```
    The server will start on `http://localhost:3000`.

## API Endpoints

- `POST /api/spin`
    - Body: `{ name, phone, domain, discount, couponCode }`
    - Response: `{ allowed: boolean, success: boolean, message?: string }`

## Project Structure

- `server.js`: Main backend logic.
- `public/`: Frontend assets (HTML, CSS, JS).
- `zootechx.db`: SQLite database (created on first run).
