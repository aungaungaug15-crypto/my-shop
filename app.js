const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Cyberpunk Theme ပါဝင်သော HTML Template
const htmlTemplate = (phoneNumber, messagesHtml) => `
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

// ဖုန်းနံပါတ်အလိုက် SMS များကို ဆွဲထုတ်ပြသသည့် Route
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

        res.send(htmlTemplate(id || '12029462199', messagesHtml));

    } catch (error) {
        const errHtml = `<div class="sms-card" style="border-color: #ff007f;">
            <div class="sms-header" style="color: #ff007f;">SYSTEM_ERROR</div>
            <div class="sms-body">Failed to fetch SMS stream. Please retry.</div>
        </div>`;
        res.send(htmlTemplate('12029462199', errHtml));
    }
});

// Home Route
app.get('/', (req, res) => {
    res.redirect('/numbers/12029462199/us');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
