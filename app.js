const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 1. Cyberpunk Auth Page (Login / Register) Template
const authTemplate = () => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cyberpunk System Access</title>
    <style>
        body {
            background-color: #05050a;
            color: #00ffcc;
            font-family: 'Courier New', Courier, monospace;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .auth-card {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00ffcc;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0, 255, 204, 0.3);
            width: 90%;
            max-width: 380px;
            text-align: center;
        }
        h2 {
            font-size: 20px;
            color: #ff007f;
            text-shadow: 0 0 8px #ff007f;
            margin-bottom: 20px;
        }
        .input-group {
            margin-bottom: 15px;
            text-align: left;
        }
        label {
            display: block;
            font-size: 12px;
            margin-bottom: 5px;
            color: #00ffcc;
        }
        input {
            width: 100%;
            padding: 10px;
            background: #0d0d1a;
            border: 1px solid #00ffcc;
            color: #fff;
            border-radius: 4px;
            box-sizing: border-box;
            outline: none;
            font-family: inherit;
        }
        input:focus {
            box-shadow: 0 0 10px #00ffcc;
        }
        .btn-submit {
            width: 100%;
            background: #00ffcc;
            color: #05050a;
            border: none;
            padding: 12px;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.5);
            border-radius: 4px;
            margin-top: 10px;
        }
        .toggle-link {
            margin-top: 15px;
            font-size: 12px;
            color: #888;
            cursor: pointer;
            display: inline-block;
        }
        .toggle-link:hover {
            color: #ff007f;
        }
    </style>
</head>
<body>

    <div class="auth-card">
        <h2 id="form-title">ACCESS // LOGIN</h2>
        <form id="auth-form" action="/login" method="POST">
            <div class="input-group">
                <label>USERNAME</label>
                <input type="text" name="username" required autocomplete="off">
            </div>
            <div class="input-group">
                <label>PASSWORD</label>
                <input type="password" name="password" required>
            </div>
            <button type="submit" class="btn-submit" id="submit-btn">INITIALIZE</button>
        </form>
        <div class="toggle-link" id="toggle-link" onclick="toggleMode()">>> NEW_USER? REGISTER_NOW</div>
    </div>

    <script>
        let isSignup = false;
        function toggleMode() {
            isSignup = !isSignup;
            const title = document.getElementById('form-title');
            const form = document.getElementById('auth-form');
            const btn = document.getElementById('submit-btn');
            const toggleLink = document.getElementById('toggle-link');

            if (isSignup) {
                title.innerText = 'REGISTER // NEW';
                form.action = '/signup';
                btn.innerText = 'CREATE_ACCOUNT';
                toggleLink.innerText = '>> EXISTING_USER? LOGIN';
            } else {
                title.innerText = 'ACCESS // LOGIN';
                form.action = '/login';
                btn.innerText = 'INITIALIZE';
                toggleLink.innerText = '>> NEW_USER? REGISTER_NOW';
            }
        }
    </script>
</body>
</html>
`;

// 2. Cyberpunk OTP Receiver Page Template
const smsTemplate = (phoneNumber, messagesHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cyberpunk OTP Receiver</title>
    <style>
        body {
            background-color: #05050a;
            color: #00ffcc;
            font-family: 'Courier New', Courier, monospace;
            margin: 0;
            padding: 20px;
            text-align: center;
        }
        h1 {
            font-size: 24px;
            text-shadow: 0 0 10px #00ffcc;
            word-break: break-all;
        }
        .btn-copy {
            background-color: #00ffcc;
            color: #05050a;
            border: none;
            padding: 10px 20px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.5);
            margin-bottom: 20px;
            border-radius: 4px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #00ffcc;
            padding: 15px;
            box-shadow: 0 0 20px rgba(0, 255, 204, 0.2);
            background: rgba(0, 0, 0, 0.8);
            border-radius: 8px;
        }
        .section-title {
            text-align: left;
            font-size: 14px;
            color: #ff007f;
            text-shadow: 0 0 5px #ff007f;
            margin-bottom: 10px;
            border-bottom: 1px dashed #ff007f;
            padding-bottom: 5px;
        }
        .sms-card {
            background: rgba(0, 255, 204, 0.03);
            border: 1px solid #00ffcc;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
            box-shadow: 0 0 10px rgba(0, 255, 204, 0.15);
            text-align: left;
        }
        .sms-header {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #00ffcc;
            margin-bottom: 6px;
            border-bottom: 1px dashed rgba(0, 255, 204, 0.3);
            padding-bottom: 4px;
        }
        .sms-body {
            font-size: 13px;
            word-break: break-all;
            line-height: 1.4;
            color: #ffffff;
        }
        .no-msg {
            color: #888;
            padding: 20px;
            font-style: italic;
        }
    </style>
</head>
<body>

    <h1>+${phoneNumber}</h1>
    <button class="btn-copy" onclick="navigator.clipboard.writeText('+${phoneNumber}'); alert('Number Copied!');">COPY NUMBER</button>

    <div class="container">
        <div class="section-title">INCOMING_SMS_STREAM // LIVE</div>
        <div id="sms-container">
            ${messagesHtml}
        </div>
    </div>

</body>
</html>
`;

// Home Route - Login Page ပြသမည်
app.get('/', (req, res) => {
    res.send(authTemplate());
});

// Login & Signup Route များ
app.post('/login', (req, res) => {
    res.redirect('/numbers/12029462199/us');
});

app.post('/signup', (req, res) => {
    res.redirect('/numbers/12029462199/us');
});

// OTP Dashboard Route
app.get('/numbers/:id/:country', async (req, res) => {
    const { id, country } = req.params;
    
    try {
        const apiResponse = await axios.get(`https://api.example.com/messages?id=${id}&country=${country}`).catch(() => null);
        let messages = apiResponse && apiResponse.data ? apiResponse.data : [];

        let messagesHtml = '';

        if (!messages || messages.length === 0) {
            messagesHtml = '<div class="no-msg">No incoming messages detected yet...</div>';
        } else {
            messagesHtml = messages.map((msg, index) => {
                const textContent = typeof msg === 'string' ? msg : (msg.text || JSON.stringify(msg));
                const timeText = msg.time || 'Just now';

                return `
                    <div class="sms-card">
                        <div class="sms-header">
                            <span>SMS_PACKET #${index + 1}</span>
                            <span>${timeText}</span>
                        </div>
                        <div class="sms-body">
                            ${textContent}
                        </div>
                    </div>
                `;
            }).join('');
        }

        res.send(smsTemplate(id || '12029462199', messagesHtml));

    } catch (error) {
        const errHtml = `<div class="sms-card" style="border-color: #ff007f;">
            <div class="sms-header" style="color: #ff007f;">SYSTEM_ERROR</div>
            <div class="sms-body">Failed to fetch SMS stream. Please retry.</div>
        </div>`;
        res.send(smsTemplate('12029462199', errHtml));
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
