// Regressió: a l'iPhone el PDF s'obria en blanc perquè l'enllaç temporal (blob:)
// s'esborrava 0–2 s després del clic, abans que el visor l'hagués carregat.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '@/utils/downloadBlob';

describe('downloadBlob', () => {
  const revoke = vi.fn();
  const click = vi.fn();
  let anchor: Record<string, unknown>;

  beforeEach(() => {
    vi.useFakeTimers();
    revoke.mockReset(); click.mockReset();
    anchor = { style: {}, click, remove: vi.fn() };
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:prova', revokeObjectURL: revoke });
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('obre el fitxer amb el nom indicat', () => {
    downloadBlob(new Blob(['x']), 'informe.pdf');
    expect(click).toHaveBeenCalledOnce();
    expect(anchor.href).toBe('blob:prova');
    expect(anchor.download).toBe('informe.pdf');
  });

  it("l'enllaç continua vàlid molt més enllà dels 2 s d'abans, i després s'allibera", () => {
    downloadBlob(new Blob(['x']), 'informe.pdf');
    vi.advanceTimersByTime(60_000);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5 * 60_000);
    expect(revoke).toHaveBeenCalledWith('blob:prova');
  });
});
