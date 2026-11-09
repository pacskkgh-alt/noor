/* منصة نور — الواجهة */
(() => {
'use strict';

// ============ أدوات ============
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const state = { user: null, lang: getLS('noor_lang') || 'ar', centers: null };

function getLS(k) { try { return localStorage.getItem(k); } catch { return null; } }
function setLS(k, v) { try { localStorage.setItem(k, v); } catch {} }

function t(key, vars = {}) {
  const dict = window.NOOR_I18N[state.lang] || {};
  let s = dict[key] ?? window.NOOR_I18N.ar[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDate(d, withTime) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return esc(d);
  const opts = { calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: 'short', day: 'numeric' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return new Intl.DateTimeFormat(state.lang === 'ar' ? 'ar' : 'en-GB', opts).format(date);
}
function fmtSize(b) {
  if (!b) return '0 KB';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i > 1 ? 1 : 0)} ${u[i]}`;
}
function fmtNum(n) { return new Intl.NumberFormat('en').format(n || 0); }
function relDays(d) {
  const days = Math.ceil((new Date(d) - Date.now()) / 864e5);
  return days;
}

async function api(path, opts = {}) {
  const o = { credentials: 'same-origin', ...opts };
  if (o.body && !(o.body instanceof FormData)) {
    o.headers = { 'Content-Type': 'application/json', ...(o.headers || {}) };
    o.body = JSON.stringify(o.body);
  }
  const res = await fetch(path, o);
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth') && !path.startsWith('/api/s/')) {
      state.user = null; go('/login');
    }
    const e = new Error(data.error || 'server_error'); e.code = data.error; e.data = data; throw e;
  }
  return data;
}
function errMsg(e) {
  const k = 'err.' + (e && e.code || 'server_error');
  const v = t(k);
  return v === k ? t('err.server_error') : v;
}

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icon(type === 'ok' ? 'check' : 'alert')}<span>${esc(msg)}</span>`;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3600);
}

// ---- النوافذ المنبثقة ----
function modal(html, { wide = false, onClose } = {}) {
  closeModal();
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const back = root.firstElementChild;
  back.addEventListener('mousedown', e => { if (e.target === back) closeModal(); });
  $$('[data-close]', root).forEach(b => b.addEventListener('click', closeModal));
  root._onClose = onClose;
  document.body.classList.add('no-scroll');
  return $('.modal', root);
}
function closeModal() {
  const root = $('#modal-root');
  if (root._onClose) { const f = root._onClose; root._onClose = null; f(); }
  root.innerHTML = '';
  document.body.classList.remove('no-scroll');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal-root').innerHTML) closeModal(); });

function confirmBox(message, { danger = true, okText } = {}) {
  return new Promise(resolve => {
    let done = false;
    const m = modal(`
      <div class="modal-body confirm">
        <div class="confirm-icon ${danger ? 'danger' : ''}">${icon(danger ? 'alert' : 'help')}</div>
        <p>${esc(message)}</p>
        <div class="row-end">
          <button class="btn btn-ghost" data-close>${t('cancel')}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cf-ok">${esc(okText || t('confirm'))}</button>
        </div>
      </div>`, { onClose: () => { if (!done) resolve(false); } });
    $('#cf-ok', m).onclick = () => { done = true; closeModal(); resolve(true); };
  });
}

// ---- أيقونات ----
const ICONS = {
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  dicom: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 7v10M8 9.5c1.5 1 2.5 1 4 0M8 13c1.5 1 2.5 1 4 0M16 9.5c-1.5 1-2.5 1-4 0M16 13c-1.5 1-2.5 1-4 0"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="3"/><path d="m16 10 6-3v10l-6-3z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20"/><path d="M8 7h4M8 11h4M8 15h4M10 3v0"/>',
  hospital: '<path d="M3 21V7l9-4 9 4v14M2 21h20"/><path d="M12 8v6M9 11h6M9 21v-4h6v4"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"/>',
  whatsapp: '<path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3 3z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.9-1-.9.9c-1-.4-2-1.4-2.4-2.4l.9-.9-1-1.9z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  note: '<path d="M5 3h14a2 2 0 0 1 2 2v10l-6 6H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M15 21v-6h6M8 8h8M8 12h5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  stethoscope: '<path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v2a5 5 0 0 0 10 0v-2"/><circle cx="21" cy="12" r="2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5L4 8M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2M20 20v-4h-4"/>',
  storage: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ICONS.file}</svg>`;
const logo = (size = 36) => `<img src="/logo.svg" width="${size}" height="${size}" alt="">`;

const CATS = ['imaging', 'lab', 'report', 'prescription', 'other'];
const kindIcon = k => ({ pdf: 'pdf', image: 'image', dicom: 'dicom', video: 'video' }[k] || 'file');

// ============ التوجيه ============
function go(path) { if (location.hash !== '#' + path) location.hash = path; else render(); }
window.addEventListener('hashchange', render);

function homeFor(u) { return u.role === 'admin' ? '/app/admin' : u.role === 'doctor' ? '/app/inbox' : '/app/files'; }

function setLang(l) {
  state.lang = l; setLS('noor_lang', l);
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  document.title = l === 'ar' ? 'نور | منصة الفحوصات الطبية' : 'Noor | Medical Records';
  render();
}
const langBtn = () => `<button class="btn btn-ghost btn-sm lang-btn" data-lang>${icon('globe')}<span>${state.lang === 'ar' ? 'English' : 'العربية'}</span></button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lang]');
  if (b) setLang(state.lang === 'ar' ? 'en' : 'ar');
  const n = e.target.closest('[data-go]');
  if (n) { e.preventDefault(); go(n.dataset.go); document.body.classList.remove('nav-open'); }
});

async function render() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  const m = location.pathname.match(/^\/s\/([\w-]+)/);
  if (m) return renderSharePage(m[1]);

  const route = location.hash.slice(1) || '/';
  if (route === '/') return renderLanding();
  if (route === '/login' || route === '/register') {
    if (state.user) return go(homeFor(state.user));
    return renderAuth(route === '/register');
  }
  if (!state.user) return go('/login');
  const parts = route.split('/').filter(Boolean); // ['app', ...]
  const page = parts.slice(1).join('/') || '';
  const allowed = NAV[state.user.role].map(n => n.path);
  if (!allowed.includes('/app/' + page)) return go(homeFor(state.user));
  renderShell(page);
}

// ============ الصفحة الرئيسية ============
function publicHeader() {
  return `<header class="pub-header">
    <a class="brand" href="#/">${logo(38)}<span><b>${t('brand')}</b><small>${t('brand.tag')}</small></span></a>
    <nav class="pub-nav">
      ${langBtn()}
      ${state.user
        ? `<button class="btn btn-primary btn-sm" data-go="${homeFor(state.user)}">${t('nav.dashboard')}</button>`
        : `<button class="btn btn-ghost btn-sm" data-go="/login">${t('auth.login')}</button><button class="btn btn-primary btn-sm" data-go="/register">${t('auth.register')}</button>`}
    </nav>
  </header>`;
}

function renderLanding() {
  $('#app').innerHTML = `
  <div class="landing">
    ${publicHeader()}
    <section class="hero">
      <div class="hero-text">
        <span class="pill">${icon('sparkle')} ${t('land.pill')}</span>
        <h1>${t('land.title')}</h1>
        <p class="lead">${t('land.lead')}</p>
        <div class="hero-cta">
          <button class="btn btn-primary btn-lg" data-go="/register">${t('land.cta')}</button>
          <button class="btn btn-outline btn-lg" data-go="/login">${t('auth.login')}</button>
        </div>
        <div class="hero-trust">${icon('lock')} ${t('land.trust')}</div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="mock-card mock-main">
          <div class="mock-head">${logo(26)}<b>${t('nav.files')}</b></div>
          ${[['dicom', 'land.mock1', 'cat.imaging', 'c-imaging'], ['pdf', 'land.mock2', 'cat.lab', 'c-lab'], ['pdf', 'land.mock3', 'cat.report', 'c-report']].map(([k, ti, c, cls]) => `
            <div class="mock-row"><span class="file-ic ${cls}">${icon(k)}</span><div><b>${t(ti)}</b><small>${t(c)}</small></div>${icon('check', 'ok')}</div>`).join('')}
        </div>
        <div class="mock-card mock-share">
          <div class="mock-row"><span class="file-ic wa">${icon('whatsapp')}</span><div><b>${t('land.mockShare')}</b><small>PIN • ••••</small></div></div>
        </div>
        <div class="glow"></div>
      </div>
    </section>

    <section class="features">
      ${[['upload', 'f1'], ['share', 'f2'], ['dicom', 'f3'], ['stethoscope', 'f4'], ['shield', 'f5'], ['activity', 'f6']].map(([i, k]) => `
        <div class="feature"><div class="feature-ic">${icon(i)}</div><h3>${t('land.' + k + 't')}</h3><p>${t('land.' + k + 'd')}</p></div>`).join('')}
    </section>

    <section class="steps">
      <h2>${t('land.howTitle')}</h2>
      <div class="steps-grid">
        ${[1, 2, 3].map(n => `<div class="step"><span class="step-n">${n}</span><h3>${t('land.s' + n + 't')}</h3><p>${t('land.s' + n + 'd')}</p></div>`).join('')}
      </div>
    </section>

    <section class="cta-band">
      <div><h2>${t('land.docTitle')}</h2><p>${t('land.docLead')}</p></div>
      <button class="btn btn-gold btn-lg" data-go="/register">${t('land.docCta')}</button>
    </section>

    <footer class="pub-footer">${logo(24)} <span>© 2026 ${t('brand')} — ${t('land.footer')}</span></footer>
  </div>`;
}

