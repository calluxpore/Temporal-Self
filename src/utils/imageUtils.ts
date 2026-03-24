import type { Memory } from '../types/memory';

const MAX_WIDTH = 1920;
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
  return compressBlobToJpegDataUrl(file);
}

async function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
}

async function compressBlobToJpegDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

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

/**
 * Normalize common phone photo formats to a storage-ready data URL.
 * - Tries canvas resize/compress for regular browser-decodable images.
 * - Converts HEIC/HEIF to JPEG in-browser when needed.
 * - Falls back to raw data URL if conversion is unavailable.
 */
export async function normalizePhonePhotoToDataUrl(file: File): Promise<string> {
  try {
    return await compressBlobToJpegDataUrl(file);
  } catch {
    const mime = file.type.toLowerCase();
    const isHeicLike =
      mime.includes('heic') || mime.includes('heif') || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
    if (isHeicLike) {
      try {
        const { default: heic2any } = await import('heic2any');
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: JPEG_QUALITY,
        });
        const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
        if (convertedBlob instanceof Blob) {
          return await compressBlobToJpegDataUrl(convertedBlob);
        }
      } catch {
        // Fall through to raw data URL fallback.
      }
    }
    return await readBlobAsDataUrl(file);
  }
}
