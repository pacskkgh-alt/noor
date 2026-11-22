// تجميع صور الأشعة في "دراسات": بطاقة واحدة لكل دراسة، وداخلها السلاسل مرتبة
// شكل الدراسة في قاعدة البيانات:
// { id, ownerId, kind: 'dicom', studyKey, title, examDate, center, category: 'imaging', size,
//   series: [{ uid, number, description, modality, size, slices: [{ n, i, p, sop, frames, size }] }],
//   attachments: [{ id, storedName, originalName, mime, size, kind: 'pdf' }] }
const crypto = require('crypto');

const uid = () => crypto.randomBytes(9).toString('base64url');
const fmtDA = d => (/^\d{8}$/.test(d || '') ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : '');
const studyKeyOf = m => (m.studyUID ? 'study:' + m.studyUID : 'series:' + m.seriesUID);

function sortSeries(series) {
  series.slices.sort((a, b) => {
    if (Number.isFinite(a.i) && Number.isFinite(b.i) && a.i !== b.i) return a.i - b.i;
    if (Number.isFinite(a.p) && Number.isFinite(b.p) && a.p !== b.p) return b.p - a.p;
    return String(a.name || a.n).localeCompare(String(b.name || b.n), 'en', { numeric: true });
  });
}

function refresh(study) {
  study.series.forEach(sortSeries);
  study.series.sort((a, b) => (Number.isFinite(a.number) ? a.number : 1e9) - (Number.isFinite(b.number) ? b.number : 1e9));
  study.series.forEach(s => { s.size = s.slices.reduce((a, x) => a + (x.size || 0), 0); });
  study.size = study.series.reduce((a, s) => a + s.size, 0) + (study.attachments || []).reduce((a, x) => a + (x.size || 0), 0);
  study.modalities = [...new Set(study.series.map(s => s.modality).filter(Boolean))];
}

/**
 * يضيف صوراً إلى دراسات المالك (ينشئ دراسة جديدة أو يدمج مع موجودة)
 * items: [{ storedName, size, name, meta }]
 * يرجع: { touched: [study...], created: [study...], duplicates: [storedName...] }
 */
function ingest(db, ownerId, items, { title = '', examDate = '', center = '', notes = '', now = new Date().toISOString() } = {}) {
  const touched = new Set(), created = [], duplicates = [];
  for (const it of items) {
    const m = it.meta;
    const key = studyKeyOf(m);
    let study = db.files.find(f => f.ownerId === ownerId && f.kind === 'dicom' && f.studyKey === key && !f.deletedAt);
    if (!study) {
      const desc = m.studyDescription || m.bodyPart || m.seriesDescription || '';
      const label = (m.modality && !desc.toUpperCase().startsWith(m.modality.toUpperCase()) ? `${m.modality} ${desc}` : desc).trim() || m.modality || 'DICOM';
      study = {
        id: uid(), ownerId, kind: 'dicom', category: 'imaging', studyKey: key,
        title: title || label, examDate: examDate || fmtDA(m.studyDate), center: center || m.institution || '',
        notes, originalName: label + '.zip', mime: 'application/dicom', series: [], attachments: [], size: 0, createdAt: now,
      };
      db.files.push(study);
      created.push(study);
    }
    let series = study.series.find(s => s.uid === m.seriesUID);
    if (!series) {
      series = { uid: m.seriesUID, number: m.seriesNumber, description: m.seriesDescription, modality: m.modality, slices: [], size: 0 };
      study.series.push(series);
    }
    // نفس الصورة مرفوعة سابقاً (إعادة رفع نفس القرص)
    if (m.sopUID && study.series.some(s => s.slices.some(x => x.sop === m.sopUID))) { duplicates.push(it.storedName); continue; }
    series.slices.push({ n: it.storedName, i: m.instance, p: m.position, sop: m.sopUID, frames: m.frames > 1 ? m.frames : undefined, size: it.size, name: it.name });
    touched.add(study);
  }
  touched.forEach(refresh);
  return { touched: [...touched], created, duplicates };
}

// كل الملفات المخزنة لهذا العنصر (لحذفها من القرص)
function storedNamesOf(f) {
  if (f.kind === 'dicom' && f.series) {
    return [...f.series.flatMap(s => s.slices.map(x => x.n)), ...(f.attachments || []).map(a => a.storedName)];
  }
  return f.storedName ? [f.storedName] : [];
}

// ما يُرسل للواجهة عن الدراسة (بدون أسماء الملفات المخزنة)
function publicStudy(f) {
  const series = f.series.map((s, idx) => {
    const count = s.slices.length;
    const frames = count === 1 ? (s.slices[0].frames || 1) : 1;
    return { idx, uid: s.uid, number: Number.isFinite(s.number) ? s.number : null, description: s.description || '', modality: s.modality || '', count, frames, images: Math.max(count, frames) };
  });
  return {
    seriesCount: series.length,
    imageCount: series.reduce((a, s) => a + s.images, 0),
    modalities: f.modalities || [],
    series,
    attachments: (f.attachments || []).map(a => ({ id: a.id, originalName: a.originalName, kind: a.kind, size: a.size })),
  };
}