// ============ الدخول والتسجيل ============
function renderAuth(isRegister) {
  $('#app').innerHTML = `
  <div class="auth-page">
    <div class="auth-side">
      <a class="brand light" href="#/">${logo(44)}<span><b>${t('brand')}</b><small>${t('brand.tag')}</small></span></a>
      <h2>${t('auth.sideTitle')}</h2>
      <ul class="auth-points">
        <li>${icon('check')} ${t('auth.p1')}</li>
        <li>${icon('check')} ${t('auth.p2')}</li>
        <li>${icon('check')} ${t('auth.p3')}</li>
      </ul>
    </div>
    <div class="auth-main">
      <div class="auth-top">${langBtn()}</div>
      <form class="auth-card" id="auth-form" novalidate>
        <h1>${isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}</h1>
        <p class="muted">${isRegister ? t('auth.registerSub') : t('auth.loginSub')}</p>
        ${isRegister ? `
          <div class="seg" role="radiogroup" id="role-seg">
            <label><input type="radio" name="role" value="patient" checked><span>${icon('user')} ${t('role.patient')}</span></label>
            <label><input type="radio" name="role" value="doctor"><span>${icon('stethoscope')} ${t('role.doctor')}</span></label>
          </div>
          <label class="field"><span>${t('f.name')}</span><input name="name" required autocomplete="name"></label>` : ''}
        <label class="field"><span>${t('f.email')}</span><input name="email" type="email" required autocomplete="email" dir="ltr"></label>
        ${isRegister ? `<label class="field"><span>${t('f.phone')} <small class="muted">(${t('f.optional')})</small></span><input name="phone" type="tel" dir="ltr" placeholder="9665XXXXXXXX"></label>` : ''}
        <label class="field"><span>${t('f.password')}</span><input name="password" type="password" required minlength="8" autocomplete="${isRegister ? 'new-password' : 'current-password'}" dir="ltr"></label>
        ${isRegister ? `
          <div id="doctor-fields" hidden>
            <div class="info-box">${icon('shield')} ${t('auth.doctorNote')}</div>
            <label class="field"><span>${t('f.specialty')}</span><input name="specialty"></label>
            <label class="field"><span>${t('f.licenseNumber')}</span><input name="licenseNumber" dir="ltr"></label>
            <label class="field"><span>${t('f.licenseFile')}</span><input name="license" type="file" accept=".pdf,.jpg,.jpeg,.png"></label>
          </div>` : ''}
        <div class="form-error" id="auth-err" hidden></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">${isRegister ? t('auth.register') : t('auth.login')}</button>
        <p class="auth-switch">${isRegister ? t('auth.haveAccount') : t('auth.noAccount')}
          <a href="#${isRegister ? '/login' : '/register'}">${isRegister ? t('auth.login') : t('auth.register')}</a></p>
        ${!isRegister ? `
        <div class="demo-box">
          <b>${t('auth.demo')}</b>
          <div class="demo-grid">
            ${[['patient', 'patient@noor.app', 'Patient@1234'], ['doctor', 'doctor@noor.app', 'Doctor@1234'], ['admin', 'admin@noor.app', 'Admin@1234']].map(([r, e, p]) =>
              `<button type="button" class="demo-btn" data-email="${e}" data-pass="${p}">${t('role.' + r)}</button>`).join('')}
          </div>
        </div>` : ''}
      </form>
    </div>
  </div>`;

  const form = $('#auth-form');
  if (isRegister) {
    $$('input[name=role]', form).forEach(r => r.addEventListener('change', () => {
      $('#doctor-fields').hidden = form.role.value !== 'doctor';
    }));
  }
  $$('.demo-btn', form).forEach(b => b.onclick = () => {
    form.email.value = b.dataset.email; form.password.value = b.dataset.pass; form.requestSubmit();
  });
  form.onsubmit = async e => {
    e.preventDefault();
    const err = $('#auth-err'); err.hidden = true;
    const btn = $('button[type=submit]', form); btn.disabled = true;
    try {
      let data;
      if (isRegister) {
        const fd = new FormData(form);
        if (fd.get('role') !== 'doctor') { fd.delete('license'); fd.delete('specialty'); fd.delete('licenseNumber'); }
        data = await api('/api/auth/register', { method: 'POST', body: fd });
      } else {
        data = await api('/api/auth/login', { method: 'POST', body: { email: form.email.value, password: form.password.value } });
      }
      state.user = data.user;
      toast(t('auth.welcome', { name: data.user.name }));
      go(homeFor(data.user));
    } catch (ex) {
      err.textContent = errMsg(ex); err.hidden = false;
    } finally { btn.disabled = false; }
  };
}

// ============ الهيكل العام ============
const NAV = {
  patient: [
    { path: '/app/files', icon: 'file', key: 'nav.files' },
    { path: '/app/shares', icon: 'share', key: 'nav.shares' },
    { path: '/app/profile', icon: 'user', key: 'nav.profile' },
  ],
  doctor: [
    { path: '/app/inbox', icon: 'inbox', key: 'nav.inbox' },
    { path: '/app/profile', icon: 'user', key: 'nav.profile' },
  ],
  admin: [
    { path: '/app/admin', icon: 'chart', key: 'nav.overview' },
    { path: '/app/admin/users', icon: 'users', key: 'nav.users' },
    { path: '/app/admin/doctors', icon: 'shield', key: 'nav.verify' },
    { path: '/app/admin/centers', icon: 'hospital', key: 'nav.centers' },
    { path: '/app/admin/activity', icon: 'activity', key: 'nav.activity' },
    { path: '/app/profile', icon: 'user', key: 'nav.profile' },
  ],
};

function renderShell(page) {
  const u = state.user;
  const current = '/app/' + page;
  $('#app').innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/">${logo(36)}<span><b>${t('brand')}</b><small>${t('role.' + u.role)}</small></span></a>
      <nav class="side-nav">
        ${NAV[u.role].map(n => `<a href="#${n.path}" class="${current === n.path ? 'active' : ''}" data-go="${n.path}">${icon(n.icon)}<span>${t(n.key)}</span>
          ${n.path === '/app/admin/doctors' ? '<em class="nav-badge" id="pending-badge" hidden></em>' : ''}</a>`).join('')}
      </nav>
      <div class="side-foot">
        <div class="me"><span class="avatar">${esc(u.name.replace(/^د\.\s*/, '').trim()[0] || '?')}</span><div><b>${esc(u.name)}</b><small dir="ltr">${esc(u.email)}</small></div></div>
        <button class="btn btn-ghost btn-sm btn-block" id="logout">${icon('logout')} ${t('auth.logout')}</button>
      </div>
    </aside>
    <div class="nav-scrim" id="nav-scrim"></div>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" id="menu-btn" aria-label="menu">${icon('menu')}</button>
        <div class="topbar-title" id="page-title"></div>
        <div class="topbar-actions">${langBtn()}</div>
      </header>
      <main class="content" id="view"><div class="loading"><span class="spinner"></span></div></main>
    </div>
  </div>`;
  $('#logout').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); state.user = null; go('/'); };
  $('#menu-btn').onclick = () => document.body.classList.toggle('nav-open');
  $('#nav-scrim').onclick = () => document.body.classList.remove('nav-open');

  const views = {
    'files': viewFiles, 'shares': viewShares, 'profile': viewProfile, 'inbox': viewInbox,
    'admin': viewAdminOverview, 'admin/users': viewAdminUsers, 'admin/doctors': viewAdminDoctors,
    'admin/centers': viewAdminCenters, 'admin/activity': viewAdminActivity,
  };
  const nav = NAV[u.role].find(n => n.path === current);
  $('#page-title').textContent = nav ? t(nav.key) : '';
  if (u.role === 'admin') api('/api/admin/stats').then(s => { const b = $('#pending-badge'); if (b && s.pendingDoctors) { b.textContent = s.pendingDoctors; b.hidden = false; } }).catch(() => {});
  const viewEl = $('#view');
  (views[page] || viewFiles)(viewEl).catch(e => {
    if (viewEl.isConnected) viewEl.innerHTML = `<div class="empty">${icon('alert')}<p>${esc(errMsg(e))}</p></div>`;
  });
}

function pageHead(title, sub, actions = '') {
  return `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;
}
function emptyState(ic, title, sub, action = '') {
  return `<div class="empty"><div class="empty-ic">${icon(ic)}</div><h3>${title}</h3><p class="muted">${sub}</p>${action}</div>`;
}

