import { eq } from 'drizzle-orm';
import { id } from './domain.ts';
import { media } from './db/schema.ts';
import type { Database } from './db/client.ts';

const MAX_BYTES = 1_500_000;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface MediaRow {
  id: string;
  userId: string;
  contentType: string;
  bytes: string;
  createdAt: string;
}

function decodeBase64(raw: string): Uint8Array {
  const clean = raw.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(clean, 'base64');
  }
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function publicOrigin(input: {
  proto?: string;
  host?: string;
  url?: string;
}): string {
  if (input.url) {
    try {
      return new URL(input.url).origin;
    } catch {
      /* fall through */
    }
  }
  const proto = input.proto || 'https';
  const host = input.host || 'localhost';
  return `${proto}://${host}`;
}

export function mediaUrl(origin: string, mediaId: string): string {
  return `${origin.replace(/\/$/, '')}/api/media/${mediaId}`;
}

export async function createMedia(
  db: Database,
  userId: string,
  contentType: string,
  data: string,
): Promise<MediaRow> {
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED.has(type)) throw new Error('Use a JPEG, PNG, or WebP photo');
  const raw = data.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
  if (!raw) throw new Error('Photo was empty');
  const bytes = decodeBase64(raw);
  if (bytes.byteLength === 0) throw new Error('Photo was empty');
  if (bytes.byteLength > MAX_BYTES) throw new Error('Photo is too large');

  const row: MediaRow = {
    id: id('m_'),
    userId,
    contentType: type,
    bytes: raw,
    createdAt: new Date().toISOString(),
  };
  await db.insert(media).values(row);
  return row;
}

export async function readMedia(
  db: Database,
  mediaId: string,
): Promise<MediaRow | null> {
  const [row] = await db
    .select()
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);
  return row ?? null;
}

export function mediaBytes(row: MediaRow): Uint8Array {
  return decodeBase64(row.bytes);
}
