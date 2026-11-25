// Regressió: a l'iPhone (també dins del Gmail) la pàgina quedava en blanc perquè el
// service worker responia a les navegacions amb redireccions (WebKit les rebutja).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sw = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

describe('service worker', () => {
  it('no intercepta peticions (cap controlador de fetch ni respondWith)', () => {
    expect(sw).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(sw).not.toContain('respondWith');
  });
  it('en activar-se esborra la memòria cau antiga', () => {
    expect(sw).toMatch(/caches\.delete/);
  });
});
