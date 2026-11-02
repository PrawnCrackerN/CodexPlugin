'use strict';
// Only mock data. No CLI subprocess, network, UI connection or consume call.
const assert = require('node:assert/strict');
const { ResetCreditDetailsCache, normalizeResetCredits, readConsistentSnapshot } = require('./avatar-quota/reset-controller.cjs');
const now = Date.now(), expiry = Math.floor(now / 1000) + 3600;
const keyA = 'a'.repeat(64), keyB = 'b'.repeat(64);
const card = (id = 'card-a', fields = {}) => ({ id, grantedAt: 1, status: 'available', resetType: 'codexRateLimits', ...fields });
const snapshot = (rows, count = 1, accountKey = keyA) => ({ _accountKey: accountKey, rateLimitResetCredits: { availableCount: count, credits: rows } });
const normalized = (cache, value, at = now) => normalizeResetCredits(cache.enrich(value, at), at);
let passed = 0;
async function check(name, run) { await run(); console.log('PASS ' + name); passed++; }
function mockClient(responses, options = {}) {
  let limitsReads = 0, accountReads = 0;
  const account = { account: { type: 'chatgpt', email: 'mock@example.test' }, workspaceRouting: { chatgptAccountId: 'account-a', backendOrigin: 'https://example.test' } };
  const client = { accountRevision: 0, async request(method) {
    if (method === 'account/read') { accountReads++; return structuredClone(account); }
    if (method === 'account/rateLimits/read') {
      limitsReads++;
      const response = responses[Math.min(limitsReads - 1, responses.length - 1)];
      if (typeof response === 'function') return response(client);
      return { accountId: 'account-a', rateLimits: {}, ...structuredClone(response) };
    }
    throw new Error('Unexpected non-read-only mock RPC');
  }};
  return { client, get limitsReads() { return limitsReads; }, get accountReads() { return accountReads; } };
}
const summary = (rows, count = 1) => ({ rateLimitResetCredits: { availableCount: count, credits: rows } });
(async () => {
  await check('explicit null differs from missing expiry', () => {
    const result = normalizeResetCredits(snapshot([card('dated', { expiresAt: expiry }), card('none', { expiresAt: null }), card('unknown')], 3), now);
    assert.deepEqual(result.cards.map(row => row.expiryStatus), ['dated', 'noExpiry', 'unknown']);
    assert.equal(result.detailsComplete, true);
  });
  await check('same account and ID retain a known expiry without changing raw fields', () => {
    const cache = new ResetCreditDetailsCache();
    normalized(cache, snapshot([card('card-a', { expiresAt: expiry })]));
    const enriched = cache.enrich(snapshot([card()]), now + 1000);
    assert.equal(Object.hasOwn(enriched.rateLimitResetCredits.credits[0], 'expiresAt'), false);
    const result = normalizeResetCredits(enriched, now + 1000);
    assert.equal(result.cards[0].expiresAt, expiry); assert.equal(result.cards[0].expirySource, 'cached');
  });
  await check('missing list never resurrects old card identities', () => {
    const cache = new ResetCreditDetailsCache();
    normalized(cache, snapshot([card('card-a', { expiresAt: expiry })]));
    const result = normalized(cache, snapshot(null));
    assert.equal(result.availableCount, 1); assert.deepEqual(result.cards, []); assert.equal(result.detailsComplete, false);
    assert.equal(normalized(cache, snapshot([card('card-b')])).cards[0].expiryStatus, 'unknown');
  });
  await check('partial lists remain partial and never gain cached rows', () => {
    const cache = new ResetCreditDetailsCache();
    normalized(cache, snapshot([card('card-a', { expiresAt: expiry }), card('card-b', { expiresAt: expiry + 1 })], 2));
    const result = normalized(cache, snapshot([card('card-b')], 2));
    assert.equal(result.cards.length, 1); assert.equal(result.cards[0].id, 'card-b');
    assert.equal(result.cards[0].expiresAt, expiry + 1); assert.equal(result.detailsComplete, false);
  });
  await check('different and unknown account keys cannot inherit metadata', () => {
    const cache = new ResetCreditDetailsCache();
    normalized(cache, snapshot([card('card-a', { expiresAt: expiry })]));
    assert.equal(normalized(cache, snapshot([card()], 1, keyB)).cards[0].expiryStatus, 'unknown');
    normalized(cache, snapshot([card('card-a', { expiresAt: expiry })]));
    assert.equal(normalized(cache, snapshot([card()], 1, null)).cards[0].expiryStatus, 'unknown');
    assert.equal(normalized(cache, snapshot([card()])).cards[0].expiryStatus, 'unknown');
  });
  await check('new explicit expiry and explicit no-expiry override cached date', () => {
    const cache = new ResetCreditDetailsCache();
    normalized(cache, snapshot([card('card-a', { expiresAt: expiry })]));
    assert.equal(normalized(cache, snapshot([card('card-a', { expiresAt: expiry + 300 })])).cards[0].expiresAt, expiry + 300);
    assert.equal(normalized(cache, snapshot([card('card-a', { expiresAt: null })])).cards[0].expiryStatus, 'noExpiry');
    assert.equal(normalized(cache, snapshot([card()])).cards[0].expiryStatus, 'noExpiry');
  });
  await check('TTL does not renew when a missing field uses cached metadata', () => {
    const cache = new ResetCreditDetailsCache();
    normalized(cache, snapshot([card('card-a', { expiresAt: expiry })]));
    assert.equal(normalized(cache, snapshot([card()]), now + 9 * 60 * 1000).cards[0].expirySource, 'cached');
    assert.equal(normalized(cache, snapshot([card()]), now + 10 * 60 * 1000).cards[0].expiryStatus, 'unknown');
  });
  await check('zero, redeemed, replacement list and new grant invalidate old metadata', () => {
    for (const intermediate of [snapshot([], 0), snapshot([card('card-a', { status: 'redeemed' })]), snapshot([card('replacement')])]) {
      const cache = new ResetCreditDetailsCache(); normalized(cache, snapshot([card('card-a', { expiresAt: expiry })]));
      normalized(cache, intermediate); assert.equal(normalized(cache, snapshot([card()])).cards[0].expiryStatus, 'unknown');
    }
    const cache = new ResetCreditDetailsCache(); normalized(cache, snapshot([card('card-a', { expiresAt: expiry })]));
    assert.equal(normalized(cache, snapshot([card('card-a', { grantedAt: 2 })])).cards[0].expiryStatus, 'unknown');
  });
  await check('expired cached date is not shown as an available card', () => {
    const cache = new ResetCreditDetailsCache(); normalized(cache, snapshot([card('card-a', { expiresAt: Math.floor(now / 1000) + 1 })]));
    const result = normalized(cache, snapshot([card()]), now + 2000);
    assert.equal(result.availableCount, 1); assert.deepEqual(result.cards, []); assert.equal(result.detailsComplete, false);
  });
  await check('one missing-detail retry tolerates the observed latency above two seconds', async () => {
    const f = mockClient([summary(null), () => new Promise(resolve => setTimeout(() => resolve({
      accountId: 'account-a', rateLimits: {}, ...summary([card('card-a', { expiresAt: expiry })])
    }), 2200))]);
    const result = normalizeResetCredits(await readConsistentSnapshot(f.client, 5000), now);
    assert.equal(f.limitsReads, 2); assert.equal(f.accountReads, 3); assert.equal(result.cards[0].expiresAt, expiry);
  });
  await check('retry count-only keeps first-read metadata without preserving its list', async () => {
    const f = mockClient([
      summary([card('card-a', { expiresAt: expiry }), card('card-b')], 2),
      summary(null, 2), summary([card('card-a')], 2)
    ]);
    const first = normalizeResetCredits(await readConsistentSnapshot(f.client, 50), now);
    assert.equal(first.availableCount, 2); assert.deepEqual(first.cards, []);
    const next = normalizeResetCredits(await readConsistentSnapshot(f.client, 50), now);
    assert.equal(next.cards.length, 1); assert.equal(next.cards[0].id, 'card-a');
    assert.equal(next.cards[0].expiresAt, expiry); assert.equal(next.cards[0].expirySource, 'cached');
  });
  await check('persistent detail absence observes cooldown', async () => {
    const f = mockClient([summary(null)]);
    await readConsistentSnapshot(f.client, 50); await readConsistentSnapshot(f.client, 50);
    assert.equal(f.limitsReads, 3);
  });
  await check('documented capped lists do not trigger extra queries', async () => {
    const f = mockClient([summary([card('card-a', { expiresAt: expiry })], 2)]);
    const result = normalizeResetCredits(await readConsistentSnapshot(f.client, 50), now);
    assert.equal(f.limitsReads, 1); assert.equal(result.detailsComplete, false);
  });
  await check('optional detail timeout preserves validated quota within budget', async () => {
    const f = mockClient([summary(null), () => new Promise(() => {})]);
    const started = Date.now(), result = await readConsistentSnapshot(f.client, 25);
    assert.equal(result.rateLimitResetCredits.availableCount, 1); assert.equal(f.limitsReads, 2);
    assert.ok(Date.now() - started < 150);
  });
  await check('account revision change during detail retry fails closed', async () => {
    const f = mockClient([summary(null), client => { client.accountRevision++; return { accountId: 'account-a', rateLimits: {}, ...summary([card('card-a', { expiresAt: expiry })]) }; }]);
    await assert.rejects(readConsistentSnapshot(f.client, 50), { code: 'accountChanged' });
  });
  await check('retry cannot apply another account deadline', async () => {
    const f = mockClient([summary(null), { accountId: 'account-b', ...summary([card('card-a', { expiresAt: expiry })]) }]);
    await assert.rejects(readConsistentSnapshot(f.client, 50), { code: 'accountChanged' });
  });
  console.log(`Reset credit detail checks: ${passed} passed`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
