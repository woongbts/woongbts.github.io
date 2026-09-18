import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await cp('web/index.html', 'dist/index.html');
await cp('web/styles.css', 'dist/styles.css');
await build({
  entryPoints: ['web/app.js'],
  outfile: 'dist/app.js',
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2022']
});
