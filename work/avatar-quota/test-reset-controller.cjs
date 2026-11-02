'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { ResetController, normalizeResetCredits, deriveAccountKey, readConsistentSnapshot } = require('./reset-controller.cjs');
const { formatRateLimits, CdpSession } = require('../../outputs/CodexAvatarQuota/agent.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'badge-reset-mock-'));
const now = 1793500000000;
const account = id => ({ account: { type: 'chatgpt', email: 'mock@example.test', planType: 'pro' },
  workspaceRouting: { chatgptAccountId: id, backendOrigin: 'https://example.test', accountRoutingOverride: 'NO_CONSTRAINT' } });
const limits = (id = 'mock-account', count = 1, rows = [{ id: 'mock-card', expiresAt: now / 1000 + 3600, status: 'available', resetType: 'codexRateLimits' }], used = 61) => ({
  accountId: id, rateLimits: { limitId: 'codex', planType: 'pro', primary: { usedPercent: used, windowDurationMins: 10080, resetsAt: now / 1000 + 100000 } },
  rateLimitResetCredits: { availableCount: count, credits: rows }
});
let serial = 0;
function fixture(options = {}) {
  const journalPath = options.journalPath || path.join(directory, `journal-${++serial}.json`);
  const calls = [], updates = [];
  let currentAccount = account('mock-account'), snapshot = limits(), consumes = 0;
  const client = { accountRevision: 0, request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'account/read') return structuredClone(currentAccount);
    if (method === 'account/rateLimits/read') {
      assert.deepEqual(params, { excludeResetCreditDetails: false });
      return structuredClone(snapshot);
    }
    if (method === 'account/rateLimitResetCredit/consume') {
      consumes++;
      const journal = JSON.parse(fs.readFileSync(journalPath));
      const op = journal.operations.at(-1);
      assert.equal(op.status, 'pending'); assert.equal(op.idempotencyKey, params.idempotencyKey);
      assert.equal(fs.statSync(journalPath).mode & 0o777, 0o600);
      if (options.consume) return options.consume({ params, client, setAccount: value => { currentAccount = value; }, setLimits: value => { snapshot = value; } });
      snapshot = limits('mock-account', 0, [], 13);
      return { outcome: 'reset' };
    }
    throw new Error('Unexpected mock RPC');
  } };
  const controller = new ResetController({ getClient: () => client, publish: async value => { updates.push(value); },
    format: formatRateLimits, journalPath, now: () => now, timeoutMs: 30 });
  return { controller, client, calls, updates, journalPath, count: () => consumes,
    setLimits: value => { snapshot = value; }, setAccount: value => { currentAccount = value; },
    request: (extra = {}) => ({ type: 'reset', requestId: randomUUID(), accountKey: deriveAccountKey(currentAccount, snapshot), creditId: 'mock-card', ...extra }) };
}

