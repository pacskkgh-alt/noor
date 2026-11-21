// بناء عارض الأشعة الاحترافي (Cornerstone3D) إلى public/build
import { defineConfig } from 'vite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export default defineConfig({
  root: 'client',
  base: '/build/',
  publicDir: false,
  build: {
    outDir: '../public/build',
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      input: { viewer: 'client/viewer/main.js' },
      output: {
        entryFileNames: 'viewer-pro.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: a => ((a.names || [a.name]).some(n => n && n.endsWith('.css')) ? 'viewer-pro.css' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
  // مكتبة الأشعة تستخدم EventEmitter من Node؛ نوفّر نسخة المتصفح منها
  resolve: { alias: { events: require.resolve('events/') } },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@cornerstonejs/dicom-image-loader'], include: ['dicom-parser'] },
});
