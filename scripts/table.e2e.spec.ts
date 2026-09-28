import { test, expect, type Browser, type Page, type Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const artifacts = path.resolve(process.env.QA_ARTIFACT_DIR ?? 'docs/qa/table');
async function tapCard(card: Locator) {
  // Fan cards expose their left edge; the bottom edge remains reachable beside a lifted card.
  const bounds = await card.boundingBox();
  await card.click({ position: { x: 14, y: bounds!.height - 8 } });
}

for (const viewport of [{width:1366,height:768},{width:390,height:667},{width:844,height:390},{width:547,height:287}]) test(`five players sit around the table ${viewport.width}x${viewport.height}`, async ({ browser }) => {
  test.skip(process.env.QA_FIXTURES !== '1', 'Local QA server');
  const clients = await Promise.all(Array.from({ length: 5 }, (_, i) => guest(browser, `Mèo ${i + 1}`, viewport)));
  try {
    const host = clients[0]!;
    await host.page.getByRole('button', { name: /Tạo phòng/ }).click();
    await expect(host.page.locator('.room-ticket strong')).toBeVisible();
    const code = await host.page.locator('.room-ticket strong').innerText();
    for (const client of clients.slice(1)) {
      await client.page.getByRole('textbox', { name: 'Mã phòng' }).fill(code);
      await client.page.getByRole('button', { name: 'Vào phòng', exact: true }).click();
    }
    await expect(host.page.locator('.player-list-row')).toHaveCount(5);
    for (const client of clients) await client.page.getByRole('button', { name: 'Tôi sẵn sàng', exact: true }).click();
    await host.page.getByRole('button', { name: /Bắt đầu ván/ }).click();
    for (const client of clients) {
      await expect(client.page.locator('.table-layout')).toBeVisible();
      await expect(client.page.locator('.seat-target')).toHaveCount(4);
      await fitsScreen(client.page);
      const bounds = await client.page.locator('.seat-target').evaluateAll(elements => elements.map(element => { const box=element.getBoundingClientRect();return {x:box.x,y:box.y,right:box.right,bottom:box.bottom}; }));
      for (let i=0;i<bounds.length;i++) {
        expect(bounds[i]!.x).toBeGreaterThanOrEqual(0);
        expect(bounds[i]!.right).toBeLessThanOrEqual(viewport.width);
        for (let j=i+1;j<bounds.length;j++) expect(bounds[i]!.right<=bounds[j]!.x || bounds[j]!.right<=bounds[i]!.x || bounds[i]!.bottom<=bounds[j]!.y || bounds[j]!.bottom<=bounds[i]!.y).toBe(true);
      }
      expect(client.errors).toEqual([]);
    }
    await expect(clients[1]!.page.locator('.seat-turn-label')).toHaveText('ĐANG CHƠI');
    await expect(host.page.locator('.effect-start')).toHaveCount(0);
    for (const client of clients) await client.page.mouse.move(5,5);
    await mkdir(artifacts, { recursive: true });
    await host.page.screenshot({ path: path.join(artifacts, `table-five-${viewport.width}x${viewport.height}.png`) });
    await clients[1]!.page.screenshot({ path: path.join(artifacts, `table-five-opponent-${viewport.width}x${viewport.height}.png`) });
    const response = await fetch('http://127.0.0.1:3013', {method:'POST',body:JSON.stringify({roomCode:code,fixture:'table'})});
    expect(response.ok).toBe(true);
    const {revision}=await response.json();
    for (const client of clients) await client.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => clients.every(client => client.snapshot?.game?.public?.revision===revision)).toBe(true);
    const cats=host.page.locator('.hand-card[data-card-type="CAT_TACO"]');
    await tapCard(cats.nth(0));await tapCard(cats.nth(1));
    const targets=host.page.locator('.seat-target.can-target');
    await expect(targets).toHaveCount(4);
    for (const target of await targets.all()) {
      await target.click();
      await expect(target).toHaveAttribute('aria-pressed','true');
      await expect(host.page.locator('.play-submit')).toBeEnabled();
    }
    await host.page.mouse.move(5,5);
    await host.page.screenshot({path:path.join(artifacts,`table-five-selected-${viewport.width}x${viewport.height}.png`)});
    await host.page.locator('.play-submit').click();
    for (const client of clients) {
      await expect(client.page.locator('.function-notice')).toContainText('× 2');
      await expect(client.page.locator('.nope-callout')).toContainText('Ai Nope không?');
      await client.page.getByRole('button',{name:'Bỏ qua',exact:true}).click();
    }
    await expect.poll(() => host.snapshot.game.public.phase).toBe('TURN');
    const tripleResponse=await fetch('http://127.0.0.1:3013',{method:'POST',body:JSON.stringify({roomCode:code,fixture:'table'})});
    expect(tripleResponse.ok).toBe(true);
    const tripleRevision=(await tripleResponse.json()).revision;
    for (const client of clients) await client.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => clients.every(client => client.snapshot?.game?.public?.revision===tripleRevision)).toBe(true);
    for (const card of await host.page.locator('.hand-card[data-card-type="CAT_TACO"]').all()) await tapCard(card);
    await host.page.locator('.requested-picker select').selectOption('SKIP');
    for (const target of await host.page.locator('.seat-target.can-target').all()) {
      await target.click();
      await expect(target).toHaveAttribute('aria-pressed','true');
    }
    await expect(host.page.locator('.play-submit')).toBeEnabled();
    await fitsScreen(host.page);
    for (const client of clients) expect(client.errors).toEqual([]);
  } finally { await Promise.all(clients.map(client => client.context.close().catch(() => {}))); }
});
async function guest(browser: Browser, name: string, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const client = { context, page, snapshot: null as any, outgoing: [] as any[], errors: [] as string[] };
  page.on('pageerror', error => client.errors.push(error.message));
  page.on('websocket', socket => {
    const parse = (data: string | Buffer) => { try { const value = data.toString(); return JSON.parse(value.slice(value.indexOf('['))); } catch { return null; } };
    socket.on('framereceived', ({ payload }) => { const packet = parse(payload); if (packet?.[0] === 'room:snapshot') client.snapshot = packet[1]; });
    socket.on('framesent', ({ payload }) => { const packet = parse(payload); if (packet) client.outgoing.push(packet); });
  });
  await page.goto(process.env.QA_BASE_URL ?? 'http://localhost:5182');
  await expect(page.locator('.connection-indicator')).toHaveClass(/connected/);
  await expect(page.locator('.lobby-loading')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Tên của bạn' }).fill(name);
  return client;
}

async function fitsScreen(page: Page) {
  const dimensions = await page.evaluate(() => ({ height: innerHeight, width: innerWidth, scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height + 1);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  for (const selector of ['.table-status', '.table-felt', '.hand-scroll', '.turn-actions']) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds, selector).toBeTruthy();
    expect(bounds!.y, selector).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height, selector).toBeLessThanOrEqual(dimensions.height + 1);
  }
}

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 390, height: 667 }, { width: 360, height: 640 }, { width: 844, height: 390 }, { width: 547, height: 287 }]) {
  test(`single-screen table ${viewport.width}x${viewport.height}: direct combos, local UI, notices, shuffle, ping and chat`, async ({ browser }) => {
    test.setTimeout(60_000);
    test.skip(process.env.QA_FIXTURES !== '1', 'Uses the loopback-only fixture runner');
    const host = await guest(browser, 'Chủ bàn', viewport);
    const peer = await guest(browser, 'Bạn mèo', viewport);
    const clients = [host, peer];
    try {
      await host.page.getByRole('button', { name: /Tạo phòng/ }).click();
      await expect(host.page.locator('.room-ticket strong')).toBeVisible();
      const code = await host.page.locator('.room-ticket strong').innerText();
      expect(code).toMatch(/^\d{6}$/);
      await peer.page.getByRole('textbox', { name: 'Mã phòng' }).fill(code);
      await peer.page.getByRole('button', { name: 'Vào phòng', exact: true }).click();
      await expect(host.page.locator('.player-list-row')).toHaveCount(2);
      expect(host.snapshot.room.options.mode).toBe('EXTENDED');
      for (const client of clients) await client.page.getByRole('button', { name: 'Tôi sẵn sàng', exact: true }).click();
      await host.page.getByRole('button', { name: /Bắt đầu ván/ }).click();
      await expect(host.page.locator('.table-layout')).toBeVisible();
      const fixture = async (kind = 'table') => {
        const response = await fetch('http://127.0.0.1:3013', { method: 'POST', body: JSON.stringify({ roomCode: code, fixture: kind }) });
        expect(response.ok).toBe(true);
        const { revision } = await response.json();
        for (const client of clients) await client.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await expect.poll(() => clients.every(client => client.snapshot?.game?.public?.revision === revision)).toBe(true);
      };
      const pass = async () => {
        for (const client of clients) await client.page.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
        await expect.poll(() => host.snapshot.game.public.phase).toBe('TURN');
      };
      await fixture();
      await expect(host.page.locator('.ping-indicator')).toContainText(/\d+ ms/);
      await expect(host.page.locator('.table-status h1')).toContainText('Lượt của bạn');
      await expect(host.page.locator('.self-avatar .avatar-timer')).toHaveCount(1);
      await expect(host.page.locator('.seat-target .avatar-timer')).toHaveCount(0);
      await expect(peer.page.locator('.seat-target .avatar-timer')).toHaveCount(1);
      await expect(peer.page.locator('.self-avatar .avatar-timer')).toHaveCount(0);
      await expect(host.page.locator('.self-avatar .countdown')).toContainText(/4\d?s/);
      const arc = host.page.locator('.self-avatar .timer-arc');
      const startArc = Number(await arc.getAttribute('stroke-dashoffset'));
      await expect.poll(async () => Number(await arc.getAttribute('stroke-dashoffset'))).toBeGreaterThan(startArc);
      await expect(peer.page.locator('.seat-turn-label')).toHaveText('ĐANG CHƠI');
      await expect(host.page.locator('.room-chat-panel')).toBeHidden();
      await expect(host.page.locator('.mode-picker')).toHaveCount(0);
      await fitsScreen(host.page);
      const localRequests = host.outgoing.filter(packet => !['connection:ping'].includes(packet[0])).length;
      const cats = host.page.locator('.hand-card[data-card-type="CAT_TACO"]');
      await tapCard(cats.nth(0));
      const lift = await cats.nth(0).evaluate(element => getComputedStyle(element).transform);
      expect(lift).not.toBe('none');
      await tapCard(cats.nth(1));
      await expect(host.page.locator('.hand-card.is-selected')).toHaveCount(2);
      await expect(host.page.locator('.play-submit')).toBeDisabled();
      await host.page.locator('.seat-target.can-target').click();
      await expect(host.page.locator('.play-submit')).toBeEnabled();
      await fitsScreen(host.page);
      await mkdir(artifacts, { recursive: true });
      await host.page.screenshot({ path: path.join(artifacts, `table-${viewport.width}x${viewport.height}.png`) });
      await tapCard(cats.nth(2));
      await expect(host.page.locator('.hand-card.is-selected')).toHaveCount(3);
      await host.page.locator('.seat-target.can-target').click();
      await host.page.locator('.requested-picker select').selectOption('SKIP');
      await host.page.getByRole('button', { name: 'Xếp bài', exact: true }).click();
      expect(host.outgoing.filter(packet => packet[0] !== 'connection:ping')).toHaveLength(localRequests);
      await host.page.locator('.play-submit').click();
      await expect(host.page.locator('.function-notice')).toContainText('× 3');
      await expect(peer.page.locator('.function-notice')).toContainText('× 3');
      for (const client of clients) {
        const hasNope = client.snapshot.game.private.hand.some((card: any) => card.type === 'NOPE');
        await expect(client.page.locator('.choice-buttons .button-danger')).toHaveCount(hasNope ? 1 : 0);
        await expect(client.page.locator('.nope-callout')).toContainText('Ai Nope không?');
      }
      await expect(host.page.locator('.avatar-timer')).toHaveCount(2);
      await expect(host.page.locator('.phase-coach')).toContainText('12 giây');
      expect(host.snapshot.game.public.pending.requestedType).toBe('SKIP');
      await pass();
      expect(host.snapshot.events.some((event: any) => event.key === 'combo.triple')).toBe(true);
      await fixture();
      await tapCard(host.page.locator('.hand-card[data-card-type="SHUFFLE"]'));
      await host.page.locator('.play-submit').click();
      await expect(host.page.locator('[data-function-notice="SHUFFLE"]')).toContainText(/Xáo|xáo/);
      await expect(peer.page.locator('[data-function-notice="SHUFFLE"]')).toBeVisible();
      await pass();
      await expect(host.page.locator('[data-shuffle-animation]')).toBeVisible();
      await host.page.screenshot({ path: path.join(artifacts, `shuffle-${viewport.width}x${viewport.height}.png`) });
      await expect(host.page.locator('[data-shuffle-animation]')).toHaveCount(0);
      await host.page.locator('.room-chat-trigger').click();
      await host.page.locator('#room-chat-input').fill('Bàn mới dễ chơi hơn 🐱');
      await host.page.locator('#room-chat-input').press('Enter');
      await host.page.locator('.chat-close').click();
      await expect(peer.page.locator('.chat-unread')).toHaveText('1');
      await peer.page.locator('.room-chat-trigger').click();
      await expect(peer.page.locator('.room-chat-message p')).toHaveText('Bàn mới dễ chơi hơn 🐱');
      await peer.page.keyboard.press('Escape');
      await expect(peer.page.locator('.room-chat-panel')).toBeHidden();
      await fixture();
      await tapCard(host.page.locator('.hand-card[data-card-type="ATTACK"]'));
      await tapCard(host.page.locator('.hand-card[data-card-type="PLUS_PLUS"]'));
      await expect(host.page.locator('.play-submit')).toBeEnabled();
      await host.page.locator('.play-submit').click();
      await expect.poll(() => host.snapshot.game.public.pending?.playKind).toBe('PLUS_PLUS');
      await pass();
      expect(host.snapshot.game.public.turnsRemaining).toBe(3);
      if (viewport.width === 1366) {
        await fixture('no-nopes');
        await tapCard(host.page.locator('.hand-card[data-card-type="SHUFFLE"]'));
        await host.page.locator('.play-submit').click();
        await expect.poll(() => host.snapshot.game.public.phase).toBe('NOPE_WINDOW');
        const deadline = host.snapshot.game.public.deadlineAt;
        expect(deadline - Date.now()).toBeGreaterThan(11000);
        for (const client of clients) {
          expect(client.snapshot.game.private.hand.some((card: any) => card.type === 'NOPE')).toBe(false);
          await expect(client.page.locator('.choice-buttons .button-danger')).toHaveCount(0);
          await expect(client.page.locator('.nope-callout')).toContainText('Ai Nope không?');
        }
        await expect(host.page.locator('.nope-callout')).toHaveCount(1);
        await expect.poll(() => Date.now() > deadline, { timeout: 16000 }).toBe(true);
        await expect.poll(() => host.snapshot.game.public.phase).toBe('TURN');
        await fixture('nope');
        await tapCard(host.page.locator('.hand-card[data-card-type="SHUFFLE"]'));
        await host.page.locator('.play-submit').click();
        await expect(host.page.locator('.choice-buttons .button-danger')).toBeEnabled();
        await expect.poll(() => host.page.locator('.function-notice').evaluate(element => getComputedStyle(element).opacity)).toBe('1');
        await host.page.screenshot({ path: path.join(artifacts, 'nope-popup.png') });
        await host.page.locator('.choice-buttons .button-danger').click();
        await expect.poll(() => host.snapshot.game.public.pending?.nopeCount).toBe(1);
        await expect(host.page.locator('.choice-buttons .button-danger')).toHaveCount(0);
        await pass();
      }
      await host.page.reload();
      await expect(host.page.locator('.table-layout')).toBeVisible();
      await expect(host.page.locator('.function-notice')).toHaveCount(0);
      for (const client of clients) expect(client.errors).toEqual([]);
    } finally { await Promise.all(clients.map(client => client.context.close().catch(() => {}))); }
  });
}
