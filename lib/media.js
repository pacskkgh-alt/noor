// معالجة الوسائط: التعرف على نوع الملف، قراءة بيانات DICOM، ضغط الصور والفيديو، وإنشاء ملفات ZIP
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const sharp = require('sharp');
const dicomParser = require('dicom-parser');

let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); if (!fs.existsSync(ffmpegPath)) ffmpegPath = null; } catch {}

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v'];
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
  '.pdf': 'application/pdf', '.dcm': 'application/dicom',
};

function hasDicomMagic(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const b = Buffer.alloc(4);
    const n = fs.readSync(fd, b, 0, 4, 128);
    fs.closeSync(fd);
    return n === 4 && b.toString('latin1') === 'DICM';
  } catch { return false; }
}

// يحدد نوع الملف من امتداده، أو من محتواه لملفات الأشعة التي بلا امتداد
function detectKind(filePath, name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (['.dcm', '.dicom'].includes(ext)) return 'dicom';
  if (path.basename(name).toUpperCase() === 'DICOMDIR') return null;
  if (hasDicomMagic(filePath)) return 'dicom';
  return null;
}

// يقرأ بيانات الترتيب والتجميع من ملف DICOM (بدون بيانات الصورة)
function readDicomMeta(filePath) {
  try {
    const bytes = fs.readFileSync(filePath);
    const ds = dicomParser.parseDicom(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length));
    if (!ds.elements.x7fe00010) return null; // ليس صورة (مثل DICOMDIR أو تقرير منظم)
    const ipp = (ds.string('x00200032') || '').split('\\').map(Number);
    return {
      seriesUID: ds.string('x0020000e') || 'series',
      seriesDescription: (ds.string('x0008103e') || ds.string('x00081030') || '').trim(),
      modality: (ds.string('x00080060') || '').trim(),
      studyDate: ds.string('x00080020') || '',
      instance: parseInt(ds.string('x00200013') || '', 10),
      position: ipp.length === 3 && ipp.every(Number.isFinite) ? ipp[2] : parseFloat(ds.string('x00201041') || 'NaN'),
    };
  } catch { return null; }
}

function sortSlices(items) {
  return items.sort((a, b) => {
    const ai = a.meta.instance, bi = b.meta.instance;
    if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
    const ap = a.meta.position, bp = b.meta.position;
    if (Number.isFinite(ap) && Number.isFinite(bp) && ap !== bp) return bp - ap;
    return a.name.localeCompare(b.name, 'en', { numeric: true });
  });
}

// ضغط الصورة بجودة عالية مع الحفاظ على أبعادها، ولا يُحفظ الناتج إلا إذا كان أصغر بوضوح
async function compressImage(dir, storedName, originalName) {
  const input = path.join(dir, storedName);
  const ext = path.extname(storedName).toLowerCase();
  const originalSize = fs.statSync(input).size;
  if (ext === '.gif') return null;
  const base = () => sharp(input, { failOn: 'none' }).rotate();
  const candidates = [];
  if (ext === '.jpg' || ext === '.jpeg') {
    candidates.push({ ext, buf: await base().jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer() });
  } else if (ext === '.png') {
    candidates.push({ ext, buf: await base().png({ compressionLevel: 9, effort: 10 }).toBuffer() });
    candidates.push({ ext: '.webp', buf: await base().webp({ nearLossless: true, quality: 80, effort: 5 }).toBuffer() });
  } else if (ext === '.webp') {
    candidates.push({ ext, buf: await base().webp({ quality: 90, effort: 5 }).toBuffer() });
  }
  const best = candidates.sort((a, b) => a.buf.length - b.buf.length)[0];
  if (!best || best.buf.length > originalSize * 0.95) return null;
  const newName = crypto.randomBytes(16).toString('hex') + best.ext;
  fs.writeFileSync(path.join(dir, newName), best.buf);
  fs.unlinkSync(input);
  return {
    storedName: newName, size: best.buf.length, originalSize, mime: MIME[best.ext],
    originalName: best.ext === ext ? originalName : originalName.replace(/\.[^.]+$/, '') + best.ext,
  };
}

// ضغط الفيديو بصيغة H.264 مع الحفاظ على الدقة الأصلية
function compressVideo(dir, storedName) {
  return new Promise(resolve => {
    if (!ffmpegPath) return resolve(null);
    const input = path.join(dir, storedName);
    const originalSize = fs.statSync(input).size;
    const outName = crypto.randomBytes(16).toString('hex') + '.mp4';
    const output = path.join(dir, outName);
    const p = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; if (err.length > 4000) err = err.slice(-4000); });
    const timer = setTimeout(() => p.kill('SIGKILL'), 60 * 60 * 1000);
    p.on('close', code => {
      clearTimeout(timer);
      const ok = code === 0 && fs.existsSync(output);
      const size = ok ? fs.statSync(output).size : 0;
      if (!ok || size > originalSize * 0.95) {
        if (!ok) console.error('ffmpeg failed:', err.trim().slice(-500));
        try { fs.unlinkSync(output); } catch {}
        return resolve(null);
      }
      resolve({ storedName: outName, size, originalSize, mime: 'video/mp4' });
    });
  });
}

// ---- ZIP بدون ضغط (لتحميل دراسة أشعة كاملة) ----
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function sendZip(res, entries, zipName) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const data = fs.readFileSync(e.path);
    const name = Buffer.from(e.name, 'utf8');
    const crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
    h.writeUInt32LE(0, 10); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
    res.write(h); res.write(name); res.write(data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(0, 10); c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  res.end(Buffer.concat([cd, end]));
}

module.exports = { detectKind, readDicomMeta, sortSlices, compressImage, compressVideo, sendZip, MIME, hasFfmpeg: !!ffmpegPath };
