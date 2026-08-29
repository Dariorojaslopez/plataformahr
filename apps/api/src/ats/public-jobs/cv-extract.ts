import { inflateRawSync, inflateSync } from 'node:zlib';
import {
  CV_EXTENSION_BY_MIME,
  CV_MAX_BYTES,
  CV_MIME,
  type AllowedCvMime,
} from './cv.constants';

export type InspectedCv = {
  mime: AllowedCvMime;
  extension: 'pdf' | 'docx' | 'txt';
  originalName: string;
  buffer: Buffer;
};

export function inspectCvFile(input: {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
}): InspectedCv | { error: 'empty' | 'size' | 'type' } {
  const buffer = input.buffer;
  if (!buffer.length) return { error: 'empty' };
  if (buffer.length > CV_MAX_BYTES) return { error: 'size' };

  const mime = detectCvMime(buffer, input.mimetype, input.originalname);
  if (!mime) return { error: 'type' };

  return {
    mime,
    extension: CV_EXTENSION_BY_MIME[mime],
    originalName: sanitizeOriginalName(input.originalname),
    buffer,
  };
}

export function detectCvMime(
  buffer: Buffer,
  mimeHint?: string,
  originalName?: string,
): AllowedCvMime | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return CV_MIME.PDF;
  }
  if (buffer.length >= 4 && buffer.subarray(0, 2).toString('ascii') === 'PK') {
    if (zipHasEntry(buffer, 'word/document.xml')) return CV_MIME.DOCX;
    return null;
  }
  const name = (originalName ?? '').toLowerCase();
  const hint = (mimeHint ?? '').toLowerCase();
  const looksText =
    hint.startsWith('text/plain') || name.endsWith('.txt') || looksLikeUtf8Text(buffer);
  if (looksText && looksLikeUtf8Text(buffer)) return CV_MIME.TXT;
  return null;
}

export function extractCvText(inspected: InspectedCv): string {
  if (inspected.mime === CV_MIME.TXT) {
    return inspected.buffer.toString('utf8');
  }
  if (inspected.mime === CV_MIME.PDF) {
    return extractPdfText(inspected.buffer);
  }
  return extractDocxText(inspected.buffer);
}

export function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const parts: string[] = [...extractPdfLiterals(raw)];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(raw))) {
    const bytes = Buffer.from(match[1], 'latin1');
    for (const decoded of tryInflate(bytes)) {
      const latin1 = decoded.toString('latin1');
      parts.push(...extractPdfLiterals(latin1));
      parts.push(decoded.toString('utf8'));
    }
  }
  return parts.join('\n').replace(/[^\S\n]+/g, ' ').trim();
}

export function extractDocxText(buffer: Buffer): string {
  const xml = readZipEntry(buffer, 'word/document.xml');
  if (!xml) return '';
  return xml
    .toString('utf8')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<w:t[^>]*>/g, '')
    .replace(/<\/w:t>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

function extractPdfLiterals(raw: string): string[] {
  const out: string[] = [];
  const re = /\((?:\\.|[^\\)])*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const inner = match[0].slice(1, -1);
    const text = inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, ' ')
      .replace(/\\([()\\])/g, '$1');
    if (text.trim()) out.push(text);
  }
  return out;
}

function tryInflate(bytes: Buffer): Buffer[] {
  const out: Buffer[] = [];
  for (const fn of [inflateSync, inflateRawSync]) {
    try {
      out.push(fn(bytes));
    } catch {
      /* not this wrapper */
    }
  }
  return out;
}

function looksLikeUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  const sample = buffer.subarray(0, 4000).toString('utf8');
  const replacement = (sample.match(/\uFFFD/g) ?? []).length;
  return replacement / Math.max(sample.length, 1) < 0.05;
}

function sanitizeOriginalName(name: string | undefined): string {
  const cleaned = (name ?? '')
    .replace(/[/\\]/g, '')
    .replace(/\0/g, '')
    .trim()
    .slice(0, 180);
  return cleaned || 'cv';
}

function zipHasEntry(buffer: Buffer, target: string): boolean {
  return readZipEntry(buffer, target) !== null;
}

function readZipEntry(buffer: Buffer, target: string): Buffer | null {
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.toString('utf8', nameStart, nameStart + nameLen);
    const dataStart = nameStart + nameLen + extraLen;
    if (dataStart + compSize > buffer.length) break;
    const data = buffer.subarray(dataStart, dataStart + compSize);
    if (name === target || name.endsWith(`/${target}`)) {
      if (method === 0) return Buffer.from(data);
      if (method === 8) {
        try {
          return inflateRawSync(data);
        } catch {
          return null;
        }
      }
      return null;
    }
    offset = dataStart + compSize;
  }
  return null;
}

/** Test helper: ZIP with stored (uncompressed) entries. */
export function buildStoredZip(entries: Record<string, string | Buffer>): Buffer {
  const parts: Buffer[] = [];
  for (const [name, content] of Object.entries(entries)) {
    const data = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    const nameBuf = Buffer.from(name, 'utf8');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    parts.push(header, nameBuf, data);
  }
  return Buffer.concat(parts);
}