(async () => {
  assert.deepEqual(normalizeResetCredits({ rateLimitResetCredits: null }, now), { availableCount: null, cards: [], detailsComplete: false });
  assert.equal(normalizeResetCredits({ rateLimitResetCredits: { availableCount: null, credits: [] } }, now).availableCount, null);
  assert.equal(normalizeResetCredits(limits('mock-account', 3), now).detailsComplete, false);
  assert.equal(normalizeResetCredits(limits('mock-account', 1, null), now).cards.length, 0);
  assert.equal(normalizeResetCredits(limits('mock-account', 1, [{ id: 'expired', expiresAt: 1, status: 'available', resetType: 'codexRateLimits' }]), now).availableCount, 1);
  assert.equal(deriveAccountKey(account('a'), limits('b')), null);
  assert.equal(deriveAccountKey({ account: account('a').account }, limits('a')), null);
  let initialReads = 0, initialLimits = 0;
  const initializing = { accountRevision: 0, request: async method => {
    if (method === 'account/read') { if (++initialReads === 1) initializing.accountRevision++; return account('mock-account'); }
    if (method === 'account/rateLimits/read') { initialLimits++; return limits(); }
    throw new Error('Read retry must never consume');
  } };
  const stable = await readConsistentSnapshot(initializing, 30);
  assert.equal(stable._accountRevision, 1); assert.equal(initialReads, 4); assert.equal(initialLimits, 2);
  assert.equal(stable._accountKey, deriveAccountKey(account('mock-account'), limits()));
  let unstableReads = 0;
  const unstable = { accountRevision: 0, request: async method => {
    if (method === 'account/read') { unstableReads++; unstable.accountRevision++; return account('mock-account'); }
    if (method === 'account/rateLimits/read') return limits();
    throw new Error('Read retry must never consume');
  } };
  await assert.rejects(readConsistentSnapshot(unstable, 30), error => error.code === 'accountChanged' && error.reason === 'revisionChanged');
  assert.equal(unstableReads, 6, 'unstable identity must stop after three read-only brackets');
  let mismatchedReads = 0;
  const mismatched = { accountRevision: 0, request: async method => {
    if (method === 'account/read') return account('account-a');
    if (method === 'account/rateLimits/read') { mismatchedReads++; return limits('account-b'); }
    throw new Error('Read retry must never consume');
  } };
  await assert.rejects(readConsistentSnapshot(mismatched, 30), error => error.code === 'accountChanged' && error.reason === 'snapshotAccountMismatch');
  assert.equal(mismatchedReads, 3, 'known wrong-account usage must never be displayed');

  const success = fixture(), request = success.request();
  const result = await success.controller.handle(request);
  assert.deepEqual(result, { outcome: 'reset', refreshed: true });
  assert.equal(success.count(), 1);
  assert.equal(success.updates.at(-1).percent, 87, 'use actual read, never assume 100%');
  assert.equal(success.updates.at(-1).resetOperation.status, 'complete');
  assert.equal(success.updates.at(-1).resetOperation.requestId, request.requestId);
  await success.controller.handle(request); assert.equal(success.count(), 1, 'duplicate request never consumes again');

  const generic = fixture(); generic.setLimits(limits('mock-account', 1, null));
  await generic.controller.handle(generic.request({ creditId: undefined }));
  assert.equal(Object.hasOwn(generic.calls.find(item => item.method.endsWith('/consume')).params, 'creditId'), false);

  const zero = fixture(); zero.setLimits(limits('mock-account', 0, []));
  const zeroRequest = zero.request();
  assert.equal((await zero.controller.handle(zeroRequest)).outcome, 'noCredit'); assert.equal(zero.count(), 0);
  assert.equal(zero.updates.at(-1).resetOperation.requestId, zeroRequest.requestId);
  assert.equal(zero.updates.at(-1).resetOperation.status, 'complete');

  const expired = fixture(); expired.setLimits(limits('mock-account', 1, [{ id: 'mock-card', status: 'available', resetType: 'codexRateLimits', expiresAt: 1 }]));
  const expiredRequest = expired.request();
  assert.equal((await expired.controller.handle(expiredRequest)).outcome, 'notSubmitted'); assert.equal(expired.count(), 0);
  assert.equal(JSON.parse(fs.readFileSync(expired.journalPath)).operations[0].submitted, false);
  const confirmedNotSent = await expired.controller.handle({ ...expiredRequest, type: 'refresh', creditId: undefined });
  assert.equal(confirmedNotSent.outcome, 'notSubmitted');
  assert.equal(expired.updates.at(-1).resetOperation.status, 'complete');

  const unknown = fixture({ consume: async () => { throw new Error('Mock timeout'); } });
  const unknownRequest = unknown.request();
  assert.equal((await unknown.controller.handle(unknownRequest)).outcome, 'unconfirmed');
  unknown.setLimits(limits('mock-account', 0, [], 0));
  assert.equal((await unknown.controller.handle({ ...unknownRequest, type: 'refresh', creditId: undefined })).outcome, 'unconfirmed');
  assert.equal(unknown.updates.at(-1).resetOperation.status, 'unconfirmed', 'count decrease cannot prove which operation succeeded');
  await unknown.controller.handle(unknown.request()); assert.equal(unknown.count(), 1, 'new request blocked while outcome unknown');
  const restarted = fixture({ journalPath: unknown.journalPath });
  assert.equal((await restarted.controller.handle(restarted.request())).outcome, 'unconfirmed'); assert.equal(restarted.count(), 0);

  let release;
  const slow = fixture({ consume: () => new Promise(resolve => { release = resolve; }) });
  slow.controller.timeoutMs = 1000;
  const pending = slow.controller.handle(slow.request());
  await new Promise(resolve => setImmediate(resolve));
  const concurrent = await slow.controller.handle(slow.request()); assert.equal(concurrent.outcome, 'busy');
  const otherProcess = fixture({ journalPath: slow.journalPath });
  assert.equal((await otherProcess.controller.handle(otherProcess.request())).outcome, 'busy');
  release({ outcome: 'nothingToReset' }); await pending; assert.equal(slow.count(), 1);

  // No live CDP connection: exercise only event validation on a fake session.
  const session = new CdpSession({ url: 'app://-/index.html', webSocketDebuggerUrl: 'ws://127.0.0.1/mock' });
  const bindingRequests = [];
  session.request = async (method, params) => { bindingRequests.push({ method, params }); return {}; };
  session.mainFrameId = 'top';
  let received = 0; session.onAction = async () => { received++; };
  for (const context of [
    { id: 1, auxData: { isDefault: true, frameId: 'top' } },
    { id: 2, auxData: { isDefault: false, frameId: 'top' } },
    { id: 3, auxData: { isDefault: true, frameId: 'child' } }
  ]) session.handleEvent({ method: 'Runtime.executionContextCreated', params: { context } });
  await new Promise(resolve => setImmediate(resolve));
  for (const id of [1, 2, 3]) session.handleEvent({ method: 'Runtime.bindingCalled', params: { name: '__codexUsageBadgeAction', executionContextId: id, payload: '{}' } });
  assert.equal(received, 1); assert.equal(bindingRequests.length, 1);
  assert.equal(bindingRequests[0].params.executionContextId, 1);
  session.handleEvent({ method: 'Runtime.executionContextsCleared', params: {} });
  session.handleEvent({ method: 'Runtime.bindingCalled', params: { name: '__codexUsageBadgeAction', executionContextId: 1, payload: '{}' } });
  assert.equal(received, 1);
  console.log('PASS: authoritative counts, identity, durable intent, actual post-read, idempotent duplicate, generic credit, terminal noCredit/notSubmitted, timeout recovery lock, cross-window/process singleflight, main-default-context bridge');
})().finally(() => fs.rmSync(directory, { recursive: true, force: true })).catch(error => { console.error(error); process.exitCode = 1; });
