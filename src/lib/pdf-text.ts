import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
import tesseractWorkerUrl from 'tesseract.js/dist/worker.min.js?url';
import engTrainedDataUrl from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PdfExtractionResult = {
  text: string;
  mode: 'text' | 'ocr';
};

function normalizeLineText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isTextExtractionWeak(text: string): boolean {
  const normalized = normalizeLineText(text);
  if (normalized.length < 120) {
    return true;
  }

  const lineCount = text.split('\n').filter((line) => line.trim().length > 0).length;
  return lineCount < 3;
}

async function loadPdfDocument(buffer: ArrayBuffer) {
  return pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
}

async function extractSelectablePdfText(buffer: ArrayBuffer): Promise<string> {
  const document = await loadPdfDocument(buffer);
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines = new Map<number, { x: number; text: string }[]>();

    textContent.items.forEach((item) => {
      if (!('str' in item) || !Array.isArray(item.transform)) {
        return;
      }

      const text = item.str.trim();
      if (!text) {
        return;
      }

      const x = typeof item.transform[4] === 'number' ? item.transform[4] : 0;
      const y = typeof item.transform[5] === 'number' ? item.transform[5] : 0;
      const lineKey = Math.round(y);
      const current = lines.get(lineKey) ?? [];
      current.push({ x, text });
      lines.set(lineKey, current);
    });

    const pageText = [...lines.entries()]
      .sort((left, right) => right[0] - left[0])
      .map(([, segments]) => normalizeLineText(segments.sort((left, right) => left.x - right.x).map((segment) => segment.text).join(' ')))
      .filter(Boolean)
      .join('\n');

    if (pageText) {
      pages.push(pageText);
    }
  }

  return pages.join('\n');
}

async function renderPageForOcr(page: pdfjsLib.PDFPageProxy): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create a canvas context for OCR');
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas;
}

async function extractPdfTextWithOcr(buffer: ArrayBuffer, onProgress?: (message: string) => void): Promise<string> {
  const document = await loadPdfDocument(buffer);
  const localCorePath = new URL('/tesseract-core/tesseract-core-lstm.wasm.js', window.location.origin).toString();
  const trainedData = await fetch(engTrainedDataUrl).then(async (response) => {
    if (!response.ok) {
      throw new Error('Unable to load local OCR language data');
    }
    return new Uint8Array(await response.arrayBuffer());
  });

  const worker = await createWorker(
    [{ code: 'eng', data: trainedData }],
    1,
    {
      corePath: localCorePath,
      workerPath: tesseractWorkerUrl,
      logger: (message) => {
        if (!onProgress) {
          return;
        }

        if (typeof message.status === 'string') {
          onProgress(`${message.status}${typeof message.progress === 'number' ? ` ${Math.round(message.progress * 100)}%` : ''}`);
        }
      },
    }
  );

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '11',
      preserve_interword_spaces: '1',
    });

    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress?.(`OCR page ${pageNumber} of ${document.numPages}`);
      const page = await document.getPage(pageNumber);
      const canvas = await renderPageForOcr(page);
      const result = await worker.recognize(canvas);
      const text = result.data.text
        .split(/\r?\n/)
        .map((line) => normalizeLineText(line))
        .filter(Boolean)
        .join('\n');

      if (text) {
        pages.push(text);
      }
    }

    return pages.join('\n');
  } finally {
    await worker.terminate();
  }
}

export async function extractPdfText(buffer: ArrayBuffer, onProgress?: (message: string) => void): Promise<PdfExtractionResult> {
  const selectableText = await extractSelectablePdfText(buffer);
  if (!isTextExtractionWeak(selectableText)) {
    return {
      text: selectableText,
      mode: 'text',
    };
  }

  onProgress?.('No usable selectable text found. Running OCR...');
  const ocrText = await extractPdfTextWithOcr(buffer, onProgress);

  return {
    text: ocrText || selectableText,
    mode: 'ocr',
  };
}