// ============ المريض: الملفات ============
async function getCenters() {
  if (!state.centers) state.centers = (await api('/api/centers')).centers;
  return state.centers;
}

async function viewFiles(el) {
  const { files } = await api('/api/files');
  const ui = { q: '', cat: 'all', selected: new Set() };

  el.innerHTML = `
    ${pageHead(t('files.title'), t('files.sub'), `<button class="btn btn-primary" id="upload-btn">${icon('upload')} ${t('files.upload')}</button>`)}
    <div class="stat-row small">
      <div class="mini-stat"><b>${files.length}</b><span>${t('files.count')}</span></div>
      <div class="mini-stat"><b>${files.filter(f => f.kind === 'dicom').length}</b><span>${t('kind.dicom')}</span></div>
      <div class="mini-stat"><b>${fmtSize(files.reduce((a, f) => a + f.size, 0))}</b><span>${t('files.storage')}</span></div>
      <div class="mini-stat"><b>${files.reduce((a, f) => a + f.notesCount, 0)}</b><span>${t('files.doctorNotes')}</span></div>
    </div>
    <div class="toolbar">
      <div class="search">${icon('search')}<input id="q" placeholder="${t('files.search')}"></div>
      <div class="chips" id="cats">
        <button class="chip active" data-cat="all">${t('cat.all')}</button>
        ${CATS.map(c => `<button class="chip" data-cat="${c}"><i class="dot c-${c}"></i>${t('cat.' + c)}</button>`).join('')}
      </div>
    </div>
    <div class="select-bar" id="select-bar" hidden>
      <span id="sel-count"></span>
      <div class="row-gap"><button class="btn btn-ghost btn-sm" id="sel-clear">${t('cancel')}</button><button class="btn btn-primary btn-sm" id="sel-share">${icon('share')} ${t('files.shareSelected')}</button></div>
    </div>
    <div id="file-grid" class="file-grid"></div>`;

  const grid = $('#file-grid', el);
  function draw() {
    const q = ui.q.trim().toLowerCase();
    const list = files.filter(f => (ui.cat === 'all' || f.category === ui.cat) &&
      (!q || [f.title, f.center, f.originalName, f.notes].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => (b.examDate || b.createdAt).localeCompare(a.examDate || a.createdAt));
    if (!files.length) {
      grid.innerHTML = emptyState('upload', t('files.emptyTitle'), t('files.emptySub'), `<button class="btn btn-primary" id="empty-up">${icon('upload')} ${t('files.upload')}</button>`);
      $('#empty-up', grid).onclick = () => openUpload();
      return;
    }
    if (!list.length) { grid.innerHTML = emptyState('search', t('files.noResults'), ''); return; }
    grid.innerHTML = list.map(f => `
      <article class="file-card ${ui.selected.has(f.id) ? 'selected' : ''}" data-id="${f.id}">
        <label class="file-check" title="${t('select')}"><input type="checkbox" ${ui.selected.has(f.id) ? 'checked' : ''}><span></span></label>
        <button class="file-thumb c-${f.category}" data-act="view">${icon(kindIcon(f.kind))}<small>${t('kind.' + f.kind)}</small></button>
        <div class="file-body">
          <h3 title="${esc(f.title)}">${esc(f.title)}</h3>
          <div class="file-meta">
            <span class="badge c-${f.category}">${t('cat.' + f.category)}</span>
            <span>${icon('clock')} ${fmtDate(f.examDate || f.createdAt)}</span>
          </div>
          ${f.center ? `<div class="file-center">${icon('hospital')} ${esc(f.center)}</div>` : ''}
          ${f.notesCount ? `<button class="note-flag" data-act="view">${icon('note')} ${t('files.notesFrom', { n: f.notesCount })}</button>` : ''}
        </div>
        <div class="file-actions">
          <button class="icon-btn" data-act="view" title="${t('view')}">${icon('eye')}</button>
          <button class="icon-btn" data-act="share" title="${t('share')}">${icon('share')}</button>
          <button class="icon-btn" data-act="edit" title="${t('edit')}">${icon('edit')}</button>
          <button class="icon-btn danger" data-act="delete" title="${t('delete')}">${icon('trash')}</button>
        </div>
      </article>`).join('');
  }
  function drawSel() {
    $('#select-bar', el).hidden = !ui.selected.size;
    $('#sel-count', el).textContent = t('files.selected', { n: ui.selected.size });
  }
  draw();

  $('#q', el).oninput = e => { ui.q = e.target.value; draw(); };
  $('#cats', el).onclick = e => {
    const c = e.target.closest('[data-cat]'); if (!c) return;
    ui.cat = c.dataset.cat; $$('.chip', el).forEach(x => x.classList.toggle('active', x === c)); draw();
  };
  $('#upload-btn', el).onclick = () => openUpload();
  $('#sel-clear', el).onclick = () => { ui.selected.clear(); draw(); drawSel(); };
  $('#sel-share', el).onclick = () => openShare(files, [...ui.selected]);

  grid.onchange = e => {
    const card = e.target.closest('.file-card'); if (!card) return;
    e.target.checked ? ui.selected.add(card.dataset.id) : ui.selected.delete(card.dataset.id);
    card.classList.toggle('selected', e.target.checked); drawSel();
  };
  grid.onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const f = files.find(x => x.id === b.closest('.file-card').dataset.id);
    const act = b.dataset.act;
    if (act === 'view') openFileViewer(f, { url: `/api/files/${f.id}/content`, canDownload: true, notes: true });
    if (act === 'share') openShare(files, [f.id]);
    if (act === 'edit') openEditFile(f, () => draw());
    if (act === 'delete' && await confirmBox(t('files.confirmDelete', { title: f.title }))) {
      try {
        await api('/api/files/' + f.id, { method: 'DELETE' });
        files.splice(files.indexOf(f), 1); ui.selected.delete(f.id); draw(); drawSel();
        toast(t('files.deleted'));
      } catch (ex) { toast(errMsg(ex), 'err'); }
    }
  };

  async function openUpload() {
    const centers = await getCenters().catch(() => []);
    let picked = [];
    const m = modal(`
      <div class="modal-head"><h2>${icon('upload')} ${t('up.title')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
      <form class="modal-body" id="up-form">
        <label class="dropzone" id="dz">
          <input type="file" id="up-input" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.dcm,.dicom,.mp4,.webm,.mov,.m4v">
          <div class="dz-ic">${icon('upload')}</div>
          <b>${t('up.drop')}</b>
          <small class="muted">${t('up.types')}</small>
        </label>
        <ul class="up-list" id="up-list"></ul>
        <div class="grid-2">
          <label class="field"><span>${t('f.title')}</span><input name="title" placeholder="${t('up.titlePh')}"></label>
          <label class="field"><span>${t('f.category')}</span><select name="category">${CATS.map(c => `<option value="${c}">${t('cat.' + c)}</option>`).join('')}</select></label>
          <label class="field"><span>${t('f.examDate')}</span><input name="examDate" type="date"></label>
          <label class="field"><span>${t('f.center')}</span><input name="center" list="centers-dl" placeholder="${t('up.centerPh')}"></label>
        </div>
        <datalist id="centers-dl">${centers.map(c => `<option value="${esc(state.lang === 'en' && c.nameEn ? c.nameEn : c.name)}">`).join('')}</datalist>
        <label class="field"><span>${t('f.notes')} <small class="muted">(${t('f.optional')})</small></span><textarea name="notes" rows="2"></textarea></label>
        <div class="progress" id="up-prog" hidden><i></i></div>
        <div class="form-error" id="up-err" hidden></div>
        <div class="row-end">
          <button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button>
          <button class="btn btn-primary" type="submit" id="up-submit" disabled>${icon('upload')} ${t('up.submit')}</button>
        </div>
      </form>`, { wide: true });
    const input = $('#up-input', m), dz = $('#dz', m);
    const setFiles = list => {
      picked = [...list];
      $('#up-list', m).innerHTML = picked.map(f => `<li>${icon('file')} <span>${esc(f.name)}</span><small>${fmtSize(f.size)}</small></li>`).join('');
      $('#up-submit', m).disabled = !picked.length;
      const ext = (picked[0]?.name || '').split('.').pop().toLowerCase();
      if (['dcm', 'dicom'].includes(ext)) m.querySelector('[name=category]').value = 'imaging';
    };
    input.onchange = () => setFiles(input.files);
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => setFiles(e.dataTransfer.files));
    $('#up-form', m).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      picked.forEach(f => fd.append('files', f));
      const prog = $('#up-prog', m), bar = $('i', prog), err = $('#up-err', m);
      prog.hidden = false; err.hidden = true; $('#up-submit', m).disabled = true;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files');
      xhr.upload.onprogress = ev => { if (ev.lengthComputable) bar.style.width = (ev.loaded / ev.total * 100) + '%'; };
      xhr.onload = () => {
        let data = {}; try { data = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status === 200) {
          files.push(...data.files); closeModal(); draw();
          toast(t('up.done', { n: data.files.length }));
          if (data.files.length < picked.length) toast(t('up.skipped'), 'err');
        } else {
          err.textContent = errMsg({ code: data.error }); err.hidden = false; $('#up-submit', m).disabled = false; prog.hidden = true;
        }
      };
      xhr.onerror = () => { err.textContent = t('err.server_error'); err.hidden = false; $('#up-submit', m).disabled = false; };
      xhr.send(fd);
    };
  }
}

