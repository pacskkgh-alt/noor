/* عارض الملفات الطبية — PDF / صور / فيديو / DICOM (مع تصفح المقاطع) */
window.NoorViewer = (() => {
  let cleanup = null;

  function dispose() { if (cleanup) { cleanup(); cleanup = null; } }

  function mount(stage, { url, kind, t, sliceCount = 1 }) {
    dispose();
    if (kind === 'pdf') {
      stage.innerHTML = `<iframe class="pdf-frame" src="${url}" title="PDF"></iframe>
        <a class="open-tab" href="${url}" target="_blank" rel="noopener">${t('viewer.openTab')}</a>`;
    } else if (kind === 'image') {
      stage.innerHTML = `<div class="img-stage"><img src="${url}" alt=""></div>`;
      const img = stage.querySelector('img');
      img.onclick = () => img.classList.toggle('zoomed');
    } else if (kind === 'video') {
      stage.innerHTML = `<video class="video" src="${url}" controls playsinline preload="metadata"></video>`;
      cleanup = () => { const v = stage.querySelector('video'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); } };
    } else if (kind === 'dicom') {
      mountDicom(stage, url, t, sliceCount);
    } else {
      stage.innerHTML = `<div class="viewer-msg">${t('viewer.unsupported')}</div>`;
    }
  }

  // ---------- قراءة ملف DICOM ----------
  const SUPPORTED_TS = ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1'];
  function decodeDicom(buffer) {
    const bytes = new Uint8Array(buffer);
    const ds = dicomParser.parseDicom(bytes);
    const ts = ds.string('x00020010') || '1.2.840.10008.1.2';
    const pxEl = ds.elements.x7fe00010;
    if (!SUPPORTED_TS.includes(ts) || !pxEl || pxEl.encapsulatedPixelData) { const e = new Error('compressed'); e.code = 'compressed'; throw e; }
    const rows = ds.uint16('x00280010'), cols = ds.uint16('x00280011');
    const bits = ds.uint16('x00280100') || 16;
    const spp = ds.uint16('x00280002') || 1;
    const frames = parseInt(ds.string('x00280008') || '1', 10) || 1;
    const n = rows * cols * spp;
    const info = {
      rows, cols, spp, planar: ds.uint16('x00280006') || 0,
      photo: (ds.string('x00280004') || 'MONOCHROME2').trim(),
      slope: ds.floatString('x00281053') || 1, intercept: ds.floatString('x00281052') || 0,
      wc: ds.floatString('x00281050'), ww: ds.floatString('x00281051'),
      modality: ds.string('x00080060') || '', desc: ds.string('x0008103e') || ds.string('x00081030') || '',
      date: ds.string('x00080020') || '', location: ds.string('x00201041') || (ds.string('x00200032') || '').split('\\')[2] || '',
      frames,
    };
    const signed = ds.uint16('x00280103') === 1;
    const off = bytes.byteOffset + pxEl.dataOffset;
    const frameData = i => {
      const start = off + i * n * (bits / 8);
      if (bits === 8) return new Uint8Array(bytes.buffer, start, n);
      if (start % 2 === 0) return signed ? new Int16Array(bytes.buffer, start, n) : new Uint16Array(bytes.buffer, start, n);
      const copy = bytes.slice(start - bytes.byteOffset, start - bytes.byteOffset + n * 2).buffer;
      return signed ? new Int16Array(copy) : new Uint16Array(copy);
    };
    return { info, frameData };
  }

  async function mountDicom(stage, url, t, sliceCount) {
    stage.innerHTML = `<div class="viewer-msg"><span class="spinner"></span> ${t('viewer.loading')}</div>`;
    let alive = true;
    const sliceUrl = i => sliceCount > 1 ? url + (url.includes('?') ? '&' : '?') + 'slice=' + i : url;
    const fetchBuf = async i => {
      const res = await fetch(sliceUrl(i), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('fetch');
      return res.arrayBuffer();
    };

    // كل صورة = { info, data }
    const cache = new Map();
    let first, total;
    try {
      const decoded = decodeDicom(await fetchBuf(0));
      first = decoded;
      total = sliceCount > 1 ? sliceCount : decoded.info.frames;
      cache.set(0, Promise.resolve({ info: decoded.info, data: decoded.frameData(0) }));
    } catch (e) {
      stage.innerHTML = `<div class="viewer-msg">${t(e.code === 'compressed' ? 'viewer.dicomCompressed' : 'viewer.dicomError')}</div>`;
      return;
    }
    const getImage = i => {
      if (!cache.has(i)) {
        cache.set(i, (async () => {
          if (sliceCount > 1) { const d = decodeDicom(await fetchBuf(i)); return { info: d.info, data: d.frameData(0) }; }
          return { info: first.info, data: first.frameData(i) };
        })());
      }
      return cache.get(i);
    };

    let cur = await getImage(0);
    const fi = cur.info;
    const range = () => { let mn = Infinity, mx = -Infinity; for (const v of cur.data) { if (v < mn) mn = v; if (v > mx) mx = v; } return [mn * fi.slope + fi.intercept, mx * fi.slope + fi.intercept]; };
    const [mn, mx] = range();
    const initWL = () => (fi.ww ? [fi.wc, fi.ww] : [(mn + mx) / 2, Math.max(1, mx - mn)]);
    let [wc, ww] = initWL();
    let idx = 0, invert = fi.photo === 'MONOCHROME1', zoom = 1, panX = 0, panY = 0;
    let tool = total > 1 ? 'scroll' : 'wl';
    const multi = total > 1;

    const fmtDA = s => s && s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : '';
    const header = [fi.modality, fi.desc, fmtDA(fi.date)].filter(Boolean).join(' • ');
    stage.innerHTML = `
      <div class="dcm">
        <div class="dcm-tools">
          ${multi ? `<button data-tool="scroll" class="on" title="${t('viewer.scroll')}">⇅ <span>${t('viewer.scroll')}</span></button>` : ''}
          <button data-tool="wl" class="${multi ? '' : 'on'}" title="${t('viewer.wl')}">◐ <span>${t('viewer.wl')}</span></button>
          <button data-tool="pan" title="${t('viewer.pan')}">✥ <span>${t('viewer.pan')}</span></button>
          <button data-a="zin" title="+">＋</button><button data-a="zout" title="−">－</button>
          <button data-a="invert">${t('viewer.invert')}</button>
          <button data-a="reset">${t('viewer.reset')}</button>
          ${multi ? `<span class="dcm-load" dir="ltr"></span>` : ''}
        </div>
        <div class="dcm-view" tabindex="0"><canvas></canvas>
          <div class="dcm-ov tl" dir="ltr">${esc(header)}</div>
          ${multi ? `<div class="dcm-ov tr" dir="ltr"></div>` : ''}
          <div class="dcm-ov br" dir="ltr"></div>
          <div class="dcm-hint">${t(multi ? 'viewer.seriesHint' : 'viewer.dicomHint')}</div>
          <div class="dcm-wait" hidden><span class="spinner"></span></div>
        </div>
        ${multi ? `<div class="dcm-frames"><span class="dcm-count" dir="ltr">1 / ${total}</span><input type="range" min="1" max="${total}" value="1" dir="ltr" aria-label="${t('viewer.slice')}"></div>` : ''}
      </div>`;
    const canvas = stage.querySelector('canvas'), ctx = canvas.getContext('2d');
    const viewEl = stage.querySelector('.dcm-view'), ovBR = stage.querySelector('.br'), ovTR = stage.querySelector('.tr');
    const slider = stage.querySelector('.dcm-frames input'), countEl = stage.querySelector('.dcm-count');
    const waitEl = stage.querySelector('.dcm-wait'), loadEl = stage.querySelector('.dcm-load');
    let img = null;

    // تكبير الصورة لتملأ مساحة العرض مع الحفاظ على نسبتها
    function fit() {
      const w = viewEl.clientWidth, h = viewEl.clientHeight;
      if (!w || !h || !canvas.width) return;
      const k = Math.min(w / canvas.width, h / canvas.height);
      canvas.style.width = Math.floor(canvas.width * k) + 'px';
      canvas.style.height = Math.floor(canvas.height * k) + 'px';
    }
    const ro = new ResizeObserver(fit);
    ro.observe(viewEl);

    function draw() {
      const { info, data } = cur;
      if (canvas.width !== info.cols || canvas.height !== info.rows || !img) {
        canvas.width = info.cols; canvas.height = info.rows; img = ctx.createImageData(info.cols, info.rows);
        fit();
      }
      const d = img.data, n = info.rows * info.cols, lo = wc - ww / 2, k = 255 / ww, s = info.slope, b = info.intercept;
      for (let i = 0; i < n; i++) {
        let r, g, bl;
        if (info.spp === 3) {
          const get = c => info.planar ? data[c * n + i] : data[i * 3 + c];
          r = get(0); g = get(1); bl = get(2);
        } else {
          let y = ((data[i] * s + b) - lo) * k;
          y = y < 0 ? 0 : y > 255 ? 255 : y;
          if (invert) y = 255 - y;
          r = g = bl = y;
        }
        const o = i * 4; d[o] = r; d[o + 1] = g; d[o + 2] = bl; d[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      ovBR.textContent = `${info.cols}×${info.rows}  WL ${Math.round(wc)} / WW ${Math.round(ww)}  ${Math.round(zoom * 100)}%`;
      if (ovTR) ovTR.textContent = `${t('viewer.slice')} ${idx + 1}/${total}${info.location ? `  Z ${(+info.location).toFixed(1)}` : ''}`;
      if (slider) { slider.value = idx + 1; countEl.textContent = `${idx + 1} / ${total}`; }
    }
    draw();

    let pending = null;
    async function goTo(i) {
      i = Math.max(0, Math.min(total - 1, i));
      if (i === idx && !pending) return;
      idx = i;
      const req = pending = getImage(i);
      const ready = await Promise.race([req, new Promise(r => setTimeout(() => r(null), 60))]);
      if (!ready) waitEl.hidden = false;
      try { const im = await req; if (alive && pending === req) { cur = im; draw(); } }
      catch { /* سيُعرض المقطع السابق */ }
      if (pending === req) { pending = null; waitEl.hidden = true; }
    }

    // تحميل كل المقاطع في الخلفية (4 في نفس الوقت)
    if (multi) {
      let loaded = 1, next = 1;
      const worker = async () => {
        while (alive && next < total) {
          const i = next++;
          try { await getImage(i); } catch {}
          loaded++;
          if (loadEl) loadEl.textContent = loaded < total ? `${t('viewer.loadingSlices')} ${loaded}/${total}` : '';
        }
      };
      for (let w = 0; w < 4; w++) worker();
    }

    // ---- التفاعل بالفأرة واللمس ----
    let drag = null;
    const pt = e => (e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY });
    const hideHint = () => stage.querySelector('.dcm-hint')?.remove();
    const down = e => { const p = pt(e); drag = { x: p.x, y: p.y, wc, ww, panX, panY, idx }; viewEl.classList.add('dragging'); hideHint(); };
    const move = e => {
      if (!drag) return;
      const p = pt(e), dx = p.x - drag.x, dy = p.y - drag.y;
      if (tool === 'scroll') goTo(drag.idx + Math.round(dy / 8));
      else if (tool === 'wl' && fi.spp === 1) {
        const k = Math.max(1, ww > 0 ? (fi.ww || (mx - mn)) / 300 : 1);
        ww = Math.max(1, drag.ww + dx * k);
        wc = drag.wc + dy * k;
        requestAnimationFrame(draw);
      } else { panX = drag.panX + dx; panY = drag.panY + dy; requestAnimationFrame(draw); }
      if (e.cancelable) e.preventDefault();
    };
    const up = () => { drag = null; viewEl.classList.remove('dragging'); };
    const wheel = e => {
      e.preventDefault(); hideHint();
      if (multi && !e.ctrlKey && !e.metaKey) { goTo(idx + (e.deltaY > 0 ? 1 : -1)); return; }
      zoom = Math.min(8, Math.max(0.25, zoom * (e.deltaY < 0 ? 1.12 : 0.89))); draw();
    };
    const key = e => {
      if (!multi) return;
      if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); goTo(idx + 1); }
      if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); goTo(idx - 1); }
      if (e.key === 'Home') goTo(0);
      if (e.key === 'End') goTo(total - 1);
    };

    viewEl.addEventListener('mousedown', down);
    viewEl.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    viewEl.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('keydown', key);
    viewEl.focus({ preventScroll: true });
    cleanup = () => {
      alive = false;
      ro.disconnect();
      window.removeEventListener('mousemove', move); window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up);
      document.removeEventListener('keydown', key);
    };

    stage.querySelector('.dcm-tools').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tool) {
        tool = b.dataset.tool;
        stage.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === b));
      }
      const a = b.dataset.a;
      if (a === 'zin') zoom = Math.min(8, zoom * 1.25);
      if (a === 'zout') zoom = Math.max(0.25, zoom / 1.25);
      if (a === 'invert') invert = !invert;
      if (a === 'reset') { [wc, ww] = initWL(); zoom = 1; panX = panY = 0; invert = fi.photo === 'MONOCHROME1'; }
      draw();
    };
    if (slider) slider.oninput = () => goTo(slider.value - 1);
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`); }

  return { mount, dispose };
})();
