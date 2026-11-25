// utils/downloadBlob.ts — desa un fitxer generat al navegador (PDF, Excel, CSV).
//
// Al mòbil (sobretot iPhone) el navegador no desa el fitxer: l'obre a la mateixa
// pestanya o en una de nova a partir de l'enllaç temporal (blob:). Abans aquest
// enllaç s'esborrava al cap d'1–2 segons (o a l'instant), i el PDF s'obria en blanc.
// Ara l'enllaç viu uns minuts, prou perquè el visor del mòbil l'acabi de carregar.

const KEEP_URL_MS = 5 * 60_000;

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), KEEP_URL_MS);
}