function openEditFile(f, onSaved) {
  const m = modal(`
    <div class="modal-head"><h2>${icon('edit')} ${t('edit')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <form class="modal-body" id="ed-form">
      <label class="field"><span>${t('f.title')}</span><input name="title" value="${esc(f.title)}" required></label>
      <div class="grid-2">
        <label class="field"><span>${t('f.category')}</span><select name="category">${CATS.map(c => `<option value="${c}" ${c === f.category ? 'selected' : ''}>${t('cat.' + c)}</option>`).join('')}</select></label>
        <label class="field"><span>${t('f.examDate')}</span><input name="examDate" type="date" value="${esc(f.examDate)}"></label>
      </div>
      <label class="field"><span>${t('f.center')}</span><input name="center" value="${esc(f.center)}"></label>
      <label class="field"><span>${t('f.notes')}</span><textarea name="notes" rows="2">${esc(f.notes)}</textarea></label>
      <div class="row-end"><button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button><button class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  $('#ed-form', m).onsubmit = async e => {
    e.preventDefault();
    try {
      const { file } = await api('/api/files/' + f.id, { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) });
      Object.assign(f, file); closeModal(); onSaved(); toast(t('saved'));
    } catch (ex) { toast(errMsg(ex), 'err'); }
  };
}

// ---- عارض الملفات ----
function openFileViewer(f, { url, canDownload = true, notes = false, doctorMode = false } = {}) {
  const dl = url + (url.includes('?') ? '&' : '?') + 'download=1';
  const m = modal(`
    <div class="modal-head viewer-head">
      <div class="vh-title"><span class="file-ic c-${f.category || 'other'}">${icon(kindIcon(f.kind))}</span><div><h2>${esc(f.title)}</h2>
        <small class="muted">${[f.category ? t('cat.' + f.category) : '', f.examDate ? fmtDate(f.examDate) : '', esc(f.center || '')].filter(Boolean).join(' • ')}</small></div></div>
      <div class="row-gap">
        ${canDownload ? `<a class="btn btn-ghost btn-sm" href="${dl}">${icon('download')} <span class="hide-sm">${t('download')}</span></a>` : ''}
        <button class="icon-btn" data-close>${icon('x')}</button>
      </div>
    </div>
    <div class="viewer-wrap ${notes ? 'with-notes' : ''}">
      <div class="viewer-stage" id="stage"></div>
      ${notes ? `<aside class="notes-panel" id="notes"><div class="loading"><span class="spinner"></span></div></aside>` : ''}
    </div>`, { wide: true, onClose: () => window.NoorViewer.dispose() });
  m.classList.add('modal-viewer');
  window.NoorViewer.mount($('#stage', m), { url, kind: f.kind, t });
  if (notes) loadNotes();

  async function loadNotes() {
    const panel = $('#notes', m);
    try {
      const { notes: list } = await api(`/api/files/${f.id}/notes`);
      panel.innerHTML = `
        <h3>${icon('note')} ${t('notes.title')}</h3>
        ${list.length ? list.map(n => `<div class="note"><div class="note-head"><b>${esc(n.doctorName)}</b><small>${esc(n.specialty)}</small></div><p>${esc(n.text)}</p><small class="muted">${fmtDate(n.createdAt, true)}</small></div>`).join('')
          : `<p class="muted small">${doctorMode ? t('notes.emptyDoc') : t('notes.empty')}</p>`}
        ${doctorMode ? `<form id="note-form" class="note-form"><textarea name="text" rows="4" required placeholder="${t('notes.ph')}"></textarea><button class="btn btn-primary btn-block">${t('notes.add')}</button></form>` : ''}`;
      const nf = $('#note-form', panel);
      if (nf) nf.onsubmit = async e => {
        e.preventDefault();
        try { await api(`/api/files/${f.id}/notes`, { method: 'POST', body: { text: nf.text.value } }); toast(t('notes.added')); loadNotes(); }
        catch (ex) { toast(errMsg(ex), 'err'); }
      };
    } catch (e) { panel.innerHTML = `<p class="muted">${esc(errMsg(e))}</p>`; }
  }
}

// ============ المشاركة ============
async function openShare(files, preselected = []) {
  const [{ doctors }, centers] = await Promise.all([api('/api/doctors'), getCenters()]);
  const sel = new Set(preselected);
  const s = { type: 'doctor', method: 'whatsapp', doctorId: null, centerId: null };

  const m = modal(`
    <div class="modal-head"><h2>${icon('share')} ${t('sh.title')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <form class="modal-body share-form" id="sh-form">
      <section>
        <h4>1. ${t('sh.files')}</h4>
        <div class="pick-list files-pick">
          ${files.map(f => `<label class="pick"><input type="checkbox" name="fid" value="${f.id}" ${sel.has(f.id) ? 'checked' : ''}>
            <span class="file-ic sm c-${f.category}">${icon(kindIcon(f.kind))}</span><span class="pick-text"><b>${esc(f.title)}</b><small>${t('cat.' + f.category)} • ${fmtDate(f.examDate || f.createdAt)}</small></span></label>`).join('')}
        </div>
      </section>
      <section>
        <h4>2. ${t('sh.to')}</h4>
        <div class="seg seg-3" id="type-seg">
          <label><input type="radio" name="type" value="doctor" checked><span>${icon('stethoscope')} ${t('sh.doctor')}</span></label>
          <label><input type="radio" name="type" value="center"><span>${icon('hospital')} ${t('sh.center')}</span></label>
          <label><input type="radio" name="type" value="person"><span>${icon('user')} ${t('sh.person')}</span></label>
        </div>
        <div id="to-doctor">
          <div class="search sm">${icon('search')}<input id="doc-q" placeholder="${t('sh.searchDoc')}"></div>
          <div class="pick-list" id="doc-list"></div>
        </div>
        <div id="to-center" hidden><div class="pick-list">
          ${centers.length ? centers.map(c => `<label class="pick"><input type="radio" name="centerId" value="${c.id}"><span class="file-ic sm c-report">${icon('hospital')}</span><span class="pick-text"><b>${esc(state.lang === 'en' && c.nameEn ? c.nameEn : c.name)}</b><small>${esc(c.city)} • ${t('ctype.' + (c.type || 'hospital'))}</small></span></label>`).join('') : `<p class="muted small">${t('sh.noCenters')}</p>`}
        </div></div>
        <div id="to-person" hidden>
          <label class="field"><span>${t('f.recipientName')}</span><input name="recipientName"></label>
        </div>
      </section>
      <section>
        <h4>3. ${t('sh.via')}</h4>
        <div class="seg seg-3" id="method-seg">
          <label><input type="radio" name="method" value="whatsapp" checked><span class="wa-c">${icon('whatsapp')} ${t('sh.whatsapp')}</span></label>
          <label><input type="radio" name="method" value="email"><span>${icon('mail')} ${t('sh.email')}</span></label>
          <label><input type="radio" name="method" value="link"><span>${icon('link')} ${t('sh.link')}</span></label>
        </div>
        <div class="grid-2">
          <label class="field" id="phone-field"><span>${t('f.whatsapp')}</span><input name="recipientPhone" type="tel" dir="ltr" placeholder="9665XXXXXXXX"></label>
          <label class="field" id="email-field" hidden><span>${t('f.email')}</span><input name="recipientEmail" type="email" dir="ltr"></label>
          <label class="field"><span>${t('sh.expiry')}</span><select name="days">
            ${[1, 3, 7, 14, 30].map(d => `<option value="${d}" ${d === 7 ? 'selected' : ''}>${t('sh.days', { n: d })}</option>`).join('')}
          </select></label>
        </div>
        <label class="field"><span>${t('f.message')} <small class="muted">(${t('f.optional')})</small></span><textarea name="message" rows="2" placeholder="${t('sh.msgPh')}"></textarea></label>
      </section>
      <div class="info-box">${icon('lock')} ${t('sh.secureNote')}</div>
      <div class="form-error" id="sh-err" hidden></div>
      <div class="row-end"><button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button><button class="btn btn-primary" id="sh-submit">${icon('share')} ${t('sh.create')}</button></div>
    </form>`, { wide: true });

  const form = $('#sh-form', m);
  const drawDocs = () => {
    const q = $('#doc-q', m).value.trim().toLowerCase();
    const list = doctors.filter(d => !q || (d.name + d.specialty).toLowerCase().includes(q));
    $('#doc-list', m).innerHTML = list.length ? list.map(d => `<label class="pick"><input type="radio" name="doctorId" value="${d.id}" ${s.doctorId === d.id ? 'checked' : ''}>
      <span class="avatar sm">${esc(d.name.replace(/^د\.\s*/, '')[0])}</span><span class="pick-text"><b>${esc(d.name)} <i class="verified" title="${t('verified')}">${icon('check')}</i></b><small>${esc(d.specialty)}</small></span></label>`).join('')
      : `<p class="muted small">${t('sh.noDoctors')}</p>`;
  };
  drawDocs();
  $('#doc-q', m).oninput = drawDocs;
  const fillContact = (phone, email) => { form.recipientPhone.value = phone || ''; form.recipientEmail.value = email || ''; };
  form.onchange = e => {
    if (e.target.name === 'type') {
      s.type = e.target.value;
      ['doctor', 'center', 'person'].forEach(x => $('#to-' + x, m).hidden = x !== s.type);
      if (s.type === 'person') fillContact('', '');
    }
    if (e.target.name === 'doctorId') { s.doctorId = e.target.value; const d = doctors.find(x => x.id === s.doctorId); fillContact(d.phone, d.email); }
    if (e.target.name === 'centerId') { s.centerId = e.target.value; const c = centers.find(x => x.id === s.centerId); fillContact(c.whatsapp, c.email); }
    if (e.target.name === 'method') {
      s.method = e.target.value;
      $('#phone-field', m).hidden = s.method !== 'whatsapp';
      $('#email-field', m).hidden = s.method !== 'email';
    }
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const err = $('#sh-err', m); err.hidden = true;
    const fileIds = $$('input[name=fid]:checked', m).map(x => x.value);
    const fail = k => { err.textContent = t(k); err.hidden = false; };
    if (!fileIds.length) return fail('sh.errFiles');
    if (s.type === 'doctor' && !s.doctorId) return fail('sh.errDoctor');
    if (s.type === 'center' && !s.centerId) return fail('sh.errCenter');
    if (s.type === 'person' && !form.recipientName.value.trim()) return fail('sh.errName');
    if (s.method === 'whatsapp' && !form.recipientPhone.value.replace(/\D/g, '')) return fail('sh.errPhone');
    if (s.method === 'email' && !/^\S+@\S+\.\S+$/.test(form.recipientEmail.value)) return fail('sh.errEmail');
    try {
      const { share } = await api('/api/shares', {
        method: 'POST', body: {
          fileIds, recipientType: s.type, doctorId: s.doctorId, centerId: s.centerId,
          recipientName: form.recipientName.value, recipientPhone: form.recipientPhone.value.replace(/\D/g, ''),
          recipientEmail: form.recipientEmail.value, method: s.method, days: form.days.value, message: form.message.value,
        },
      });
      showShareResult(share);
    } catch (ex) { err.textContent = errMsg(ex); err.hidden = false; }
  };
}

function shareUrl(s) { return `${location.origin}/s/${s.token}`; }
function shareMessage(s) {
  return t('sh.msgTemplate', {
    name: s.recipientName, patient: state.user.name, n: s.files.length,
    url: shareUrl(s), pin: s.pin, date: fmtDate(s.expiresAt),
    note: s.message ? '\n\n' + s.message : '',
  });
}

function showShareResult(share, { fresh = true } = {}) {
  const url = shareUrl(share), msg = shareMessage(share);
  const wa = `https://wa.me/${(share.recipientPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  const mail = `mailto:${encodeURIComponent(share.recipientEmail || '')}?subject=${encodeURIComponent(t('sh.mailSubject', { patient: state.user.name }))}&body=${encodeURIComponent(msg)}`;
  const m = modal(`
    <div class="modal-head"><h2>${fresh ? icon('check') + ' ' + t('sh.ready') : icon('share') + ' ' + t('sh.resend')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="modal-body share-result">
      ${fresh ? `<div class="success-burst">${icon('check')}</div><p class="center">${t('sh.readySub', { name: esc(share.recipientName) })}</p>` : ''}
      <div class="result-grid">
        <div class="result-box"><small>${t('sh.linkLabel')}</small><div class="copy-row"><input readonly value="${esc(url)}" dir="ltr"><button class="icon-btn" data-copy="${esc(url)}">${icon('copy')}</button></div></div>
        <div class="result-box pin-box"><small>${t('sh.pin')}</small><div class="pin" dir="ltr">${esc(share.pin)}</div></div>
      </div>
      <p class="muted small center">${icon('clock')} ${t('sh.validUntil', { date: fmtDate(share.expiresAt, true) })}</p>
      <div class="send-buttons">
        ${share.recipientPhone ? `<a class="btn btn-wa btn-lg" href="${wa}" target="_blank" rel="noopener">${icon('whatsapp')} ${t('sh.sendWa')}</a>` : ''}
        ${share.recipientEmail ? `<a class="btn btn-outline btn-lg" href="${mail}">${icon('mail')} ${t('sh.sendMail')}</a>` : ''}
        <button class="btn btn-ghost btn-lg" data-copy="${esc(msg)}">${icon('copy')} ${t('sh.copyMsg')}</button>
      </div>
      <div class="info-box subtle">${icon('shield')} ${t('sh.tip')}</div>
    </div>`, { onClose: () => { if (location.hash === '#/app/shares') render(); } });
  $$('[data-copy]', m).forEach(b => b.onclick = () => copyText(b.dataset.copy));
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {} ta.remove();
  }
  toast(t('copied'));
}

// ============ المريض: المشاركات ============
async function viewShares(el) {
  const { shares } = await api('/api/shares');
  shares.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const typeIcon = { doctor: 'stethoscope', center: 'hospital', person: 'user' };
  const methodIcon = { whatsapp: 'whatsapp', email: 'mail', link: 'link' };
  const status = s => s.revoked ? ['revoked', 'st-off'] : !s.active ? ['expired', 'st-warn'] : ['active', 'st-on'];

  el.innerHTML = `
    ${pageHead(t('shares.title'), t('shares.sub'), `<button class="btn btn-primary" data-go="/app/files">${icon('plus')} ${t('shares.new')}</button>`)}
    <div class="stat-row small">
      <div class="mini-stat"><b>${shares.filter(s => s.active).length}</b><span>${t('shares.activeCount')}</span></div>
      <div class="mini-stat"><b>${shares.reduce((a, s) => a + s.views, 0)}</b><span>${t('shares.totalViews')}</span></div>
      <div class="mini-stat"><b>${shares.length}</b><span>${t('shares.total')}</span></div>
    </div>
    <div class="share-list">
      ${shares.length ? shares.map(s => {
        const [st, cls] = status(s);
        const left = relDays(s.expiresAt);
        return `<article class="share-card" data-id="${s.id}">
          <div class="share-who"><span class="file-ic c-${s.recipientType === 'doctor' ? 'imaging' : s.recipientType === 'center' ? 'report' : 'other'}">${icon(typeIcon[s.recipientType])}</span>
            <div><b>${esc(s.recipientName)}</b><small>${t('sh.' + s.recipientType)} • ${icon(methodIcon[s.method])} ${t('sh.' + s.method)}</small></div></div>
          <div class="share-files">${s.files.map(f => `<span class="tag">${icon(kindIcon(f.kind))} ${esc(f.title)}</span>`).join('') || `<span class="muted small">${t('shares.noFiles')}</span>`}</div>
          <div class="share-meta">
            <span class="status ${cls}">${t('st.' + st)}</span>
            <span class="muted small">${s.active ? t('shares.daysLeft', { n: left }) : fmtDate(s.expiresAt)}</span>
            <span class="muted small">${icon('eye')} ${t('shares.views', { n: s.views })}</span>
          </div>
          <div class="share-actions">
            ${s.active ? `<button class="btn btn-ghost btn-sm" data-act="resend">${icon('share')} ${t('sh.resend')}</button>` : `<button class="btn btn-ghost btn-sm" data-act="extend">${icon('refresh')} ${t('shares.reactivate')}</button>`}
            <button class="btn btn-ghost btn-sm" data-act="log">${icon('activity')} ${t('shares.log')}</button>
            ${s.active ? `<button class="btn btn-ghost btn-sm danger" data-act="revoke">${icon('x')} ${t('shares.revoke')}</button>` : ''}
          </div>
        </article>`;
      }).join('') : emptyState('share', t('shares.emptyTitle'), t('shares.emptySub'), `<button class="btn btn-primary" data-go="/app/files">${t('shares.new')}</button>`)}
    </div>`;

  el.querySelector('.share-list').onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const s = shares.find(x => x.id === b.closest('.share-card').dataset.id);
    if (b.dataset.act === 'resend') showShareResult(s, { fresh: false });
    if (b.dataset.act === 'log') {
      const files = Object.fromEntries(s.files.map(f => [f.id, f.title]));
      modal(`<div class="modal-head"><h2>${icon('activity')} ${t('shares.log')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
        <div class="modal-body">
          <p class="muted">${t('shares.logSub', { name: esc(s.recipientName) })}</p>
          ${s.accessLog.length ? `<ul class="timeline">${[...s.accessLog].reverse().map(a => `<li><i class="tl-dot ${a.action}"></i><div><b>${t('log.' + a.action)}</b>${a.fileId ? ` — ${esc(files[a.fileId] || a.title || '')}` : ''}<small class="muted">${fmtDate(a.at, true)} • <span dir="ltr">${esc(a.ip || '')}</span></small></div></li>`).join('')}</ul>`
            : emptyState('eye', t('shares.noViews'), '')}
        </div>`);
    }
    if (b.dataset.act === 'revoke' && await confirmBox(t('shares.confirmRevoke', { name: s.recipientName }))) {
      await api(`/api/shares/${s.id}/revoke`, { method: 'POST' }); toast(t('shares.revoked')); render();
    }
    if (b.dataset.act === 'extend') {
      await api(`/api/shares/${s.id}/extend`, { method: 'POST', body: { days: 7 } }); toast(t('shares.extended')); render();
    }
  };
}

