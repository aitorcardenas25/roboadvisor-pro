// lib/xlsxLite.ts — lector mínim de fulls de càlcul per a les descàrregues de
// preus de les gestores. Llegeix .xlsx (ZIP + XML, amb o sense prefixos
// d'espai de noms) i SpreadsheetML 2003 (XML), i en treu les files com a text.
// No calcula fórmules ni formats: les dates queden com a número de sèrie
// d'Excel o com a text, i les interpreta lib/navFeeds.ts.

import { inflateRawSync } from 'zlib';

export interface Sheet { name: string; rows: string[][] }

const decodeXml = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

/** Fitxers d'un ZIP (només els que demana `want`), llegint el directori central. */
export function unzip(buf: Buffer, want: (name: string) => boolean): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El fitxer no és un ZIP vàlid');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize  = buf.readUInt32LE(p + 20);
    const nlen   = buf.readUInt16LE(p + 28);
    const elen   = buf.readUInt16LE(p + 30);
    const clen   = buf.readUInt16LE(p + 32);
    const local  = buf.readUInt32LE(p + 42);
    const name   = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + elen + clen;
    if (!want(name)) continue;
    const lnlen = buf.readUInt16LE(local + 26);
    const lelen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lnlen + lelen;
    const data  = buf.subarray(start, start + csize);
    out.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data));
  }
  return out;
}

const colIndex = (ref: string) => {
  const letters = (ref.match(/^[A-Z]+/) ?? ['A'])[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Totes les fulles d'un .xlsx com a files de text. */
export function readXlsx(buf: Buffer): Sheet[] {
  const files = unzip(buf, n => /^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml|_rels\/workbook\.xml\.rels)$/.test(n));
  const shared: string[] = [];
  const ss = files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  for (const m of ss.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)) {
    shared.push(decodeXml([...m[1].matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(t => t[1]).join('')));
  }
  // Noms de les fulles, en ordre (workbook.xml → rels → fitxer)
  const wb   = files.get('xl/workbook.xml')?.toString('utf8') ?? '';
  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? '';
  const target = new Map<string, string>();
  for (const m of rels.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/?>/g)) {
    const id = m[1].match(/\bId="([^"]+)"/)?.[1]; const t = m[1].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && t) target.set(id, 'xl/' + t.replace(/^\/?xl\//, '').replace(/^\//, ''));
  }
  const order: { name: string; file: string }[] = [];
  for (const m of wb.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)) {
    const name = decodeXml(m[1].match(/\bname="([^"]*)"/)?.[1] ?? '');
    const rid  = m[1].match(/\br:id="([^"]+)"/)?.[1] ?? m[1].match(/:id="([^"]+)"/)?.[1] ?? '';
    const file = target.get(rid);
    if (file) order.push({ name, file });
  }
  if (!order.length) {
    for (const f of [...files.keys()].filter(n => /worksheets\/sheet\d+\.xml$/.test(n)).sort()) order.push({ name: f, file: f });
  }
  return order.map(({ name, file }) => {
    const xml = files.get(file)?.toString('utf8') ?? '';
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
      const row: string[] = [];
      let next = 0;
      for (const c of r[1].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
        const attrs = c[1]; const inner = c[2] ?? '';
        const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
        const idx = ref ? colIndex(ref) : next;
        const type = attrs.match(/\bt="([^"]+)"/)?.[1];
        const v = inner.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
        let val = '';
        if (type === 's' && v !== undefined) val = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') val = decodeXml([...inner.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(t => t[1]).join(''));
        else if (v !== undefined) val = decodeXml(v);
        row[idx] = val.trim();
        next = idx + 1;
      }
      rows.push(Array.from(row, x => x ?? ''));
    }
    return { name, rows };
  });
}

/** Fulles d'un SpreadsheetML 2003 (el "Excel" en XML que donen iShares, azValor o Magallanes). */
export function readSpreadsheetMl(xml: string): Sheet[] {
  const sheets: Sheet[] = [];
  for (const ws of xml.matchAll(/<(?:\w+:)?Worksheet\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?Worksheet>/g)) {
    const name = decodeXml(ws[1].match(/Name="([^"]*)"/)?.[1] ?? '');
    const rows: string[][] = [];
    for (const r of ws[2].matchAll(/<(?:\w+:)?Row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?Row>)/g)) {
      const row: string[] = [];
      let next = 0;
      for (const c of (r[1] ?? '').matchAll(/<(?:\w+:)?Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?Cell>)/g)) {
        const index = c[1].match(/Index="(\d+)"/)?.[1];
        const idx = index ? Number(index) - 1 : next;
        const data = (c[2] ?? '').match(/<(?:\w+:)?Data\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Data>/)?.[1] ?? '';
        row[idx] = decodeXml(data.replace(/<[^>]+>/g, '')).trim();
        next = idx + 1;
      }
      rows.push(Array.from(row, x => x ?? ''));
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

/** Llegeix qualsevol dels dos formats segons el contingut. */
export function readSheets(buf: Buffer): Sheet[] {
  if (buf[0] === 0x50 && buf[1] === 0x4b) return readXlsx(buf);
  const text = buf.toString('utf8');
  if (/<(?:\w+:)?Workbook\b/.test(text)) return readSpreadsheetMl(text);
  throw new Error('Format de full de càlcul desconegut');
}
