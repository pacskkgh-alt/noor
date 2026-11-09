/* عارض الملفات الطبية — PDF / صور / فيديو / DICOM */
window.NoorViewer = (() => {
  let cleanup = null;

  function dispose() { if (cleanup) { cleanup(); cleanup = null; } }

  function mount(stage, { url, kind, t }) {
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
      mountDicom(stage, url, t);
    } else {
      stage.innerHTML = `<div class="viewer-msg">${t('viewer.unsupported')}</div>`;
    }
  }

  async function mountDicom(stage, url, t) {
    stage.innerHTML = `<div class="viewer-msg"><span class="spinner"></span> ${t('viewer.loading')}</div>`;
    let ds, bytes;
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('fetch');
      bytes = new Uint8Array(await res.arrayBuffer());
      ds = dicomParser.parseDicom(bytes);
    } catch (e) {
      stage.innerHTML = `<div class="viewer-msg">${t('viewer.dicomError')}</div>`;
      return;
    }
    const ts = ds.string('x00020010') || '1.2.840.10008.1.2';
    const supported = ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1'];
    const pxEl = ds.elements.x7fe00010;
    if (!supported.includes(ts) || !pxEl || pxEl.encapsulatedPixelData) {
      stage.innerHTML = `<div class="viewer-msg">${t('viewer.dicomCompressed')}</div>`;
      return;
    }
    const rows = ds.uint16('x00280010'), cols = ds.uint16('x00280011');
    const bits = ds.uint16('x00280100') || 16;
    const signed = ds.uint16('x00280103') === 1;
    const spp = ds.uint16('x00280002') || 1;
    const planar = ds.uint16('x00280006') || 0;
    const photo = (ds.string('x00280004') || 'MONOCHROME2').trim();
    const slope = ds.floatString('x00281053') || 1;
    const intercept = ds.floatString('x00281052') || 0;
    const frames = parseInt(ds.string('x00280008') || '1', 10) || 1;
    const frameBytes = rows * cols * spp * (bits / 8);
    const view = new DataView(bytes.buffer, bytes.byteOffset + pxEl.dataOffset, Math.min(pxEl.length, bytes.length - pxEl.dataOffset));

    function framePixels(i) {
      const n = rows * cols, out = new Float32Array(n * spp), base = i * frameBytes;
      for (let k = 0; k < n * spp; k++) {
        let v;
        if (bits === 8) v = view.getUint8(base + k);
        else v = signed ? view.getInt16(base + k * 2, true) : view.getUint16(base + k * 2, true);
        out[k] = v * slope + intercept;
      }
      return out;
    }

    let frame = 0, px = framePixels(0);
    const range = () => { let mn = Infinity, mx = -Infinity; for (const v of px) { if (v < mn) mn = v; if (v > mx) mx = v; } return [mn, mx]; };
    let [mn, mx] = range();
    const defWC = ds.floatString('x00281050'), defWW = ds.floatString('x00281051');
    const initWL = () => (defWW ? [defWC, defWW] : [(mn + mx) / 2, Math.max(1, mx - mn)]);
    let [wc, ww] = initWL();
    let invert = photo === 'MONOCHROME1', zoom = 1, panX = 0, panY = 0, tool = 'wl';

    const info = [ds.string('x00080060'), ds.string('x00081030'), fmtDA(ds.string('x00080020'))].filter(Boolean).join(' • ');
    stage.innerHTML = `
      <div class="dcm">
        <div class="dcm-tools">
          <button data-tool="wl" class="on" title="${t('viewer.wl')}">◐ <span>${t('viewer.wl')}</span></button>
          <button data-tool="pan" title="${t('viewer.pan')}">✥ <span>${t('viewer.pan')}</span></button>
          <button data-a="zin">＋</button><button data-a="zout">－</button>
          <button data-a="invert">${t('viewer.invert')}</button>
          <button data-a="reset">${t('viewer.reset')}</button>
        </div>
        <div class="dcm-view"><canvas></canvas>
          <div class="dcm-ov tl" dir="ltr">${esc(info)}</div>
          <div class="dcm-ov br" dir="ltr"></div>
          <div class="dcm-hint">${t('viewer.dicomHint')}</div>
        </div>
        ${frames > 1 ? `<div class="dcm-frames"><input type="range" min="1" max="${frames}" value="1"><span>1 / ${frames}</span></div>` : ''}
      </div>`;
    const canvas = stage.querySelector('canvas'), ctx = canvas.getContext('2d');
    const viewEl = stage.querySelector('.dcm-view'), ov = stage.querySelector('.br');
    canvas.width = cols; canvas.height = rows;
    const img = ctx.createImageData(cols, rows);

    function draw() {
      const d = img.data, n = rows * cols, lo = wc - ww / 2;
      for (let i = 0; i < n; i++) {
        let r, g, b;
        if (spp === 3) {
          const get = c => planar ? px[c * n + i] : px[i * 3 + c];
          r = get(0); g = get(1); b = get(2);
        } else {
          let y = ((px[i] - lo) / ww) * 255;
          y = y < 0 ? 0 : y > 255 ? 255 : y;
          if (invert) y = 255 - y;
          r = g = b = y;
        }
        const o = i * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      ov.textContent = `${cols}×${rows}  WL ${Math.round(wc)} / WW ${Math.round(ww)}  ${Math.round(zoom * 100)}%`;
    }
    draw();

    let drag = null;
    const down = e => { const p = pt(e); drag = { x: p.x, y: p.y, wc, ww, panX, panY }; viewEl.classList.add('dragging'); stage.querySelector('.dcm-hint')?.remove(); };
    const move = e => {
      if (!drag) return;
      const p = pt(e), dx = p.x - drag.x, dy = p.y - drag.y;
      if (tool === 'wl' && spp === 1) {
        const k = Math.max(1, (mx - mn) / 400);
        ww = Math.max(1, drag.ww + dx * k * (document.dir === 'rtl' ? -1 : 1));
        wc = drag.wc + dy * k;
      } else { panX = drag.panX + dx; panY = drag.panY + dy; }
      requestAnimationFrame(draw);
      if (e.cancelable) e.preventDefault();
    };
    const up = () => { drag = null; viewEl.classList.remove('dragging'); };
    const pt = e => (e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY });
    const wheel = e => { e.preventDefault(); zoom = Math.min(8, Math.max(0.25, zoom * (e.deltaY < 0 ? 1.12 : 0.89))); draw(); };

    viewEl.addEventListener('mousedown', down);
    viewEl.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    viewEl.addEventListener('wheel', wheel, { passive: false });
    cleanup = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up);
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
      if (a === 'reset') { [wc, ww] = initWL(); zoom = 1; panX = panY = 0; invert = photo === 'MONOCHROME1'; }
      draw();
    };
    const slider = stage.querySelector('.dcm-frames input');
    if (slider) slider.oninput = () => {
      frame = slider.value - 1; px = framePixels(frame);
      slider.nextElementSibling.textContent = `${frame + 1} / ${frames}`; draw();
    };
  }

  function fmtDA(s) { return s && s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : ''; }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`); }

  return { mount, dispose };
})();