// ============ الطبيب ============
async function viewInbox(el) {
  const data = await api('/api/doctor/inbox');
  if (data.pending) {
    const st = data.status;
    el.innerHTML = `<div class="status-card ${st}">
      <div class="status-ic">${icon(st === 'rejected' ? 'x' : 'clock')}</div>
      <h2>${t('doc.' + st + 'Title')}</h2><p class="muted">${t('doc.' + st + 'Sub')}</p></div>`;
    return;
  }
  const { shares } = data;
  el.innerHTML = `
    ${pageHead(t('inbox.title'), t('inbox.sub'))}
    <div class="verified-banner">${icon('shield')} ${t('inbox.verified')}</div>
    ${shares.length ? `<div class="inbox-list">${shares.map(s => `
      <article class="inbox-card">
        <header><span class="avatar">${esc(s.patientName[0])}</span><div><b>${esc(s.patientName)}</b><small class="muted">${t('inbox.sharedOn', { date: fmtDate(s.createdAt) })} • ${t('shares.daysLeft', { n: relDays(s.expiresAt) })}</small></div></header>
        ${s.message ? `<blockquote>${esc(s.message)}</blockquote>` : ''}
        <div class="inbox-files">${s.files.map(f => `
          <button class="inbox-file" data-sid="${s.id}" data-fid="${f.id}">
            <span class="file-ic c-${f.category}">${icon(kindIcon(f.kind))}</span>
            <span class="pick-text"><b>${esc(f.title)}</b><small>${t('cat.' + f.category)} • ${fmtDate(f.examDate || f.createdAt)}</small></span>
            ${f.myNotes ? `<span class="badge c-lab">${icon('check')} ${t('inbox.noted')}</span>` : `<span class="badge">${t('inbox.new')}</span>`}
          </button>`).join('')}</div>
      </article>`).join('')}</div>`
      : emptyState('inbox', t('inbox.emptyTitle'), t('inbox.emptySub'))}`;
  el.onclick = e => {
    const b = e.target.closest('.inbox-file'); if (!b) return;
    const f = shares.find(s => s.id === b.dataset.sid).files.find(x => x.id === b.dataset.fid);
    openFileViewer(f, { url: `/api/files/${f.id}/content`, notes: true, doctorMode: true });
  };
}

