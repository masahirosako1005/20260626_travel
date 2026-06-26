const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = '/tmp/puppeteer-cache/chrome/linux-150.0.7871.24/chrome-linux64/chrome';
const SCRATCHPAD = '/tmp/claude-1000/-home-masahiro-Project-Claude-20260626-travel/50c524e5-1c4c-4a08-a7c2-a9e3dacb7f09/scratchpad/screenshots';
const BASE = 'http://localhost:3000';
const LD_PATH = '/tmp/nss-extract/usr/lib/x86_64-linux-gnu:/tmp/nspr-extract/usr/lib/x86_64-linux-gnu:/tmp/alsa-extract/usr/lib/x86_64-linux-gnu';

process.env.LD_LIBRARY_PATH = [LD_PATH, process.env.LD_LIBRARY_PATH || ''].filter(Boolean).join(':');

async function shot(page, filename, delay = 800) {
  await new Promise(r => setTimeout(r, delay));
  await page.screenshot({ path: path.join(SCRATCHPAD, filename), fullPage: false });
  console.log('  saved:', filename);
}

async function waitForLoad(page) {
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 600));
}

(async () => {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--no-zygote', '--single-process',
      '--disable-extensions', '--disable-background-timer-throttling',
    ],
    timeout: 30000,
    env: { ...process.env },
  });
  console.log('Browser launched OK');

  // ── USER SCREENS ─────────────────────────────────
  console.log('\n--- USER SCREENS ---');
  const up = await browser.newPage();
  await up.setViewport({ width: 430, height: 932 });

  await up.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 20000 });
  await waitForLoad(up);

  // Select U035 (Lv.5 user with rich data)
  await up.select('#userSelect', 'U035');
  await new Promise(r => setTimeout(r, 2000));

  // U-01: ホーム
  await up.evaluate(() => switchTab('home'));
  await shot(up, 'u01_home.png', 2000);

  // U-02: 旅のリプレイ
  await up.evaluate(() => switchTab('replay'));
  await shot(up, 'u02_replay.png', 2000);

  // U-03: 未完了一覧
  await up.evaluate(() => switchTab('incomplete'));
  await shot(up, 'u03_incomplete.png', 2000);

  // U-04: おすすめルート
  await up.evaluate(() => switchTab('routes'));
  await shot(up, 'u04_routes.png', 2000);

  // U-05: 愛着スコア
  await up.evaluate(() => switchTab('attachment'));
  await shot(up, 'u05_attachment.png', 2000);

  await up.close();

  // ── ADMIN SCREENS ────────────────────────────────
  console.log('\n--- ADMIN SCREENS ---');
  const ap = await browser.newPage();
  await ap.setViewport({ width: 1280, height: 900 });

  await ap.goto(BASE + '/admin', { waitUntil: 'networkidle0', timeout: 20000 });
  await waitForLoad(ap);

  // A-01: ダッシュボード
  await ap.evaluate(() => adminTab('dashboard'));
  await shot(ap, 'a01_dashboard.png', 1200);

  // A-02: JSONインポート
  await ap.evaluate(() => adminTab('import'));
  await shot(ap, 'a02_import.png', 800);

  // A-03: スポット管理
  await ap.evaluate(() => adminTab('spots'));
  await shot(ap, 'a03_spots.png', 1000);

  // A-04: ラリー管理
  await ap.evaluate(() => adminTab('rallies'));
  await shot(ap, 'a04_rallies.png', 1200);

  // A-05: 特典管理
  await ap.evaluate(() => adminTab('benefits'));
  await shot(ap, 'a05_benefits.png', 1200);

  // A-06: 再訪候補
  await ap.evaluate(() => adminTab('revisit'));
  await shot(ap, 'a06_revisit.png', 1500);

  await ap.close();
  await browser.close();
  console.log('\nAll screenshots saved to:', SCRATCHPAD);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
