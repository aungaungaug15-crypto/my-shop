require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'orders.json');
const USERS_FILE = path.join(__dirname, 'users.json');

const GOOGLE_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackUrl: process.env.GOOGLE_CALLBACK_URL
};

function getUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch (e) { return []; }
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getPhoneNumbersFromEnv() {
  const envPhones = process.env.MY_PHONES;
  if (!envPhones) return { us: [], mm: [] };
  const phones = envPhones.split(',').map(p => p.trim()).filter(Boolean);
  return {
    us: phones.filter(p => p.startsWith('+1')),
    mm: phones.filter(p => p.startsWith('+95'))
  };
}

function getOrders() {
  if (!fs.existsSync(DB_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { return []; }
}
function saveOrders(orders) {
  fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2));
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'myshopsecret2024',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 86400000 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null, success: null });
});

app.post('/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render('login', { error: 'ကျေးဇူးပြု၍ Gmail နှင့် Password အပြည့်အစုံထည့်ပါ။', success: null });
  }
  let users = getUsers();
  if (users.find(u => u.email === email)) {
    return res.render('login', { error: 'ဤ Gmail ဖြင့် အကောင့်ရှိပြီးသား ဖြစ်ပါသည်။', success: null });
  }
  users.push({ email, password, name: email.split('@')[0] });
  saveUsers(users);
  res.render('login', { error: null, success: 'အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်။ ကျေးဇူးပြု၍ အကောင့်ဝင်ပါ။' });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  let users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.render('login', { error: 'Gmail သို့မဟုတ် Password မှားယွင်းနေပါသည်။', success: null });
  }
  req.session.user = { name: user.name, email: user.email };
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/auth/google', (req, res) => {
  if (!GOOGLE_CONFIG.clientId || GOOGLE_CONFIG.clientId.includes('your_actual_google_client_id')) {
    return res.render('login', { error: '.env တွင် Google Client ID ကို မှန်ကန်စွာ ထည့်သွင်းပါ', success: null });
  }
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CONFIG.clientId}&redirect_uri=${encodeURIComponent(GOOGLE_CONFIG.callbackUrl)}&response_type=code&scope=email%20profile`;
  res.redirect(googleAuthUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/login');
  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CONFIG.clientId,
      client_secret: GOOGLE_CONFIG.clientSecret,
      redirect_uri: GOOGLE_CONFIG.callbackUrl,
      grant_type: 'authorization_code'
    });
    const { access_token } = tokenResponse.data;
    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const { name, email } = userResponse.data;
    req.session.user = { name, email };
    res.redirect('/');
  } catch (error) {
    res.redirect('/login');
  }
});

app.get('/', requireAuth, (req, res) => {
  const serviceId = '1';
  const serviceName = 'Telegram';
  const countries = [
    { id: 'mm', name: 'Myanmar', flag: '🇲🇲' },
    { id: 'us', name: 'United States', flag: '🇺🇸' }
  ];
  res.render('countries', { serviceId, serviceName, countries });
});

app.get('/numbers/:serviceId/:countryId', requireAuth, (req, res) => {
  const { serviceId, countryId } = req.params;
  const serviceName = 'Telegram';
  const countryNames = { 'mm': 'Myanmar', 'us': 'United States' };
  const countryFlags = { 'mm': '🇲🇲', 'us': '🇺🇸' };

  const envPhonesObj = getPhoneNumbersFromEnv();
  let filteredPhones = countryId === 'mm' ? envPhonesObj.mm : envPhonesObj.us;

  if (filteredPhones.length === 0) {
    filteredPhones = countryId === 'mm' ? ["+95991234567"] : ["+12029462199"];
  }

  let orders = getOrders();
  let currentOrders = orders.filter(o => String(o.serviceId) === String(serviceId) && o.countryId === countryId);

  if (currentOrders.length === 0) {
    const baseTime = Date.now();
    filteredPhones.forEach((phoneNum, index) => {
      orders.unshift({
        id: baseTime - (index * 1000),
        userName: req.session.user.name,
        userEmail: req.session.user.email,
        serviceId: serviceId,
        countryId: countryId,
        serviceName: serviceName,
        countryName: countryNames[countryId] || 'United States',
        countryFlag: countryFlags[countryId] || '🇺🇸',
        phone: phoneNum,
        messages: [{ id: 1, sender: 'System', code: '------', text: 'Waiting for live SMS...', time: 'Just now' }],
        price: 2000,
        status: 'ACTIVE',
        created_at: new Date().toLocaleString()
      });
    });
    saveOrders(orders);
    currentOrders = orders.filter(o => String(o.serviceId) === String(serviceId) && o.countryId === countryId);
  }

  res.render('numbers', {
    serviceId,
    countryId,
    serviceName,
    countryName: countryNames[countryId] || 'United States',
    countryFlag: countryFlags[countryId] || '🇺🇸',
    phones: currentOrders
  });
});

// ၁ မိနစ်အတွင်း ကျရောက်သော မက်ဆေ့န်းဂျာများကိုသာ Recent ဟု သတ်မှတ်ပေးသည့် ဖန်ရှင်
function extractSmsTime(fullText) {
  const lower = fullText.toLowerCase();
  
  // စာသားထဲတွင် မိနစ်ပိုင်း၊ စက္ကန့်ပိုင်းဆိုင်ရာ စကားလုံးများ ရှာဖွေခြင်း
  if (lower.includes('just now') || lower.includes('seconds ago') || lower.includes('sec ago')) {
    return 'Just now';
  }
  
  const minMatch = fullText.match(/(\d+)\s*(m|min|minutes?)\s*ago/i);
  if (minMatch) {
    const minutes = parseInt(minMatch[1], 10);
    if (minutes <= 1) {
      return '1 min ago'; // ၁ မိနစ် သို့မဟုတ် ထိုထက်နည်းပါက
    }
    return `${minutes} mins ago`;
  }

  const hourMatch = fullText.match(/(\d+)\s*(h|hr|hours?)\s*ago/i);
  if (hourMatch) {
    return `${hourMatch[1]} hr ago`;
  }

  return 'Older';
}

async function scrapeSmsForOrder(order) {
  try {
    const cleanPhone = order.phone.replace('+', '');
    const targetUrl = order.countryId === 'us' 
      ? `https://instantnum.com/countries/united-states/%2B${cleanPhone}`
      : `https://receive-smss.com/sms/${cleanPhone}/`;

    const { data } = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://instantnum.com/'
      },
      timeout: 12000
    });
    
    const $ = cheerio.load(data);
    let scrapedMessages = [];

    $('tr, .message-row, .sms-item, div').each((i, element) => {
      const text = $(element).text().trim();
      if (text.length > 5 && /\b\d{4,8}\b/.test(text)) {
        const tds = $(element).find('td');
        let sender = 'SMS Service';
        let smsText = text.replace(/\s+/g, ' ');

        if (tds.length >= 2) {
          sender = $(tds[0]).text().trim() || 'SMS Service';
          smsText = $(tds[1]).text().trim() || text;
        }

        const otpMatch = smsText.match(/\b\d{4,8}\b/);
        const code = otpMatch ? otpMatch[0] : '------';
        
        // အမှန်တကယ် ရခဲ့သည့် အချိန်ကို ထုတ်ယူခြင်း
        const actualTime = extractSmsTime(smsText);

        if (!scrapedMessages.some(m => m.text === smsText)) {
          scrapedMessages.push({
            id: scrapedMessages.length + 1,
            sender: sender,
            code: code,
            text: smsText,
            time: actualTime // တကယ်ကျလာသည့် အချိန်အတိအကျ (သို့) 1 min ago ကို ပြပေးမည်
          });
        }
      }
    });

    return scrapedMessages;
  } catch (error) {
    return [];
  }
}