// ============ الملف الشخصي ============
async function viewProfile(el) {
  const u = state.user;
  el.innerHTML = `
    ${pageHead(t('nav.profile'), '')}
    <div class="grid-2 cards-2">
      <form class="card" id="pf-form">
        <h3>${t('pf.info')}</h3>
        <label class="field"><span>${t('f.name')}</span><input name="name" value="${esc(u.name)}" required></label>
        <label class="field"><span>${t('f.email')}</span><input value="${esc(u.email)}" disabled dir="ltr"></label>
        <label class="field"><span>${t('f.phone')}</span><input name="phone" value="${esc(u.phone)}" dir="ltr"></label>
        ${u.doctor ? `<div class="kv"><span>${t('f.specialty')}</span><b>${esc(u.doctor.specialty)}</b></div><div class="kv"><span>${t('f.licenseNumber')}</span><b dir="ltr">${esc(u.doctor.licenseNumber)}</b></div><div class="kv"><span>${t('pf.verification')}</span><span class="status ${u.doctor.verification === 'approved' ? 'st-on' : u.doctor.verification === 'rejected' ? 'st-off' : 'st-warn'}">${t('vs.' + u.doctor.verification)}</span></div>` : ''}
        <button class="btn btn-primary">${t('save')}</button>
      </form>
      <form class="card" id="pw-form">
        <h3>${t('pf.password')}</h3>
        <label class="field"><span>${t('pf.current')}</span><input name="currentPassword" type="password" required dir="ltr"></label>
        <label class="field"><span>${t('pf.new')}</span><input name="newPassword" type="password" minlength="8" required dir="ltr"></label>
        <button class="btn btn-outline">${t('pf.change')}</button>
      </form>
    </div>`;
  $('#pf-form', el).onsubmit = async e => {
    e.preventDefault();
    try { const { user } = await api('/api/auth/me', { method: 'PATCH', body: { name: e.target.name.value, phone: e.target.phone.value } }); state.user = user; toast(t('saved')); render(); }
    catch (ex) { toast(errMsg(ex), 'err'); }
  };
  $('#pw-form', el).onsubmit = async e => {
    e.preventDefault();
    try { await api('/api/auth/me', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast(t('pf.changed')); }
    catch (ex) { toast(errMsg(ex), 'err'); }
  };
}

// ============ الأدمن ============
async function viewAdminOverview(el) {
  const s = await api('/api/admin/stats');
  const max = Math.max(1, ...s.days.map(d => Math.max(d.uploads, d.shares)));
  const catTotal = Math.max(1, Object.values(s.byCat).reduce((a, b) => a + b, 0));
  el.innerHTML = `
    ${pageHead(t('adm.overview'), t('adm.overviewSub'))}
    ${s.pendingDoctors ? `<button class="alert-banner" data-go="/app/admin/doctors">${icon('shield')} ${t('adm.pendingAlert', { n: s.pendingDoctors })} <span>←</span></button>` : ''}
    <div class="stat-grid">
      ${[['users', s.users, 'adm.users', t('adm.usersSub', { p: s.patients, d: s.doctors })],
        ['file', fmtNum(s.files), 'adm.files', ''],
        ['storage', fmtSize(s.storage), 'adm.storage', ''],
        ['share', fmtNum(s.activeShares), 'adm.activeShares', t('adm.ofTotal', { n: s.shares })],
        ['eye', fmtNum(s.shareViews), 'adm.views', ''],
        ['hospital', s.centers, 'adm.centers', '']].map(([ic, v, k, sub]) => `
        <div class="stat"><span class="stat-ic">${icon(ic)}</span><div><b>${v}</b><span>${t(k)}</span>${sub ? `<small>${sub}</small>` : ''}</div></div>`).join('')}
    </div>
    <div class="grid-2 cards-2">
      <div class="card">
        <div class="card-head"><h3>${t('adm.activity14')}</h3><div class="legend"><span><i class="lg-up"></i>${t('adm.uploads')}</span><span><i class="lg-sh"></i>${t('adm.sharesL')}</span></div></div>
        <div class="bars" dir="ltr">
          ${s.days.map(d => `<div class="bar-col" title="${d.date}: ${d.uploads} / ${d.shares}">
            <div class="bar-pair"><i class="b-up" style="height:${d.uploads / max * 100}%"></i><i class="b-sh" style="height:${d.shares / max * 100}%"></i></div>
            <small>${d.date.slice(8)}</small></div>`).join('')}
        </div>
      </div>
      <div class="card">
        <h3>${t('adm.byCat')}</h3>
        <div class="hbars">
          ${CATS.map(c => `<div class="hbar"><span>${t('cat.' + c)}</span><div class="hbar-track"><i class="c-${c}" style="width:${(s.byCat[c] || 0) / catTotal * 100}%"></i></div><b>${s.byCat[c] || 0}</b></div>`).join('')}
        </div>
        <h3 class="mt">${t('adm.byKind')}</h3>
        <div class="kind-tags">${['pdf', 'image', 'dicom', 'video'].map(k => `<span class="tag">${icon(kindIcon(k))} ${t('kind.' + k)}: <b>${s.byKind[k] || 0}</b></span>`).join('')}</div>
      </div>
    </div>`;
}

async function viewAdminUsers(el) {
  const { users } = await api('/api/admin/users');
  const ui = { q: '', role: 'all' };
  el.innerHTML = `
    ${pageHead(t('nav.users'), t('adm.usersPageSub', { n: users.length }))}
    <div class="toolbar">
      <div class="search">${icon('search')}<input id="q" placeholder="${t('adm.searchUsers')}"></div>
      <div class="chips" id="roles">${['all', 'patient', 'doctor', 'admin'].map(r => `<button class="chip ${r === 'all' ? 'active' : ''}" data-role="${r}">${r === 'all' ? t('cat.all') : t('role.' + r)}</button>`).join('')}</div>
    </div>
    <div class="table-wrap"><table class="table"><thead><tr>
      <th>${t('f.name')}</th><th>${t('adm.role')}</th><th>${t('adm.status')}</th><th>${t('adm.files')}</th><th>${t('adm.storage')}</th><th>${t('adm.joined')}</th><th></th>
    </tr></thead><tbody id="tb"></tbody></table></div>`;
  const draw = () => {
    const q = ui.q.toLowerCase();
    $('#tb', el).innerHTML = users.filter(u => (ui.role === 'all' || u.role === ui.role) && (!q || (u.name + u.email).toLowerCase().includes(q))).map(u => `
      <tr data-id="${u.id}">
        <td><div class="cell-user"><span class="avatar sm">${esc(u.name.replace(/^د\.\s*/, '')[0])}</span><div><b>${esc(u.name)}</b><small dir="ltr">${esc(u.email)}</small></div></div></td>
        <td><span class="badge role-${u.role}">${t('role.' + u.role)}</span>${u.doctor ? ` <span class="status sm ${u.doctor.verification === 'approved' ? 'st-on' : u.doctor.verification === 'rejected' ? 'st-off' : 'st-warn'}">${t('vs.' + u.doctor.verification)}</span>` : ''}</td>
        <td><span class="status ${u.status === 'active' ? 'st-on' : 'st-off'}">${t('us.' + u.status)}</span></td>
        <td>${u.filesCount}</td><td>${fmtSize(u.storage)}</td><td>${fmtDate(u.createdAt)}</td>
        <td class="actions">${u.id === state.user.id ? `<span class="muted small">${t('adm.you')}</span>` : `
          <button class="btn btn-ghost btn-sm" data-act="toggle">${u.status === 'active' ? t('adm.suspend') : t('adm.activate')}</button>
          <button class="icon-btn danger" data-act="delete" title="${t('delete')}">${icon('trash')}</button>`}</td>
      </tr>`).join('') || `<tr><td colspan="7" class="muted center">${t('files.noResults')}</td></tr>`;
  };
  draw();
  $('#q', el).oninput = e => { ui.q = e.target.value; draw(); };
  $('#roles', el).onclick = e => { const c = e.target.closest('[data-role]'); if (!c) return; ui.role = c.dataset.role; $$('#roles .chip', el).forEach(x => x.classList.toggle('active', x === c)); draw(); };
  $('#tb', el).onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const u = users.find(x => x.id === b.closest('tr').dataset.id);
    try {
      if (b.dataset.act === 'toggle') {
        const next = u.status === 'active' ? 'suspended' : 'active';
        if (next === 'suspended' && !await confirmBox(t('adm.confirmSuspend', { name: u.name }), { okText: t('adm.suspend') })) return;
        const { user } = await api('/api/admin/users/' + u.id, { method: 'PATCH', body: { status: next } });
        Object.assign(u, user); draw(); toast(t('saved'));
      }
      if (b.dataset.act === 'delete' && await confirmBox(t('adm.confirmDelete', { name: u.name }))) {
        await api('/api/admin/users/' + u.id, { method: 'DELETE' });
        users.splice(users.indexOf(u), 1); draw(); toast(t('adm.deleted'));
      }
    } catch (ex) { toast(errMsg(ex), 'err'); }
  };
}

