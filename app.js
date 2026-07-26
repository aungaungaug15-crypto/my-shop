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

// စာသားများထဲမှ OTP Code များကို သီးသန့်ထုတ်ယူသည့် Function
const parseMessages = (data) => {
    let rawText = '';

    if (Array.isArray(data)) {
        rawText = data.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ');
    } else if (typeof data === 'object' && data !== null) {
        rawText = JSON.stringify(data);
    } else {
        rawText = String(data || '');
    }

    // OTP ရှာဖွေသည့် Regex Pattern
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

    if (extractedList.length === 0) {
        const generalNumbers = rawText.match(/\b\d{4,8}\b/g) || [];
        generalNumbers.forEach((num, index) => {
            if (num.length >= 4 && num.length <= 8) {
                extractedList.push({
                    code: num,
                    time: index === 0 ? 'Just now' : 'Older'
                });
            }
        });
    }

    // OTP အသစ်ဆုံးကို အပေါ်ဆုံးရောက်အောင် Reverse လှန်မည်
    return extractedList.reverse();
};

const htmlTemplate = (phoneNumber, messagesHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receive SMS Online - Free Virtual Number</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            background-color: #f4f6f9;
            color: #1e293b;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 30px 15px;
            display: flex;
            justify-content: center;
        }
        .main-wrapper {
            width: 100%;
            max-width: 680px;
        }
        .header-card {
            background: #ffffff;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            text-align: center;
            margin-bottom: 20px;
            border: 1px solid #e2e8f0;
        }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background-color: #e6f4ea;
            color: #137333;
            font-size: 12px;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 20px;
            margin-bottom: 12px;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            background-color: #1e8e3e;
            border-radius: 50%;
        }
        .phone-title {
            font-size: 28px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 16px;
            letter-spacing: -0.5px;
        }
        .btn-copy {
            background-color: #2563eb;
            color: #ffffff;
            border: none;
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }
        .btn-copy:hover {
            background-color: #1d4ed8;
        }
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
            padding: 0 4px;
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #334155;
        }
        .live-tag {
            font-size: 12px;
            color: #64748b;
        }
        .sms-card {
            background: #ffffff;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            transition: transform 0.15s ease;
        }
        .sms-card.latest {
            border-left: 4px solid #2563eb;
            background: #f8fafc;
        }
        .sms-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: #64748b;
            margin-bottom: 10px;
        }
        .sender-tag {
            font-weight: 600;
            color: #0f172a;
        }
        .badge-new {
            background-color: #dbeafe;
            color: #1e40af;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            margin-left: 6px;
        }
        .otp-container {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #f1f5f9;
            padding: 10px 14px;
            border-radius: 8px;
        }
        .otp-label {
            font-size: 12px;
            font-weight: 600;
            color: #475569;
            text-transform: uppercase;
        }
        .otp-code {
            font-size: 22px;
            font-weight: 700;
            color: #2563eb;
            letter-spacing: 2px;
            font-family: monospace;
        }
        .no-msg {
            background: #ffffff;
            border-radius: 10px;
            border: 1px dashed #cbd5e1;
            color: #64748b;
            padding: 30px;
            text-align: center;
            font-size: 14px;
        }
    </style>
</head>
<body>

    <div class="main-wrapper">
        <div class="header-card">
            <div class="status-badge">
                <span class="status-dot"></span> Online & Ready
            </div>
            <div class="phone-title">+${escapeHtml(phoneNumber)}</div>
            <button class="btn-copy" onclick="navigator.clipboard.writeText('+${escapeHtml(phoneNumber)}'); alert('Phone number copied!');">Copy Number</button>
        </div>

        <div class="section-header">
            <div class="section-title">Received Messages</div>
            <div class="live-tag">Auto-refreshing</div>
        </div>

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

        let parsedOtps = parseMessages(rawData);
        let messagesHtml = '';

        if (!parsedOtps || parsedOtps.length === 0) {
            messagesHtml = '<div class="no-msg">No incoming OTP messages detected yet.</div>';
        } else {
            messagesHtml = parsedOtps.map((item, index) => {
                const isLatest = index === 0;
                const timeTag = isLatest ? 'Just now' : 'Older';

                return `
                    <div class="sms-card ${isLatest ? 'latest' : ''}">
                        <div class="sms-meta">
                            <div>
                                <span class="sender-tag">Verification Service</span>
                                ${isLatest ? '<span class="badge-new">LATEST</span>' : ''}
                            </div>
                            <div>${escapeHtml(timeTag)}</div>
                        </div>
                        <div class="otp-container">
                            <span class="otp-label">OTP Code:</span>
                            <span class="otp-code">${escapeHtml(item.code)}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        res.send(htmlTemplate(id || '12029462199', messagesHtml));

    } catch (error) {
        const errHtml = `<div class="no-msg" style="color: #ef4444; border-color: #fca5a5;">Failed to fetch SMS stream. Please refresh.</div>`;
        res.send(htmlTemplate('12029462199', errHtml));
    }
});

app.get('/', (req, res) => {
    res.redirect('/numbers/12029462199/us');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
