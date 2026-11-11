// توليد ملفات تجريبية (تقرير PDF وصورة أشعة DICOM) لعرض المنصة
function makePdf(lines) {
  const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let y = 780;
  const content = lines.map(([size, text, bold]) => {
    const s = `BT /${bold ? 'F2' : 'F1'} ${size} Tf 60 ${y} Td (${esc(text)}) Tj ET`;
    y -= size + 12;
    return s;
  }).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function makeDicom({ patientName = 'DEMO^PATIENT', studyDate = '20261101', size = 512, pixelFn = null, modality = 'CR', description = 'CHEST PA',
  seriesUID = null, instance = 1, position = null, intercept = 0, wc = 1600, ww = 2800 } = {}) {
  const parts = [];
  const str = (v, pad = ' ') => { let b = Buffer.from(v, 'latin1'); if (b.length % 2) b = Buffer.concat([b, Buffer.from(pad)]); return b; };
  const us = v => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
  const ul = v => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
  const el = (g, e, vr, val) => {
    const long = ['OB', 'OW', 'OF', 'SQ', 'UT', 'UN'].includes(vr);
    const h = Buffer.alloc(long ? 12 : 8);
    h.writeUInt16LE(g, 0); h.writeUInt16LE(e, 2); h.write(vr, 4, 'latin1');
    if (long) h.writeUInt32LE(val.length, 8); else h.writeUInt16LE(val.length, 6);
    return Buffer.concat([h, val]);
  };
  const sop = '1.2.840.10008.5.1.4.1.1.1';
  const inst = '1.2.826.0.1.3680043.10.999.' + Date.now();
  const metaBody = Buffer.concat([
    el(2, 1, 'OB', Buffer.from([0, 1])),
    el(2, 2, 'UI', str(sop, '\0')),
    el(2, 3, 'UI', str(inst, '\0')),
    el(2, 0x10, 'UI', str('1.2.840.10008.1.2.1', '\0')),
  ]);
  parts.push(Buffer.alloc(128), Buffer.from('DICM'), el(2, 0, 'UL', ul(metaBody.length)), metaBody);

  // صورة صدر اصطناعية
  const N = size, px = Buffer.alloc(N * N * 2);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x - N / 2) / (N / 2), v = (y - N / 2) / (N / 2);
    let val = 150;
    if ((u * u) / 0.8 + (v * v) / 0.95 < 1) val = 2100;
    for (const cx of [-0.38, 0.38]) {
      const lu = (u - cx) / 0.3, lv = (v + 0.05) / 0.62;
      if (lu * lu + lv * lv < 1) val = 700 + 300 * (lu * lu + lv * lv);
    }
    const hu = (u + 0.1) / 0.22, hv = (v - 0.2) / 0.28;
    if (hu * hu + hv * hv < 1 && u < 0.15) val = Math.max(val, 1800);
    if (Math.abs(u) < 0.06) val = Math.max(val, 2700);
    for (let r = 0; r < 8; r++) {
      const ry = -0.55 + r * 0.14 + 0.18 * u * u;
      if (Math.abs(v - ry) < 0.018 && Math.abs(u) < 0.7 && Math.abs(u) > 0.06) val = Math.max(val, 2300);
    }
    val += (rnd() - 0.5) * 120;
    if (pixelFn) val = pixelFn(u, v, rnd);
    px.writeUInt16LE(Math.max(0, Math.min(4095, Math.round(val))), (y * N + x) * 2);
  }
  parts.push(
    el(8, 0x16, 'UI', str(sop, '\0')),
    el(8, 0x18, 'UI', str(inst, '\0')),
    el(8, 0x20, 'DA', str(studyDate)),
    el(8, 0x60, 'CS', str(modality)),
    el(8, 0x1030, 'LO', str(description)),
    el(8, 0x103e, 'LO', str(description)),
    el(0x10, 0x10, 'PN', str(patientName)),
    el(0x20, 0x0e, 'UI', str(seriesUID || inst + '.1', '\0')),
    el(0x20, 0x13, 'IS', str(String(instance))),
    ...(position !== null ? [el(0x20, 0x32, 'DS', str(`0\\0\\${position}`))] : []),
    el(0x28, 2, 'US', us(1)),
    el(0x28, 4, 'CS', str('MONOCHROME2')),
    el(0x28, 0x10, 'US', us(N)),
    el(0x28, 0x11, 'US', us(N)),
    el(0x28, 0x100, 'US', us(16)),
    el(0x28, 0x101, 'US', us(12)),
    el(0x28, 0x102, 'US', us(11)),
    el(0x28, 0x103, 'US', us(0)),
    el(0x28, 0x1050, 'DS', str(String(wc))),
    el(0x28, 0x1051, 'DS', str(String(ww))),
    el(0x28, 0x1052, 'DS', str(String(intercept))),
    el(0x28, 0x1053, 'DS', str('1')),
    el(0x7fe0, 0x10, 'OW', px),
  );
  return Buffer.concat(parts);
}

// دراسة أشعة مقطعية للرأس (عدة مقاطع) لعرض خاصية التصفح بين المقاطع
function makeHeadCT({ slices = 48, patientName = 'AHMED^SARA', studyDate = '20261105' } = {}) {
  const seriesUID = '1.2.826.0.1.3680043.10.999.' + Date.now() + '.2';
  const out = [];
  for (let s = 0; s < slices; s++) {
    const z = -1 + (2 * s + 1) / slices; // من أسفل الرأس إلى أعلاه
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const pixelFn = (u, v, rnd) => {
      const ax = 0.78 * r, ay = 0.92 * r;
      if (ax < 0.05) return 1024 - 1000;
      const d = (u * u) / (ax * ax) + (v * v) / (ay * ay);
      let hu = -1000;
      if (d < 1.12) hu = 30;                       // جلد ونسيج
      if (d < 1.0) hu = 900;                       // الجمجمة
      if (d < 0.86) hu = 34 + (rnd() - 0.5) * 6;   // الدماغ
      if (d < 0.86 && d > 0.55 && z > -0.3) hu = 40 + (rnd() - 0.5) * 6; // المادة الرمادية
      const vz = 1 - Math.pow((z - 0.15) / 0.35, 2);
      if (vz > 0) for (const cx of [-0.12, 0.12]) {   // البطينات
        const du = (u - cx) / (0.07 * vz + 0.01), dv = (v + 0.05) / (0.3 * vz + 0.02);
        if (du * du + dv * dv < 1 && d < 0.86) hu = 5;
      }
      if (z < -0.35 && d < 0.86) {                     // تجاويف الجيوب الأنفية
        const du = u / 0.2, dv = (v + 0.55) / 0.18;
        if (du * du + dv * dv < 1) hu = -950;
      }
      return hu + 1024;
    };
    out.push(makeDicom({
      patientName, studyDate, size: 256, pixelFn, modality: 'CT', description: 'HEAD WITHOUT CONTRAST',
      seriesUID, instance: s + 1, position: Math.round((z * 90) * 10) / 10, intercept: -1024, wc: 40, ww: 80,
    }));
  }
  return out;
}

module.exports = { makePdf, makeDicom, makeHeadCT };
