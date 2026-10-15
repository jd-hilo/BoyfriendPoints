#!/usr/bin/env node
/**
 * App Store marketing captures of the Expo web app.
 *
 * Requires EXPO_PUBLIC_SCREENSHOT_MODE=1 so auth + seed stay mocked.
 * Usage:
 *   EXPO_PUBLIC_SCREENSHOT_MODE=1 pnpm --dir mobile screenshots
 * or start `pnpm --dir mobile web:screenshots` first, then this script.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.SCREENSHOT_OUT_DIR || '/opt/cursor/artifacts';
const PORT = Number(process.env.EXPO_WEB_PORT || 8081);
const BASE = `http://127.0.0.1:${PORT}`;

const VIEWPORT = { width: 440, height: 956, deviceScaleFactor: 3 };

const SHOTS = [
  {
    file: '01_feed.png',
    shot: 'feed',
    waitFor: 'mushroom risotto',
    settleMs: 1800,
  },
  {
    file: '02_submit_request.png',
    shot: 'submit',
    waitFor: 'Mowed the lawn',
    settleMs: 800,
  },
  {
    file: '03_redeem_prizes.png',
    shot: 'redeem',
    waitFor: 'Movie night, my pick',
    settleMs: 800,
  },
  {
    file: '04_wife_requests.png',
    shot: 'requests',
    waitFor: 'Fixed the leaky sink',
    settleMs: 800,
  },
  {
    file: '05_wife_manage.png',
    shot: 'manage',
    waitFor: 'Breakfast in bed',
    scrollTo: 'Prizes they can get',
    settleMs: 900,
  },
  {
    file: '06_profile_points.png',
    shot: 'profile',
    waitFor: 'Noah & Emma',
    settleMs: 800,
  },
  {
    file: '07_notifications.png',
    shot: 'notifications',
    waitFor: 'requested points',
    settleMs: 800,
  },
  {
    file: '08_onboarding.png',
    shot: 'onboarding',
    waitFor: 'Every favor',
    settleMs: 1800,
  },
  {
    file: '09_link_partner.png',
    shot: 'link',
    waitFor: 'Link your partner',
    settleMs: 700,
  },
];

function portOpen(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function waitForUrl(url, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status > 0) return;
    } catch {
      /* still booting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startExpo() {
  const env = {
    ...process.env,
    EXPO_PUBLIC_SCREENSHOT_MODE: '1',
    CI: '1',
    BROWSER: 'none',
    EXPO_NO_TELEMETRY: '1',
  };
  const child = spawn(
    'pnpm',
    ['exec', 'expo', 'start', '--web', '--port', String(PORT), '--non-interactive'],
    {
      cwd: MOBILE_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (buf) => process.stdout.write(buf));
  child.stderr.on('data', (buf) => process.stderr.write(buf));
  return child;
}

const IOS_CHROME_CSS = `
#ios-marketing-chrome {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  font-family: system-ui, -apple-system, "SF Pro Text", "Segoe UI", sans-serif;
  color: #000;
}
#ios-marketing-chrome .status {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 54px;
}
#ios-marketing-chrome .time {
  position: absolute;
  left: 28px;
  top: 16px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.3px;
  line-height: 22px;
}
#ios-marketing-chrome .island {
  position: absolute;
  top: 11px;
  left: 50%;
  transform: translateX(-50%);
  width: 126px;
  height: 36px;
  background: #000;
  border-radius: 24px;
}
#ios-marketing-chrome .icons {
  position: absolute;
  right: 22px;
  top: 18px;
  display: flex;
  align-items: center;
  gap: 6px;
}
#ios-marketing-chrome .home {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  width: 140px;
  height: 5px;
  background: #000;
  border-radius: 3px;
}
html, body, #root {
  background: #ffffff !important;
}
::-webkit-scrollbar { display: none !important; }
`;

const IOS_CHROME_HTML = `
<div class="status">
  <div class="time">9:41</div>
  <div class="island"></div>
  <div class="icons" aria-hidden="true">
    <svg width="19" height="12" viewBox="0 0 19 12" fill="none">
      <rect x="0" y="7" width="3" height="5" rx="0.6" fill="#000"/>
      <rect x="4.5" y="5" width="3" height="7" rx="0.6" fill="#000"/>
      <rect x="9" y="2.5" width="3" height="9.5" rx="0.6" fill="#000"/>
      <rect x="13.5" y="0" width="3" height="12" rx="0.6" fill="#000"/>
    </svg>
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <path d="M1.2 8.4C3.7 6.2 6.5 5.1 8 5.1c1.5 0 4.3 1.1 6.8 3.3" stroke="#000" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M3.4 10.1c1.6-1.4 3.1-2.1 4.6-2.1 1.5 0 3 .7 4.6 2.1" stroke="#000" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="8" cy="11.1" r="1.1" fill="#000"/>
    </svg>
    <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
      <rect x="0.6" y="0.6" width="22" height="11.8" rx="2.6" stroke="#000" stroke-width="1.2" opacity="0.4"/>
      <rect x="2.2" y="2.2" width="18.8" height="8.6" rx="1.4" fill="#000"/>
      <rect x="23.6" y="4.2" width="2.2" height="4.6" rx="0.8" fill="#000" opacity="0.4"/>
    </svg>
  </div>
</div>
<div class="home"></div>
`;

async function installChrome(page) {
  await page.addStyleTag({ content: IOS_CHROME_CSS });
  await page.evaluate((html) => {
    document.getElementById('ios-marketing-chrome')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'ios-marketing-chrome';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
  }, IOS_CHROME_HTML);
}

async function waitForImages(page) {
  await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(
      imgs.map(
        (img) =>
          img.complete ||
          new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          }),
      ),
    );
  });
}

async function captureShot(page, spec) {
  const url = `${BASE}/?shot=${encodeURIComponent(spec.shot)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('#root', { timeout: 30_000 });
  await page.waitForFunction(
    (text) => document.body?.innerText?.includes(text),
    spec.waitFor,
    { timeout: 30_000 },
  );
  if (spec.scrollTo) {
    await page.evaluate((label) => {
      const nodes = [...document.querySelectorAll('div, span, p')];
      const el = nodes.find((node) => node.textContent?.trim() === label);
      el?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }, spec.scrollTo);
  }
  await waitForImages(page);
  await page.waitForTimeout(spec.settleMs);
  await installChrome(page);
  const dest = path.join(OUT_DIR, spec.file);
  await page.screenshot({
    path: dest,
    type: 'png',
    animations: 'disabled',
  });
  return dest;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let expo;
  const alreadyUp = await portOpen(PORT);
  if (!alreadyUp) {
    console.log(`Starting Expo web on :${PORT} (screenshot mode)…`);
    expo = startExpo();
  } else {
    console.log(`Reusing existing server on :${PORT}`);
  }

  try {
    await waitForUrl(BASE);
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--hide-scrollbars', '--font-render-hinting=none'],
    });
    const context = await browser.newContext({
      viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
      deviceScaleFactor: VIEWPORT.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'light',
    });
    const page = await context.newPage();
    const written = [];
    for (const spec of SHOTS) {
      console.log(`Capturing ${spec.file} (${spec.shot})…`);
      written.push(await captureShot(page, spec));
    }
    await browser.close();
    const list = written.join('\n');
    await writeFile(path.join(OUT_DIR, 'screenshot_manifest.txt'), `${list}\n`);
    console.log('\nWrote:');
    console.log(list);
  } finally {
    if (expo) {
      expo.kill('SIGTERM');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
