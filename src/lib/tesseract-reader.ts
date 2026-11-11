/**
 * Mirror World OCR uses ONLY same-origin, build-copied Tesseract worker,
 * WASM and English traineddata. No external recognition service/CDN.
 * The output is untrusted candidate text, never a database operation.
 */
export type ReadOptions = {
  enhanceContrast?: boolean;
  onProgress?: (percent: number) => void;
};
export type OcrReadResult = {
  text: string;
  confidence: number | null;
  width: number;
  height: number;
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 12_000_000;
const MAX_CANVAS_DIMENSION = 2800;
const MIN_DIMENSION = 64;

function sameOriginAsset(relative: string): string {
  const url = new URL(import.meta.env.BASE_URL + 'ocr/' + relative, window.location.origin);
  if (url.origin !== window.location.origin) {
    throw new Error('OCR assets must be served from the Aeternum origin');
  }
  return url.href;
}

export function verifyMirrorScreenshot(file: File): void {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Use a PNG, JPEG or WebP screenshot');
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    throw new Error('Screenshot must be between 1 byte and 5 MB');
  }
}

async function prepareImage(file: File, enhanceContrast: boolean):
  Promise<{canvas: HTMLCanvasElement; width: number; height: number}> {
  verifyMirrorScreenshot(file);
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error('Cannot decode the image; try a new PNG/JPEG/WebP screenshot');
  }
  try {
    const {width, height} = image;
    if (width < MIN_DIMENSION || height < MIN_DIMENSION ||
        width * height > MAX_SOURCE_PIXELS) {
      throw new Error('Screenshot dimensions are unsupported (minimum 64 px; maximum 12 megapixels)');
    }
    const scale = Math.min(2, MAX_CANVAS_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d', {willReadFrequently: false});
    if (!ctx) throw new Error('Could not initialize local image processing');
    if (enhanceContrast) ctx.filter = 'grayscale(1) contrast(1.55)';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {canvas, width, height};
  } finally {
    image.close();
  }
}

/** Called only after a user clicks Recognize; lazy-loaded to keep page load light.
 * Model/engine files are copied into public/ocr at build time. The file never
 * leaves this browser during OCR. Server upload happens later on approval.
 */
export async function readMirrorScreenshotWithTesseract(
  file: File, options: ReadOptions = {}
): Promise<OcrReadResult> {
  const {canvas, width, height} = await prepareImage(file, options.enhanceContrast ?? true);
  // No static import; Vite builds a separate on-demand chunk.
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker('eng', undefined, {
    workerPath: sameOriginAsset('worker.min.js'),
    corePath: sameOriginAsset('core'),
    langPath: sameOriginAsset('lang'),
    workerBlobURL: false,
    gzip: true,
    logger: entry => {
      if (entry.status === 'recognizing text' && typeof entry.progress === 'number') {
        options.onProgress?.(Math.round(Math.max(0, Math.min(1, entry.progress)) * 100));
      }
    }
  });
  try {
    const {data} = await worker.recognize(canvas);
    return {text:data.text.slice(0,20000),confidence:Number.isFinite(data.confidence)
      ? Math.round(data.confidence) : null,width,height};
  } finally {
    canvas.width = 0;canvas.height = 0;
    await worker.terminate();
  }
}