// تحويل البيانات القديمة (سلسلة لكل بطاقة) إلى دراسات، ودمج بطاقات الدراسة الواحدة
function migrate(db, readMeta) {
  let changed = false;
  for (const f of db.files.filter(x => x.kind === 'dicom' && !x.series)) {
    const names = f.slices || [f.storedName];
    const items = names.map(n => ({ storedName: n, meta: readMeta(n), size: 0 }));
    const series = [];
    for (const it of items) {
      const m = it.meta || { seriesUID: 'series-' + f.id };
      let s = series.find(x => x.uid === m.seriesUID);
      if (!s) { s = { uid: m.seriesUID, number: m.seriesNumber, description: m.seriesDescription || '', modality: m.modality || '', slices: [], size: 0 }; series.push(s); }
      s.slices.push({ n: it.storedName, i: m.instance, p: m.position, sop: m.sopUID, frames: m.frames > 1 ? m.frames : (f.frames > 1 ? f.frames : undefined), size: Math.round((f.size || 0) / names.length) });
    }
    const m0 = (items.find(x => x.meta) || {}).meta || {};
    f.studyKey = m0.seriesUID ? studyKeyOf(m0) : 'file:' + f.id;
    f.series = series; f.attachments = f.attachments || [];
    if (!f.center && m0.institution) f.center = m0.institution;
    delete f.slices; delete f.storedName; delete f.frames;
    refresh(f);
    changed = true;
  }
  // دمج البطاقات التي تنتمي لنفس الدراسة ولنفس المالك
  const groups = new Map();
  // الدراسات المحذوفة (في سلة المحذوفات) لا تُدمج مع غيرها
  for (const f of db.files.filter(x => x.kind === 'dicom' && !x.deletedAt)) {
    const k = f.ownerId + '|' + f.studyKey;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const [keep, ...rest] = list;
    for (const r of rest) {
      for (const s of r.series) {
        const t = keep.series.find(x => x.uid === s.uid);
        if (t) s.slices.forEach(x => { if (!x.sop || !t.slices.some(y => y.sop === x.sop)) t.slices.push(x); });
        else keep.series.push(s);
      }
      keep.attachments.push(...(r.attachments || []));
      db.shares.forEach(sh => { sh.fileIds = [...new Set(sh.fileIds.map(id => (id === r.id ? keep.id : id)))]; });
      db.notes.forEach(n => { if (n.fileId === r.id) n.fileId = keep.id; });
      db.files = db.files.filter(x => x !== r);
    }
    refresh(keep);
    changed = true;
  }
  return changed;
}

// إصلاح: صور أشعة رُفعت سابقاً كأنها PDF أو صور (بسبب امتداد مضلل مثل HELPRU.PDF) تُنقل إلى دراساتها
function repairMisdetected(db, { isDicom, readMeta, unlink }) {
  const wrong = db.files.filter(f => f.kind !== 'dicom' && !f.deletedAt && f.storedName && isDicom(f.storedName));
  if (!wrong.length) return 0;
  const owners = [...new Set(wrong.map(f => f.ownerId))];
  let moved = 0;
  for (const ownerId of owners) {
    const files = wrong.filter(f => f.ownerId === ownerId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const items = files.map(f => ({ f, storedName: f.storedName, size: f.size, name: f.originalName, meta: readMeta(f.storedName) })).filter(x => x.meta);
    if (!items.length) continue;
    // العنوان الذي كتبه المستخدم: الجزء المشترك قبل « — » (مثل «CT BRAIN — HELPRU.PDF»)
    const prefixes = [...new Set(items.map(x => (x.f.title || '').split(' — ')[0]))];
    const title = prefixes.length === 1 && items[0].f.title.includes(' — ') ? prefixes[0] : '';
    const first = items[0].f;
    const r = ingest(db, ownerId, items, { title, examDate: first.examDate || '', center: first.center || '', notes: first.notes || '', now: first.createdAt });
    const dup = new Set(r.duplicates);
    for (const it of items) {
      const study = db.files.find(st => st.kind === 'dicom' && !st.deletedAt && st.series && st.series.some(s => s.slices.some(x => x.n === it.storedName)));
      if (dup.has(it.storedName)) unlink(it.storedName);
      db.shares.forEach(sh => { sh.fileIds = [...new Set(sh.fileIds.map(id => (id === it.f.id ? (study ? study.id : null) : id)).filter(Boolean))]; });
      db.notes.forEach(n => { if (n.fileId === it.f.id && study) n.fileId = study.id; });
      db.files = db.files.filter(x => x !== it.f);
      moved++;
    }
  }
  return moved;
}

module.exports = { ingest, storedNamesOf, publicStudy, migrate, refresh, repairMisdetected };