async function viewAdminDoctors(el) {
  const { users } = await api('/api/admin/users');
  const docs = users.filter(u => u.role === 'doctor');
  let tab = docs.some(d => d.doctor.verification === 'pending') ? 'pending' : 'approved';
  el.innerHTML = `
    ${pageHead(t('nav.verify'), t('adm.verifySub'))}
    <div class="tabs" id="tabs">${['pending', 'approved', 'rejected'].map(s => `<button class="tab" data-tab="${s}">${t('vs.' + s)} <em>${docs.filter(d => d.doctor.verification === s).length}</em></button>`).join('')}</div>
    <div id="doc-grid" class="doc-grid"></div>`;
  const draw = () => {
    $$('.tab', el).forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
    const list = docs.filter(d => d.doctor.verification === tab);
    $('#doc-grid', el).innerHTML = list.length ? list.map(d => `
      <article class="card doc-card" data-id="${d.id}">
        <header><span class="avatar">${esc(d.name.replace(/^د\.\s*/, '')[0])}</span><div><b>${esc(d.name)}</b><small class="muted">${esc(d.doctor.specialty)}</small></div></header>
        <div class="kv"><span>${t('f.licenseNumber')}</span><b dir="ltr">${esc(d.doctor.licenseNumber)}</b></div>
        <div class="kv"><span>${t('f.email')}</span><span dir="ltr">${esc(d.email)}</span></div>
        <div class="kv"><span>${t('f.phone')}</span><span dir="ltr">${esc(d.phone || '—')}</span></div>
        <div class="kv"><span>${t('adm.joined')}</span><span>${fmtDate(d.createdAt)}</span></div>
        ${d.doctor.reviewNote ? `<div class="kv"><span>${t('adm.reviewNote')}</span><span>${esc(d.doctor.reviewNote)}</span></div>` : ''}
        <button class="btn btn-ghost btn-sm btn-block" data-act="license">${icon('eye')} ${t('adm.viewLicense')}</button>
        <div class="row-gap">
          ${tab !== 'approved' ? `<button class="btn btn-primary btn-sm grow" data-act="approved">${icon('check')} ${t('adm.approve')}</button>` : ''}
          ${tab !== 'rejected' ? `<button class="btn btn-danger-soft btn-sm grow" data-act="rejected">${icon('x')} ${tab === 'approved' ? t('adm.revokeVerify') : t('adm.reject')}</button>` : ''}
        </div>
      </article>`).join('') : emptyState('shield', t('adm.noDocs'), '');
  };
  draw();
  $('#tabs', el).onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; draw(); } };
  $('#doc-grid', el).onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const d = docs.find(x => x.id === b.closest('.doc-card').dataset.id);
    if (b.dataset.act === 'license') {
      return openFileViewer({ title: t('adm.licenseOf', { name: d.name }), kind: d.doctor.licenseFile?.kind || 'pdf', category: 'report' }, { url: `/api/admin/doctors/${d.id}/license`, canDownload: true });
    }
    let note = '';
    if (b.dataset.act === 'rejected') {
      note = await promptBox(t('adm.rejectReason'));
      if (note === null) return;
    }
    try {
      const { user } = await api(`/api/admin/doctors/${d.id}/verify`, { method: 'POST', body: { decision: b.dataset.act, note } });
      Object.assign(d, user);
      toast(b.dataset.act === 'approved' ? t('adm.approvedMsg', { name: d.name }) : t('adm.rejectedMsg'));
      viewAdminDoctors(el);
      const badge = $('#pending-badge'); const p = docs.filter(x => x.doctor.verification === 'pending').length;
      if (badge) { badge.textContent = p; badge.hidden = !p; }
    } catch (ex) { toast(errMsg(ex), 'err'); }
  };
}

function promptBox(label) {
  return new Promise(resolve => {
    let done = false;
    const m = modal(`<form class="modal-body" id="pb"><label class="field"><span>${esc(label)}</span><textarea name="v" rows="3"></textarea></label>
      <div class="row-end"><button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button><button class="btn btn-primary">${t('confirm')}</button></div></form>`,
      { onClose: () => { if (!done) resolve(null); } });
    $('#pb', m).onsubmit = e => { e.preventDefault(); done = true; const v = e.target.v.value; closeModal(); resolve(v); };
  });
}

