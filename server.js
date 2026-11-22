// منصة نور — الخادم
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store');
const media = require('./lib/media');
const otp = require('./lib/otp');
const studies = require('./lib/studies');

const { db, save, uid, UPLOADS } = store;
const compression = require('compression');
const app = express();
app.use(compression({ filter: (req, res) => !/^\/api\/(files|s)\//.test(req.path) && compression.filter(req, res) }));
const PORT = process.env.PORT || 3000;
const SESSION_DAYS = 7;

app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  if (MAINTENANCE && req.method === 'POST' && /^\/api\/(auth\/register|files$|shares$)/.test(req.path)) {
    return res.status(503).json({ error: 'maintenance' });
  }
  next();
});

// ---------- أدوات مساعدة ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}
function log(req, userId, action, details = {}) {
  db.activity.unshift({
    id: uid(), userId, action, details,
    ip: req.ip, at: new Date().toISOString(),
  });
  if (db.activity.length > 5000) db.activity.length = 5000;
}
function shareKey(share) {
  return crypto.createHmac('sha256', store.SECRET).update('share:' + share.id + ':' + share.token).digest('hex').slice(0, 32);
}
function shareActive(s) {
  return !s.revoked && new Date(s.expiresAt) > new Date();
}
function storedPath(name) { return path.join(UPLOADS, name); }
function sendStoredFile(req, res, file, download) {
  if (file.kind === 'dicom' && file.series) return sendStudy(req, res, file, download);
  const type = file.kind === 'pdf' ? 'application/pdf' : (file.mime || 'application/octet-stream');
  sendPath(res, storedPath(file.storedName), type, file.originalName, download);
}
const safeName = v => String(v || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 80) || 'file';
// دراسة أشعة: ?series=رقم&slice=رقم لصورة، ?attachment=id لمرفق، ?download=1 للدراسة كاملة ZIP (مجلد لكل سلسلة)
function sendStudy(req, res, f, download) {
  if (req.query.attachment) {
    const a = (f.attachments || []).find(x => x.id === req.query.attachment);
    if (!a) return res.status(404).json({ error: 'not_found' });
    return sendPath(res, storedPath(a.storedName), a.mime || 'application/pdf', a.originalName, download);
  }
  if (download) {
    const entries = [];
    f.series.forEach((s, k) => {
      const dir = `${String(Number.isFinite(s.number) ? s.number : k + 1).padStart(2, '0')} ${safeName(s.description || s.modality || 'series')}`;
      const pad = String(s.slices.length).length;
      s.slices.forEach((x, i) => entries.push({ name: `${safeName(f.title)}/${dir}/${String(i + 1).padStart(Math.max(4, pad), '0')}.dcm`, path: storedPath(x.n) }));
    });
    (f.attachments || []).forEach(a => entries.push({ name: `${safeName(f.title)}/${safeName(a.originalName)}`, path: storedPath(a.storedName) }));
    return media.sendZip(res, entries, safeName(f.title) + '.zip');
  }
  const s = f.series[Math.min(Math.max(parseInt(req.query.series, 10) || 0, 0), f.series.length - 1)];
  if (!s) return res.status(404).json({ error: 'not_found' });
  const i = Math.min(Math.max(parseInt(req.query.slice, 10) || 0, 0), s.slices.length - 1);
  sendPath(res, storedPath(s.slices[i].n), 'application/dicom', `${i + 1}.dcm`, false);
}
// تسجيل المشاهدة مرة واحدة كل 10 دقائق لكل ملف (العارض يطلب مئات الصور)
const recentViews = new Map();
function shouldLogView(key) {
  const now = Date.now(), last = recentViews.get(key) || 0;
  if (now - last < 600e3) return false;
  recentViews.set(key, now);
  return true;
}
function sendPath(res, p, type, name, download) {
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(p, { headers: { 'Content-Type': type } });
}
function removeFileFromDisk(file) {
  for (const n of studies.storedNamesOf(file)) { try { fs.unlinkSync(storedPath(n)); } catch {} }
}
function unlinkQuiet(p) { try { fs.unlinkSync(p); } catch {} }
// الحذف بقرار الأدمن: ما يحذفه المستخدم يُخفى فقط (سلة المحذوفات) ولا يُمسح إلا بقرار الأدمن
const live = f => f && !f.deletedAt;
const liveFile = id => { const f = db.files.find(x => x.id === id); return live(f) ? f : null; };

// قفل الأمان: على Render بدون قرص دائم لا نقبل بيانات جديدة (ستُمسح مع أول تحديث)
const MAINTENANCE = !!process.env.RENDER && !store.PERSISTENT && process.env.NOOR_ALLOW_TEMP !== '1';
if (MAINTENANCE) console.warn('🔒 وضع الصيانة: التسجيل والرفع والمشاركة متوقفة حتى يُربط القرص الدائم.');

// ---------- طابور ضغط الفيديو (ملف واحد في كل مرة) ----------
const videoQueue = [];
let videoBusy = false;
function enqueueVideo(id) { videoQueue.push(id); runVideoQueue(); }
async function runVideoQueue() {
  if (videoBusy || !videoQueue.length) return;
  videoBusy = true;
  const id = videoQueue.shift();
  const f = db.files.find(x => x.id === id);
  try {
    if (f && f.processing) {
      const r = await media.compressVideo(UPLOADS, f.storedName);
      const still = db.files.find(x => x.id === f.id);
      if (r && still) {
        unlinkQuiet(storedPath(still.storedName));
        Object.assign(still, { storedName: r.storedName, size: r.size, originalSize: r.originalSize, mime: r.mime, originalName: still.originalName.replace(/\.[^.]+$/, '') + '.mp4' });
      } else if (r) unlinkQuiet(storedPath(r.storedName));
      if (still) still.processing = false;
      save();
    }
  } catch (e) {
    console.error('video compression error', e);
    if (f) { f.processing = false; save(); }
  } finally {
    videoBusy = false;
    runVideoQueue();
  }
}

// ---------- الجلسات ----------
app.use((req, res, next) => {
  const sid = parseCookies(req).noor_sid;
  const s = sid && db.sessions[sid];
  if (s && new Date(s.expires) > new Date()) {
    const u = db.users.find(x => x.id === s.userId);
    if (u && u.status === 'active') req.user = u;
  }
  next();
});
function auth(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}
function startSession(res, user) {
  const sid = crypto.randomBytes(32).toString('hex');
  db.sessions[sid] = { userId: user.id, expires: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString() };
  res.setHeader('Set-Cookie', `noor_sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
}

// ---------- رفع الملفات ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, f, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(f.originalname).toLowerCase()),
  }),
  limits: { fileSize: 500 * 1024 * 1024, files: 3000 },
  fileFilter: (req, f, cb) => {
    // multer يقرأ أسماء الملفات بترميز latin1 — نعيدها إلى UTF-8 حتى تظهر الأسماء العربية
    f.originalname = Buffer.from(f.originalname, 'latin1').toString('utf8');
    cb(null, true); // يُتحقق من النوع بعد الحفظ (بعض ملفات الأشعة بلا امتداد)
  },
});

// ================= المصادقة =================
// التحقق بالجوال (Authentica) للمرضى والأطباء. الأدمن والحسابات التجريبية معفاة.
const needsOtp = u => ['patient', 'doctor'].includes(u.role) && !u.demo;
// الحسابات التجريبية: تعمل فقط على جهاز التطوير (أو إذا فُعّلت صراحة بـ NOOR_DEMO=1). على Render معطّلة تماماً
const DEMO = process.env.NOOR_DEMO === '1' || (!process.env.RENDER && process.env.NOOR_DEMO !== '0');
const phoneTaken = (phone, exceptId) => db.users.some(u => u.phone === phone && u.id !== exceptId);

function otpError(res, e) {
  const status = { otp_wait: 429, otp_rate_limited: 429, otp_send_failed: 502 }[e.code] || 400;
  return res.status(status).json({ error: e.code || 'server_error', wait: e.wait, remaining: e.remaining });
}
async function startOtp(req, res, c, extra = {}) {
  try {
    const devCode = await otp.sendCode(c, req.ip);
    if (!c.fake) log(req, c.userId || null, 'otp_sent', { purpose: c.purpose, phone: otp.maskPhone(c.phone) });
    save();
    res.json({ otpRequired: true, ...otp.publicChallenge(c, devCode), ...extra });
  } catch (e) {
    if (c.purpose === 'register' && e.code !== 'otp_wait') { otp.dropChallenge(c); if (c.onExpire) c.onExpire(); }
    otpError(res, e);
  }
}

app.post('/api/auth/register', upload.single('license'), (req, res) => {
  const { name, email, password, role, phone, specialty, licenseNumber } = req.body;
  const cleanup = () => req.file && fs.unlink(req.file.path, () => {});
  if (!name || !email || !password || !['patient', 'doctor'].includes(role)) {
    cleanup(); return res.status(400).json({ error: 'missing_fields' });
  }
  if (password.length < 8) { cleanup(); return res.status(400).json({ error: 'weak_password' }); }
  const em = String(email).trim().toLowerCase();
  const ph = otp.normalizePhone(phone);
  // الإيميل والجوال يبقيان محجوزين لحساب محذوف (يستطيع الأدمن استرجاعه بملفاته)
  if (db.users.some(u => u.status === 'deleted' && (u.email === em || (ph && u.phone === ph)))) { cleanup(); return res.status(409).json({ error: 'account_deleted' }); }
  if (db.users.some(u => u.email === em)) { cleanup(); return res.status(409).json({ error: 'email_taken' }); }
  if (!ph) { cleanup(); return res.status(400).json({ error: 'invalid_phone' }); }
  if (phoneTaken(ph)) { cleanup(); return res.status(409).json({ error: 'phone_taken' }); }
  const user = {
    id: uid(), name: String(name).trim(), email: em, phone: ph, phoneVerified: false,
    role, status: 'active', passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  if (role === 'doctor') {
    const lk = req.file && media.detectKind(req.file.path, req.file.originalname);
    if (!specialty || !licenseNumber || !req.file || !['pdf', 'image'].includes(lk)) { cleanup(); return res.status(400).json({ error: 'doctor_fields' }); }
    user.doctor = {
      specialty, licenseNumber, verification: 'pending',
      licenseFile: { storedName: req.file.filename, originalName: req.file.originalname, mime: req.file.mimetype, kind: lk },
    };
  }
  // لا يُنشأ الحساب إلا بعد التحقق من الجوال
  const c = otp.createChallenge('register', { phone: ph, pendingUser: user, onExpire: cleanup });
  startOtp(req, res, c);
});

function handleLogin(adminOnly) {
  return (req, res) => {
    const { email, password } = req.body || {};
    const u = db.users.find(x => x.email === String(email || '').trim().toLowerCase());
    // الأدمن يدخل من صفحته الخاصة فقط، ولا يدخل غيره منها
    const wrongDoor = u && (adminOnly ? u.role !== 'admin' : u.role === 'admin');
    if (!u || wrongDoor || (u.demo && !DEMO) || !checkPassword(String(password || ''), u.passwordHash)) {
      log(req, u ? u.id : null, 'login_failed', { email });
      save();
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    if (u.status === 'deleted') return res.status(403).json({ error: 'account_deleted' });
    if (u.status !== 'active') return res.status(403).json({ error: 'account_suspended' });
    if (needsOtp(u)) {
      // حساب قديم بلا رقم موثّق: يضيف رقمه أولاً
      if (!u.phone || !u.phoneVerified) {
        const c = otp.createChallenge('add_phone', { userId: u.id });
        return res.json({ needPhone: true, challengeId: c.id, phone: u.phone || '' });
      }
      return startOtp(req, res, otp.createChallenge('login', { userId: u.id, phone: u.phone }));
    }
    startSession(res, u);
    log(req, u.id, adminOnly ? 'admin_login' : 'login');
    save();
    res.json({ user: publicUser(u) });
  };
}
app.post('/api/auth/login', handleLogin(false));
// دخول العرض التجريبي بضغطة زر (بدون كلمات مرور مكتوبة في الواجهة)
app.post('/api/auth/demo', (req, res) => {
  if (!DEMO) return res.status(404).json({ error: 'not_found' });
  const role = req.body?.role;
  const u = role === 'admin'
    ? db.users.find(x => x.role === 'admin' && x.email === 'admin@noor.app' && x.status === 'active')
    : db.users.find(x => x.demo && x.role === role && x.status === 'active' && (role !== 'doctor' || x.doctor?.verification === 'approved'));
  if (!u) return res.status(404).json({ error: 'not_found' });
  startSession(res, u);
  log(req, u.id, role === 'admin' ? 'admin_login' : 'login', { demo: true });
  save();
  res.json({ user: publicUser(u) });
});
app.post('/api/admin/login', handleLogin(true));

// إضافة رقم جوال لحساب قديم أثناء الدخول
app.post('/api/auth/otp/phone', (req, res) => {
  const c = otp.getChallenge(req.body?.challengeId);
  if (!c || c.purpose !== 'add_phone') return res.status(400).json({ error: 'otp_expired' });
  const ph = otp.normalizePhone(req.body.phone);
  if (!ph) return res.status(400).json({ error: 'invalid_phone' });
  if (phoneTaken(ph, c.userId)) return res.status(409).json({ error: 'phone_taken' });
  if (c.phone !== ph) { c.phone = ph; c.sentAt = 0; }
  startOtp(req, res, c);
});

// نسيت كلمة المرور: بالبريد أو الجوال. الرد واحد دائماً حتى لا يُكشف وجود الحساب
app.post('/api/auth/forgot', (req, res) => {
  const id = String(req.body?.identifier || '').trim();
  const ph = otp.normalizePhone(id);
  const u = db.users.find(x => ph ? x.phone === ph : x.email === id.toLowerCase());
  const valid = u && needsOtp(u) && u.status === 'active' && u.phone && u.phoneVerified;
  const c = otp.createChallenge('reset', valid ? { userId: u.id, phone: u.phone } : { fake: true, phone: ph || 'fake:' + id.toLowerCase().slice(0, 80) });
  log(req, valid ? u.id : null, 'password_reset_requested', { identifier: valid ? undefined : id.slice(0, 60) });
  startOtp(req, res, c);
});

// تغيير رقم الجوال من صفحة الحساب
app.post('/api/auth/phone', auth(), (req, res) => {
  const ph = otp.normalizePhone(req.body?.phone);
  if (!ph) return res.status(400).json({ error: 'invalid_phone' });
  if (phoneTaken(ph, req.user.id)) return res.status(409).json({ error: 'phone_taken' });
  if (req.user.role === 'admin') {
    req.user.phone = ph; save();
    return res.json({ user: publicUser(req.user) });
  }
  startOtp(req, res, otp.createChallenge('phone_change', { userId: req.user.id, phone: ph }));
});

app.post('/api/auth/otp/resend', (req, res) => {
  const c = otp.getChallenge(req.body?.challengeId);
  if (!c || !c.phone) return res.status(400).json({ error: 'otp_expired' });
  startOtp(req, res, c);
});

app.post('/api/auth/otp/verify', (req, res) => {
  const c = otp.getChallenge(req.body?.challengeId);
  if (!c) return res.status(400).json({ error: 'otp_expired' });
  if (c.purpose === 'reset') {
    const pw = String(req.body.newPassword || '');
    if (pw.length < 8) return res.status(400).json({ error: 'weak_password' });
  }
  try { otp.checkCode(c, req.body.code); }
  catch (e) {
    if (!c.fake) log(req, c.userId || null, 'otp_failed', { purpose: c.purpose, phone: otp.maskPhone(c.phone) });
    save();
    return otpError(res, e);
  }
  otp.dropChallenge(c);

  if (c.purpose === 'register') {
    const user = c.pendingUser;
    if (db.users.some(u => u.email === user.email)) return res.status(409).json({ error: 'email_taken' });
    if (phoneTaken(user.phone)) return res.status(409).json({ error: 'phone_taken' });
    user.phoneVerified = true;
    db.users.push(user);
    log(req, user.id, 'register', { role: user.role });
    startSession(res, user);
    save();
    return res.json({ user: publicUser(user) });
  }

  const u = db.users.find(x => x.id === c.userId);
  if (!u || u.status !== 'active') return res.status(400).json({ error: 'otp_expired' });
  if (c.purpose === 'login' || c.purpose === 'add_phone') {
    if (c.purpose === 'add_phone') {
      if (phoneTaken(c.phone, u.id)) return res.status(409).json({ error: 'phone_taken' });
      u.phone = c.phone; u.phoneVerified = true;
      log(req, u.id, 'phone_changed', { phone: otp.maskPhone(c.phone) });
    }
    startSession(res, u);
    log(req, u.id, 'login', { otp: true });
  } else if (c.purpose === 'reset') {
    u.passwordHash = hashPassword(String(req.body.newPassword));
    for (const [k, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[k];
    startSession(res, u);
    log(req, u.id, 'password_reset');
  } else if (c.purpose === 'phone_change') {
    if (!req.user || req.user.id !== u.id) return res.status(401).json({ error: 'unauthorized' });
    if (phoneTaken(c.phone, u.id)) return res.status(409).json({ error: 'phone_taken' });
    u.phone = c.phone; u.phoneVerified = true;
    log(req, u.id, 'phone_changed', { phone: otp.maskPhone(c.phone) });
  }
  save();
  res.json({ user: publicUser(u) });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = parseCookies(req).noor_sid;
  if (sid) delete db.sessions[sid];
  res.setHeader('Set-Cookie', 'noor_sid=; HttpOnly; Path=/; Max-Age=0');
  save();
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user), otpDevMode: otp.DEV_MODE, maintenance: MAINTENANCE, demo: DEMO }));

app.patch('/api/auth/me', auth(), (req, res) => {
  const { name, currentPassword, newPassword } = req.body || {};
  if (name) req.user.name = String(name).trim();
  if (newPassword) {
    if (!checkPassword(String(currentPassword || ''), req.user.passwordHash)) return res.status(400).json({ error: 'wrong_password' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'weak_password' });
    req.user.passwordHash = hashPassword(newPassword);
    log(req, req.user.id, 'password_changed');
  }
  save();
  res.json({ user: publicUser(req.user) });
});

// ================= ملفات المريض =================
function canAccessFile(user, file) {
  if (!user || !live(file)) return false;
  if (file.ownerId === user.id) return true;
  if (user.role === 'doctor' && user.doctor?.verification === 'approved') {
    return db.shares.some(s => s.doctorId === user.id && shareActive(s) && s.fileIds.includes(file.id));
  }
  return false;
}
function fileWithExtras(f) {
  const { series, attachments, storedName, studyKey, ...rest } = f;
  const extra = f.kind === 'dicom' && series ? studies.publicStudy(f) : {};
  return { ...rest, ...extra, notesCount: db.notes.filter(n => n.fileId === f.id).length };
}

app.get('/api/files', auth('patient'), (req, res) => {
  res.json({ files: db.files.filter(f => f.ownerId === req.user.id && live(f)).map(fileWithExtras) });
});

// الرفع: الملفات العادية بطاقة لكل ملف، وصور الأشعة تُجمع حسب الدراسة (وتُدمج مع الدراسة نفسها إن رُفعت سابقاً)
// الأقراص الكبيرة تُرفع على دفعات؛ كل دفعة تُضاف لنفس الدراسة تلقائياً. حقل attachments: تقارير PDF من القرص تُرفق بالدراسة
app.post('/api/files', auth('patient'), upload.fields([{ name: 'files', maxCount: 3000 }, { name: 'attachments', maxCount: 20 }]), async (req, res, next) => {
  const uploaded = req.files?.files || [];
  const attachFiles = req.files?.attachments || [];
  const all = [...uploaded, ...attachFiles];
  try {
    const { title, category, examDate, center, notes, acceptTerms } = req.body;
    // الموافقة على الشروط مطلوبة قبل أول رفع
    if (!req.user.termsAcceptedAt) {
      if (acceptTerms !== '1') { all.forEach(f => unlinkQuiet(f.path)); return res.status(400).json({ error: 'terms_required' }); }
      req.user.termsAcceptedAt = new Date().toISOString();
      log(req, req.user.id, 'terms_accepted');
    }
    if (!uploaded.length && !attachFiles.length) return res.status(400).json({ error: 'no_files' });

    const skipped = [], singles = [], dicoms = [];
    for (const f of uploaded) {
      const kind = media.detectKind(f.path, f.originalname);
      if (!kind) { unlinkQuiet(f.path); skipped.push({ name: f.originalname, reason: 'unsupported' }); continue; }
      if (kind === 'dicom') {
        const meta = media.readDicomMeta(f.path);
        if (!meta) { unlinkQuiet(f.path); skipped.push({ name: f.originalname, reason: 'not_image' }); continue; }
        dicoms.push({ storedName: f.filename, size: fs.statSync(f.path).size, name: f.originalname, meta });
      } else singles.push({ f, kind });
    }

    const now = new Date().toISOString();
    const cat = ['imaging', 'lab', 'report', 'prescription', 'other'].includes(category) ? category : 'other';
    const total = singles.length + (dicoms.length ? 1 : 0);
    const nameFor = fallback => (total === 1 && title) ? title : (title ? `${title} — ${fallback}` : fallback);
    const created = [];

    for (const { f, kind } of singles) {
      const file = {
        id: uid(), ownerId: req.user.id, title: nameFor(f.originalname), category: cat,
        examDate: examDate || '', center: center || '', notes: notes || '',
        originalName: f.originalname, storedName: f.filename, mime: media.MIME[path.extname(f.filename)] || f.mimetype,
        size: f.size, originalSize: f.size, kind, createdAt: now,
      };
      if (kind === 'image') {
        try { const r = await media.compressImage(UPLOADS, f.filename, f.originalname); if (r) Object.assign(file, r); }
        catch (e) { console.error('image compression skipped:', e.message); }
      }
      if (kind === 'video') file.processing = media.hasFfmpeg;
      db.files.push(file);
      created.push(file);
      log(req, req.user.id, 'file_uploaded', { fileId: file.id, title: file.title });
      if (file.processing) enqueueVideo(file.id);
    }

    let touched = [];
    if (dicoms.length) {
      const r = studies.ingest(db, req.user.id, dicoms, { title: title || '', examDate: examDate || '', center: center || '', notes: notes || '', now });
      r.duplicates.forEach(n => unlinkQuiet(storedPath(n)));
      if (r.duplicates.length) skipped.push({ name: `${r.duplicates.length}`, reason: 'duplicate' });
      r.created.forEach(st => log(req, req.user.id, 'file_uploaded', { fileId: st.id, title: st.title }));
      touched = r.touched.length ? r.touched : r.created;
    }

    // تقارير PDF من القرص: تُرفق بالدراسة (أو تُرفع كملف عادي إن لم توجد دراسة)
    const target = touched.slice().sort((a, b) => b.size - a.size)[0]
      || (req.body.studyId && db.files.find(x => x.id === req.body.studyId && x.ownerId === req.user.id && x.kind === 'dicom' && live(x)));
    for (const f of attachFiles) {
      if (media.detectKind(f.path, f.originalname) !== 'pdf') { unlinkQuiet(f.path); continue; }
      if (target) {
        target.attachments = target.attachments || [];
        target.attachments.push({ id: uid(), storedName: f.filename, originalName: f.originalname, mime: 'application/pdf', size: f.size, kind: 'pdf' });
        studies.refresh(target);
        if (!touched.includes(target)) touched.push(target);
      } else {
        const file = { id: uid(), ownerId: req.user.id, title: f.originalname, category: 'report', examDate: examDate || '', center: center || '', notes: '', originalName: f.originalname, storedName: f.filename, mime: 'application/pdf', size: f.size, originalSize: f.size, kind: 'pdf', createdAt: now };
        db.files.push(file); created.push(file);
      }
    }
    save();
    res.json({ files: [...created, ...touched.filter(x => !created.includes(x))].map(fileWithExtras), skipped });
  } catch (e) {
    const used = new Set(db.files.flatMap(x => studies.storedNamesOf(x)));
    all.forEach(f => { if (!used.has(f.filename)) unlinkQuiet(f.path); });
    next(e);
  }
});

app.patch('/api/files/:id', auth('patient'), (req, res) => {
  const f = db.files.find(x => x.id === req.params.id && x.ownerId === req.user.id && live(x));
  if (!f) return res.status(404).json({ error: 'not_found' });
  for (const k of ['title', 'category', 'examDate', 'center', 'notes']) {
    if (req.body[k] !== undefined) f[k] = String(req.body[k]);
  }
  save();
  res.json({ file: fileWithExtras(f) });
});

app.delete('/api/files/:id', auth('patient'), (req, res) => {
  const f = db.files.find(x => x.id === req.params.id && x.ownerId === req.user.id && live(x));
  if (!f) return res.status(404).json({ error: 'not_found' });
  // يختفي من حساب المريض ومن روابط المشاركة، ويبقى محفوظاً في سلة المحذوفات (مع ملاحظات الأطباء)
  f.deletedAt = new Date().toISOString(); f.deletedBy = req.user.id;
  db.shares.forEach(s => { s.fileIds = s.fileIds.filter(id => id !== f.id); });
  log(req, req.user.id, 'file_deleted', { fileId: f.id, title: f.title });
  save();
  res.json({ ok: true });
});

app.get('/api/files/:id/content', auth(), (req, res) => {
  const f = db.files.find(x => x.id === req.params.id);
  if (!canAccessFile(req.user, f)) return res.status(404).json({ error: 'not_found' });
  if (f.ownerId !== req.user.id && shouldLogView(req.user.id + ':' + f.id)) {
    log(req, req.user.id, 'file_viewed_by_doctor', { fileId: f.id, title: f.title, ownerId: f.ownerId });
    save();
  }
  sendStoredFile(req, res, f, req.query.download === '1');
});

app.get('/api/files/:id/notes', auth(), (req, res) => {
  const f = db.files.find(x => x.id === req.params.id);
  if (!canAccessFile(req.user, f)) return res.status(404).json({ error: 'not_found' });
  const notes = db.notes.filter(n => n.fileId === f.id).map(n => {
    const d = db.users.find(u => u.id === n.doctorId);
    return { ...n, doctorName: d ? d.name : '—', specialty: d?.doctor?.specialty || '' };
  });
  res.json({ notes });
});

app.post('/api/files/:id/notes', auth('doctor'), (req, res) => {
  const f = db.files.find(x => x.id === req.params.id);
  if (!canAccessFile(req.user, f) || f.ownerId === req.user.id) return res.status(404).json({ error: 'not_found' });
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'missing_fields' });
  const note = { id: uid(), fileId: f.id, doctorId: req.user.id, text, createdAt: new Date().toISOString() };
  db.notes.push(note);
  log(req, req.user.id, 'note_added', { fileId: f.id, title: f.title, ownerId: f.ownerId });
  save();
  res.json({ note });
});

// ================= الأطباء والمراكز (للمريض) =================
app.get('/api/doctors', auth(), (req, res) => {
  res.json({
    doctors: db.users
      .filter(u => u.role === 'doctor' && u.status === 'active' && u.doctor?.verification === 'approved')
      .map(u => ({ id: u.id, name: u.name, specialty: u.doctor.specialty, email: u.email, phone: u.phone })),
  });
});
app.get('/api/centers', auth(), (req, res) => res.json({ centers: db.centers }));

// ================= المشاركة =================
function shareView(s) {
  const files = s.fileIds.map(liveFile).filter(Boolean);
  return {
    ...s, pin: s.pin,
    files: files.map(f => ({ id: f.id, title: f.title, kind: f.kind, category: f.category })),
    active: shareActive(s),
    views: (s.accessLog || []).length,
  };
}

app.get('/api/shares', auth('patient'), (req, res) => {
  res.json({ shares: db.shares.filter(s => s.ownerId === req.user.id).map(shareView) });
});

app.post('/api/shares', auth('patient'), (req, res) => {
  const { fileIds, recipientType, doctorId, centerId, recipientName, recipientPhone, recipientEmail, method, days, message } = req.body || {};
  const ids = (Array.isArray(fileIds) ? fileIds : []).filter(id => db.files.some(f => f.id === id && f.ownerId === req.user.id));
  if (!ids.length) return res.status(400).json({ error: 'no_files' });
  if (!['doctor', 'center', 'person'].includes(recipientType)) return res.status(400).json({ error: 'missing_fields' });

  let name = recipientName, phone = recipientPhone || '', email = recipientEmail || '';
  if (recipientType === 'doctor') {
    const d = db.users.find(u => u.id === doctorId && u.role === 'doctor' && u.doctor?.verification === 'approved');
    if (!d) return res.status(400).json({ error: 'doctor_not_found' });
    name = d.name; phone = phone || d.phone; email = email || d.email;
  } else if (recipientType === 'center') {
    const c = db.centers.find(x => x.id === centerId);
    if (!c) return res.status(400).json({ error: 'center_not_found' });
    name = c.name; phone = phone || c.whatsapp; email = email || c.email;
  }
  if (!name) return res.status(400).json({ error: 'missing_fields' });

  const d = Math.min(Math.max(parseInt(days, 10) || 7, 1), 90);
  const share = {
    id: uid(), ownerId: req.user.id, fileIds: ids,
    recipientType, doctorId: recipientType === 'doctor' ? doctorId : null,
    centerId: recipientType === 'center' ? centerId : null,
    recipientName: String(name), recipientPhone: String(phone), recipientEmail: String(email),
    method: ['whatsapp', 'email', 'link'].includes(method) ? method : 'link',
    message: String(message || '').slice(0, 500),
    token: crypto.randomBytes(18).toString('base64url'),
    pin: String(crypto.randomInt(0, 10000)).padStart(4, '0'),
    expiresAt: new Date(Date.now() + d * 864e5).toISOString(),
    revoked: false, failedAttempts: 0, accessLog: [],
    createdAt: new Date().toISOString(),
  };
  db.shares.push(share);
  log(req, req.user.id, 'share_created', { shareId: share.id, recipient: share.recipientName, recipientType, files: ids.length });
  save();
  res.json({ share: shareView(share) });
});

app.post('/api/shares/:id/revoke', auth('patient'), (req, res) => {
  const s = db.shares.find(x => x.id === req.params.id && x.ownerId === req.user.id);
  if (!s) return res.status(404).json({ error: 'not_found' });
  s.revoked = true;
  log(req, req.user.id, 'share_revoked', { shareId: s.id, recipient: s.recipientName });
  save();
  res.json({ share: shareView(s) });
});

app.post('/api/shares/:id/extend', auth('patient'), (req, res) => {
  const s = db.shares.find(x => x.id === req.params.id && x.ownerId === req.user.id);
  if (!s) return res.status(404).json({ error: 'not_found' });
  const d = Math.min(Math.max(parseInt(req.body.days, 10) || 7, 1), 90);
  s.expiresAt = new Date(Date.now() + d * 864e5).toISOString();
  s.revoked = false; s.failedAttempts = 0;
  save();
  res.json({ share: shareView(s) });
});

// ---- رابط المشاركة العام (بدون حساب) ----
function findShare(req) {
  return db.shares.find(s => s.token === req.params.token);
}
app.get('/api/s/:token', (req, res) => {
  const s = findShare(req);
  if (!s) return res.status(404).json({ error: 'not_found' });
  const owner = db.users.find(u => u.id === s.ownerId);
  const status = s.revoked ? 'revoked' : !shareActive(s) ? 'expired' : s.failedAttempts >= 5 ? 'locked' : 'ok';
  res.json({ status, patientName: owner?.name || '', recipientName: s.recipientName, expiresAt: s.expiresAt, filesCount: s.fileIds.filter(liveFile).length, message: s.message });
});

app.post('/api/s/:token/unlock', (req, res) => {
  const s = findShare(req);
  if (!s || !shareActive(s)) return res.status(404).json({ error: 'not_found' });
  if (s.failedAttempts >= 5) return res.status(423).json({ error: 'locked' });
  if (String(req.body.pin || '') !== s.pin) {
    s.failedAttempts++;
    log(req, null, 'share_pin_failed', { shareId: s.id, ownerId: s.ownerId });
    save();
    return res.status(401).json({ error: 'wrong_pin', remaining: 5 - s.failedAttempts });
  }
  s.failedAttempts = 0;
  s.accessLog.push({ at: new Date().toISOString(), ip: req.ip, ua: String(req.headers['user-agent'] || '').slice(0, 160), action: 'opened' });
  log(req, null, 'share_opened', { shareId: s.id, ownerId: s.ownerId, recipient: s.recipientName });
  save();
  const owner = db.users.find(u => u.id === s.ownerId);
  const files = s.fileIds.map(liveFile).filter(Boolean)
    .map(f => ({ id: f.id, title: f.title, kind: f.kind, category: f.category, examDate: f.examDate, center: f.center, size: f.size, originalName: f.originalName,
      ...(f.kind === 'dicom' && f.series ? studies.publicStudy(f) : {}) }));
  res.json({ key: shareKey(s), patientName: owner?.name, files, expiresAt: s.expiresAt });
});

app.get('/api/s/:token/files/:fid', (req, res) => {
  const s = findShare(req);
  if (!s || !shareActive(s) || req.query.k !== shareKey(s) || !s.fileIds.includes(req.params.fid)) {
    return res.status(404).json({ error: 'not_found' });
  }
  const f = liveFile(req.params.fid);
  if (!f) return res.status(404).json({ error: 'not_found' });
  const firstRequest = (!req.headers.range || req.headers.range.startsWith('bytes=0-'))
    && (req.query.download === '1' || shouldLogView(s.id + ':' + f.id + ':' + (req.query.attachment || '')));
  if (firstRequest) {
    s.accessLog.push({ at: new Date().toISOString(), ip: req.ip, action: req.query.download === '1' ? 'downloaded' : 'viewed', fileId: f.id, title: f.title });
    save();
  }
  sendStoredFile(req, res, f, req.query.download === '1');
});

// ================= الطبيب =================
app.get('/api/doctor/inbox', auth('doctor'), (req, res) => {
  if (req.user.doctor?.verification !== 'approved') return res.json({ shares: [], pending: true, status: req.user.doctor?.verification });
  const shares = db.shares.filter(s => s.doctorId === req.user.id && shareActive(s)).map(s => {
    const owner = db.users.find(u => u.id === s.ownerId);
    const files = s.fileIds.map(liveFile).filter(Boolean)
      .map(f => ({ ...fileWithExtras(f), myNotes: db.notes.filter(n => n.fileId === f.id && n.doctorId === req.user.id).length }));
    return { id: s.id, patientName: owner?.name || '—', patientEmail: owner?.email, message: s.message, createdAt: s.createdAt, expiresAt: s.expiresAt, files };
  });
  res.json({ shares });
});

// ================= الأدمن =================
const admin = auth('admin');

function diskInfo() {
  try {
    const st = fs.statfsSync(store.DATA);
    return { total: st.blocks * st.bsize, free: st.bavail * st.bsize };
  } catch { return {}; }
}

app.get('/api/admin/stats', admin, (req, res) => {
  const users = db.users.filter(u => u.status !== 'deleted');
  const files = db.files.filter(live);
  const trashed = db.files.filter(f => !live(f));
  const byRole = r => users.filter(u => u.role === r).length;
  const byCat = {};
  files.forEach(f => { byCat[f.category] = (byCat[f.category] || 0) + 1; });
  const byKind = {};
  files.forEach(f => { byKind[f.kind] = (byKind[f.kind] || 0) + 1; });
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    days.push({
      date: d,
      uploads: files.filter(f => f.createdAt.slice(0, 10) === d).length,
      shares: db.shares.filter(s => s.createdAt.slice(0, 10) === d).length,
    });
  }
  res.json({
    users: users.length, patients: byRole('patient'), doctors: byRole('doctor'),
    pendingDoctors: users.filter(u => u.role === 'doctor' && u.doctor?.verification === 'pending').length,
    suspended: users.filter(u => u.status !== 'active').length,
    files: files.length, storage: files.reduce((a, f) => a + (f.size || 0), 0),
    trash: { files: trashed.length, users: db.users.length - users.length, size: trashed.reduce((a, f) => a + (f.size || 0), 0) },
    maintenance: MAINTENANCE,
    shares: db.shares.length, activeShares: db.shares.filter(shareActive).length,
    shareViews: db.shares.reduce((a, s) => a + (s.accessLog || []).length, 0),
    centers: db.centers.length, byCat, byKind, days,
    storageInfo: { persistent: store.PERSISTENT, since: store.DATA_SINCE, ...diskInfo() },
  });
});

app.get('/api/admin/users', admin, (req, res) => {
  res.json({
    users: db.users.filter(u => u.status !== 'deleted').map(u => ({
      ...publicUser(u),
      filesCount: db.files.filter(f => f.ownerId === u.id && live(f)).length,
      storage: db.files.filter(f => f.ownerId === u.id && live(f)).reduce((a, f) => a + f.size, 0),
      sharesCount: db.shares.filter(s => s.ownerId === u.id).length,
    })),
  });
});

app.patch('/api/admin/users/:id', admin, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id && x.status !== 'deleted');
  if (!u) return res.status(404).json({ error: 'not_found' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'self_action' });
  if (['active', 'suspended'].includes(req.body.status)) {
    u.status = req.body.status;
    if (u.status === 'suspended') for (const [k, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[k];
    log(req, req.user.id, u.status === 'active' ? 'user_activated' : 'user_suspended', { targetId: u.id, target: u.name });
  }
  save();
  res.json({ user: publicUser(u) });
});

// حذف الحساب: يُعطَّل ويُخفى، وتبقى ملفاته محفوظة حتى يقرر الأدمن (سلة المحذوفات)
app.delete('/api/admin/users/:id', admin, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id && x.status !== 'deleted');
  if (!u) return res.status(404).json({ error: 'not_found' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'self_action' });
  u.prevStatus = u.status; u.status = 'deleted';
  u.deletedAt = new Date().toISOString(); u.deletedBy = req.user.id;
  // روابط المشاركة التي أنشأها تتوقف فوراً
  db.shares.forEach(s => { if (s.ownerId === u.id && !s.revoked) { s.revoked = true; s.revokedByDeletion = true; } });
  for (const [k, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[k];
  log(req, req.user.id, 'user_deleted', { targetId: u.id, target: u.name, email: u.email });
  save();
  res.json({ ok: true });
});

// ---------- سلة المحذوفات ----------
const nameOf = id => db.users.find(u => u.id === id)?.name || '—';
app.get('/api/admin/trash', admin, (req, res) => {
  const owners = Object.fromEntries(db.users.map(u => [u.id, u]));
  const files = db.files.filter(f => !live(f)).map(f => ({
    ...fileWithExtras(f),
    ownerName: owners[f.ownerId]?.name || '—', ownerEmail: owners[f.ownerId]?.email || '',
    ownerDeleted: owners[f.ownerId]?.status === 'deleted', deletedByName: nameOf(f.deletedBy),
  }));
  const users = db.users.filter(u => u.status === 'deleted').map(u => {
    const own = db.files.filter(f => f.ownerId === u.id);
    return { ...publicUser(u), filesCount: own.length, storage: own.reduce((a, f) => a + (f.size || 0), 0), deletedByName: nameOf(u.deletedBy) };
  });
  files.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  users.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  res.json({ files, users });
});
const trashedFile = req => db.files.find(f => f.id === req.params.id && !live(f));
// الأدمن يعرض الملف المحذوف قبل أن يقرر
app.get('/api/admin/trash/files/:id/content', admin, (req, res) => {
  const f = trashedFile(req);
  if (!f) return res.status(404).json({ error: 'not_found' });
  sendStoredFile(req, res, f, req.query.download === '1');
});
app.post('/api/admin/trash/files/:id/restore', admin, (req, res) => {
  const f = trashedFile(req);
  if (!f) return res.status(404).json({ error: 'not_found' });
  if (db.users.find(u => u.id === f.ownerId)?.status === 'deleted') return res.status(400).json({ error: 'owner_deleted' });
  // نفس الدراسة رُفعت من جديد بعد الحذف؟ ندمج الصور فيها بدل بطاقتين
  const twin = f.kind === 'dicom' && f.studyKey && db.files.find(x => x !== f && live(x) && x.ownerId === f.ownerId && x.studyKey === f.studyKey);
  delete f.deletedAt; delete f.deletedBy;
  if (twin) {
    const before = [...studies.storedNamesOf(f), ...studies.storedNamesOf(twin)];
    studies.migrate(db, () => null);
    // الصور المكررة (نفس الصورة في النسختين) تُمسح لأنها لم تعد مستخدمة
    const used = new Set(db.files.flatMap(x => studies.storedNamesOf(x)));
    before.filter(n => !used.has(n)).forEach(n => unlinkQuiet(storedPath(n)));
  }
  log(req, req.user.id, 'file_restored', { fileId: f.id, title: f.title, ownerId: f.ownerId });
  save();
  res.json({ ok: true });
});
app.delete('/api/admin/trash/files/:id', admin, (req, res) => {
  const f = trashedFile(req);
  if (!f) return res.status(404).json({ error: 'not_found' });
  removeFileFromDisk(f);
  db.files = db.files.filter(x => x !== f);
  db.notes = db.notes.filter(n => n.fileId !== f.id);
  log(req, req.user.id, 'file_purged', { title: f.title, ownerId: f.ownerId });
  save();
  res.json({ ok: true });
});
const trashedUser = req => db.users.find(u => u.id === req.params.id && u.status === 'deleted');
app.post('/api/admin/trash/users/:id/restore', admin, (req, res) => {
  const u = trashedUser(req);
  if (!u) return res.status(404).json({ error: 'not_found' });
  u.status = u.prevStatus === 'suspended' ? 'suspended' : 'active';
  delete u.prevStatus; delete u.deletedAt; delete u.deletedBy;
  log(req, req.user.id, 'user_restored', { targetId: u.id, target: u.name });
  save();
  res.json({ ok: true });
});
// الحذف النهائي للحساب: يمسح الحساب وكل ملفاته من القرص (لا يمكن التراجع)
app.delete('/api/admin/trash/users/:id', admin, (req, res) => {
  const u = trashedUser(req);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const own = db.files.filter(f => f.ownerId === u.id);
  own.forEach(removeFileFromDisk);
  const fileIds = new Set(own.map(f => f.id));
  db.files = db.files.filter(f => f.ownerId !== u.id);
  db.notes = db.notes.filter(n => !fileIds.has(n.fileId) && n.doctorId !== u.id);
  db.shares = db.shares.filter(s => s.ownerId !== u.id);
  db.shares.forEach(s => { if (s.doctorId === u.id) s.revoked = true; });
  if (u.doctor?.licenseFile) removeFileFromDisk(u.doctor.licenseFile);
  db.users = db.users.filter(x => x.id !== u.id);
  log(req, req.user.id, 'user_purged', { target: u.name, email: u.email });
  save();
  res.json({ ok: true });
});

app.post('/api/admin/doctors/:id/verify', admin, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id && x.role === 'doctor');
  if (!u) return res.status(404).json({ error: 'not_found' });
  const decision = req.body.decision;
  if (!['approved', 'rejected', 'pending'].includes(decision)) return res.status(400).json({ error: 'missing_fields' });
  u.doctor.verification = decision;
  u.doctor.reviewNote = String(req.body.note || '');
  u.doctor.reviewedAt = new Date().toISOString();
  log(req, req.user.id, decision === 'approved' ? 'doctor_approved' : 'doctor_rejected', { targetId: u.id, target: u.name });
  save();
  res.json({ user: publicUser(u) });
});

app.get('/api/admin/doctors/:id/license', admin, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id && x.role === 'doctor');
  if (!u?.doctor?.licenseFile) return res.status(404).json({ error: 'not_found' });
  sendStoredFile(req, res, u.doctor.licenseFile, false);
});

app.post('/api/admin/centers', admin, (req, res) => {
  const { name, nameEn, city, type, email, whatsapp } = req.body || {};
  if (!name) return res.status(400).json({ error: 'missing_fields' });
  const c = { id: uid(), name, nameEn: nameEn || '', city: city || '', type: type || 'hospital', email: email || '', whatsapp: whatsapp || '', createdAt: new Date().toISOString() };
  db.centers.push(c);
  log(req, req.user.id, 'center_added', { target: c.name });
  save();
  res.json({ center: c });
});
app.patch('/api/admin/centers/:id', admin, (req, res) => {
  const c = db.centers.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not_found' });
  for (const k of ['name', 'nameEn', 'city', 'type', 'email', 'whatsapp']) if (req.body[k] !== undefined) c[k] = String(req.body[k]);
  log(req, req.user.id, 'center_updated', { target: c.name });
  save();
  res.json({ center: c });
});
app.delete('/api/admin/centers/:id', admin, (req, res) => {
  const c = db.centers.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not_found' });
  db.centers = db.centers.filter(x => x.id !== c.id);
  log(req, req.user.id, 'center_deleted', { target: c.name });
  save();
  res.json({ ok: true });
});

app.get('/api/admin/activity', admin, (req, res) => {
  const names = Object.fromEntries(db.users.map(u => [u.id, { name: u.name, role: u.role }]));
  res.json({
    activity: db.activity.slice(0, 1000).map(a => ({
      ...a,
      userName: a.userId ? names[a.userId]?.name || '—' : null,
      userRole: a.userId ? names[a.userId]?.role : null,
      ownerName: a.details?.ownerId ? names[a.details.ownerId]?.name : undefined,
    })),
  });
});

// ================= الواجهة =================
app.use('/vendor/dicomParser.min.js', (req, res) =>
  res.sendFile(path.join(__dirname, 'node_modules/dicom-parser/dist/dicomParser.min.js')));
app.use('/build', express.static(path.join(__dirname, 'public/build'), {
  setHeaders: (res, p) => {
    if (p.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
    res.setHeader('Cache-Control', /assets|chunks/.test(p) ? 'public, max-age=31536000, immutable' : 'no-cache');
  },
}));
app.use(express.static(path.join(__dirname, 'public')));
app.get(['/s/:token', '/', '/admin', '/admin/'], (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : 'upload_error' });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

store.ensureSeed(hashPassword);
const dropSessionsOf = ids => {
  let n = 0;
  for (const k of Object.keys(db.sessions)) if (ids.has(db.sessions[k].userId)) { Reflect.deleteProperty(db.sessions, k); n++; }
  return n;
};
// كلمة مرور الأدمن من إعدادات Render (NOOR_ADMIN_PASSWORD): تُطبَّق عند كل تشغيل إذا تغيّرت
if (process.env.NOOR_ADMIN_PASSWORD) {
  const a = db.users.find(u => u.role === 'admin' && u.email === (process.env.NOOR_ADMIN_EMAIL || 'admin@noor.app').toLowerCase());
  if (a && !checkPassword(process.env.NOOR_ADMIN_PASSWORD, a.passwordHash)) {
    a.passwordHash = hashPassword(process.env.NOOR_ADMIN_PASSWORD);
    dropSessionsOf(new Set([a.id]));
    save(); console.log('🔑 تم تحديث كلمة مرور الأدمن من الإعدادات.');
  }
}
// الحسابات التجريبية معطّلة على الخادم الحقيقي: نُخرج من كان داخلاً بها
if (!DEMO && dropSessionsOf(new Set(db.users.filter(u => u.demo).map(u => u.id)))) save();
// تحويل الأشعة المحفوظة بالشكل القديم (بطاقة لكل سلسلة) إلى دراسات
if (studies.migrate(db, n => media.readDicomMeta(storedPath(n)))) { save(); console.log('تم تجميع الأشعة السابقة في دراسات.'); }
{
  const moved = studies.repairMisdetected(db, {
    isDicom: n => media.hasDicomMagic(storedPath(n)) || media.looksLikeRawDicom(storedPath(n)),
    readMeta: n => media.readDicomMeta(storedPath(n)),
    unlink: n => unlinkQuiet(storedPath(n)),
  });
  if (moved) { save(); console.log(`تم نقل ${moved} صورة أشعة كانت مسجّلة كملفات عادية إلى دراساتها.`); }
}
// إكمال ضغط الفيديوهات التي توقفت بسبب إعادة تشغيل الخادم
db.files.filter(f => f.processing).forEach(f => enqueueVideo(f.id));
app.listen(PORT, () => console.log(`✨ منصة نور تعمل على http://localhost:${PORT}`));
