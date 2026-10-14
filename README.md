# FatafatPay — FamPay Gmail IMAP Backend

A secure, standalone Node.js microservice designed to handle Gmail IMAP mailbox connections and parse FamPay credit notification emails for the FatafatPay payment gateway website.

---

## 1. Overview & Architecture

### The Problem
Traditional cPanel / shared hosting environments (such as ALC Hosting) often lack the compiled `php-imap` extension, producing the error:
```
PHP IMAP extension is not installed/enabled on the server.
```

### The Solution
This standalone Node.js service decouples IMAP reading from the PHP server:
1. **PHP Website (`FamPayGmailAPI.php`)** makes authenticated HTTPS POST requests to this backend.
2. **This Backend** connects securely to `imap.gmail.com:993` over TLS using `imapflow` and `mailparser`.
3. **Parsed Transactions** (`amount`, `utr`, `fam_txn_id`, `purpose`) are returned as clean JSON to PHP.
4. **The Main Website UI and database schema remain 100% unchanged.**

```
+-----------------------------------+
|   FatafatPay PHP Website          |
|   (Admin / Merchant / User)       |
+-----------------+-----------------+
                  | HTTPS (POST)
                  | Header: X-API-Key: <token>
                  v
+-----------------+-----------------+
|   Node.js Microservice            |
|   (Vercel / Render / VPS)         |
+-----------------+-----------------+
                  | TLS Port 993
                  v
+-----------------+-----------------+
|   Gmail IMAP (imap.gmail.com)     |
+-----------------------------------+
```

---

## 2. Environment Variables

Configure these environment variables in your deployment environment (Vercel, Render, VPS `.env`):

| Variable Name | Required | Default | Description |
|---|---|---|---|
| `FAMPAY_BACKEND_KEY` | **Yes** | _None_ | Strong shared secret API token (32+ characters) |
| `NODE_ENV` | Optional | `production` | Runtime environment (`production` or `development`) |
| `PORT` | Optional | `3000` | Port for standalone HTTP server |
| `GMAIL_HOST` | Optional | `imap.gmail.com` | IMAP server hostname |
| `GMAIL_PORT` | Optional | `993` | IMAP server port |
| `GMAIL_SECURE` | Optional | `true` | Use TLS (`true`) |
| `IMAP_TIMEOUT_MS` | Optional | `12000` | IMAP connection timeout in milliseconds |
| `SEARCH_DAYS` | Optional | `2` | Default days of emails to search |
| `FETCH_LIMIT` | Optional | `30` | Max messages to inspect per request |

---

## 3. How to Deploy to Vercel (Step-by-Step)

### Option A: Deploy via GitHub & Vercel Dashboard (Recommended)

1. **Create a new GitHub Repository:**
   - Go to [GitHub](https://github.com/new) and create a private repository named `fampay-imap-backend`.
   - Push the contents of the `fampay-imap-backend` folder to this repository:
     ```bash
     cd fampay-imap-backend
     git init
     git add .
     git commit -m "Initial commit of FamPay IMAP backend"
     git branch -M main
     git remote add origin https://github.com/your-username/fampay-imap-backend.git
     git push -u origin main
     ```

2. **Import into Vercel:**
   - Log in to your [Vercel Dashboard](https://vercel.com).
   - Click **Add New...** -> **Project**.
   - Select your `fampay-imap-backend` repository and click **Import**.

3. **Configure Environment Variables in Vercel:**
   - Under **Environment Variables**, add:
     - `FAMPAY_BACKEND_KEY` = `<Generate a random 32+ character key>` (e.g. `sk_live_fampay_9876543210abcdef123456`)
     - `NODE_ENV` = `production`
   - Click **Deploy**.

4. **Copy Your Deployment URL:**
   - Once deployed, Vercel gives you a URL like:
     `https://fampay-imap-backend.vercel.app`
   - Verify health: `https://fampay-imap-backend.vercel.app/api/health`

5. **Connect to Your PHP Website:**
   - Open `/workspace/calm-darwin/config/fampay.php` on your PHP server (or set environment variables on ALC Hosting).
   - Set:
     ```php
     'backend_url' => 'https://fampay-imap-backend.vercel.app',
     'api_key'     => 'sk_live_fampay_9876543210abcdef123456',
     ```

---

## 4. Alternative Hosting Options (If Vercel Encounters IP Constraints)

> **Important Note on Vercel & Gmail:**
> Vercel Serverless runs in AWS Lambda datacenters with dynamic IPs. In some cases, Google may flag high-frequency logins from serverless datacenter IP pools. If you observe connection throttling, you can deploy this same codebase to any persistent Node.js environment with a dedicated IP:

### Option B: Deploy to Render (Free / $7 Web Service)
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add Environment Variable `FAMPAY_BACKEND_KEY`.
5. Click **Create Web Service**.

### Option C: Deploy on cPanel / ALC Hosting (Node.js Selector)
If your ALC Hosting plan includes cPanel's **Setup Node.js App**:
1. Upload this `fampay-imap-backend` folder to your cPanel home directory.
2. In cPanel -> **Setup Node.js App** -> **Create Application**.
3. Set **Application root** to `fampay-imap-backend` and **Application startup file** to `server.js`.
4. Click **Run NPM Install**.
5. Add environment variable `FAMPAY_BACKEND_KEY`.
6. Start the application. It will run locally on your hosting server with zero latency!

---

## 5. API Endpoints Reference

### 1. Health Check
- **URL:** `GET /api/health`
- **Authentication:** None (Public)
- **Response:**
  ```json
  {
    "status": "ok",
    "service": "fampay-imap-backend",
    "version": "1.0.0",
    "timestamp": "2026-10-13T10:45:00.000Z",
    "env": "production",
    "authConfigured": true
  }
  ```

### 2. Test Connection
- **URL:** `POST /api/test-connection`
- **Authentication:** `X-API-Key: <token>` or `Authorization: Bearer <token>`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "user@gmail.com",
    "app_password": "xxxx xxxx xxxx xxxx"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Gmail connected successfully!"
  }
  ```
- **Failure Response (200 OK / 400):**
  ```json
  {
    "success": false,
    "message": "Gmail Login Failed: Invalid Email or App Password. Ensure 2-Step Verification is ON and you generated a 16-character App Password."
  }
  ```

### 3. Fetch Transactions
- **URL:** `POST /api/fetch-transactions`
- **Authentication:** `X-API-Key: <token>`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "user@gmail.com",
    "app_password": "xxxx xxxx xxxx xxxx",
    "days": 2,
    "limit": 30
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "transactions": [
      {
        "amount": 100.00,
        "utr": "663493224330",
        "fam_txn_id": "FMPU01a0d9ad-1726-7792-b41b-85baf06c9f67",
        "purpose": "ORD202609251C8992",
        "date": "2026-10-13T09:30:00.000Z",
        "raw": "Hey Pritam Bepari, You have successfully paid ₹100.00 Transaction ID : FMPU01a0d9ad-1726-7792-b41b-85baf06c9f67 UTR : 663493224330 Purpose : ORD202609251C8992"
      }
    ]
  }
  ```

---

## 6. Security Guarantees

1. **No Password Storage:** Gmail App Passwords are never stored on the Node.js backend. They are passed only in transient memory during active IMAP calls.
2. **Timing-Safe Auth:** API authentication utilizes constant-time string comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
3. **No Sensitive Logging:** IMAP wire traffic and passwords are explicitly silenced (`logger: false`).
4. **Input Sanitization:** All incoming email bodies are stripped of scripts, styles, and tags before regex evaluation.
