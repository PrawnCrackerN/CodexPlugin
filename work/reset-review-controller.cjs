'use strict';
// Independent offline contract checks. All RPC methods below use a fake client.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { ResetController, deriveAccountKey, readConsistentSnapshot } = require('./avatar-quota/reset-controller.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = x => JSON.parse(JSON.stringify(x));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reset-review-'));
let passed = 0;
function fixture(name, options = {}) {
  let account = { account: { type: 'chatgpt', email: 'example@example.test', planType: 'pro' }, workspaceRouting: { chatgptAccountId: 'test-account-a', backendOrigin: 'https://example.test', accountRoutingOverride: 'NO_CONSTRAINT' } };
  let limits = { accountId: 'test-account-a', rateLimits: { primary: { usedPercent: 70 } }, rateLimitResetCredits: { availableCount: 1, credits: [{ id: 'test-card', resetType: 'codexRateLimits', status: 'available', expiresAt: null }] } };
  let consumeCalls = 0, accountReads = 0;
  const published = [];
  const client = { accountRevision: 0, async request(method, params) {
    if (method === 'account/read') { accountReads++; if (options.onAccountRead) await options.onAccountRead(accountReads, state); return clone(account); }
    if (method === 'account/rateLimits/read') { if (options.onLimits) await options.onLimits(state); return clone(limits); }
    if (method === 'account/rateLimitResetCredit/consume') {
      consumeCalls++;
      if (options.consume) return options.consume(state, params);
      limits.rateLimits.primary.usedPercent = 33;
      limits.rateLimitResetCredits = { availableCount: 0, credits: [] };
      return { outcome: 'reset' };
    }
    throw new Error('Unexpected fake RPC');
  }};
  const state = {
    client, published, get account() { return account; }, get limits() { return limits; },
    get consumeCalls() { return consumeCalls; },
    setAccountId(id) { account.workspaceRouting.chatgptAccountId = id; limits.accountId = id; client.accountRevision++; },
    setCredits(value) { limits.rateLimitResetCredits = value; }
  };
  const journalPath = path.join(root, name + '.json');
  const create = () => new ResetController({ getClient: () => client, publish: async value => { published.push(value); if (options.publish) await options.publish(value, state); }, format: value => ({ percent: 100 - value.rateLimits.primary.usedPercent }), journalPath, timeoutMs: options.timeoutMs ?? 150 });
  const request = () => ({ type: 'reset', requestId: crypto.randomUUID(), accountKey: deriveAccountKey(account, limits), creditId: 'test-card' });
  return { ...state, state, create, journalPath, request, published };
}
async function check(name, run) { await run(); passed++; console.log('PASS ' + name); }
(async () => {
  await check('fresh data and idempotent duplicate', async () => {
    const f = fixture('idempotent'), c = f.create(), request = f.request();
    const first = await c.handle(request);
    assert.equal(first.outcome, 'reset'); assert.equal(first.refreshed, true);
    assert.equal(f.published.at(-1).percent, 67);
    assert.equal((await c.handle(request)).outcome, 'reset');
    assert.equal(f.state.consumeCalls, 1);
  });
  await check('two processes share single-flight lock', async () => {
    const f = fixture('cross-process', { consume: async state => { await sleep(40); state.setCredits({ availableCount: 0, credits: [] }); return { outcome: 'reset' }; } });
    const a = f.create(), b = f.create();
    const results = await Promise.all([a.handle(f.request()), b.handle(f.request())]);
    assert.equal(results.filter(x => x.outcome === 'reset').length, 1);
    assert.equal(f.state.consumeCalls, 1);
  });
  await check('timeout survives restart and read-only refresh', async () => {
    const f = fixture('timeout', { timeoutMs: 20, consume: () => new Promise(() => {}) });
    assert.equal((await f.create().handle(f.request())).outcome, 'unconfirmed');
    const newController = f.create();
    assert.equal((await newController.handle(f.request())).outcome, 'unconfirmed');
    const refresh = { ...f.request(), type: 'refresh' };
    assert.equal((await newController.handle(refresh)).outcome, 'unconfirmed');
    assert.equal(f.state.consumeCalls, 1);
  });
  await check('saved pending entry never consumes on reload', async () => {
    const f = fixture('restart');
    const req = f.request();
    fs.writeFileSync(f.journalPath, JSON.stringify({ version: 1, operations: [{ requestId: req.requestId, idempotencyKey: crypto.randomUUID(), accountKey: req.accountKey, creditId: req.creditId, status: 'pending', refreshed: false }] }), { mode: 0o600 });
    assert.equal((await f.create().handle(f.request())).outcome, 'unconfirmed');
    assert.equal(f.state.consumeCalls, 0);
  });
  await check('account changes abort before consume', async () => {
    const f = fixture('account-change', { onAccountRead: async (n, state) => { if (n === 2) state.setAccountId('test-account-b'); } });
    const result = await f.create().handle(f.request());
    assert.equal(result.refreshed, false); assert.equal(f.state.consumeCalls, 0);
  });
  await check('switch after consume never republishes old identity', async () => {
    const f = fixture('post-account-change', { consume: async state => {
      state.setAccountId('test-account-b'); throw new Error('Transport interrupted during switch');
    }});
    const request = f.request();
    assert.equal((await f.create().handle(request)).outcome, 'unconfirmed');
    assert.equal(f.published.at(-1).accountKey, null);
    assert.equal(f.published.at(-1).percent, null);
    assert.equal(f.published.at(-1).resetCredits.availableCount, null);
    assert.equal(f.state.consumeCalls, 1);
  });
  await check('saved official outcome recovers through read-only refresh', async () => {
    const f = fixture('post-read-fail', { onAccountRead: async n => {
      if (n === 4) throw new Error('Mock refresh offline');
    }});
    const request = f.request();
    assert.equal((await f.create().handle(request)).outcome, 'unconfirmed');
    const refresh = await f.create().handle({ ...request, type: 'refresh' });
    assert.equal(refresh.outcome, 'reset'); assert.equal(refresh.refreshed, true);
    assert.equal(f.published.at(-1).resetOperation.status, 'complete');
    assert.equal(f.state.consumeCalls, 1);
  });
  await check('missing optional expiry is valid but never invented', async () => {
    const f = fixture('missing-expiry');
    delete f.state.limits.rateLimitResetCredits.credits[0].expiresAt;
    assert.equal((await f.create().handle(f.request())).outcome, 'reset');
    assert.equal(f.published[0].resetCredits.cards[0].expiresAt, null);
    assert.equal(f.state.consumeCalls, 1);
  });
  await check('noCredit has published complete terminal operation', async () => {
    const f = fixture('no-credit'); f.state.setCredits({ availableCount: 0, credits: [] });
    const request = f.request(), result = await f.create().handle(request);
    assert.equal(result.outcome, 'noCredit'); assert.equal(result.refreshed, true);
    assert.equal(f.published.at(-1).resetOperation.requestId, request.requestId);
    assert.equal(f.published.at(-1).resetOperation.status, 'complete');
    assert.equal(f.published.at(-1).resetOperation.outcome, 'noCredit');
    assert.equal(f.state.consumeCalls, 0);
  });
  await check('pre-submit failure is terminal and refresh never consumes', async () => {
    const f = fixture('not-submitted', { onAccountRead: async n => {
      if (n === 3) throw new Error('Mock pre-submit read offline');
    }});
    const request = f.request(), c = f.create();
    await c.publishSnapshot({ ...clone(f.state.limits), _accountKey: request.accountKey, _accountRevision: 0 });
    const result = await c.handle(request);
    assert.equal(result.outcome, 'notSubmitted'); assert.equal(result.refreshed, true);
    assert.equal(f.published.at(-1).resetOperation.status, 'complete');
    assert.equal(f.published.at(-1).resetOperation.outcome, 'notSubmitted');
    assert.equal((await c.handle({ ...request, type: 'refresh' })).outcome, 'notSubmitted');
    assert.equal(f.published.at(-1).resetOperation.refreshed, true);
    assert.equal(f.state.consumeCalls, 0);
  });
  await check('early consume rejection is handled while publishing', async () => {
    const f = fixture('early-rejection', { consume: async () => { throw new Error('Mock immediate failure'); }, publish: () => sleep(25) });
    const unhandled = [];
    const onUnhandled = reason => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      assert.equal((await f.create().handle(f.request())).outcome, 'unconfirmed');
      assert.deepEqual(unhandled, []);
    } finally { process.off('unhandledRejection', onUnhandled); }
  });
  await check('poll-busy client absence stays a known non-submission', async () => {
    const f = fixture('poll-busy'), request = f.request(), c = f.create();
    await c.publishSnapshot({ ...clone(f.state.limits), _accountKey: request.accountKey, _accountRevision: 0 });
    c.getClient = () => null;
    assert.equal((await c.handle(request)).outcome, 'notSubmitted');
    assert.equal(f.state.consumeCalls, 0);
    c.getClient = () => f.state.client;
    assert.equal((await c.handle({ ...request, type: 'refresh' })).outcome, 'notSubmitted');
    assert.equal(f.published.at(-1).resetOperation.status, 'complete');
  });
  await check('startup account notification retries only consistent reads', async () => {
    const f = fixture('startup-notification', { onAccountRead: (n, state) => {
      if (n === 1) state.client.accountRevision++;
    }});
    const snapshot = await readConsistentSnapshot(f.state.client, 100);
    assert.equal(snapshot._accountRevision, 1);
    assert.equal(snapshot._accountKey, f.request().accountKey);
    assert.equal(f.state.consumeCalls, 0);
  });
  await check('continuously changing revision fails closed', async () => {
    const f = fixture('unstable-revision', { onAccountRead: (n, state) => {
      state.client.accountRevision++;
    }});
    await assert.rejects(readConsistentSnapshot(f.state.client, 100), { code: 'accountChanged' });
    assert.equal(f.state.consumeCalls, 0);
  });
  await check('known different usage account never produces a snapshot', async () => {
    const f = fixture('mismatched-usage');
    f.state.limits.accountId = 'test-account-b';
    await assert.rejects(readConsistentSnapshot(f.state.client, 100), { code: 'accountChanged' });
    assert.equal(f.state.consumeCalls, 0);
  });
  console.log(`Independent offline review: ${passed} checks passed`);
})().finally(() => fs.rmSync(root, { recursive: true, force: true })).catch(error => { console.error(error.stack); process.exitCode = 1; });
