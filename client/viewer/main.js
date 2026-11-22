/* عارض الأشعة الاحترافي لمنصة نور — مبني على Cornerstone3D
 * يُحمَّل عند الحاجة فقط (import ديناميكي) ويعرض نفسه على window.NoorProViewer */
import {
  init as csInit, RenderingEngine, Enums, imageLoader, volumeLoader, setVolumesForViewports, cache, metaData,
  cornerstoneStreamingImageVolumeLoader, utilities as csUtils,
} from '@cornerstonejs/core';
import { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader';
import * as csTools from '@cornerstonejs/tools';
import './viewer.css';

const {
  ToolGroupManager, Enums: ToolEnums, addTool, annotation,
  WindowLevelTool, PanTool, ZoomTool, StackScrollTool, LengthTool, AngleTool,
  EllipticalROITool, RectangleROITool, EraserTool, CrosshairsTool,
} = csTools;
const { MouseBindings } = ToolEnums;
const { ViewportType, OrientationAxis, Events } = Enums;

// ---------- التهيئة (مرة واحدة) ----------
let ready = null;
function initOnce() {
  if (!ready) {
    ready = (async () => {
      await csInit();
      dicomImageLoaderInit({ maxWebWorkers: Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) >> 1)) });
      volumeLoader.registerVolumeLoader('cornerstoneStreamingImageVolume', cornerstoneStreamingImageVolumeLoader);
      // ملفات حقيقية تحمل أحياناً مسافة بكسل صفرية أو غير صالحة (مثل 0.000\0.000) فتتعطل الكاميرا والقياس؛ نصححها
      let fixing = false;
      metaData.addProvider((type, imageId) => {
        if (fixing || (type !== 'imagePlaneModule' && type !== 'generalImageModule')) return undefined;
        let m;
        fixing = true;
        try { m = metaData.get(type, imageId); } finally { fixing = false; }
        if (!m) return undefined;
        const ok = v => Number.isFinite(+v) && +v > 0;
        if (type === 'imagePlaneModule' && !(ok(m.rowPixelSpacing) && ok(m.columnPixelSpacing))) {
          return { ...m, rowPixelSpacing: 1, columnPixelSpacing: 1, pixelSpacing: [1, 1], usingDefaultValues: true };
        }
        if (type === 'generalImageModule' && m.pixelSpacing && !m.pixelSpacing.every(ok)) return { ...m, pixelSpacing: undefined };
        return m;
      }, 10000);
      csTools.init();
      [WindowLevelTool, PanTool, ZoomTool, StackScrollTool, LengthTool, AngleTool, EllipticalROITool, RectangleROITool, EraserTool, CrosshairsTool]
        .forEach(T => addTool(T));
    })();
  }
  return ready;
}

// ---------- الإعدادات الجاهزة للتباين (CT بوحدة HU) ----------
const PRESETS = [
  { key: 'brain', c: 40, w: 80 },
  { key: 'subdural', c: 75, w: 215 },
  { key: 'stroke', c: 40, w: 40 },
  { key: 'lung', c: -600, w: 1500 },
  { key: 'mediastinum', c: 50, w: 350 },
  { key: 'abdomen', c: 40, w: 400 },
  { key: 'liver', c: 60, w: 160 },
  { key: 'bone', c: 480, w: 2500 },
];

const MEASURE_TOOLS = {
  length: LengthTool.toolName, angle: AngleTool.toolName,
  ellipse: EllipticalROITool.toolName, rect: RectangleROITool.toolName, eraser: EraserTool.toolName,
};
const NAV_TOOLS = { wl: WindowLevelTool.toolName, pan: PanTool.toolName, zoom: ZoomTool.toolName, scroll: StackScrollTool.toolName };
const ALL_PRIMARY = { ...NAV_TOOLS, ...MEASURE_TOOLS };

