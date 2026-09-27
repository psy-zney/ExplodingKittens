import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, totalmem, platform, release } from 'node:os';
import path from 'node:path';

const artifacts = path.resolve(process.env.QA_ARTIFACT_DIR ?? 'docs/qa');
const results: Record<string, unknown>[] = [];
type Client = {
  context: BrowserContext; page: Page; lang: 'vi' | 'en'; name: string;
  snapshot: any; incoming: any[]; outgoing: any[]; errors: string[]; mobile: boolean;
};

async function client(browser: Browser, index: number, mobile = false): Promise<Client> {
  const lang = index % 2 === 0 ? 'vi' : 'en';
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}),
  });
  await context.addInitScript((legacyStyle) => localStorage.setItem('kittens.style', legacyStyle), ['pen', 'stamp', 'pixel', 'geometry'][index % 4]!);
  await context.addInitScript(() => {
    const sockets: WebSocket[] = [];
    (window as any).__qaSockets = sockets;
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(...args: ConstructorParameters<typeof WebSocket>) { super(...args); sockets.push(this); }
    };
    const instrumentation = { contexts: [] as AudioContext[], gains: [] as GainNode[] };
    (window as any).__qaAudio = instrumentation;
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args: ConstructorParameters<typeof AudioContext>) { super(...args); instrumentation.contexts.push(this); }
      createGain() { const gain = super.createGain(); instrumentation.gains.push(gain); return gain; }
    };
  });
  const page = await context.newPage();
  const c: Client = { context, page, lang, name: `QA Cat ${index + 1}`, snapshot: null, incoming: [], outgoing: [], errors: [], mobile };
  page.on('pageerror', error => c.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') c.errors.push(message.text()); });
  page.on('websocket', socket => {
    const decode = (payload: string | Buffer) => {
      const value = payload.toString();
      const at = value.indexOf('[');
      if (at < 0) return null;
      try { return JSON.parse(value.slice(at)); } catch { return null; }
    };
    socket.on('framereceived', frame => {
      const packet = decode(frame.payload);
      if (!packet) return;
      c.incoming.push(packet);
      if (packet[0] === 'room:snapshot') c.snapshot = packet[1];
    });
    socket.on('framesent', frame => { const packet = decode(frame.payload); if (packet) c.outgoing.push(packet); });
  });
  await page.goto(process.env.QA_BASE_URL ?? 'http://localhost:5173');
  await expect(page.locator('.connection-indicator')).toHaveClass(/connected/);
  expect(await page.evaluate(() => (window as any).__qaAudio.contexts.length)).toBe(0);
  if (lang === 'en') await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('textbox', { name: lang === 'vi' ? 'Tên của bạn' : 'Your name' }).fill(c.name);
  await expect(page.locator('.style-picker')).toHaveCount(0);
  await expect(page.locator('.mixed-deck-cards .playing-card')).toHaveCount(4);
  return c;
}

async function lobby(browser: Browser, count: number, mobile = false) {
  const clients = await Promise.all(Array.from({ length: count }, (_, index) => client(browser, index, mobile)));
  const host = clients[0]!;
  await host.page.getByRole('button', { name: /Tạo phòng/ }).click();
  await expect(host.page.locator('.room-ticket strong')).toBeVisible();
  const code = (await host.page.locator('.room-ticket strong').textContent())!;
  for (const c of clients.slice(1)) {
    await c.page.getByRole('textbox', { name: c.lang === 'vi' ? 'Mã phòng' : 'Room code' }).fill(code);
    await c.page.getByRole('button', { name: c.lang === 'vi' ? 'Vào phòng' : 'Join room', exact: true }).click();
    await expect(c.page.locator('.player-list-row')).toHaveCount(clients.indexOf(c) + 1);
  }
  await expect(host.page.locator('.player-list-row')).toHaveCount(count);
  return { clients, host, code };
}

async function start(clients: Client[]) {
  for (const c of clients) await c.page.getByRole('button', { name: c.lang === 'vi' ? 'Tôi sẵn sàng' : 'I’m ready', exact: true }).click();
  await clients[0]!.page.getByRole('button', { name: /Bắt đầu ván/ }).click();
  await Promise.all(clients.map(c => expect(c.page.locator('.table-layout')).toBeVisible()));
  await expect.poll(() => clients.every(c => c.snapshot?.game?.public?.phase === 'TURN')).toBe(true);
  return clients[0]!.snapshot.game.public.gameId as string;
}

async function synced(clients: Client[], revision: number) {
  await expect.poll(() => clients.every(c => c.snapshot?.game?.public?.revision === revision)).toBe(true);
  const reference = JSON.stringify(clients[0]!.snapshot.game.public);
  for (const c of clients) expect(JSON.stringify(c.snapshot.game.public)).toBe(reference);
}

async function refresh(c: Client) {
  const frames = await c.page.evaluate(() => (window as any).__qaFrames?.running ? (window as any).__qaFrames.times : null);
  const token = await c.page.evaluate(() => localStorage.getItem('kittens.guestToken'));
  const id = c.snapshot.game?.private?.hand ? c.snapshot.room.players.find((p: any) => p.name === c.name)?.id : null;
  await c.page.reload();
  await expect(c.page.locator('.connection-indicator')).toHaveClass(/connected/);
  await expect.poll(() => c.snapshot.room.players.some((p: any) => p.id === id && p.connected)).toBe(true);
  expect(await c.page.evaluate(() => localStorage.getItem('kittens.guestToken'))).toBe(token);
  expect(c.snapshot.room.players.filter((p: any) => p.name === c.name)).toHaveLength(1);
  await expect(c.page.locator('.table-layout')).toBeVisible();
  if (frames) await beginFrames(c.page, frames);
}

