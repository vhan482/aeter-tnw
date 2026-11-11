import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const dist=join(root,'dist','ocr');
const manifestPath=join(dist,'manifest.json');
if (!existsSync(manifestPath)) throw new Error('OCR model/worker missing from production build');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
if (manifest.offline!==true || manifest.engine!=='tesseract.js' ||
    manifest.language!=='eng' || manifest.version!=='7.0.0') {
  throw new Error('Unexpected OCR asset manifest');
}
const required=['worker.min.js','lang/eng.traineddata.gz'];
for (const path of required) {
  const file=join(dist,path);
  if (!existsSync(file)||statSync(file).size<1000) {
    throw new Error('Missing or truncated offline OCR asset: '+path);
  }
}
const core=join(dist,'core');
const names=existsSync(core)?readdirSync(core):[];
if (!names.some(n=>n.endsWith('.wasm')) ||
    !names.some(n=>n.endsWith('.wasm.js'))) {
  throw new Error('Production bundle is missing Tesseract WebAssembly variants');
}
for(const name of names) {
  if (!/^tesseract-core.*\.wasm(?:\.js)?$/.test(name)) {
    throw new Error('Unexpected asset in OCR core directory');
  }
}
console.log('Verified same-origin OCR worker, WASM variants and English model in dist/ocr.');
