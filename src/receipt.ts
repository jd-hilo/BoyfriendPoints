export type ReceiptKind =
  | 'request'
  | 'earn'
  | 'redeem'
  | 'fulfill'
  | 'approve';

export interface ReceiptData {
  kind: ReceiptKind;
  emoji: string;
  title: string;
  points: number;
  fromName: string;
  toName: string;
  meta?: string;
  note?: string;
}

const KIND_LABEL: Record<ReceiptKind, string> = {
  request: 'POINT REQUEST',
  earn: 'POINTS EARNED',
  redeem: 'PRIZE REDEEMED',
  fulfill: 'PRIZE GIVEN',
  approve: 'POINTS APPROVED',
};

function signFor(kind: ReceiptKind): string {
  return kind === 'redeem' || kind === 'fulfill' ? '−' : '+';
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y: number,
  x2: number,
) {
  ctx.save();
  ctx.strokeStyle = '#c9cdd3';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/** Render a LoveReceipts paper receipt to a canvas. */
export function renderReceiptCanvas(data: ReceiptData): HTMLCanvasElement {
  const width = 720;
  const height = 960;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Desk background
  const desk = ctx.createLinearGradient(0, 0, 0, height);
  desk.addColorStop(0, '#e7ebf0');
  desk.addColorStop(1, '#cfd5dc');
  ctx.fillStyle = desk;
  ctx.fillRect(0, 0, width, height);

  // Paper shadow + body
  const px = 70;
  const py = 60;
  const pw = width - px * 2;
  const ph = height - py * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(px + 10, py + 14, pw, ph);

  ctx.fillStyle = '#fffcf7';
  ctx.fillRect(px, py, pw, ph);

  // Top blue brand strip
  const strip = ctx.createLinearGradient(px, py, px + pw, py);
  strip.addColorStop(0, '#4fc3ff');
  strip.addColorStop(0.5, '#008cff');
  strip.addColorStop(1, '#0062c8');
  ctx.fillStyle = strip;
  ctx.fillRect(px, py, pw, 10);

  let y = py + 56;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '700 34px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText('💎 LoveReceipts', width / 2, y);

  y += 36;
  ctx.font = '600 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#8b8b8b';
  ctx.fillText(KIND_LABEL[data.kind], width / 2, y);

  y += 28;
  drawDashedLine(ctx, px + 40, y, px + pw - 40);

  y += 48;
  ctx.fillStyle = '#555';
  ctx.font = '500 20px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText('FROM', width / 2, y);
  y += 30;
  ctx.fillStyle = '#008cff';
  ctx.font = '800 28px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText(data.fromName, width / 2, y);

  y += 40;
  ctx.fillStyle = '#555';
  ctx.font = '500 20px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText('TO', width / 2, y);
  y += 30;
  ctx.fillStyle = '#008cff';
  ctx.font = '800 28px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText(data.toName, width / 2, y);

  y += 36;
  drawDashedLine(ctx, px + 40, y, px + pw - 40);

  y += 56;
  ctx.font = '64px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText(data.emoji || '⭐', width / 2, y);

  y += 44;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '700 30px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  for (const line of wrapText(ctx, data.title, pw - 80)) {
    ctx.fillText(line, width / 2, y);
    y += 36;
  }

  if (data.meta) {
    y += 4;
    ctx.fillStyle = '#8b8b8b';
    ctx.font = '500 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillText(data.meta, width / 2, y);
    y += 28;
  }

  y += 18;
  // XP pill
  const amount = `${signFor(data.kind)}${data.points}`;
  ctx.font = '800 34px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  const label = `💎  ${amount}`;
  const tw = ctx.measureText(label).width;
  const pillW = tw + 48;
  const pillH = 56;
  const pillX = (width - pillW) / 2;
  const pillY = y - 38;
  const grad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY);
  grad.addColorStop(0, '#4fc3ff');
  grad.addColorStop(0.5, '#008cff');
  grad.addColorStop(1, '#0062c8');
  ctx.fillStyle = grad;
  roundRect(ctx, pillX, pillY, pillW, pillH, 28);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(label, width / 2, y);

  y += 50;
  drawDashedLine(ctx, px + 40, y, px + pw - 40);

  y += 36;
  const when = new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  ctx.fillStyle = '#8b8b8b';
  ctx.font = '500 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(when, width / 2, y);

  y += 40;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText('Thank you for the love 💕', width / 2, y);

  // Tear edge
  ctx.fillStyle = '#e7ebf0';
  const tearY = py + ph - 18;
  for (let x = px; x < px + pw; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, tearY);
    ctx.arc(x + 9, tearY, 9, Math.PI, 0);
    ctx.fill();
  }

  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function canvasToPngFile(
  canvas: HTMLCanvasElement,
  filename = 'love-receipt.png',
): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not export receipt'))),
      'image/png',
    );
  });
  return new File([blob], filename, { type: 'image/png' });
}

import posthog from 'posthog-js';

/** Share receipt image via Web Share API, or download as fallback. */
export async function shareReceiptImage(data: ReceiptData): Promise<void> {
  const canvas = renderReceiptCanvas(data);
  const file = await canvasToPngFile(canvas);
  const text = `${data.emoji} ${data.title} · ${signFor(data.kind)}${data.points} XP · LoveReceipts\nhttps://testflight.apple.com/join/aM6xgrsc`;

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (nav.share) {
    const payload: ShareData = { title: 'LoveReceipts', text, files: [file] };
    if (!nav.canShare || nav.canShare(payload)) {
      try {
        await nav.share(payload);
        posthog.capture('receipt_image_shared', { kind: data.kind });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }
    try {
      await nav.share({ title: 'LoveReceipts', text });
      posthog.capture('receipt_image_shared', { kind: data.kind });
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  posthog.capture('receipt_image_shared', { kind: data.kind, method: 'download' });
}
