import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Static-only, same-origin OCR assets.
 * Never let the browser fall back to a CDN to fetch worker/core/language files.
 * This script requires a locked yarn install and fails closed when assets are missing.
 */
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const modules = join(root, 'node_modules');
const workerFile = join(modules, 'tesseract.js', 'dist', 'worker.min.js');
const coreDir = join(modules, 'tesseract.js-core');
const engFile = join(modules, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz');
const output = join(root, 'public', 'ocr');

const coreFiles = existsSync(coreDir)
  ? readdirSync(coreDir).filter(file => /^tesseract-core.*\.wasm(?:\.js)?$/.test(file))
  : [];
if (!existsSync(workerFile) || !existsSync(engFile) ||
    !coreFiles.some(file => file.endsWith('.wasm')) ||
    !coreFiles.some(file => file.endsWith('.wasm.js'))) {
  throw new Error('Self-hosted OCR assets missing. Run yarn install --immutable and verify Tesseract package versions.');
}

rmSync(output, {recursive:true,force:true});
mkdirSync(join(output, 'core'), {recursive:true});
mkdirSync(join(output, 'lang'), {recursive:true});
copyFileSync(workerFile, join(output, 'worker.min.js'));
for (const file of coreFiles) copyFileSync(join(coreDir,file),join(output,'core',file));
copyFileSync(engFile,join(output,'lang','eng.traineddata.gz'));

writeFileSync(join(output,'manifest.json'),JSON.stringify({
  engine:'tesseract.js',version:'7.0.0',language:'eng',source:'locally installed locked npm packages',
  coreFiles,offline:true
},null,2)+'\n');
console.log('Prepared same-origin Tesseract OCR assets ('+coreFiles.length+' core files, English model).');
