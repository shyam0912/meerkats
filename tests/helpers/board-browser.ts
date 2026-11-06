import { test as base, expect, type Page } from '@playwright/test';
import type { LocalRecord } from '../../src/persistence/database';

type Decision = 'stay' | 'leave';
type Guard = { nextDocument?: string; decision?: Decision; answered?: () => void };
const guards = new WeakMap<Page, Guard>();

declare global {
  interface Window {
    boardQaEvent: (event: unknown) => Promise<void>;
    holdBoardWrite?: boolean;
    heldBoardRevision?: number;
  }
}

// Runs in each disposable document, before the application opens IndexedDB.
function observeDocument() {
  const log = (type: string, details?: unknown) => {
    void window.boardQaEvent({ type, details, time: Date.now(), url: location.href }).catch(() => {});
  };
  for (const event of ['pageshow', 'pagehide', 'visibilitychange']) {
    window.addEventListener(event, () => log(event, document.visibilityState), true);
  }
  const transaction = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (...args) {
    const tx = transaction.apply(this, args);
    if (tx.mode === 'readwrite' && tx.objectStoreNames.contains('sessions')) log('transaction-start');
    return tx;
  };
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, key) {
    const request = put.call(this, value, key);
    if (this.name !== 'sessions') return request;
    const record = value as LocalRecord;
    const board = record.snapshot.whiteboard;
    const write = { documentId: board.id, generation: record.generation, revision: board.localRevision };
    log('write-request', write);
    for (const event of ['complete', 'abort', 'error']) {
      this.transaction.addEventListener(event, () => log('write-' + event, write));
    }
    // Only the two unload tests opt in. Keep the real transaction open until
    // Stay releases it or Leave destroys this document.
    if (window.holdBoardWrite && key !== undefined) {
      window.heldBoardRevision = board.localRevision;
      const keepAlive = () => {
        if (window.holdBoardWrite) this.get(key).onsuccess = keepAlive;
      };
      keepAlive();
    }
    return request;
  };
}

export const test = base.extend({
  page: async ({ page }, runTest, info) => {
    const events: unknown[] = [];
    const violations: string[] = [];
    const note = (type: string, details: unknown) => events.push({ time: Date.now(), type, details });
    const guard: Guard = { nextDocument: 'initial' };
    guards.set(page, guard);
    await page.exposeFunction('boardQaEvent', (event: unknown) => events.push(event));
    await page.addInitScript(observeDocument);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    cdp.on('Page.frameRequestedNavigation', event => note('requested-navigation', event));
    cdp.on('Network.requestWillBeSent', event => {
      if (event.type === 'Document') note('document-request', { url: event.request.url, initiator: event.initiator });
    });
    cdp.on('Page.frameNavigated', ({ frame }) => {
      if (frame.parentId) return;
      note('document-committed', { url: frame.url, loader: frame.loaderId });
      if (guard.nextDocument !== 'initial' && guard.nextDocument !== frame.url) {
        violations.push('Unexpected document navigation to ' + frame.url);
      }
      guard.nextDocument = undefined;
    });
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) note('playwright-navigation', frame.url());
    });
    page.on('dialog', async dialog => {
      const expected = guard.decision && dialog.type() === 'beforeunload';
      note('dialog', { type: dialog.type(), decision: expected ? guard.decision : 'unexpected' });
      if (!expected) violations.push('Unexpected dialog: ' + dialog.type());
      if (expected && guard.decision === 'leave') await dialog.accept();
      else await dialog.dismiss();
      if (expected) guard.answered?.();
    });
    page.on('websocket', ws => ws.on('framereceived', frame => note('websocket', String(frame.payload).slice(0, 1500))));
    page.on('pageerror', error => note('page-error', error.message));
    page.on('console', message => { if (message.type() === 'error') note('console-error', message.text()); });
    page.on('requestfailed', request => note('request-failed', [request.url(), request.failure()]));
    page.on('response', response => { if (response.status() >= 400) note('http-error', [response.url(), response.status()]); });
    try {
      await runTest(page);
    } finally {
      await info.attach('board-browser-events', { body: JSON.stringify({ violations, events }, null, 2), contentType: 'application/json' });
      expect(violations, 'Unexpected browser navigation or dialogs').toEqual([]);
    }
  },
});

export async function reloadBoard(page: Page, decision?: Decision) {
  const guard = guards.get(page);
  if (!guard) throw new Error('Use the monitored board-browser fixture');
  guard.nextDocument = decision === 'stay' ? undefined : page.url();
  guard.decision = decision;
  try {
    if (!decision) {
      await page.reload();
      return;
    }
    const answer = new Promise<void>(resolve => { guard.answered = resolve; });
    const navigated = decision === 'leave'
      ? page.waitForEvent('domcontentloaded') : Promise.resolve();
    await page.evaluate(() => { setTimeout(() => location.reload(), 0); });
    await Promise.all([answer, navigated]);
  } finally {
    guard.nextDocument = undefined;
    guard.decision = undefined;
    guard.answered = undefined;
  }
}

export async function openRecentBoard(page: Page, sessionId: string) {
  const guard = guards.get(page);
  if (!guard) throw new Error('Use the monitored board-browser fixture');
  const url = new URL('/workspace', page.url());
  url.searchParams.set('session', sessionId);
  guard.nextDocument = url.href;
  try {
    await page.getByRole('button', { name: new RegExp('Board ' + sessionId.slice(0, 8)) }).click();
    await expect(page).toHaveURL(url.href);
  } finally {
    guard.nextDocument = undefined;
  }
}