app.get('/api/sync-sms/:orderId', requireAuth, async (req, res) => {
  let orders = getOrders();
  const order = orders.find(o => String(o.id) === String(req.params.orderId));
  if (!order) return res.json({ success: false, updated: false });

  const newMessages = await scrapeSmsForOrder(order);
  if (newMessages.length > 0) {
    order.messages = newMessages;
    saveOrders(orders);
    return res.json({ success: true, updated: true });
  }

  res.json({ success: true, updated: false });
});

app.get('/order/:id', requireAuth, async (req, res) => {
  let orders = getOrders();
  const currentId = req.params.id;
  const currentIndex = orders.findIndex(o => String(o.id) === String(currentId));

  if (currentIndex === -1) return res.redirect('/');

  const order = orders[currentIndex];
  const liveMessages = await scrapeSmsForOrder(order);
  if (liveMessages.length > 0) {
    order.messages = liveMessages;
    orders[currentIndex] = order;
    saveOrders(orders);
  }

  const sameGroupOrders = orders.filter(o => String(o.serviceId) === String(order.serviceId) && o.countryId === order.countryId);
  const groupIndex = sameGroupOrders.findIndex(o => String(o.id) === String(currentId));

  res.render('order', {
    order,
    prevOrder: groupIndex > 0 ? sameGroupOrders[groupIndex - 1] : null,
    nextOrder: groupIndex < sameGroupOrders.length - 1 ? sameGroupOrders[groupIndex + 1] : null,
    currentPageNum: groupIndex + 1,
    totalPages: sameGroupOrders.length
  });
});

app.listen(PORT, () => console.log(`Shop running at http://localhost:${PORT}`));
