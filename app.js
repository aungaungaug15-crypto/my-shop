const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// XSS ကာကွယ်ရန် သန့်စင်သည့် Function
const escapeHtml = (str) => {
    if (typeof str !== 'string') str = String(str);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// စာသားထဲမှ OTP Code သို့မဟုတ် ဂဏန်းများကိုသာ သီးသန့်ရှာပေးသည့် Function
const extractOtp = (text) => {
    // စာသားထဲတွင် ၄ လုံးမှ ၈ လုံးအထိပါသော ဂဏန်း (OTP Code) ကို ရှာမည်
    const match = text.match(/\b\d{4,8}\b/);
    return match ? match[0] : null;
};

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
        .otp-box {
            display: inline-block;
            background-color: rgba(255, 0, 127, 0.2);
            border: 1px solid #ff007f;
            color: #ff007f;
            font-size: 20px;
            font-weight: bold;
            padding: 6px 12px;
            border-radius: 4px;
            letter-spacing: 2px;
            margin-top: 5px;
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

    <h1>+${escapeHtml(phoneNumber)}</h1>
    <button class="btn-copy" onclick="navigator.clipboard.writeText('+${escapeHtml(phoneNumber)}'); alert('Number Copied!');">COPY NUMBER</button>

    <div class="container">
        <div class="section-title">INCOMING_SMS_STREAM // LIVE</div>
        <div id="sms-container">
            ${messagesHtml}
        </div>
    </div>

</body>
</html>
`;

app.get('/numbers/:id/:country', async (req, res) => {
    const { id, country } = req.params;
    
    try {
        const apiResponse = await axios.get(`https://api.example.com/messages?id=${encodeURIComponent(id)}&country=${encodeURIComponent(country)}`).catch(() => null);
        let messages = apiResponse && apiResponse.data ? apiResponse.data : [];

        // စာသားအရှည်ကြီးတွေနဲ့ OTP မပါတဲ့ ရှုပ်ထွေးနေသော message တွေကို Filter ပစ်ပါမည်
        let validMessages = messages.filter(msg => {
            const rawText = typeof msg === 'string' ? msg : (msg.text || JSON.stringify(msg));
            return extractOtp(rawText) !== null; // OTP ဂဏန်းပါမှသာ လက်ခံမည်
        });

        let messagesHtml = '';

        if (!validMessages || validMessages.length === 0) {
            messagesHtml = '<div class="no-msg">No valid OTP messages detected yet...</div>';
        } else {
            messagesHtml = validMessages.map((msg, index) => {
                const rawText = typeof msg === 'string' ? msg : (msg.text || JSON.stringify(msg));
                const otpCode = extractOtp(rawText);
                const timeText = msg.time || (index === 0 ? 'Just now' : 'Older');

                return `
                    <div class="sms-card">
                        <div class="sms-header">
                            <span>SMS_SERVICE</span>
                            <span>${escapeHtml(timeText)}</span>
                        </div>
                        <div class="sms-body">
                            <div>OTP_CODE:</div>
                            <div class="otp-box">${escapeHtml(otpCode)}</div>
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

app.get('/', (req, res) => {
    res.redirect('/numbers/12029462199/us');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
