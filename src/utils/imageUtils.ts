import type { Memory } from '../types/memory';

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.8;

/** All image data URLs for a memory (supports legacy imageDataUrl). */
export function getMemoryImages(memory: Memory): string[] {
  if (memory.imageDataUrls?.length) return memory.imageDataUrls;
  if (memory.imageDataUrl) return [memory.imageDataUrl];
  return [];
}

/**
 * Compress image via canvas (max width 1200px, quality 0.8) then return as base64 data URL.
 */
export async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2d context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
