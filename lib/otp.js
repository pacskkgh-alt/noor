// رموز التحقق بالجوال عبر Authentica (رسائل SMS)
// نولّد الرمز بأنفسنا ونرسله عبر Authentica، ونتحقق منه هنا (مدة الصلاحية وعدد المحاولات تحت تحكمنا)
const crypto = require('crypto');

const API_KEY = process.env.AUTHENTICA_API_KEY || '';
const BASE = (process.env.AUTHENTICA_BASE_URL || 'https://api.authentica.sa/api/v2').replace(/\/+$/, '');
const TEMPLATE_ID = process.env.AUTHENTICA_TEMPLATE_ID || '';
// بدون مفتاح: وضع تجريبي يعرض الرمز على الشاشة بدل إرساله
const DEV_MODE = !API_KEY;

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_AFTER_S = 60;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_PHONE_HOUR = 5;
const MAX_SENDS_PER_IP_HOUR = 20;
const CHALLENGE_TTL_MS = 30 * 60 * 1000;

const challenges = new Map(); // id -> challenge
const sendLog = new Map();    // key -> [timestamps]

// يحوّل الرقم السعودي إلى الصيغة الدولية +9665XXXXXXXX، أو null إن كان غير صالح
function normalizePhone(input) {
  let d = String(input || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '');
  d = d.replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1);
  else if (/^5\d{8}$/.test(d)) d = '966' + d;
  return /^9665\d{8}$/.test(d) ? '+' + d : null;
}
function maskPhone(p) { return p ? p.slice(0, 5) + '•••••' + p.slice(-3) : ''; }

const hash = code => crypto.createHash('sha256').update(String(code)).digest('hex');
const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

function recent(key) {
  const now = Date.now();
  const list = (sendLog.get(key) || []).filter(t => now - t < 3600e3);
  sendLog.set(key, list);
  return list;
}

async function deliver(phone, code) {
  if (DEV_MODE) { console.log(`[وضع تجريبي] رمز التحقق إلى ${phone}: ${code}`); return; }
  const body = { method: 'sms', phone, otp: code };
  if (TEMPLATE_ID) body.template_id = Number(TEMPLATE_ID) || TEMPLATE_ID;
  let res, data = {};
  try {
    res = await fetch(BASE + '/send-otp', {
      method: 'POST',
      headers: { 'X-Authorization': API_KEY, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    console.error('Authentica: تعذّر الاتصال', e.message);
    throw Object.assign(new Error('otp_send_failed'), { code: 'otp_send_failed' });
  }
  if (!res.ok || data.success === false) {
    console.error('Authentica: فشل الإرسال', res.status, JSON.stringify(data).slice(0, 300));
    throw Object.assign(new Error('otp_send_failed'), { code: 'otp_send_failed' });
  }
}

function cleanup() {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (now - c.createdAt > CHALLENGE_TTL_MS) { challenges.delete(id); if (c.onExpire) try { c.onExpire(); } catch {} }
  }
}
setInterval(cleanup, 60e3).unref();

// ينشئ تحدياً جديداً. purpose: register | login | add_phone | reset | phone_change
function createChallenge(purpose, data = {}) {
  const c = { id: crypto.randomBytes(18).toString('base64url'), purpose, createdAt: Date.now(), attempts: 0, sentAt: 0, ...data };
  challenges.set(c.id, c);
  return c;
}
function getChallenge(id) {
  const c = challenges.get(String(id || ''));
  if (!c || Date.now() - c.createdAt > CHALLENGE_TTL_MS) return null;
  return c;
}
function dropChallenge(c) { challenges.delete(c.id); }

// يرسل رمزاً جديداً لرقم التحدي (مع حدود الإرسال)
async function sendCode(c, ip) {
  if (!c.phone) throw Object.assign(new Error('invalid_phone'), { code: 'invalid_phone' });
  const wait = RESEND_AFTER_S - Math.floor((Date.now() - c.sentAt) / 1000);
  if (c.sentAt && wait > 0) throw Object.assign(new Error('otp_wait'), { code: 'otp_wait', wait });
  if (recent('p:' + c.phone).length >= MAX_SENDS_PER_PHONE_HOUR || recent('i:' + ip).length >= MAX_SENDS_PER_IP_HOUR) {
    throw Object.assign(new Error('otp_rate_limited'), { code: 'otp_rate_limited' });
  }
  const code = newCode();
  if (!c.fake) await deliver(c.phone, code);
  recent('p:' + c.phone).push(Date.now());
  recent('i:' + ip).push(Date.now());
  Object.assign(c, { codeHash: hash(code), expires: Date.now() + CODE_TTL_MS, attempts: 0, sentAt: Date.now() });
  return DEV_MODE && !c.fake ? code : undefined;
}

// يتحقق من الرمز: يرجع true أو يرمي خطأ برمز مناسب
function checkCode(c, code) {
  if (!c.codeHash) throw Object.assign(new Error('otp_invalid'), { code: 'otp_invalid' });
  if (Date.now() > c.expires) throw Object.assign(new Error('otp_expired'), { code: 'otp_expired' });
  if (c.attempts >= MAX_ATTEMPTS) throw Object.assign(new Error('otp_too_many'), { code: 'otp_too_many' });
  c.attempts++;
  const given = hash(String(code || '').replace(/\D/g, ''));
  const ok = !c.fake && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(c.codeHash));
  if (!ok) {
    const left = MAX_ATTEMPTS - c.attempts;
    throw Object.assign(new Error(left > 0 ? 'otp_invalid' : 'otp_too_many'), { code: left > 0 ? 'otp_invalid' : 'otp_too_many', remaining: left });
  }
  c.codeHash = null;
  return true;
}

function publicChallenge(c, devCode) {
  return {
    challengeId: c.id, purpose: c.purpose, phoneMasked: c.fake || c.purpose === 'reset' ? '' : maskPhone(c.phone),
    resendIn: Math.max(0, RESEND_AFTER_S - Math.floor((Date.now() - c.sentAt) / 1000)),
    devCode, devMode: DEV_MODE,
  };
}

module.exports = {
  normalizePhone, maskPhone, createChallenge, getChallenge, dropChallenge, sendCode, checkCode, publicChallenge,
  DEV_MODE, RESEND_AFTER_S,
};