const I = { // أيقونات صغيرة
  scroll: '<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>',
  wl: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  pan: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  zoom: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5M11 8v6M8 11h6"/>',
  length: '<path d="M4 20 20 4M7 17l-2-2M10 14l-2-2M13 11l-2-2M16 8l-2-2"/>',
  angle: '<path d="M4 20h16M4 20 15 6"/><path d="M10 20a6 6 0 0 0-1.5-4"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  eraser: '<path d="M7 20h12M5 15l8-8 6 6-5 5H9z"/>',
  clear: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  flipH: '<path d="M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z"/>',
  flipV: '<path d="M3 12h18M7 8l5-5 5 5zM7 16l5 5 5-5z"/>',
  invert: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',
  l1: '<rect x="4" y="4" width="16" height="16" rx="1"/>',
  l2: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14"/>',
  l4: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M12 3v18M3 12h18"/>',
  mpr: '<rect x="3" y="3" width="11" height="18" rx="1"/><rect x="16" y="3" width="5" height="8" rx="1"/><rect x="16" y="13" width="5" height="8" rx="1"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"/>',
  more: '<path d="M4 6h16M4 12h16M4 18h10"/>',
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

let current = null;
let seq = 0;

export function dispose() {
  if (current) { try { current.destroy(); } catch (e) { console.warn(e); } current = null; }
}

/**
 * @param stage عنصر العرض
 * @param opts { t, mode: 'full'|'simple', series: [{ id, title, sliceCount, urlFor(i) }], index }
 */
export async function mount(stage, opts) {
  dispose();
  const { t } = opts;
  const id = ++seq;
  stage.innerHTML = `<div class="pv-msg"><span class="pv-spin"></span> ${esc(t('viewer.loading'))}</div>`;
  await initOnce();
  if (id !== seq) return; // فُتح ملف آخر أثناء التحميل
  current = new ProViewer(stage, opts);
  await current.start();
}

// ============================================================
class ProViewer {
  constructor(stage, { t, mode = 'full', series = [], index = 0, stripCount }) {
    this.stage = stage; this.t = t; this.series = series;
    // عدد سلاسل الدراسة الحالية (تظهر في الشريط)؛ ما بعدها سلاسل دراسات أخرى للمقارنة
    this.stripCount = Math.min(series.length, stripCount ?? series.length);
    this.advanced = mode === 'full';
    this.simpleMode = mode !== 'full';
    this.uid = 'pv' + (++seq) + Date.now().toString(36);
    this.engine = new RenderingEngine(this.uid);
    this.toolGroup = null; this.mprGroup = null;
    this.layout = 1; this.mpr = false; this.linked = true;
    this.panes = [{ seriesIndex: index }];
    this.primary = 'scroll';
    this.playing = false; this.fps = 12;
    this.listeners = [];
    this.destroyed = false;
  }

  // كل مقطع ملف مستقل، أو ملف واحد متعدد الإطارات (frame يجب أن يكون آخر معامل في الرابط)
  imageIdsFor(s) {
    const n = Math.max(1, s.sliceCount || 1);
    if (n === 1 && (s.frames || 1) > 1) {
      const base = new URL(s.urlFor(0), location.href).href;
      return Array.from({ length: s.frames }, (_, i) => 'wadouri:' + base + (base.includes('?') ? '&' : '?') + 'frame=' + (i + 1));
    }
    return Array.from({ length: n }, (_, i) => 'wadouri:' + new URL(s.urlFor(i), location.href).href);
  }
  count(s) { return Math.max(s?.sliceCount || 1, s?.frames || 1); }

  // ---------- البناء ----------
  async start() {
    const t = this.t;
    const adv = this.advanced;
    this.stage.innerHTML = `
      <div class="pv ${adv ? 'pv-adv' : 'pv-simple'}" tabindex="0">
        <div class="pv-bar">
          <div class="pv-group">
            ${this.btn('tool', 'scroll', 'viewer.scroll', 'S')}
            ${this.btn('tool', 'wl', 'viewer.wl', 'W')}
            ${this.btn('tool', 'pan', 'viewer.pan', 'P')}
            ${this.btn('tool', 'zoom', 'viewer.zoom', 'Z')}
          </div>
          <div class="pv-group">
            <select class="pv-preset" title="${esc(t('viewer.presets'))}">
              <option value="">${esc(t('viewer.presets'))}</option>
              <option value="auto">${esc(t('viewer.preset.auto'))}</option>
              ${PRESETS.map(p => `<option value="${p.key}">${esc(t('viewer.preset.' + p.key))}</option>`).join('')}
            </select>
          </div>
          <div class="pv-group pv-adv-only">
            ${this.btn('tool', 'length', 'viewer.length', 'L')}
            ${this.btn('tool', 'angle', 'viewer.angle', 'A')}
            ${this.btn('tool', 'ellipse', 'viewer.ellipse', 'E')}
            ${this.btn('tool', 'rect', 'viewer.rect', 'R')}
            ${this.btn('tool', 'eraser', 'viewer.eraser', 'D')}
            ${this.btn('act', 'clear', 'viewer.clear')}
          </div>
          <div class="pv-group pv-adv-only">
            ${this.btn('act', 'rotate', 'viewer.rotate', '.')}
            ${this.btn('act', 'flipH', 'viewer.flipH', 'H')}
            ${this.btn('act', 'flipV', 'viewer.flipV', 'V')}
            ${this.btn('act', 'invert', 'viewer.invert', 'I')}
          </div>
          <div class="pv-group pv-cine">
            ${this.btn('act', 'play', 'viewer.cine', 'Space')}
            <select class="pv-fps" title="${esc(t('viewer.fps'))}">${[5, 8, 12, 20, 30].map(f => `<option value="${f}" ${f === this.fps ? 'selected' : ''}>${f} fps</option>`).join('')}</select>
          </div>
          <div class="pv-group pv-adv-only">
            ${this.btn('layout', 'l1', 'viewer.layout1', '1')}
            ${this.btn('layout', 'l2', 'viewer.layout2', '2')}
            ${this.btn('layout', 'l4', 'viewer.layout4', '4')}
            ${this.btn('layout', 'mpr', 'viewer.mpr', 'M')}
            ${this.btn('act', 'link', 'viewer.link')}
          </div>
          <div class="pv-group pv-end">
            ${this.btn('act', 'reset', 'viewer.reset', 'Esc')}
            ${this.btn('act', 'full', 'viewer.fullscreen', 'F')}
            <span class="pv-adv-only pv-inline">${this.btn('act', 'help', 'viewer.shortcuts', '?')}</span>
            ${this.simpleMode ? `<button class="pv-advtoggle" data-act="advanced">${ic('more')}<span>${esc(t('viewer.advanced'))}</span></button>` : ''}
          </div>
        </div>
        <div class="pv-body">
          ${this.stripCount > 1 ? this.stripHtml() : ''}
          <div class="pv-grid"></div>
        </div>
        <div class="pv-toast" hidden></div>
      </div>`;
    this.root = this.stage.querySelector('.pv');
    this.grid = this.root.querySelector('.pv-grid');
    this.toastEl = this.root.querySelector('.pv-toast');
    this.root.querySelector('.pv-bar').addEventListener('click', e => this.onBar(e));
    this.setupStrip();
    this.root.querySelector('.pv-preset').addEventListener('change', e => { this.applyPreset(e.target.value); e.target.value = ''; });
    this.root.querySelector('.pv-fps').addEventListener('change', e => { this.fps = +e.target.value; if (this.playing) { this.stopCine(); this.startCine(); } });
    this.on(this.root, 'keydown', e => this.onKey(e));
    this.on(document, 'fullscreenchange', () => setTimeout(() => this.resize(), 50));
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.grid);
    this.root.focus({ preventScroll: true });
    await this.buildStacks();
  }

  // ---------- شريط سلاسل الدراسة ----------
  stripHtml() {
    const t = this.t;
    const items = this.series.slice(0, this.stripCount).map((s, k) => `
      <button class="pv-thumb" data-series="${k}" draggable="true" title="${esc(s.title)}">
        <span class="pv-thumb-img"><canvas width="112" height="112"></canvas><em>${esc(s.modality || '')}</em></span>
        <b>${esc(s.title)}</b>
        <small>${esc(t('viewer.images', { n: this.count(s) }))}</small>
      </button>`).join('');
    return `<aside class="pv-strip" aria-label="${esc(t('viewer.seriesList'))}">
      <div class="pv-strip-head">${esc(t('viewer.seriesList'))} <span>${this.stripCount}</span></div>
      <div class="pv-thumbs">${items}</div>
      <div class="pv-strip-hint pv-adv-only">${esc(t('viewer.dragHint'))}</div>
    </aside>`;
  }

  setupStrip() {
    const strip = this.root.querySelector('.pv-strip');
    if (!strip) return;
    strip.addEventListener('click', e => {
      const b = e.target.closest('[data-series]'); if (!b) return;
      this.pickSeries(+b.dataset.series);
    });
    strip.addEventListener('dragstart', e => {
      const b = e.target.closest('[data-series]'); if (!b) return;
      e.dataTransfer.setData('text/noor-series', b.dataset.series);
      e.dataTransfer.effectAllowed = 'copy';
    });
    this.grid.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('text/noor-series')) return;
      e.preventDefault();
      this.grid.querySelectorAll('.pv-pane').forEach(p => p.classList.toggle('pv-drop', p.contains(e.target)));
    });
    this.grid.addEventListener('dragleave', e => { if (!this.grid.contains(e.relatedTarget)) this.grid.querySelectorAll('.pv-drop').forEach(p => p.classList.remove('pv-drop')); });
    this.grid.addEventListener('drop', e => {
      const k = e.dataTransfer.getData('text/noor-series');
      this.grid.querySelectorAll('.pv-drop').forEach(p => p.classList.remove('pv-drop'));
      if (k === '') return;
      e.preventDefault();
      const pane = e.target.closest('[data-pane]');
      if (this.mpr || !pane) return this.pickSeries(+k);
      this.setActivePane(+pane.dataset.pane);
      this.changeSeries(+pane.dataset.pane, +k);
    });
    this.loadThumbs();
  }

  // صورة مصغّرة حقيقية لكل سلسلة (من منتصفها)، واحدة تلو الأخرى حتى لا تبطئ العرض
  async loadThumbs() {
    for (let k = 0; k < this.stripCount; k++) {
      if (this.destroyed) return;
      const s = this.series[k];
      const canvas = this.root.querySelector(`.pv-thumb[data-series="${k}"] canvas`);
      if (!canvas) continue;
      const ids = this.imageIdsFor(s);
      try {
        await csUtils.loadImageToCanvas({ canvas, imageId: ids[Math.floor(ids.length / 2)], thumbnail: true, useCPURendering: true });
        canvas.parentElement.classList.add('ready');
      } catch (e) { console.warn('thumbnail failed', e); }
    }
  }

  async pickSeries(k) {
    if (this.mpr) {
      this.panes[this.activePane || 0].seriesIndex = k;
      if ((this.series[k]?.sliceCount || 1) >= 10) { this.mpr = false; await this.buildMpr(); }
      else { this.layout = 1; this.activePane = 0; this.panes[0].seriesIndex = k; await this.buildStacks(); }
      return;
    }
    await this.changeSeries(this.activePane || 0, k);
  }

  btn(kind, key, label, shortcut) {
    const title = this.t(label) + (shortcut && this.advanced ? ` (${shortcut})` : '');
    return `<button class="pv-btn" data-${kind}="${key}" title="${esc(title)}" aria-label="${esc(this.t(label))}">${ic(key)}<span>${esc(this.t(label))}</span></button>`;
  }

  on(target, ev, fn, o) { target.addEventListener(ev, fn, o); this.listeners.push(() => target.removeEventListener(ev, fn, o)); }

  // ---------- مجموعات الأدوات ----------
  makeToolGroup(gid, viewportIds, forMpr) {
    ToolGroupManager.destroyToolGroup(gid);
    const g = ToolGroupManager.createToolGroup(gid);
    const names = [WindowLevelTool, PanTool, ZoomTool, StackScrollTool, LengthTool, AngleTool, EllipticalROITool, RectangleROITool, EraserTool].map(T => T.toolName);
    names.forEach(n => g.addTool(n));
    if (forMpr) {
      g.addTool(CrosshairsTool.toolName, {
        getReferenceLineColor: vpId => ({ [this.uid + '-ax']: 'rgb(255, 200, 60)', [this.uid + '-sag']: 'rgb(80, 220, 120)', [this.uid + '-cor']: 'rgb(90, 170, 255)' }[vpId]),
        getReferenceLineControllable: () => true, getReferenceLineDraggableRotatable: () => true, getReferenceLineSlabThicknessControlsOn: () => false,
      });
    }
    viewportIds.forEach(v => g.addViewport(v, this.uid));
    g.setToolActive(StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] });
    g.setToolActive(PanTool.toolName, { bindings: [{ mouseButton: MouseBindings.Auxiliary }, { numTouchPoints: 3 }] });
    g.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }, { numTouchPoints: 2 }] });
    // أدوات القياس تبقى ظاهرة حتى لو لم تكن مفعّلة
    [LengthTool, AngleTool, EllipticalROITool, RectangleROITool].forEach(T => g.setToolPassive(T.toolName));
    return g;
  }

  setPrimary(key) {
    if (!this.mpr || key !== 'scroll') this.primary = key;
    const groups = [this.toolGroup, this.mprGroup].filter(Boolean);
    for (const g of groups) {
      for (const [k, name] of Object.entries(ALL_PRIMARY)) {
        if (!g.hasTool(name)) continue;
        if (k === 'scroll') { g.setToolActive(name, { bindings: [{ mouseButton: MouseBindings.Wheel }] }); continue; }
        if (k === 'pan') { g.setToolActive(name, { bindings: [{ mouseButton: MouseBindings.Auxiliary }, { numTouchPoints: 3 }] }); continue; }
        if (k === 'zoom') { g.setToolActive(name, { bindings: [{ mouseButton: MouseBindings.Secondary }, { numTouchPoints: 2 }] }); continue; }
        if (MEASURE_TOOLS[k]) g.setToolPassive(name); else g.setToolDisabled(name);
      }
      const name = ALL_PRIMARY[this.primary];
      const extra = { scroll: [{ mouseButton: MouseBindings.Wheel }], pan: [{ mouseButton: MouseBindings.Auxiliary }, { numTouchPoints: 3 }], zoom: [{ mouseButton: MouseBindings.Secondary }, { numTouchPoints: 2 }] }[this.primary] || [];
      if (g === this.mprGroup && this.primary === 'scroll') {
        g.setToolActive(CrosshairsTool.toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] });
      } else {
        if (g.hasTool(CrosshairsTool.toolName)) g.setToolPassive(CrosshairsTool.toolName);
        g.setToolActive(name, { bindings: [{ mouseButton: MouseBindings.Primary }, ...extra] });
      }
    }
    this.root.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === this.primary));
  }

  // ---------- عرض المقاطع (1 أو 2 أو 4 أجزاء) ----------
  async buildStacks() {
    this.teardownViewports();
    this.mpr = false;
    const n = this.layout;
    while (this.panes.length < n) this.panes.push({ seriesIndex: Math.min(this.series.length - 1, this.panes.length) });
    this.grid.className = 'pv-grid pv-l' + n;
    this.grid.innerHTML = this.panes.slice(0, n).map((p, i) => this.paneHtml(i, p)).join('');
    const inputs = [];
    this.panes.slice(0, n).forEach((p, i) => {
      const el = this.grid.querySelector(`[data-pane="${i}"] .pv-vp`);
      inputs.push({ viewportId: this.vpId(i), type: ViewportType.STACK, element: el, defaultOptions: { background: [0, 0, 0] } });
    });
    this.engine.setViewports(inputs);
    this.toolGroup = this.makeToolGroup(this.uid + '-tg', inputs.map(x => x.viewportId), false);
    const firstMulti = this.count(this.series[this.panes[0].seriesIndex]) > 1;
    if (!this._primaryChosen) this.primary = firstMulti ? 'scroll' : 'wl';
    this.setPrimary(this.primary);
    this.grid.querySelectorAll('.pv-series').forEach(sel => sel.addEventListener('change', e => this.changeSeries(+e.target.dataset.pane, +e.target.value)));
    await Promise.all(this.panes.slice(0, n).map((p, i) => this.loadPane(i)));
    this.updateButtons();
  }

  paneHtml(i, p) {
    const multi = this.layout > 1 && this.series.length > 0;
    return `
      <div class="pv-pane ${i === 0 ? 'active' : ''}" data-pane="${i}">
        <div class="pv-vp" oncontextmenu="return false"></div>
        ${multi ? `<select class="pv-series" data-pane="${i}">${this.seriesOptions(p.seriesIndex)}</select>` : ''}
        <div class="pv-ov pv-tl"></div><div class="pv-ov pv-tr"></div><div class="pv-ov pv-bl"></div><div class="pv-ov pv-br"></div>
        <div class="pv-loading"><span class="pv-spin"></span></div>
        <div class="pv-err" hidden></div>
      </div>`;
  }

  vpId(i) { return `${this.uid}-vp${i}`; }

  seriesOptions(selected) {
    const groups = [];
    this.series.forEach((s, k) => {
      const g = s.group || '';
      let grp = groups.find(x => x.g === g);
      if (!grp) groups.push(grp = { g, items: [] });
      grp.items.push(`<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(s.title)}${this.count(s) > 1 ? ` (${this.count(s)})` : ''}</option>`);
    });
    if (groups.length < 2) return groups.map(x => x.items.join('')).join('');
    return groups.map(x => `<optgroup label="${esc(x.g)}">${x.items.join('')}</optgroup>`).join('');
  }

  async loadPane(i) {
    const pane = this.grid.querySelector(`[data-pane="${i}"]`);
    const s = this.series[this.panes[i].seriesIndex];
    const vp = this.engine.getViewport(this.vpId(i));
    if (!s || !vp) return;
    const imageIds = this.imageIdsFor(s);
    pane.querySelector('.pv-loading').hidden = false;
    pane.querySelector('.pv-err').hidden = true;
    try {
      await vp.setStack(imageIds, 0);
      vp.render();
      const el = vp.element;
      const upd = () => this.updateOverlay(i);
      [Events.IMAGE_RENDERED, Events.VOI_MODIFIED, Events.CAMERA_MODIFIED, Events.STACK_NEW_IMAGE].forEach(ev => this.on(el, ev, upd));
      this.on(el, Events.STACK_NEW_IMAGE, () => this.syncFrom(i));
      this.on(el, 'pointerdown', () => this.setActivePane(i));
      this.updateOverlay(i);
      this.prefetch(imageIds);
    } catch (e) {
      console.error('DICOM load failed', e);
      const err = pane.querySelector('.pv-err');
      err.textContent = this.t('viewer.dicomError');
      err.hidden = false;
    } finally {
      pane.querySelector('.pv-loading').hidden = true;
    }
  }

  // تحميل كل المقاطع في الخلفية حتى يكون التصفح سلساً
  prefetch(imageIds) {
    let next = 1;
    const work = async () => {
      while (!this.destroyed && next < imageIds.length) {
        const id = imageIds[next++];
        try { await imageLoader.loadAndCacheImage(id); } catch {}
      }
    };
    for (let k = 0; k < 3; k++) work();
  }

  async changeSeries(i, seriesIndex) {
    this.panes[i].seriesIndex = seriesIndex;
    const sel = this.grid.querySelector(`.pv-series[data-pane="${i}"]`);
    if (sel) sel.value = String(seriesIndex);
    this.stopCine();
    await this.loadPane(i);
    this.updateButtons();
  }

  setActivePane(i) {
    this.activePane = i;
    this.grid.querySelectorAll('.pv-pane').forEach(p => p.classList.toggle('active', +p.dataset.pane === i));
    this.updateButtons();
  }

  activeViewports() {
    if (this.mpr) return ['ax', 'sag', 'cor'].map(k => this.engine.getViewport(`${this.uid}-${k}`)).filter(Boolean);
    const vp = this.engine.getViewport(this.vpId(this.activePane || 0));
    return vp ? [vp] : [];
  }

  // ربط التصفح بين الأجزاء (بنسبة موضع المقطع)
  syncFrom(i) {
    if (!this.linked || this.layout < 2 || this.mpr || this._syncing) return;
    const src = this.engine.getViewport(this.vpId(i));
    if (!src) return;
    const total = src.getImageIds().length;
    if (total < 2) return;
    const frac = src.getCurrentImageIdIndex() / (total - 1);
    this._syncing = true;
    for (let k = 0; k < this.layout; k++) {
      if (k === i) continue;
      const vp = this.engine.getViewport(this.vpId(k));
      if (!vp || !vp.getImageIds) continue;
      const n = vp.getImageIds().length;
      if (n > 1) vp.setImageIdIndex(Math.round(frac * (n - 1))).catch(() => {});
    }
    this._syncing = false;
  }

  // ---------- المعلومات على الصورة ----------
  updateOverlay(i) {
    const pane = this.grid.querySelector(`[data-pane="${i}"]`);
    const vp = this.engine.getViewport(this.vpId(i));
    if (!pane || !vp) return;
    const ids = vp.getImageIds();
    const idx = vp.getCurrentImageIdIndex();
    const imageId = ids[idx];
    const study = metaData.get('generalStudyModule', imageId) || {};
    const series = metaData.get('generalSeriesModule', imageId) || {};
    const plane = metaData.get('imagePlaneModule', imageId) || {};
    const { voiRange } = vp.getProperties() || {};
    const fmtDate = d => (d && typeof d === 'object' ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
      : /^\d{8}$/.test(d || '') ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d || '');
    const ww = voiRange ? Math.round(voiRange.upper - voiRange.lower) : '';
    const wc = voiRange ? Math.round((voiRange.upper + voiRange.lower) / 2) : '';
    let zoom = '';
    try { zoom = Math.round(vp.getZoom() * 100) + '%'; } catch {}
    pane.querySelector('.pv-tl').textContent = [series.modality, series.seriesDescription || study.studyDescription].filter(Boolean).join(' • ');
    pane.querySelector('.pv-tr').textContent = fmtDate(study.studyDate || series.seriesDate);
    pane.querySelector('.pv-bl').textContent = ids.length > 1
      ? `Im ${idx + 1}/${ids.length}${plane.sliceThickness ? `  Thk ${(+plane.sliceThickness).toFixed(1)}mm` : ''}${plane.sliceLocation != null ? `  Z ${(+plane.sliceLocation).toFixed(1)}` : ''}`
      : '';
    pane.querySelector('.pv-br').textContent = `W ${ww}  L ${wc}  ${zoom}`;
  }

  // ---------- MPR ----------
  async buildMpr() {
    const s = this.series[this.panes[this.activePane || 0].seriesIndex];
    if (!s || (s.sliceCount || 1) < 10) return this.toast(this.t('viewer.mprNeedSlices'));
    const imageIds = this.imageIdsFor(s);
    // تقدير الذاكرة المطلوبة
    const firstMeta = metaData.get('imagePixelModule', imageIds[0]);
    const rows = firstMeta?.rows || 512, cols = firstMeta?.columns || 512;
    const mb = (rows * cols * imageIds.length * 4) / 1048576;
    const limit = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 300 : 1500;
    if (mb > limit) return this.toast(this.t('viewer.mprTooLarge'));

    this.stopCine();
    this.teardownViewports();
    this.mpr = true;
    this.grid.className = 'pv-grid pv-mpr';
    const parts = [['ax', 'viewer.axial', OrientationAxis.AXIAL], ['sag', 'viewer.sagittal', OrientationAxis.SAGITTAL], ['cor', 'viewer.coronal', OrientationAxis.CORONAL]];
    this.grid.innerHTML = parts.map(([k, label]) => `
      <div class="pv-pane pv-mpr-${k}" data-mpr="${k}">
        <div class="pv-vp" oncontextmenu="return false"></div>
        <div class="pv-ov pv-tl pv-mpr-label">${esc(this.t(label))}</div><div class="pv-ov pv-br"></div>
      </div>`).join('') + `<div class="pv-mpr-loading"><span class="pv-spin"></span> <span>${esc(this.t('viewer.mprLoading'))}</span> <b></b></div>`;
    const loadingEl = this.grid.querySelector('.pv-mpr-loading');
    const progress = loadingEl.querySelector('b');

    try {
      // تحميل كل المقاطع أولاً (يلزم لمعرفة مواضعها)
      let done = 0;
      await Promise.all(imageIds.map(async id => {
        await imageLoader.loadAndCacheImage(id);
        progress.textContent = `${++done}/${imageIds.length}`;
      }));
      if (this.destroyed || !this.mpr) return;
      const volumeId = `cornerstoneStreamingImageVolume:${this.uid}-${s.id}`;
      const volume = cache.getVolume(volumeId) || await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
      const inputs = parts.map(([k, , orientation]) => ({
        viewportId: `${this.uid}-${k}`, type: ViewportType.ORTHOGRAPHIC,
        element: this.grid.querySelector(`[data-mpr="${k}"] .pv-vp`),
        defaultOptions: { orientation, background: [0, 0, 0] },
      }));
      this.engine.setViewports(inputs);
      this.mprGroup = this.makeToolGroup(this.uid + '-mpr', inputs.map(x => x.viewportId), true);
      volume.load();
      await setVolumesForViewports(this.engine, [{ volumeId }], inputs.map(x => x.viewportId));
      // نفس التباين الأولي للمقطع المحوري في الاتجاهات الثلاثة
      const voi = metaData.get('voiLutModule', imageIds[0]);
      const c = Array.isArray(voi?.windowCenter) ? voi.windowCenter[0] : voi?.windowCenter;
      const w = Array.isArray(voi?.windowWidth) ? voi.windowWidth[0] : voi?.windowWidth;
      inputs.forEach(x => {
        const vp = this.engine.getViewport(x.viewportId);
        if (c != null && w) vp.setProperties({ voiRange: { lower: c - w / 2, upper: c + w / 2 } });
        const upd = () => {
          const { voiRange } = vp.getProperties() || {};
          const br = this.grid.querySelector(`[data-mpr="${x.viewportId.split('-').pop()}"] .pv-br`);
          if (br && voiRange) br.textContent = `W ${Math.round(voiRange.upper - voiRange.lower)}  L ${Math.round((voiRange.upper + voiRange.lower) / 2)}`;
        };
        [Events.IMAGE_RENDERED, Events.VOI_MODIFIED].forEach(ev => this.on(vp.element, ev, upd));
      });
      this.engine.renderViewports(inputs.map(x => x.viewportId));
      this.setPrimary('scroll');
      loadingEl.remove();
      this.toast(this.t('viewer.mprHint'));
    } catch (e) {
      console.error('MPR failed', e);
      loadingEl.innerHTML = esc(this.t('viewer.mprFailed'));
    }
    this.updateButtons();
  }

  teardownViewports() {
    this.stopCine();
    [this.uid + '-tg', this.uid + '-mpr'].forEach(g => { try { ToolGroupManager.destroyToolGroup(g); } catch {} });
    this.toolGroup = this.mprGroup = null;
    try { this.engine.getViewports().forEach(v => this.engine.disableElement(v.id)); } catch {}
  }

  // ---------- الأوامر ----------
  onBar(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) { this._primaryChosen = true; return this.setPrimary(b.dataset.tool); }
    if (b.dataset.layout) return this.setLayout(b.dataset.layout);
    const a = b.dataset.act;
    if (a === 'clear') { annotation.state.removeAllAnnotations(); this.engine.render(); }
    if (a === 'rotate') this.transform(v => ({ rotation: ((v.rotation || 0) + 90) % 360 }));
    if (a === 'flipH') this.transform(v => ({ flipHorizontal: !v.flipHorizontal }));
    if (a === 'flipV') this.transform(v => ({ flipVertical: !v.flipVertical }));
    if (a === 'invert') this.activeViewports().forEach(vp => { vp.setProperties({ invert: !vp.getProperties().invert }); vp.render(); });
    if (a === 'reset') this.reset();
    if (a === 'play') this.playing ? this.stopCine() : this.startCine();
    if (a === 'link') { this.linked = !this.linked; this.updateButtons(); this.toast(this.t(this.linked ? 'viewer.linkedOn' : 'viewer.linkedOff')); }
    if (a === 'full') this.toggleFullscreen();
    if (a === 'help') this.showHelp();
    if (a === 'advanced') { this.advanced = !this.advanced; this.root.classList.toggle('pv-adv', this.advanced); this.root.classList.toggle('pv-simple', !this.advanced); b.classList.toggle('on', this.advanced); setTimeout(() => this.resize(), 30); }
  }

  async setLayout(key) {
    if (key === 'mpr') { if (!this.mpr) await this.buildMpr(); return; }
    const n = { l1: 1, l2: 2, l4: 4 }[key];
    if (!n || (n === this.layout && !this.mpr)) return;
    this.layout = n;
    this.activePane = 0;
    await this.buildStacks();
  }

  transform(fn) {
    this.activeViewports().forEach(vp => {
      const cur = vp.getViewPresentation ? vp.getViewPresentation({ rotation: true, flipHorizontal: true, flipVertical: true }) : {};
      const next = fn(cur || {});
      if (vp.setViewPresentation) vp.setViewPresentation(next);
      vp.render();
    });
  }

  applyPreset(key) {
    if (!key) return;
    this.activeViewports().forEach(vp => {
      if (key === 'auto') { vp.resetProperties(); vp.render(); return; }
      const p = PRESETS.find(x => x.key === key);
      const imageId = vp.getCurrentImageId?.();
      const mod = imageId && metaData.get('generalSeriesModule', imageId)?.modality;
      if (mod && mod !== 'CT') this.toast(this.t('viewer.presetCtOnly'));
      vp.setProperties({ voiRange: { lower: p.c - p.w / 2, upper: p.c + p.w / 2 } });
      vp.render();
    });
  }

  reset() {
    this.activeViewports().forEach(vp => {
      try { vp.resetProperties(); } catch {}
      try { vp.setViewPresentation?.({ rotation: 0, flipHorizontal: false, flipVertical: false }); } catch {}
      vp.resetCamera(); vp.render();
    });
  }

  startCine() {
    const vp = this.activeViewports()[0];
    if (!vp || this.mpr) return;
    if ((vp.getImageIds?.() || []).length < 2) return this.toast(this.t('viewer.cineNeedSlices'));
    csTools.utilities.cine.playClip(vp.element, { framesPerSecond: this.fps, loop: true });
    this.playing = vp.element;
    this.updateButtons();
  }
  stopCine() {
    if (this.playing) { try { csTools.utilities.cine.stopClip(this.playing); } catch {} }
    this.playing = false;
    this.updateButtons?.();
  }

  toggleFullscreen() {
    const el = this.root;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => el.classList.toggle('pv-pseudo-full'));
    else el.classList.toggle('pv-pseudo-full');
    setTimeout(() => this.resize(), 80);
  }

  onKey(e) {
    if (e.target.closest('select, input, textarea')) return;
    const k = e.key;
    const map = { s: 'scroll', w: 'wl', p: 'pan', z: 'zoom', l: 'length', a: 'angle', e: 'ellipse', r: 'rect', d: 'eraser' };
    const lower = k.toLowerCase();
    const advOnly = ['length', 'angle', 'ellipse', 'rect', 'eraser'];
    if (map[lower] && (this.advanced || !advOnly.includes(map[lower]))) { e.preventDefault(); return this.setPrimary(map[lower]); }
    if (k === ' ') { e.preventDefault(); return this.playing ? this.stopCine() : this.startCine(); }
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp') {
      e.preventDefault();
      const vp = this.activeViewports()[0];
      if (vp && vp.getImageIds && !this.mpr) {
        const n = vp.getImageIds().length;
        const d = (k === 'ArrowDown' || k === 'PageDown') ? 1 : -1;
        vp.setImageIdIndex(Math.max(0, Math.min(n - 1, vp.getCurrentImageIdIndex() + d * (k.startsWith('Page') ? 10 : 1))));
      }
      return;
    }
    if (!this.advanced) { if (lower === 'f') this.toggleFullscreen(); return; }
    if (lower === 'i') this.onBar({ target: this.root.querySelector('[data-act="invert"]') });
    else if (lower === 'h') this.transform(v => ({ flipHorizontal: !v.flipHorizontal }));
    else if (lower === 'v') this.transform(v => ({ flipVertical: !v.flipVertical }));
    else if (k === '.') this.transform(v => ({ rotation: ((v.rotation || 0) + 90) % 360 }));
    else if (lower === 'm') this.setLayout('mpr');
    else if (k === '1' || k === '2' || k === '4') this.setLayout('l' + k);
    else if (lower === 'f') this.toggleFullscreen();
    else if (k === '?') this.showHelp();
    else if (k === 'Delete' || k === 'Backspace') { annotation.state.removeAllAnnotations(); this.engine.render(); }
    else if (k === 'Escape' && !document.fullscreenElement) this.reset();
  }

  showHelp() {
    const rows = [
      ['S', 'viewer.scroll'], ['W', 'viewer.wl'], ['P', 'viewer.pan'], ['Z', 'viewer.zoom'],
      ['L', 'viewer.length'], ['A', 'viewer.angle'], ['E', 'viewer.ellipse'], ['R', 'viewer.rect'], ['D', 'viewer.eraser'],
      ['Delete', 'viewer.clear'], ['.', 'viewer.rotate'], ['H', 'viewer.flipH'], ['V', 'viewer.flipV'], ['I', 'viewer.invert'],
      ['Space', 'viewer.cine'], ['↑ ↓', 'viewer.slice'], ['1 / 2 / 4', 'viewer.layoutAny'], ['M', 'viewer.mpr'], ['F', 'viewer.fullscreen'], ['Esc', 'viewer.reset'],
    ];
    const mouse = [['viewer.mouseLeft', 'viewer.mouseLeftD'], ['viewer.mouseWheel', 'viewer.slice'], ['viewer.mouseRight', 'viewer.zoom'], ['viewer.mouseMiddle', 'viewer.pan']];
    let box = this.root.querySelector('.pv-help');
    if (box) { box.remove(); return; }
    box = document.createElement('div');
    box.className = 'pv-help';
    box.innerHTML = `<div class="pv-help-card"><button class="pv-help-x" aria-label="close">×</button><h3>${esc(this.t('viewer.shortcuts'))}</h3>
      <div class="pv-help-grid">${rows.map(([k, l]) => `<kbd>${esc(k)}</kbd><span>${esc(this.t(l))}</span>`).join('')}</div>
      <h4>${esc(this.t('viewer.mouse'))}</h4>
      <div class="pv-help-grid">${mouse.map(([k, l]) => `<kbd>${esc(this.t(k))}</kbd><span>${esc(this.t(l))}</span>`).join('')}</div></div>`;
    box.addEventListener('click', e => { if (e.target === box || e.target.closest('.pv-help-x')) box.remove(); });
    this.root.appendChild(box);
  }

  updateButtons() {
    if (!this.root) return;
    const shown = new Set(this.mpr ? [this.panes[this.activePane || 0]?.seriesIndex] : this.panes.slice(0, this.layout).map(p => p.seriesIndex));
    const act = this.panes[this.activePane || 0]?.seriesIndex;
    this.root.querySelectorAll('.pv-thumb').forEach(b => {
      const k = +b.dataset.series;
      b.classList.toggle('shown', shown.has(k));
      b.classList.toggle('active', k === act);
    });
    const set = (sel, on) => { const b = this.root.querySelector(sel); if (b) b.classList.toggle('on', !!on); };
    set('[data-layout="l1"]', !this.mpr && this.layout === 1);
    set('[data-layout="l2"]', !this.mpr && this.layout === 2);
    set('[data-layout="l4"]', !this.mpr && this.layout === 4);
    set('[data-layout="mpr"]', this.mpr);
    set('[data-act="link"]', this.linked && this.layout > 1 && !this.mpr);
    const play = this.root.querySelector('[data-act="play"]');
    if (play) {
      play.classList.toggle('on', !!this.playing);
      play.querySelector('svg').outerHTML = ic(this.playing ? 'pause' : 'play');
    }
    const s = this.series[this.panes[this.activePane || 0]?.seriesIndex];
    const multiSlice = this.count(s) > 1;
    this.root.querySelector('.pv-cine').classList.toggle('pv-off', !multiSlice || this.mpr);
    const mprBtn = this.root.querySelector('[data-layout="mpr"]');
    if (mprBtn) mprBtn.disabled = (s?.sliceCount || 1) < 10;
    const linkBtn = this.root.querySelector('[data-act="link"]');
    if (linkBtn) linkBtn.disabled = this.layout < 2 || this.mpr;
    const l2 = this.root.querySelector('[data-layout="l2"]'), l4 = this.root.querySelector('[data-layout="l4"]');
    if (l2) l2.disabled = this.series.length < 1;
    if (l4) l4.disabled = this.series.length < 1;
  }

  toast(msg) {
    this.toastEl.textContent = msg; this.toastEl.hidden = false;
    clearTimeout(this._tt); this._tt = setTimeout(() => { this.toastEl.hidden = true; }, 3200);
  }

  resize() {
    if (this.destroyed) return;
    try { this.engine.resize(true, true); } catch {}
  }

  destroy() {
    this.destroyed = true;
    this.stopCine();
    this.listeners.forEach(off => off()); this.listeners = [];
    this.ro?.disconnect();
    if (document.fullscreenElement && this.root?.contains(document.fullscreenElement)) document.exitFullscreen?.();
    [this.uid + '-tg', this.uid + '-mpr'].forEach(g => { try { ToolGroupManager.destroyToolGroup(g); } catch {} });
    try { this.engine.destroy(); } catch {}
    try { annotation.state.removeAllAnnotations(); } catch {}
    // تفريغ الذاكرة: الصور المحمّلة لهذا العارض
    try { cache.purgeCache(); } catch {}
  }
}

// عدد القياسات الحالية (يُستخدم في الاختبارات)
const measurementCount = () => (annotation.state.getAllAnnotations?.() || []).length;
window.NoorProViewer = { mount, dispose, measurementCount };
