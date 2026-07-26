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

// ရှုပ်ထွေးနေသော စာသားများထဲမှ OTP Code များနှင့် စာများကို ခွဲထုတ်ပေးသည့် Function
const parseMessages = (data) => {
    let rawText = '';

    if (Array.isArray(data)) {
        rawText = data.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ');
    } else if (typeof data === 'object' && data !== null) {
        rawText = JSON.stringify(data);
    } else {
        rawText = String(data || '');
    }

    // "Your code is: 123456" သို့မဟုတ် "verification code 123456" စသည့် ပုံစံများကို တိတိကျကျ ရှာမည်
    const otpKeywordsRegex = /(?:code|verification|otp|is)[:\s]*([0-9]{4,8})/gi;
    const extractedList = [];
    let match;

    while ((match = otpKeywordsRegex.exec(rawText)) !== null) {
        if (match[1]) {
            extractedList.push({
                code: match[1],
                time: extractedList.length === 0 ? 'Just now' : 'Older'
            });
        }
    }

    // အကယ်၍ Keyword မပါဘဲ ဂဏန်း သီးသန့်ဖြစ်နေပါက
    if (extractedList.length === 0) {
        const generalNumbers = rawText.match(/\b\d{4,8}\b/g) || [];
        // mins ago စသည့် စာသားဘေးက ဂဏန်းအရှည်ကြီးများကို ဖယ်ထုတ်ပါမည်
        generalNumbers.forEach((num, index) => {
            if (num.length >= 4 && num.length <= 8) {
                extractedList.push({
                    code: num,
                    time: index === 0 ? 'Just now' : 'Older'
                });
            }
        });
    }

    // အသစ်ဆုံး OTP ကို အပေါ်ဆုံးရောက်စေရန် Array ကို ပြောင်းပြန် (Reverse) လှန်ပေးမည်
    return extractedList.reverse();
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
        .sms-card.latest {
            border-color: #ff007f;
            box-shadow: 0 0 15px rgba(255, 0, 127, 0.4);
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
            font-size: 22px;
            font-weight: bold;
            padding: 6px 14px;
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
        let rawData = apiResponse && apiResponse.data ? apiResponse.data : [];

        // စာအုပ်ကြီးလို ရှုပ်နေသော String ထဲမှ OTP များကို သန့်စင်ပြီး ခွဲထုတ်ပါမည်
        let parsedOtps = parseMessages(rawData);

        let messagesHtml = '';

        if (!parsedOtps || parsedOtps.length === 0) {
            messagesHtml = '<div class="no-msg">No valid OTP messages detected yet...</div>';
        } else {
            messagesHtml = parsedOtps.map((item, index) => {
                const isLatest = index === 0;
                const timeTag = isLatest ? 'LATEST // JUST NOW' : 'OLDER';

                return `
                    <div class="sms-card ${isLatest ? 'latest' : ''}">
                        <div class="sms-header">
                            <span>SMS_SERVICE ${isLatest ? '[NEW]' : ''}</span>
                            <span>${escapeHtml(timeTag)}</span>
                        </div>
                        <div class="sms-body">
                            <div>OTP_CODE:</div>
                            <div class="otp-box">${escapeHtml(item.code)}</div>
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
