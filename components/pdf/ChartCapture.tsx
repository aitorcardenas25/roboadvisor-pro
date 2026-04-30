'use client';

import { toPng } from 'html-to-image';

const rAF = () => new Promise<void>(r => requestAnimationFrame(() => r()));

export async function captureChart(elementId: string): Promise<string | null> {
  const element = document.getElementById(elementId);
  if (!element) return null;

  // Wait for recharts to finish rendering (uses rAF internally)
  await rAF();
  await rAF();

  try {
    return await toPng(element, {
      quality:         1.0,
      pixelRatio:      2,
      backgroundColor: '#ffffff',
    });
  } catch (error) {
    console.error(`Error capturant gràfic ${elementId}:`, error);
    return null;
  }
}

export async function captureAllCharts(chartIds: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  for (const id of chartIds) {
    const img = await captureChart(id);
    if (img) results[id] = img;
  }
  return results;
}