async function beginFrames(page: Page, previous: number[] = []) {
  await page.evaluate((prior) => {
    const sample = { running: true, last: 0, times: prior };
    (window as any).__qaFrames = sample;
    const frame = (now: number) => {
      if (!sample.running) return;
      if (sample.last) sample.times.push(now - sample.last);
      sample.last = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, previous);
}

async function frameResults(page: Page) {
  return page.evaluate(() => {
    const sample = (window as any).__qaFrames;
    sample.running = false;
    const times: number[] = sample.times.filter((n: number) => n > 0).sort((a: number, b: number) => a - b);
    return {
      samples: times.length,
      medianMs: times[Math.floor(times.length / 2)] ?? null,
      p95Ms: times[Math.floor(times.length * 0.95)] ?? null,
      maxMs: times.at(-1) ?? null,
      within16_7Percent: times.length ? times.filter(n => n <= 16.7).length / times.length * 100 : 0,
      within17Percent: times.length ? times.filter(n => n <= 17).length / times.length * 100 : 0,
    };
  });
}

async function finishByDrawing(clients: Client[], options: { spectator?: Client; reconnect?: boolean; screenshot?: boolean } = {}) {
  const host = clients[0]!;
  let actions = 0;
  let insertion = 0;
  const inserted: string[] = [];
  let refreshedTurn = false;
  let refreshedInsert = false;
  let translatedDrawChecked = false;
  while (host.snapshot.room.status === 'PLAYING' && actions < 150) {
    const game = host.snapshot.game.public;
    const current = clients.find(c => c.snapshot.room.players.find((p: any) => p.name === c.name)?.id === game.currentPlayerId)!;
    const revision = game.revision;
    if (game.phase === 'TURN') {
      if (options.reconnect && !refreshedTurn) { await refresh(current); refreshedTurn = true; }
      await expect(current.page.locator('.draw-button')).toBeEnabled();
      if (current.mobile) await current.page.locator('.draw-button').tap();
      else await current.page.locator('.draw-button').click();
    } else if (game.phase === 'DEFUSE_INSERT') {
      if (options.reconnect && !refreshedInsert) { await refresh(current); refreshedInsert = true; }
      const slots = current.page.locator('.insert-slots button');
      await expect(slots.first()).toBeVisible();
      const slotCount = await slots.count();
      const zone = insertion === 0 && slotCount > 2 ? 'MIDDLE_HIDDEN' : insertion === 2 ? 'BOTTOM' : 'TOP';
      const index = zone === 'MIDDLE_HIDDEN' ? Math.floor(slotCount / 2) : zone === 'BOTTOM' ? slotCount - 1 : 0;
      if (current.mobile) {
        expect((await slots.nth(index).boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await slots.nth(index).tap();
      } else await slots.nth(index).click();
      const observer = clients.find(c => c !== current)!;
      await expect(observer.page.locator('.insert-overlay')).toBeVisible();
      await expect(observer.page.locator('.insert-slots')).toHaveCount(0);
      expect(observer.snapshot.game.private?.privateData?.insertSlotCount).toBeUndefined();
      if (options.spectator) expect(options.spectator.snapshot.game.private).toBeNull();
      if (options.screenshot && insertion === 0) {
        await current.page.screenshot({ path: path.join(artifacts, 'screenshots/insert-actor.png'), fullPage: true });
        await observer.page.screenshot({ path: path.join(artifacts, 'screenshots/insert-observer.png'), fullPage: true });
      }
      const receivedBefore = observer.incoming.length;
      if (current.mobile) await current.page.locator('.insert-submit').tap();
      else await current.page.locator('.insert-submit').click();
      await expect.poll(() => observer.incoming.slice(receivedBefore).some(p => p[0] === 'room:event' && p[1].key === 'defuse.inserted')).toBe(true);
      const event = observer.incoming.slice(receivedBefore).find(p => p[0] === 'room:event' && p[1].key === 'defuse.inserted')[1];
      expect(event.params.zone).toBe(zone);
      expect(Object.keys(event.params).sort()).toEqual(['playerId', 'zone']);
      await expect(observer.page.locator('[data-public-insertion="' + zone + '"]')).toBeVisible();
      if (zone === 'MIDDLE_HIDDEN') {
        expect(JSON.stringify(event)).not.toMatch(/"(index|slot|slotIndex|position|pointerX|pointerY|dragProgress|duration)"/);
        const observerLog = observer.snapshot.events.filter((e: any) => e.key === 'defuse.inserted').at(-1);
        expect(Object.keys(observerLog.params).sort()).toEqual(['playerId', 'zone']);
        if (options.spectator) {
          const log = options.spectator.snapshot.events.filter((e: any) => e.key === 'defuse.inserted').at(-1);
          expect(log.params.zone).toBe('MIDDLE_HIDDEN');
          expect(Object.keys(log.params).sort()).toEqual(['playerId', 'zone']);
        }
        await refresh(observer);
        const restoredLog = observer.snapshot.events.filter((e: any) => e.key === 'defuse.inserted').at(-1);
        expect(Object.keys(restoredLog.params).sort()).toEqual(['playerId', 'zone']);
      }
      await expect(observer.page.locator('.insert-overlay')).toHaveCount(0);
      inserted.push(zone);
      insertion++;
    } else throw new Error(`Unexpected phase ${game.phase}`);
    actions++;
    if (options.screenshot && !translatedDrawChecked && host.snapshot.events.some((e: any) => e.key === 'card.drawn')) {
      await expect(clients[0]!.page.locator('.history-details')).toContainText('rút một lá.');
      await expect(clients[1]!.page.locator('.history-details')).toContainText('drew a card.');
      translatedDrawChecked = true;
    }
    await expect.poll(() => host.snapshot.game.public.revision > revision).toBe(true);
    await synced(clients, host.snapshot.game.public.revision);
    for (const c of clients) await expect(c.page.locator('.error-toast')).toHaveCount(0);
  }
  expect(host.snapshot.room.status).toBe('FINISHED');
  const winnerId = host.snapshot.game.public.winnerId;
  expect(host.snapshot.game.public.players.filter((p: any) => p.alive)).toHaveLength(1);
  expect(host.snapshot.game.public.players.find((p: any) => p.alive).id).toBe(winnerId);
  await Promise.all(clients.map(c => expect(c.page.locator('.result-layout')).toBeVisible()));
  return { actions, inserted, winnerId, refreshedTurn, refreshedInsert, translatedDrawChecked };
}

test.afterAll(async ({ browser }) => {
  await mkdir(artifacts, { recursive: true });
  await writeFile(path.join(artifacts, 'browser-results.json'), JSON.stringify({
    recordedAt: new Date().toISOString(), browser: await browser.version(),
    baseURL: process.env.QA_BASE_URL ?? 'http://localhost:5173',
    headless: true, tracingEnabled: process.env.QA_TRACE === '1',
    host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, ramGiB: Math.round(totalmem() / 1024 ** 3) },
    scope: 'Real headless Chromium; mobile viewport emulation on the same desktop CPU. Frame values are requestAnimationFrame callback intervals. No physical phone or GPU compositor measurement.',
    results,
  }, null, 2));
});

test('illustrated deck: all four styles together, no style selectors, readable codex and mobile', async ({ browser }) => {
  await mkdir(path.join(artifacts, 'screenshots'), { recursive: true });
  for (const mobile of [false, true]) {
    const c = await client(browser, mobile ? 1 : 0, mobile);
    await expect(c.page.locator('.style-picker,.showcase-style-picker')).toHaveCount(0);
    await c.page.getByRole('button', { name: c.lang === 'vi' ? /Kho thẻ bài/ : /Card Codex/, exact: false }).first().click();
    await expect(c.page.locator('.codex-mini-grid .playing-card')).toHaveCount(22);
    await expect(c.page.locator('.showcase-style-picker')).toHaveCount(0);
    const styles = await c.page.locator('.codex-mini-grid .playing-card').evaluateAll(cards => [...new Set(cards.map(card => card.getAttribute('data-art-style')))].sort());
    expect(styles).toEqual(['geometry', 'pen', 'pixel', 'stamp']);
    await expect(c.page.locator('.codex-mini-grid .scene-character')).toHaveCount(22);
    await c.page.locator('.codex-mini-grid').getByRole('button', { name: c.lang === 'vi' ? 'Cứu Nổ' : 'Defuse', exact: true }).click();
    await expect(c.page.locator('.showcase-card-holder .playing-card')).toHaveAttribute('data-art-style', 'pen');
    await expect(c.page.locator('.showcase-card-holder .scene-character')).toHaveCount(1);
    await expect(c.page.locator('.codex-modal')).not.toContainText('21 CARDS');
    const fit = await c.page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
    expect(fit.content).toBeLessThanOrEqual(fit.width);
    await c.page.screenshot({ path: path.join(artifacts, `screenshots/mixed-codex-${mobile ? 'mobile' : 'desktop'}.png`) });
    await c.page.getByRole('button', { name: c.lang === 'vi' ? 'Đóng' : 'Close', exact: true }).click();
    await c.page.getByRole('button', { name: c.lang === 'vi' ? 'Cài đặt' : 'Settings', exact: true }).click();
    await expect(c.page.locator('.settings-modal .style-picker')).toHaveCount(0);
    await c.page.getByRole('button', { name: c.lang === 'vi' ? 'Đóng' : 'Close', exact: true }).click();
    for (const error of c.errors) expect(error).toBeUndefined();
    results.push({ test: 'mixed-illustrated-deck', mobile, styles, galleryTypes: 22, legacyPreferenceIgnored: true, fit });
    await c.context.close();
  }
});

test('five-second rescue draft: distinct cats, touch and keyboard picks, reconnect, fallback, toys and final K.O.', async ({browser}) => {
  await mkdir(path.join(artifacts,'screenshots'),{recursive:true});
  const {clients,host}=await lobby(browser,3,true),peer=clients[1]!;
  for(const c of clients)await c.page.getByRole('button',{name:c.lang==='vi'?'Tôi sẵn sàng':'I’m ready',exact:true}).click();
  await host.page.getByRole('button',{name:/Bắt đầu ván/}).click();
  await Promise.all(clients.map(c=>expect(c.page.locator('.defuse-draft')).toBeVisible()));
  await expect(host.page.locator('#draft-title')).toHaveText('Chọn mèo cứu mạng');
  await expect(peer.page.locator('#draft-title')).toHaveText('Pick your rescue cat');
  expect(clients.every(c=>c.snapshot.game===null)).toBe(true);
  await expect(host.page.locator('.draft-cards .cat-expression')).toHaveCount(6);
  const expressions=await host.page.locator('.draft-cards .cat-expression').evaluateAll(nodes=>nodes.map(node=>node.innerHTML));
  expect(new Set(expressions).size).toBe(6);
  expect(new Set(host.snapshot.draft.cards.map((c:any)=>c.artVariant)).size).toBe(6);
  const draftId=host.snapshot.draft.gameId,deadline=host.snapshot.draft.deadlineAt;
  const selected=host.snapshot.draft.cards[0],second=host.snapshot.draft.cards[1];
  const firstButton=host.page.locator(`[data-draft-card-id="${selected.instanceId}"] button`);
  await firstButton.focus();await firstButton.press('Enter');
  await expect(host.page.locator('.draft-card.is-mine .draft-card-owner')).toContainText(host.name);
  await expect(peer.page.locator(`[data-draft-card-id="${selected.instanceId}"] button`)).toBeDisabled();
  await peer.page.locator(`[data-draft-card-id="${second.instanceId}"] button`).tap();
  await expect(peer.page.locator('.draft-status')).toContainText('Your cat is locked');
  for(const card of await peer.page.locator('.draft-cards .playing-card').all()){
    const box=(await card.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await host.page.screenshot({path:path.join(artifacts,'screenshots/defuse-draft-mobile.png'),fullPage:true});
  await host.page.reload();
  await expect(host.page.locator('.defuse-draft')).toBeVisible();
  expect(host.snapshot.draft.gameId).toBe(draftId);expect(host.snapshot.draft.deadlineAt).toBe(deadline);
  await expect(host.page.locator('.draft-card.is-mine .draft-card-owner')).toContainText(host.name);
  await Promise.all(clients.map(c=>expect(c.page.locator('.table-layout')).toBeVisible()));
  expect(host.snapshot.game.public.gameId).toBe(draftId);
  expect(host.snapshot.game.private.hand[0].instanceId).toBe(selected.instanceId);
  expect(peer.snapshot.game.private.hand[0].instanceId).toBe(second.instanceId);
  expect(clients.every(c=>c.snapshot.game.private.hand.length===8)).toBe(true);
  expect(new Set(clients.map(c=>c.snapshot.game.private.hand[0].instanceId)).size).toBe(3);
  await beginFrames(host.page);
  const target=peer.snapshot.room.players.find((p:any)=>p.name===peer.name).id;
  await host.page.locator('.social-target select').selectOption(target);
  const revision=host.snapshot.game.public.revision,turnDeadline=host.snapshot.game.public.deadlineAt;
  for(const prop of ['EGG','BOMB','ROCK']){
    const button=host.page.locator(`[data-throw-prop="${prop}"]`);await expect(button).toBeEnabled();await button.tap();
    await Promise.all(clients.map(c=>expect(c.page.locator(`[data-social-effect="${prop}"]`)).toBeVisible()));
    if(prop==='EGG')await peer.page.screenshot({path:path.join(artifacts,'screenshots/egg-impact-mobile.png'),fullPage:true});
    const events=clients.map(c=>c.incoming.filter(p=>p[0]==='room:event'&&p[1].key==='social.thrown').at(-1)[1]);
    events.forEach(e=>expect(e.params).toEqual(events[0].params));
    expect(Object.keys(events[0].params).sort()).toEqual(['prop','sourceId','sourceName','targetId','targetName']);
    expect(host.snapshot.game.public.revision).toBe(revision);expect(host.snapshot.game.public.deadlineAt).toBe(turnDeadline);
  }
  const thrown=host.outgoing.filter(p=>p[0]==='room:throw');expect(thrown).toHaveLength(3);
  thrown.forEach(p=>expect(Object.keys(p[1]).sort()).toEqual(['actionId','prop','targetId']));
  await expect(host.page.locator('.history-details')).toContainText('ném Đá nhỏ');
  await expect(peer.page.locator('.history-details')).toContainText('threw a Pebble');
  const outcome=await finishByDrawing(clients);
  await expect(host.page.locator('[data-effect-kind=explosion]')).toBeVisible();
  await host.page.screenshot({path:path.join(artifacts,'screenshots/final-boom.png'),fullPage:true});
  await expect(host.page.locator('[data-eliminated-effect]')).toBeVisible();
  await host.page.screenshot({path:path.join(artifacts,'screenshots/final-ko.png'),fullPage:true});
  await expect(host.page.locator('[data-effect-kind=win]')).toBeVisible();
  results.push({scenario:'five-second draft and playful effects',outcome,frames:await frameResults(host.page)});
  expect(clients.flatMap(c=>c.errors)).toEqual([]);
  for(const c of clients)await c.context.close();
});

test('room chat: VI/EN messages, unread badge, safe text, reconnect, full game and rematch', async ({ browser }) => {
  await mkdir(path.join(artifacts, 'screenshots'), { recursive: true });
  const { clients, host } = await lobby(browser, 2);
  const peer = clients[1]!;
  await expect(host.page.locator('.room-chat-panel')).toBeVisible();
  await expect(peer.page.locator('.room-chat-panel')).toBeVisible();
  await expect(host.page.locator('.chat-empty')).toContainText('Chưa ai nói gì.');
  await peer.page.getByRole('button', { name: 'Minimize chat', exact: true }).click();
  const greeting = 'Chào mèo 👋 <img src=x onerror=alert(1)>';
  await host.page.getByRole('textbox', { name: 'Tin nhắn của bạn', exact: true }).fill(greeting);
  await host.page.getByRole('textbox', { name: 'Tin nhắn của bạn', exact: true }).press('Enter');
  await expect(host.page.locator('.room-chat-message p')).toHaveText([greeting]);
  await expect(host.page.locator('#room-chat-input')).toHaveValue('');
  await expect(peer.page.locator('.chat-unread')).toHaveText('1');
  await expect(peer.page.locator('.room-chat-trigger')).toHaveAttribute('aria-expanded', 'false');
  await peer.page.locator('.room-chat-trigger').click();
  await expect(peer.page.locator('.chat-unread')).toHaveCount(0);
  await expect(peer.page.locator('.room-chat-message p')).toHaveText([greeting]);
  await expect(peer.page.locator('.room-chat-panel img')).toHaveCount(0);
  await expect(peer.page.locator('.chat-message-meta strong').first()).toHaveText(host.name);
  const replyInput = peer.page.getByRole('textbox', { name: 'Your message', exact: true });
  await replyInput.fill('Hello');
  await replyInput.press('Shift+Enter');
  await replyInput.pressSequentially('cats!');
  await replyInput.press('Enter');
  await expect(host.page.locator('.room-chat-message p')).toHaveText([greeting, 'Hello\ncats!']);
  await expect(peer.page.locator('.room-chat-message.is-own')).toContainText('you');
  const draft = 'Bản nháp đi cùng ván';
  await host.page.locator('#room-chat-input').fill(draft);
  await host.page.screenshot({ path: path.join(artifacts, 'screenshots/chat-lobby.png'), fullPage: true });
  await start(clients);
  await expect(host.page.locator('#room-chat-input')).toHaveValue(draft);
  await host.page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(host.page.getByRole('textbox', { name: 'Your message', exact: true })).toHaveValue(draft);
  await host.page.getByRole('button', { name: 'VI', exact: true }).click();
  await host.page.locator('#room-chat-input').press('Enter');
  await expect(peer.page.locator('.room-chat-message p').last()).toHaveText(draft);
  await expect(host.page.locator('.history-details')).not.toContainText(draft);
  await refresh(peer);
  await expect(peer.page.locator('.room-chat-message p')).toHaveText([greeting, 'Hello\ncats!', draft]);
  await host.page.screenshot({ path: path.join(artifacts, 'screenshots/chat-table.png'), fullPage: true });
  const played = await finishByDrawing(clients);
  await expect(host.page.locator('.room-chat-message p')).toHaveText([greeting, 'Hello\ncats!', draft]);
  await peer.page.locator('#room-chat-input').fill('Another round?');
  await peer.page.locator('.room-chat-form').getByRole('button', { name: /Send/ }).click();
  await expect(host.page.locator('.room-chat-message p').last()).toHaveText('Another round?');
  await host.page.getByRole('button', { name: /Chơi lại/ }).click();
  await expect(host.page.locator('.lobby-layout')).toBeVisible();
  await expect(host.page.locator('.room-chat-message')).toHaveCount(4);
  for (const c of clients) expect(c.errors).toEqual([]);
  results.push({ test: 'room-chat-desktop', messages: 4, languages: ['vi', 'en'], restoredAfterReconnect: true, rematchHistory: true, ...played });
  await Promise.all(clients.map(c => c.context.close()));
});

test('room chat mobile: touch, readable input, focus, offline draft and reconnect', async ({ browser }) => {
  test.setTimeout(60_000);
  await mkdir(path.join(artifacts, 'screenshots'), { recursive: true });
  const { clients, host } = await lobby(browser, 2, true);
  const peer = clients[1]!;
  await expect(host.page.locator('.room-chat-panel')).toBeHidden();
  await peer.page.locator('.room-chat-trigger').tap();
  await peer.page.locator('#room-chat-input').fill('A message for your cat');
  await peer.page.locator('.room-chat-form').getByRole('button', { name: /Send/ }).tap();
  await expect(host.page.locator('.chat-unread')).toHaveText('1');
  await host.page.locator('.room-chat-trigger').tap();
  await expect(host.page.getByRole('dialog', { name: 'Trò chuyện', exact: true })).toBeVisible();
  await expect(host.page.locator('.chat-unread')).toHaveCount(0);
  const input = host.page.locator('#room-chat-input');
  expect(await input.evaluate(element => getComputedStyle(element).fontSize)).toBe('16px');
  const box = await host.page.locator('.room-chat-panel').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect((await host.page.locator('.chat-close').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await input.fill('Chờ mạng về rồi nói tiếp 🐈');
  await input.press('Escape');
  await expect(host.page.locator('.room-chat-trigger')).toBeFocused();
  await host.page.locator('.room-chat-trigger').tap();
  await expect(input).toHaveValue('Chờ mạng về rồi nói tiếp 🐈');
  await host.page.setViewportSize({ width: 900, height: 844 });
  await expect(host.page.locator('.room-chat-panel')).toBeVisible();
  await expect(input).toHaveValue('Chờ mạng về rồi nói tiếp 🐈');
  await host.page.setViewportSize({ width: 390, height: 844 });
  await expect(host.page.getByRole('dialog', { name: 'Trò chuyện', exact: true })).toBeVisible();
  await host.context.setOffline(true);
  await host.page.evaluate(() => { for (const socket of (window as any).__qaSockets) if (socket.url.includes('/socket.io/')) socket.close(); });
  await expect(host.page.locator('.connection-indicator')).toHaveClass(/offline/);
  await expect(host.page.locator('.room-chat-form button[type=submit]')).toBeDisabled();
  await input.press('Enter');
  await expect(input).toHaveValue('Chờ mạng về rồi nói tiếp 🐈');
  await expect(host.page.locator('.chat-feedback')).toContainText('Kết nối lại rồi gửi.');
  const receivedBefore = host.incoming.length;
  await host.context.setOffline(false);
  await expect(host.page.locator('.connection-indicator')).toHaveClass(/connected/);
  await expect.poll(() => host.incoming.slice(receivedBefore).some(packet => packet[0] === 'room:snapshot')).toBe(true);
  await expect(input).toHaveValue('Chờ mạng về rồi nói tiếp 🐈');
  await input.press('Enter');
  await expect(peer.page.locator('.room-chat-message p').last()).toHaveText('Chờ mạng về rồi nói tiếp 🐈');
  await expect(input).toHaveValue('');
  await host.page.screenshot({ path: path.join(artifacts, 'screenshots/chat-mobile.png') });
  await host.page.locator('.chat-close').tap();
  await peer.page.locator('.chat-close').tap();
  await start(clients);
  await expect(host.page.locator('.room-chat-trigger')).toBeVisible();
  expect(await host.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  results.push({ test: 'room-chat-mobile', viewport: '390 × 844, touch', inputPx: 16, offlineDraftRetained: true, unread: true });
  await Promise.all(clients.map(c => c.context.close()));
});

test('two independent guests: VI/EN, mixed illustrations, audio, private insert, reconnect, winner, rematch', async ({ browser }) => {
  await mkdir(path.join(artifacts, 'screenshots'), { recursive: true });
  const first = await client(browser, 0);
  await first.page.screenshot({ path: path.join(artifacts, 'screenshots/entry.png'), fullPage: true });
  await first.context.close();
  const { clients, host, code } = await lobby(browser, 2);
  const second = clients[1]!;
  await host.page.screenshot({ path: path.join(artifacts, 'screenshots/lobby.png'), fullPage: true });
  expect(await host.page.evaluate(() => localStorage.getItem('kittens.language'))).toBe('vi');
  expect(await second.page.evaluate(() => localStorage.getItem('kittens.language'))).toBe('en');
  expect(await host.page.evaluate(() => localStorage.getItem('kittens.style'))).toBe('pen');
  expect(await second.page.evaluate(() => localStorage.getItem('kittens.style'))).toBe('stamp');
  await host.page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  const audioEnableButton = host.page.locator('.settings-modal').getByRole('button', { name: /Bật âm thanh|Enable audio/ });
  if (await audioEnableButton.isVisible()) await audioEnableButton.click();
  await expect.poll(() => host.page.evaluate(() => (window as any).__qaAudio.contexts[0]?.state)).toBe('running');
  await host.page.getByRole('checkbox', { name: 'Tắt tiếng', exact: true }).check();
  await expect.poll(() => host.page.evaluate(() => {
    const audio = (window as any).__qaAudio;
    return audio.gains[0]?.gain.value < 0.0001;
  })).toBe(true);
  expect(await host.page.evaluate(() => JSON.parse(localStorage.getItem('kittens.audio')!).mute)).toBe(true);
  await host.page.getByRole('button', { name: 'Đóng', exact: true }).click();
  const gameId = await start(clients);
  await expect(host.page.locator('.hand-card')).toHaveCount(8);
  await expect(second.page.locator('.hand-card')).toHaveCount(8);
  const hostDefuse = host.page.locator('.hand-card[data-card-type=DEFUSE]').first();
  const peerDefuse = second.page.locator('.hand-card[data-card-type=DEFUSE]').first();
  expect(await hostDefuse.getAttribute('data-art-style')).toBe(await peerDefuse.getAttribute('data-art-style'));
  expect(await hostDefuse.getAttribute('data-art-variant')).not.toBe(await peerDefuse.getAttribute('data-art-variant'));
  expect(await hostDefuse.locator('.scene-art').innerHTML()).not.toBe(await peerDefuse.locator('.scene-art').innerHTML());
  await expect(host.page.locator('.hand-scroll .cat-art-svg')).toHaveCount(8);
  await expect(second.page.locator('.hand-scroll .cat-art-svg')).toHaveCount(8);
  for (const c of [host, second]) {
    const styleRequests = await c.page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name).filter(name => /(?:Pen|Stamp|Pixel|Geometry)Cat/.test(name)));
    expect(styleRequests.length).toBeGreaterThan(0);
    for (const asset of ['PenCat', 'StampCat', 'PixelCat', 'GeometryCat']) expect(styleRequests.some(name => name.includes(asset))).toBe(true);
  }
  await expect(host.page.locator('.hand-card').first()).toHaveClass(/tone-green/);
  const beforePreference = JSON.stringify(host.snapshot.game);
  await host.page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(host.page.locator('.table-status h1')).toHaveText('Your turn');
  await host.page.getByRole('button', { name: 'VI', exact: true }).click();
  await expect(host.page.locator('.table-status h1')).toHaveText('Lượt của bạn');
  expect(JSON.stringify(host.snapshot.game)).toBe(beforePreference);
  await host.page.screenshot({ path: path.join(artifacts, 'screenshots/table-desktop.png'), fullPage: true });
  const spectator = await client(browser, 3);
  await spectator.page.getByRole('textbox', { name: 'Room code', exact: true }).fill(code);
  await spectator.page.getByRole('button', { name: 'Watch room', exact: true }).click();
  await expect(spectator.page.locator('.spectator-note')).toBeVisible();
  expect(spectator.snapshot.game.private).toBeNull();
  await spectator.page.reload();
  await expect(spectator.page.locator('.spectator-note')).toBeVisible();
  await expect(spectator.page.locator('.error-toast')).toHaveCount(0);
  expect(spectator.snapshot.game.private).toBeNull();
  expect(spectator.snapshot.game.public).not.toHaveProperty('drawPile');
  for (const c of clients) {
    expect(c.snapshot.game.public).not.toHaveProperty('drawPile');
    for (const p of c.snapshot.game.public.players) expect(p).not.toHaveProperty('hand');
  }
  await beginFrames(host.page);
  const played = await finishByDrawing(clients, { spectator, reconnect: true, screenshot: true });
  const frames = await frameResults(host.page);
  await host.page.screenshot({ path: path.join(artifacts, 'screenshots/results.png'), fullPage: true });
  expect(played.inserted).toContain('MIDDLE_HIDDEN');
  const drawEvent = host.snapshot.events.find((e: any) => e.key === 'card.drawn');
  expect(drawEvent).toBeTruthy();
  await host.page.getByRole('button', { name: /Chơi lại/ }).click();
  await Promise.all(clients.map(c => expect(c.page.locator('.lobby-layout')).toBeVisible()));
  const nextGameId = await start(clients);
  expect(nextGameId).not.toBe(gameId);
  for (const c of [...clients, spectator]) expect(c.errors).toEqual([]);
  results.push({ test: 'two-player-full-game', gameId, nextGameId, ...played, frames });
  await Promise.all([...clients, spectator].map(c => c.context.close()));
});

for (const count of [3, 4, 5]) test(`${count} real guest browsers complete a synchronized game`, async ({ browser }) => {
  const { clients } = await lobby(browser, count);
  const gameId = await start(clients);
  const played = await finishByDrawing(clients);
  for (const c of clients) expect(c.errors).toEqual([]);
  results.push({ test: `${count}-player-full-game`, gameId, ...played });
  await Promise.all(clients.map(c => c.context.close()));
});

test('mobile touch viewport: choose cards and every insert slot, complete a real game', async ({ browser }) => {
  const { clients, host } = await lobby(browser, 2, true);
  await start(clients);
  await expect(host.page.locator('.hand-scroll .cat-art-svg')).toHaveCount(8);
  await host.page.screenshot({ path: path.join(artifacts, 'screenshots/table-mobile.png'), fullPage: true });
  await host.page.locator('.hand-card').first().tap();
  await expect(host.page.locator('.hand-card').first()).toHaveAttribute('aria-pressed', 'true');
  await host.page.getByRole('button', { name: 'Bỏ chọn', exact: true }).tap();
  const width = await host.page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
  await beginFrames(host.page);
  const played = await finishByDrawing(clients);
  const frames = await frameResults(host.page);
  for (const c of clients) expect(c.errors).toEqual([]);
  results.push({ test: 'mobile-emulated-full-game', viewport: '390 × 844, touch enabled, no CPU throttle', width, ...played, frames });
  await Promise.all(clients.map(c => c.context.close()));
});

test('a played function card survives disconnect in its Nope window', async ({ browser }) => {
  const { clients, host } = await lobby(browser, 2);
  await start(clients);
  let actor = host;
  let selected: any;
  for (let attempt = 0; attempt < 6; attempt++) {
    const game = host.snapshot.game.public;
    actor = clients.find(c => c.snapshot.room.players.find((p: any) => p.name === c.name)?.id === game.currentPlayerId)!;
    selected = actor.snapshot.game.private.hand.find((card: any) => ['ATTACK', 'SKIP', 'SHUFFLE', 'SEE_THE_FUTURE'].includes(card.type));
    if (selected) break;
    const revision = game.revision;
    await actor.page.locator('.draw-button').click();
    await expect.poll(() => host.snapshot.game.public.revision > revision).toBe(true);
    await synced(clients, host.snapshot.game.public.revision);
    if (host.snapshot.game.public.phase === 'DEFUSE_INSERT') {
      await actor.page.locator('.insert-submit').click();
      await expect.poll(() => host.snapshot.game.public.phase === 'TURN').toBe(true);
      await expect(actor.page.locator('.insert-overlay')).toHaveCount(0);
    }
  }
  expect(selected, 'a naturally dealt playable function card').toBeTruthy();
  const hand = actor.snapshot.game.private.hand;
  await actor.page.locator('.hand-card').nth(hand.findIndex((c: any) => c.instanceId === selected.instanceId)).click();
  await actor.page.getByRole('button', { name: /Đánh bài đã chọn|Play selected/ }).click();
  await expect.poll(() => host.snapshot.game.public.phase).toBe('NOPE_WINDOW');
  await refresh(actor);
  await expect(actor.page.locator('.choice-bar')).toContainText(actor.lang === 'vi' ? 'Cửa sổ Nope' : 'Nope window');
  for (const c of clients) {
    const pass = c.page.getByRole('button', { name: c.lang === 'vi' ? 'Bỏ qua' : 'Pass', exact: true });
    if (await pass.isVisible()) await pass.click();
  }
  await expect.poll(() => host.snapshot.game.public.phase).toBe('TURN');
  await synced(clients, host.snapshot.game.public.revision);
  for (const c of clients) expect(c.errors).toEqual([]);
  results.push({ test: 'nope-window-reconnect', cardType: selected.type, revision: host.snapshot.game.public.revision });
  await Promise.all(clients.map(c => c.context.close()));
});


async function fixture(clients: Client[], roomCode: string, kind = 'composer') {
  const response = await fetch('http://127.0.0.1:3013', {method:'POST',body:JSON.stringify({roomCode,fixture:kind})});
  expect(response.ok).toBe(true);
  const {revision} = await response.json();
  for (const c of clients) await c.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await synced(clients, revision);
}
async function passWindow(clients: Client[]) {
  await expect.poll(() => clients[0]!.snapshot.game.public.phase).toBe('NOPE_WINDOW');
  for (const c of clients) {
    const button = c.page.getByRole('button', {name:c.lang === 'vi' ? 'Bỏ qua' : 'Pass',exact:true});
    if (await button.isEnabled()) await button.click();
  }
  await expect.poll(() => clients[0]!.snapshot.game.public.phase !== 'NOPE_WINDOW').toBe(true);
}
async function selectType(c: Client, type: string, count = 1) {
  const cards = c.snapshot.game.private.hand;
  const indices = cards.map((card: any, i: number) => card.type === type ? i : -1).filter((i: number) => i >= 0).slice(0,count);
  expect(indices).toHaveLength(count);
  for (const i of indices) await c.page.locator('.hand-card').nth(i).click();
}

test('composer: pair, triple, visible targets, single replacement, Favor, hints and keyboard', async ({browser}) => {
  test.skip(process.env.QA_FIXTURES !== '1', 'Controlled deals use the separate local QA server only');
  const {clients,host,code} = await lobby(browser,3);
  await start(clients); await fixture(clients,code);
  await host.page.evaluate(() => {
    const originalNow = Date.now.bind(Date);
    Date.now = () => originalNow() + 120000;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => host.page.locator('.countdown').textContent()).toMatch(/^(2\d|30)s$/);
  await expect(host.page.locator('.phase-coach')).toContainText('Hết giờ: server rút');
  await expect(host.page.locator('#auto-mode')).toHaveValue('OFF');
  await expect(host.page.locator('.hand-card.is-suggested')).toHaveCount(1);
  await expect(host.page.locator('.hand-card.is-suggested .card-hint')).toBeVisible();
  await host.page.getByRole('button',{name:'2 · Cặp cùng tên',exact:true}).click();
  await expect(host.page.locator('.hand-card.is-suggested')).toHaveCount(0);
  await selectType(host,'CAT_TACO',2);
  const catIndices = host.snapshot.game.private.hand.map((card:any,index:number)=>card.type==='CAT_TACO'?index:-1).filter((index:number)=>index>=0);
  await host.page.locator('.hand-card').nth(catIndices[2]!).click();
  await expect(host.page.locator('.hand-card.is-selected')).toHaveCount(2);
  await expect(host.page.locator('.play-submit')).toBeDisabled();
  await expect(host.page.locator('.compose-hint')).toContainText('Chưa chọn người');
  const target = host.page.locator('.target-picker button').first();
  await target.focus(); await host.page.keyboard.press('Enter');
  await expect(target).toHaveAttribute('aria-pressed','true');
  const colors = await target.evaluate(el => {const s=getComputedStyle(el);return {fg:s.color,bg:s.backgroundColor,height:el.getBoundingClientRect().height};});
  expect(colors.fg).not.toBe(colors.bg);expect(colors.height).toBeGreaterThanOrEqual(44);
  await mkdir(path.join(artifacts,'screenshots'),{recursive:true});
  await host.page.screenshot({path:path.join(artifacts,'screenshots/composer-target-picker.png'),fullPage:true});
  await expect(host.page.locator('.play-submit')).toBeEnabled();
  await host.page.locator('.play-submit').click();await passWindow(clients);
  expect(host.snapshot.events.some((e:any)=>e.key==='combo.pair')).toBe(true);
  await fixture(clients,code);
  await host.page.getByRole('button',{name:'3 · Bộ ba cùng tên',exact:true}).click();
  await selectType(host,'CAT_TACO',3);
  await host.page.locator('.target-picker button').last().click();
  await host.page.locator('.requested-picker button').filter({hasText:/Cứu nổ/i}).click();
  await expect(host.page.locator('.requested-picker button[aria-pressed=true]')).toContainText(/Cứu nổ/i);
  await host.page.screenshot({path:path.join(artifacts,'screenshots/composer-triple.png'),fullPage:true});
  await host.page.locator('.play-submit').click();
  await expect.poll(()=>host.snapshot.game.public.phase).toBe('NOPE_WINDOW');
  expect(host.snapshot.game.public.pending.requestedType).toBe('DEFUSE');
  await expect(clients[1]!.page.locator('.phase-coach')).toContainText('Name the card to take: Defuse');
  await passWindow(clients);
  expect(host.snapshot.events.some((e:any)=>e.key==='combo.triple')).toBe(true);
  await fixture(clients,code);
  await host.page.getByRole('button',{name:'1 · Lá chức năng',exact:true}).click();
  await selectType(host,'SKIP');await selectType(host,'FAVOR');
  await expect(host.page.locator('.hand-card.is-selected')).toHaveCount(1);
  await host.page.locator('.target-picker button').first().click();
  const chosen = clients[1]!;
  await host.page.locator('.play-submit').click();await passWindow(clients);
  await expect.poll(()=>host.snapshot.game.public.phase).toBe('FAVOR_CHOICE');
  await expect(chosen.page.locator('.choice-bar')).toContainText('Select exactly one');
  await chosen.page.locator('.hand-card').first().click();await chosen.page.locator('.hand-card').last().click();
  await expect(chosen.page.locator('.hand-card.is-selected')).toHaveCount(1);
  await chosen.page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect.poll(()=>host.snapshot.game.public.phase).toBe('TURN');
  for(const c of clients) {await expect(c.page.locator('.error-toast')).toHaveCount(0);expect(c.errors).toEqual([]);}
  await mkdir(path.join(artifacts,'screenshots'),{recursive:true});
  await host.page.screenshot({path:path.join(artifacts,'screenshots/composer.png'),fullPage:true});
  results.push({test:'composer-controlled-real-server',colors});
  await Promise.all(clients.map(c=>c.context.close()));
});

test('Hamster choices discard one card at a time with readable progress', async ({browser}) => {
  test.skip(process.env.QA_FIXTURES !== '1', 'Controlled deals use the separate local QA server only');
  const {clients,host,code} = await lobby(browser,2);
  await host.page.locator('.lobby-side select').selectOption('EXTENDED');
  await expect.poll(()=>host.snapshot.room.options.mode).toBe('EXTENDED');
  await start(clients);await fixture(clients,code,'hamster');
  await selectType(host,'BATTLE_HAMSTER');await host.page.locator('.target-picker button').first().click();
  await host.page.locator('.play-submit').click();await passWindow(clients);
  const target = clients[1]!;
  while(host.snapshot.game.public.phase === 'BATTLE_HAMSTER_DISCARD') {
    const count = target.snapshot.game.private.hand.length;
    await expect(target.page.locator('.choice-bar')).toContainText(`Discard ${count-1} more`);
    await target.page.locator('.hand-card').first().click();
    await target.page.getByRole('button',{name:'Confirm',exact:true}).click();
    await expect.poll(()=>target.snapshot.game.private.hand.length).toBe(count-1);
  }
  expect(target.snapshot.game.private.hand).toHaveLength(1);
  await synced(clients,host.snapshot.game.public.revision);
  for(const c of clients)expect(c.errors).toEqual([]);
  results.push({test:'hamster-compulsory-choices'});
  await Promise.all(clients.map(c=>c.context.close()));
});

test('autodraw near deadline and manual card selection cancel queued autoplay', async ({browser}) => {
  test.skip(process.env.QA_FIXTURES !== '1', 'Short deadline uses the separate local QA server only');
  const {clients,host,code} = await lobby(browser,2);
  await start(clients);await fixture(clients,code);
  await host.page.locator('#auto-mode').selectOption('BASIC');
  await selectType(host,'SKIP');
  await expect(host.page.locator('#auto-mode')).toHaveValue('OFF');
  const before = host.outgoing.filter(p=>p[0]==='game:action').length;
  await host.page.waitForTimeout(1800);
  expect(host.outgoing.filter(p=>p[0]==='game:action')).toHaveLength(before);
  await fixture(clients,code,'timer');
  const revision=host.snapshot.game.public.revision;
  await host.page.locator('#auto-mode').selectOption('DRAW');
  await expect.poll(()=>host.outgoing.filter(p=>p[0]==='game:action').length,{timeout:32000}).toBe(before+1);
  expect(host.outgoing.filter(p=>p[0]==='game:action').at(-1)[1].action.type).toBe('DRAW_CARD');
  await expect.poll(()=>host.snapshot.game.public.revision>revision).toBe(true);
  for(const c of clients)expect(c.errors).toEqual([]);
  results.push({test:'manual-auto-cancellation-and-near-deadline-draw'});
  await Promise.all(clients.map(c=>c.context.close()));
});

test('opt-in basic autoplay completes a real match and resets on rematch', async ({browser}) => {
  test.setTimeout(360000);
  const {clients,host} = await lobby(browser,2);
  await start(clients);
  await beginFrames(host.page);
  for(const c of clients) {await expect(c.page.locator('#auto-mode')).toHaveValue('OFF');await c.page.locator('#auto-mode').selectOption('BASIC');}
  await expect.poll(()=>host.snapshot.room.status,{timeout:300000}).toBe('FINISHED');
  await synced(clients,host.snapshot.game.public.revision);
  await Promise.all(clients.map(c=>expect(c.page.locator('.result-layout')).toBeVisible()));
  expect(host.snapshot.events.some((e:any)=>e.key==='card.played')).toBe(true);
  const frames = await frameResults(host.page);
  await host.page.getByRole('button',{name:/Chơi lại/}).click();await start(clients);
  for(const c of clients) {await expect(c.page.locator('#auto-mode')).toHaveValue('OFF');expect(c.errors).toEqual([]);await expect(c.page.locator('.error-toast')).toHaveCount(0);}
  results.push({test:'autoplay-real-full-game',frames});
  await Promise.all(clients.map(c=>c.context.close()));
});
