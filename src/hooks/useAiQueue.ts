import { useEffect } from 'react';
import { useMemoryStore } from '../store/memoryStore';
import { analyzePhoto } from '../utils/analyzePhoto';
import { getMemoryImages } from '../utils/imageUtils';

async function resizeImageIfNeeded(dataUrl: string, maxPx: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width <= maxPx && height <= maxPx) {
        resolve(dataUrl);
        return;
      }
      const scale = maxPx / Math.max(width, height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function useAiQueue() {
  const {
    aiQueue,
    aiProcessing,
    aiProvider,
    aiApiKey,
    memories,
    updateMemory,
    dequeueAiAnalysis,
    completeAiAnalysis,
  } = useMemoryStore();

  useEffect(() => {
    if (aiProcessing) return;
    if (aiQueue.length === 0) return;
    if (!aiProvider || !aiApiKey) return;

    const memoryId = aiQueue[0];
    const memory = memories.find((m) => m.id === memoryId);
    if (!memory) {
      dequeueAiAnalysis();
      completeAiAnalysis();
      return;
    }

    const photoDataUrl = getMemoryImages(memory)[0];
    if (!photoDataUrl) {
      dequeueAiAnalysis();
      completeAiAnalysis();
      return;
    }

    dequeueAiAnalysis();

    resizeImageIfNeeded(photoDataUrl, 900)
      .then((resizedDataUrl) => analyzePhoto(resizedDataUrl, aiProvider, aiApiKey))
      .then((result) => {
        updateMemory(memoryId, {
          title: result.title,
          customLabel: result.emoji,
          placeDescriptor: result.placeDescriptor,
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown AI error';
        console.warn(`AI analysis failed for memory ${memoryId}:`, msg);
      })
      .finally(() => {
        window.setTimeout(() => {
          completeAiAnalysis();
        }, 600);
      });
  }, [
    aiQueue,
    aiProcessing,
    aiProvider,
    aiApiKey,
    memories,
    updateMemory,
    dequeueAiAnalysis,
    completeAiAnalysis,
  ]);
}
