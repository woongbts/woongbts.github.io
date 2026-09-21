import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await cp('web/index.html', 'dist/index.html');
await cp('web/styles.css', 'dist/styles.css');
await cp('web/auth-redirect.html', 'dist/auth-redirect.html');
await build({
  entryPoints: {
    app: 'web/app.js',
    'auth-redirect': 'web/auth-redirect.js'
  },
  outdir: 'dist',
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2022']
});