async function viewAdminCenters(el) {
  const { centers } = await api('/api/centers');
  state.centers = centers;
  const TYPES = ['hospital', 'clinic', 'lab', 'radiology'];
  el.innerHTML = `
    ${pageHead(t('nav.centers'), t('adm.centersSub'), `<button class="btn btn-primary" id="add-c">${icon('plus')} ${t('adm.addCenter')}</button>`)}
    <div class="table-wrap"><table class="table"><thead><tr><th>${t('f.centerName')}</th><th>${t('f.city')}</th><th>${t('f.type')}</th><th>${t('f.email')}</th><th>${t('f.whatsapp')}</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const draw = () => {
    $('#tb', el).innerHTML = centers.map(c => `<tr data-id="${c.id}">
      <td><div class="cell-user"><span class="file-ic sm c-report">${icon('hospital')}</span><div><b>${esc(c.name)}</b><small>${esc(c.nameEn)}</small></div></div></td>
      <td>${esc(c.city)}</td><td><span class="badge">${t('ctype.' + (c.type || 'hospital'))}</span></td>
      <td dir="ltr">${esc(c.email)}</td><td dir="ltr">${esc(c.whatsapp)}</td>
      <td class="actions"><button class="icon-btn" data-act="edit">${icon('edit')}</button><button class="icon-btn danger" data-act="delete">${icon('trash')}</button></td></tr>`).join('')
      || `<tr><td colspan="6" class="muted center">${t('sh.noCenters')}</td></tr>`;
  };
  draw();
  const form = (c = {}) => {
    const m = modal(`
      <div class="modal-head"><h2>${icon('hospital')} ${c.id ? t('edit') : t('adm.addCenter')}</h2><button class="icon-btn" data-close>${icon('x')}</button></div>
      <form class="modal-body" id="cf">
        <div class="grid-2">
          <label class="field"><span>${t('f.centerName')} (عربي)</span><input name="name" value="${esc(c.name)}" required></label>
          <label class="field"><span>${t('f.centerName')} (English)</span><input name="nameEn" value="${esc(c.nameEn)}" dir="ltr"></label>
          <label class="field"><span>${t('f.city')}</span><input name="city" value="${esc(c.city)}"></label>
          <label class="field"><span>${t('f.type')}</span><select name="type">${TYPES.map(x => `<option value="${x}" ${c.type === x ? 'selected' : ''}>${t('ctype.' + x)}</option>`).join('')}</select></label>
          <label class="field"><span>${t('f.email')}</span><input name="email" type="email" value="${esc(c.email)}" dir="ltr"></label>
          <label class="field"><span>${t('f.whatsapp')}</span><input name="whatsapp" value="${esc(c.whatsapp)}" dir="ltr" placeholder="9665XXXXXXXX"></label>
        </div>
        <div class="row-end"><button type="button" class="btn btn-ghost" data-close>${t('cancel')}</button><button class="btn btn-primary">${t('save')}</button></div>
      </form>`, { wide: true });
    $('#cf', m).onsubmit = async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target));
      try {
        if (c.id) { const { center } = await api('/api/admin/centers/' + c.id, { method: 'PATCH', body }); Object.assign(c, center); }
        else { const { center } = await api('/api/admin/centers', { method: 'POST', body }); centers.push(center); }
        closeModal(); draw(); toast(t('saved'));
      } catch (ex) { toast(errMsg(ex), 'err'); }
    };
  };
  $('#add-c', el).onclick = () => form();
  $('#tb', el).onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const c = centers.find(x => x.id === b.closest('tr').dataset.id);
    if (b.dataset.act === 'edit') form(c);
    if (b.dataset.act === 'delete' && await confirmBox(t('adm.confirmDeleteCenter', { name: c.name }))) {
      await api('/api/admin/centers/' + c.id, { method: 'DELETE' }); centers.splice(centers.indexOf(c), 1); draw(); toast(t('adm.deleted'));
    }
  };
}

async function viewAdminActivity(el) {
  const { activity } = await api('/api/admin/activity');
  const actions = [...new Set(activity.map(a => a.action))];
  const ui = { q: '', action: 'all' };
  el.innerHTML = `
    ${pageHead(t('nav.activity'), t('adm.activitySub'))}
    <div class="toolbar">
      <div class="search">${icon('search')}<input id="q" placeholder="${t('adm.searchActivity')}"></div>
      <select id="act-f" class="select"><option value="all">${t('adm.allActions')}</option>${actions.map(a => `<option value="${a}">${t('act.' + a)}</option>`).join('')}</select>
    </div>
    <div class="table-wrap"><table class="table"><thead><tr><th>${t('adm.time')}</th><th>${t('adm.actor')}</th><th>${t('adm.action')}</th><th>${t('adm.details')}</th><th>IP</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const describe = a => {
    const d = a.details || {};
    const parts = [];
    if (d.title) parts.push(`«${esc(d.title)}»`);
    if (d.recipient) parts.push(`${t('adm.to')} ${esc(d.recipient)}`);
    if (d.target) parts.push(esc(d.target));
    if (a.ownerName) parts.push(`${t('adm.patient')}: ${esc(a.ownerName)}`);
    if (d.email && a.action === 'login_failed') parts.push(`<span dir="ltr">${esc(d.email)}</span>`);
    if (d.role) parts.push(t('role.' + d.role));
    return parts.join(' • ') || '—';
  };
  const draw = () => {
    const q = ui.q.toLowerCase();
    const list = activity.filter(a => (ui.action === 'all' || a.action === ui.action) &&
      (!q || JSON.stringify([a.userName, a.details, a.ownerName]).toLowerCase().includes(q))).slice(0, 300);
    $('#tb', el).innerHTML = list.map(a => `<tr>
      <td class="nowrap">${fmtDate(a.at, true)}</td>
      <td>${a.userName ? `<b>${esc(a.userName)}</b> <small class="muted">${t('role.' + a.userRole)}</small>` : `<span class="muted">${t('adm.visitor')}</span>`}</td>
      <td><span class="act-badge act-${a.action.split('_')[0]}">${t('act.' + a.action)}</span></td>
      <td>${describe(a)}</td><td dir="ltr" class="muted small">${esc(a.ip || '')}</td></tr>`).join('')
      || `<tr><td colspan="5" class="muted center">${t('files.noResults')}</td></tr>`;
  };
  draw();
  $('#q', el).oninput = e => { ui.q = e.target.value; draw(); };
  $('#act-f', el).onchange = e => { ui.action = e.target.value; draw(); };
}

// ============ صفحة المشاركة العامة ============
async function renderSharePage(token) {
  const app = $('#app');
  const shell = inner => {
    app.innerHTML = `<div class="share-page">
      <header class="pub-header"><a class="brand" href="/">${logo(36)}<span><b>${t('brand')}</b><small>${t('brand.tag')}</small></span></a>${langBtn()}</header>
      <main class="share-main">${inner}</main>
      <footer class="pub-footer">${icon('lock')} <span>${t('pub.footer')}</span></footer></div>`;
  };
  let info;
  try { info = await api('/api/s/' + token); }
  catch { info = { status: 'not_found' }; }
  if (info.status !== 'ok') {
    shell(`<div class="status-card ${info.status === 'locked' ? 'rejected' : 'pending'}"><div class="status-ic">${icon(info.status === 'locked' ? 'lock' : 'clock')}</div>
      <h2>${t('pub.' + info.status)}</h2><p class="muted">${t('pub.' + info.status + 'Sub')}</p></div>`);
    return;
  }
  let saved = null;
  try { saved = sessionStorage.getItem('noor_share_' + token); } catch {}
  if (saved) { try { return showFiles(JSON.parse(saved)); } catch {} }

  shell(`<form class="card unlock-card" id="unlock">
      <div class="lock-ic">${icon('lock')}</div>
      <h1>${t('pub.title', { patient: esc(info.patientName) })}</h1>
      <p class="muted">${t('pub.sub', { n: info.filesCount, name: esc(info.recipientName) })}</p>
      ${info.message ? `<blockquote>${esc(info.message)}</blockquote>` : ''}
      <label class="field"><span>${t('pub.enterPin')}</span><input name="pin" class="pin-input" inputmode="numeric" maxlength="4" autocomplete="one-time-code" dir="ltr" required></label>
      <div class="form-error" id="pin-err" hidden></div>
      <button class="btn btn-primary btn-block btn-lg">${t('pub.open')}</button>
      <p class="muted small center">${icon('clock')} ${t('sh.validUntil', { date: fmtDate(info.expiresAt, true) })}</p>
    </form>`);
  const form = $('#unlock');
  form.pin.focus();
  form.pin.oninput = () => { form.pin.value = form.pin.value.replace(/\D/g, ''); };
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const data = await api(`/api/s/${token}/unlock`, { method: 'POST', body: { pin: form.pin.value } });
      try { sessionStorage.setItem('noor_share_' + token, JSON.stringify(data)); } catch {}
      showFiles(data);
    } catch (ex) {
      const err = $('#pin-err');
      err.textContent = ex.code === 'wrong_pin' ? t('pub.wrongPin', { n: ex.data.remaining }) : ex.code === 'locked' ? t('pub.locked') : errMsg(ex);
      err.hidden = false; form.pin.value = ''; form.pin.focus();
      if (ex.code === 'locked') setTimeout(() => renderSharePage(token), 1500);
    }
  };

  function showFiles(data) {
    shell(`
      <div class="share-files-head"><div><h1>${t('pub.filesOf', { patient: esc(data.patientName) })}</h1><p class="muted">${icon('clock')} ${t('sh.validUntil', { date: fmtDate(data.expiresAt, true) })}</p></div></div>
      <div class="pub-files">${data.files.map(f => `
        <article class="pub-file" data-id="${f.id}">
          <span class="file-ic c-${f.category}">${icon(kindIcon(f.kind))}</span>
          <div class="pick-text"><b>${esc(f.title)}</b><small>${t('cat.' + f.category)} • ${fmtDate(f.examDate)}${f.center ? ' • ' + esc(f.center) : ''} • ${fmtSize(f.size)}</small></div>
          <div class="row-gap">
            <button class="btn btn-primary btn-sm" data-act="view">${icon('eye')} <span class="hide-sm">${t('view')}</span></button>
            <a class="btn btn-ghost btn-sm" href="/api/s/${token}/files/${f.id}?k=${data.key}&download=1">${icon('download')}</a>
          </div>
        </article>`).join('')}</div>
      <div class="info-box subtle">${icon('shield')} ${t('pub.privacy')}</div>`);
    $('.pub-files').onclick = e => {
      const b = e.target.closest('[data-act=view]'); if (!b) return;
      const f = data.files.find(x => x.id === b.closest('.pub-file').dataset.id);
      openFileViewer(f, { url: `/api/s/${token}/files/${f.id}?k=${data.key}` });
    };
  }
}

// ============ البدء ============
(async () => {
  try { state.user = (await api('/api/auth/me')).user; } catch {}
  setLang(state.lang);
})();

})();
