import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, '../../apps/server/src/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  legalComments: 'none',
  logLevel: 'info',
  outfile: path.join(here, 'dist/server.mjs'),
  // Some Express dependencies (depd) call require() dynamically. Bundled CJS
  // modules need a real require in ESM output. google-gax (through Firestore)
  // also reads __dirname, which does not exist in an ES module, so provide the
  // Node 20.11+ equivalents from import.meta.
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      'const require = __createRequire(import.meta.url);',
      'const __filename = import.meta.filename;',
      'const __dirname = import.meta.dirname;',
    ].join(' '),
  },
});
