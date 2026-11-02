'use strict';

// No transport is created here. All RPCs use the agent's existing App Server.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY = /^[0-9a-f]{64}$/;
const OUTCOMES = new Set(['reset', 'alreadyRedeemed', 'nothingToReset', 'noCredit']);
const opaque = value => typeof value === 'string' && value.length > 0 && value.length <= 1024;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const EXPIRY_METADATA = Symbol('reset-credit-expiry');
const DETAIL_CACHE_MS = 10 * 60 * 1000;
const DETAIL_RETRY_COOLDOWN_MS = 60 * 1000;
const detailStates = new WeakMap();

function expiryMetadata(row) {
  if (Object.hasOwn(row, 'expiresAt')) {
    if (row.expiresAt === null) return { expiryStatus: 'noExpiry', expiresAt: null, expirySource: 'live' };
    if (Number.isSafeInteger(row.expiresAt)) return { expiryStatus: 'dated', expiresAt: row.expiresAt, expirySource: 'live' };
    return { expiryStatus: 'unknown', expiresAt: null, expirySource: 'unknown' };
  }
  return row[EXPIRY_METADATA] || { expiryStatus: 'unknown', expiresAt: null, expirySource: 'unknown' };
}

// Only metadata is cached. A current response must supply the exact credit ID
// before its old expiry can be reused; cached rows never become today's list.
class ResetCreditDetailsCache {
  constructor() { this.accountKey = null; this.entries = new Map(); }
  enrich(snapshot, now = Date.now()) {
    const key = KEY.test(snapshot?._accountKey) ? snapshot._accountKey : null;
    if (!key || key !== this.accountKey) { this.entries.clear(); this.accountKey = key; }
    if (!key) return snapshot;
    for (const [id, entry] of this.entries) if (now - entry.observedAt >= DETAIL_CACHE_MS || now < entry.observedAt) this.entries.delete(id);
    const summary = snapshot.rateLimitResetCredits;
    if (summary?.availableCount === 0) { this.entries.clear(); return snapshot; }
    if (!Array.isArray(summary?.credits)) return snapshot;
    const currentIds = new Set();
    const rows = summary.credits.map(row => {
      if (!row || !opaque(row.id)) return row;
      if (row.status !== 'available' || row.resetType !== 'codexRateLimits') { this.entries.delete(row.id); return row; }
      if (currentIds.has(row.id)) return row;
      currentIds.add(row.id);
      const existing = this.entries.get(row.id);
      // A grant timestamp disagreement also invalidates an unexpectedly reused ID.
      if (existing && Number.isSafeInteger(row.grantedAt) && Number.isSafeInteger(existing.grantedAt) && row.grantedAt !== existing.grantedAt) this.entries.delete(row.id);
      if (Object.hasOwn(row, 'expiresAt')) {
        const expiry = expiryMetadata(row);
        if (expiry.expiryStatus !== 'unknown') this.entries.set(row.id, { ...expiry, grantedAt: row.grantedAt, observedAt: now });
        else this.entries.delete(row.id);
        return row;
      }
      const cached = this.entries.get(row.id);
      return cached ? { ...row, [EXPIRY_METADATA]: { expiryStatus: cached.expiryStatus, expiresAt: cached.expiresAt, expirySource: 'cached' } } : row;
    });
    if (Number.isSafeInteger(summary.availableCount) && currentIds.size === summary.availableCount) {
      for (const id of this.entries.keys()) if (!currentIds.has(id)) this.entries.delete(id);
    }
    // Bound memory even if a backend supplies unusually large partial lists.
    while (this.entries.size > 256) this.entries.delete(this.entries.keys().next().value);
    return { ...snapshot, rateLimitResetCredits: { ...summary, credits: rows } };
  }
}

function normalizeResetCredits(response, now = Date.now()) {
  const summary = response?.rateLimitResetCredits;
  const availableCount = Number.isSafeInteger(summary?.availableCount) && summary.availableCount >= 0 ? summary.availableCount : null;
  const rows = Array.isArray(summary?.credits) ? summary.credits : null;
  const cards = [];
  const seen = new Set();
  for (const row of rows || []) {
    if (!opaque(row?.id) || seen.has(row.id) || row.status !== 'available' || row.resetType !== 'codexRateLimits') continue;
    if (row.expiresAt != null && (!Number.isSafeInteger(row.expiresAt) || row.expiresAt * 1000 <= now)) continue;
    const expiry = expiryMetadata(row);
    if (expiry.expiryStatus === 'dated' && expiry.expiresAt * 1000 <= now) continue;
    seen.add(row.id);
    cards.push({ id: row.id, ...expiry });
  }
  return { availableCount, cards, detailsComplete: rows !== null && availableCount !== null && cards.length === availableCount };
}

// Official generated GetAccountResponse / GetAccountRateLimitsResponse schemas:
// workspaceRouting.chatgptAccountId and usage.accountId must both identify the
// same account. Neither a display name nor email/plan alone is an identity.
function accountContext(accountResponse) {
  const account = accountResponse?.account, routing = accountResponse?.workspaceRouting;
  if (account?.type !== 'chatgpt' || !opaque(routing?.chatgptAccountId) || !opaque(routing?.backendOrigin)) return null;
  return { type: account.type, id: routing.chatgptAccountId, origin: routing.backendOrigin,
    route: routing.accountRoutingOverride ?? null, user: typeof account.email === 'string' ? account.email.trim().toLowerCase() : null };
}
function deriveAccountKey(accountResponse, limits) {
  const context = accountContext(accountResponse);
  return context && opaque(limits?.accountId) && limits.accountId === context.id ? hash(context) : null;
}
function failure(code) { const error = new Error(code); error.code = code; return error; }
async function rpc(client, method, params, timeoutMs = 12000) {
  let timer;
  try {
    return await Promise.race([client.request(method, params), new Promise((_, reject) => {
      timer = setTimeout(() => reject(failure('unconfirmed')), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}
async function readSnapshotBracket(client, timeoutMs = 12000) {
  // initialize/account notifications can arrive during the first read. Retry
  // only this entire read-only bracket; never retry a consume RPC.
  for (let attempt = 0; attempt < 3; attempt++) {
    const revision = client.accountRevision;
    const before = await rpc(client, 'account/read', { refreshToken: false }, timeoutMs);
    const limits = await rpc(client, 'account/rateLimits/read', { excludeResetCreditDetails: false }, timeoutMs);
    const after = await rpc(client, 'account/read', { refreshToken: false }, timeoutMs);
    const beforeKey = deriveAccountKey(before, limits), afterKey = deriveAccountKey(after, limits);
    const beforeContext = accountContext(before), afterContext = accountContext(after);
    const snapshotMismatch = opaque(limits?.accountId) &&
      ((beforeContext && beforeContext.id !== limits.accountId) || (afterContext && afterContext.id !== limits.accountId));
    const reason = client.accountRevision !== revision ? 'revisionChanged' :
      snapshotMismatch ? 'snapshotAccountMismatch' :
      hash(beforeContext) !== hash(afterContext) || beforeKey !== afterKey ? 'contextChanged' : null;
    if (!reason) return { ...limits, _accountKey: afterKey, _accountRevision: revision };
    if (attempt === 2) { const error = failure('accountChanged'); error.reason = reason; throw error; }
  }
}

function needsCreditDetails(snapshot) {
  const summary = snapshot.rateLimitResetCredits;
  if (!Number.isSafeInteger(summary?.availableCount) || summary.availableCount <= 0) return false;
  if (!Array.isArray(summary.credits) || summary.credits.length === 0) return true;
  // A capped list is valid; repeatedly asking for the remaining rows will not
  // make it complete. Only missing expiry metadata merits the bounded retry.
  return summary.credits.some(row => opaque(row?.id) && row.status === 'available' && row.resetType === 'codexRateLimits' && expiryMetadata(row).expiryStatus === 'unknown');
}
async function readConsistentSnapshot(client, timeoutMs = 12000) {
  let snapshot = await readSnapshotBracket(client, timeoutMs);
  let state = detailStates.get(client);
  if (!state) { state = { cache: new ResetCreditDetailsCache(), retryKey: null, retriedAt: -Infinity }; detailStates.set(client, state); }
  const now = Date.now();
  const needsDetails = needsCreditDetails(snapshot);
  snapshot = state.cache.enrich(snapshot, now);
  const sameAccount = state.retryKey === snapshot._accountKey;
  if (snapshot._accountKey && needsDetails && (!sameAccount || now - state.retriedAt >= DETAIL_RETRY_COOLDOWN_MS)) {
    state.retryKey = snapshot._accountKey; state.retriedAt = now;
    // This optional read has one shared four-second budget. Reuse the first
    // bracket's final identity as its starting identity, then verify again.
    const deadline = Date.now() + Math.min(4000, timeoutMs);
    try {
      const limits = await rpc(client, 'account/rateLimits/read', { excludeResetCreditDetails: false }, Math.max(1, deadline - Date.now()));
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw failure('detailTimeout');
      const after = await rpc(client, 'account/read', { refreshToken: false }, remaining);
      if (client.accountRevision !== snapshot._accountRevision || deriveAccountKey(after, limits) !== snapshot._accountKey) throw failure('accountChanged');
      snapshot = { ...limits, _accountKey: snapshot._accountKey, _accountRevision: snapshot._accountRevision };
    } catch (error) {
      if (error.code === 'accountChanged' || client.accountRevision !== snapshot._accountRevision) throw failure('accountChanged');
      // A detail timeout must not discard the already validated quota snapshot.
    }
  }
  return state.cache.enrich(snapshot, Date.now());
}

class ResetController {
  constructor({ getClient, publish, format, journalPath, now = Date.now, timeoutMs = 12000 }) {
    Object.assign(this, { getClient, publish, format, journalPath, now, timeoutMs });
    this.busy = false;
    this.activeRequestId = null;
    this.lastSnapshot = null;
  }
  load() {
    try {
      const stat = fs.lstatSync(this.journalPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw failure('journalUnavailable');
      const value = JSON.parse(fs.readFileSync(this.journalPath, 'utf8'));
      if (value.version !== 1 || !Array.isArray(value.operations) || value.operations.some(op => !UUID.test(op.requestId) || !UUID.test(op.idempotencyKey) || !KEY.test(op.accountKey) || !['pending', 'unconfirmed', 'complete'].includes(op.status))) throw failure('journalUnavailable');
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, operations: [] };
      throw failure('journalUnavailable');
    }
  }
  write(journal) {
    const temporary = `${this.journalPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    let fd;
    try {
      fd = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify(journal));
      fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      fs.renameSync(temporary, this.journalPath);
      const directory = fs.openSync(path.dirname(this.journalPath), 'r');
      try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      try { fs.unlinkSync(temporary); } catch {}
    }
  }
  acquire() {
    const lock = `${this.journalPath}.lock`;
    // Do not auto-remove an orphan lock: a second live process must never win
    // a check/unlink race. The installer can remove it after stopping agents.
    try {
      const fd = fs.openSync(lock, 'wx', 0o600);
      fs.writeFileSync(fd, String(process.pid)); fs.fsyncSync(fd); fs.closeSync(fd);
    } catch { throw failure('busy'); }
    return () => { try { fs.unlinkSync(lock); } catch {} };
  }
  operation(accountKey, journal = this.load()) {
    if (!accountKey) return null;
    const matching = journal.operations.filter(op => op.accountKey === accountKey);
    const op = matching.find(op => op.status !== 'complete') || matching.at(-1);
    if (!op) return null;
    return { requestId: op.requestId, accountKey: op.accountKey,
      status: op.status === 'pending' && this.activeRequestId !== op.requestId ? 'unconfirmed' : op.status,
      ...(op.outcome ? { outcome: op.outcome } : {}), refreshed: op.refreshed === true };
  }
  async publishSnapshot(snapshot, journal) {
    this.lastSnapshot = snapshot;
    let resetOperation, journalOK = true;
    try { resetOperation = this.operation(snapshot._accountKey, journal); } catch { journalOK = false; resetOperation = null; }
    const value = { ...this.format(snapshot), accountKey: journalOK ? snapshot._accountKey : null,
      resetCredits: normalizeResetCredits(snapshot, this.now()), resetOperation,
      updatedAt: this.now(), stale: false };
    await this.publish(value);
    return value;
  }
  async read(client, expectedKey) {
    const snapshot = await readConsistentSnapshot(client, this.timeoutMs);
    if (this.getClient() !== client || (expectedKey && snapshot._accountKey !== expectedKey)) throw failure('accountChanged');
    return snapshot;
  }
  validate(request) {
    return request && ['reset', 'refresh'].includes(request.type) && UUID.test(request.requestId) &&
      (request.accountKey == null || KEY.test(request.accountKey)) &&
      (request.creditId === undefined || opaque(request.creditId));
  }
  recordNotSubmitted(journal, request, outcome = 'notSubmitted', refreshed = false) {
    if (!KEY.test(request.accountKey)) return null;
    const existing = journal.operations.find(item => item.requestId === request.requestId);
    if (existing) return existing;
    const entry = { requestId: request.requestId, idempotencyKey: crypto.randomUUID(), accountKey: request.accountKey,
      creditId: request.creditId ?? null, submitted: false, status: 'complete', outcome, refreshed,
      startedAt: this.now(), updatedAt: this.now() };
    journal.operations.push(entry); this.write(journal); return entry;
  }
  async handle(request) {
    if (!this.validate(request)) return { outcome: 'error', refreshed: false, message: '请求格式无效' };
    if (this.busy) return { outcome: 'busy', refreshed: false, message: '已有操作正在进行' };
    this.busy = true;
    let release, journal, op, client, snapshot;
    try {
      release = this.acquire(); journal = this.load(); client = this.getClient();
      if (!client) throw failure('unavailable');
      // A persisted pending entry might have crossed a process crash. It is
      // unresolved, never an instruction to retry consume.
      for (const previous of journal.operations) if (previous.status === 'pending') { previous.status = 'unconfirmed'; previous.refreshed = false; }
      this.write(journal);
      snapshot = await this.read(client, request.accountKey);
      if (request.type === 'refresh') {
        let previous = journal.operations.find(item => item.requestId === request.requestId);
        if (previous && previous.accountKey !== snapshot._accountKey) throw failure('accountChanged');
        const unresolved = journal.operations.find(item => item.accountKey === snapshot._accountKey && item.status !== 'complete');
        previous = unresolved || previous;
        if (previous && OUTCOMES.has(previous.outcome)) {
          previous.status = 'complete'; previous.refreshed = true; previous.updatedAt = this.now(); this.write(journal);
        }
        if (!previous && request.accountKey) previous = this.recordNotSubmitted(journal, request, 'notSubmitted', true);
        if (previous?.status === 'complete') { previous.refreshed = true; this.write(journal); }
        await this.publishSnapshot(snapshot, journal);
        return { outcome: previous ? (previous.status === 'complete' ? previous.outcome : 'unconfirmed') : 'refreshed', refreshed: true };
      }
      if (!request.accountKey || !snapshot._accountKey) throw failure('identityUnavailable');
      const sameRequest = journal.operations.find(item => item.requestId === request.requestId);
      if (sameRequest) {
        if (sameRequest.accountKey !== request.accountKey || sameRequest.creditId !== (request.creditId ?? null)) throw failure('invalidRequest');
        if (sameRequest.status === 'complete') { sameRequest.refreshed = true; this.write(journal); }
        await this.publishSnapshot(snapshot, journal);
        return { outcome: sameRequest.status === 'complete' ? sameRequest.outcome : 'unconfirmed', refreshed: true };
      }
      const unresolved = journal.operations.find(item => item.accountKey === request.accountKey && item.status !== 'complete');
      if (unresolved) {
        await this.publishSnapshot(snapshot, journal);
        return { outcome: 'unconfirmed', refreshed: true, message: '上次操作结果待确认，请仅刷新状态' };
      }
      const summary = normalizeResetCredits(snapshot, this.now());
      if (summary.availableCount === null) throw failure('unavailable');
      if (summary.availableCount === 0) {
        this.recordNotSubmitted(journal, request, 'noCredit', true);
        await this.publishSnapshot(snapshot, journal); return { outcome: 'noCredit', refreshed: true };
      }
      if (request.creditId !== undefined) {
        const selected = snapshot.rateLimitResetCredits?.credits?.find(row => row?.id === request.creditId);
        if (!selected || selected.status !== 'available' || selected.resetType !== 'codexRateLimits' ||
          !(selected.expiresAt == null || (Number.isSafeInteger(selected.expiresAt) && selected.expiresAt * 1000 > this.now()))) throw failure('creditUnavailable');
      }
      // Check the account once more immediately before the durable intent and
      // write RPC. No network await is inserted between this check and consume.
      const account = await rpc(client, 'account/read', { refreshToken: false }, this.timeoutMs);
      if (this.getClient() !== client || client.accountRevision !== snapshot._accountRevision || deriveAccountKey(account, snapshot) !== request.accountKey) throw failure('accountChanged');
      if (request.creditId !== undefined) {
        const selected = snapshot.rateLimitResetCredits.credits.find(row => row?.id === request.creditId);
        if (selected.expiresAt != null && selected.expiresAt * 1000 <= this.now()) throw failure('creditUnavailable');
      }
      op = { requestId: request.requestId, idempotencyKey: crypto.randomUUID(), accountKey: request.accountKey,
        creditId: request.creditId ?? null, submitted: true, status: 'pending', refreshed: false, startedAt: this.now(), updatedAt: this.now() };
      journal.operations.push(op); this.write(journal); this.activeRequestId = request.requestId;
      // Persist before sending. Publishing pending must not delay the RPC and
      // widen the account-check window. The post-read is always published first
      // before the caller delivers resetResult to the renderer.
      const consume = rpc(client, 'account/rateLimitResetCredit/consume', {
        idempotencyKey: op.idempotencyKey, ...(op.creditId !== null ? { creditId: op.creditId } : {})
      }, this.timeoutMs).then(value => ({ value }), () => ({ failed: true }));
      await this.publishSnapshot(snapshot, journal);
      const settled = await consume;
      if (settled.failed) throw failure('unconfirmed');
      const result = settled.value;
      if (!OUTCOMES.has(result?.outcome)) throw failure('unconfirmed');
      op.outcome = result.outcome; op.status = 'unconfirmed'; op.updatedAt = this.now(); this.write(journal);
      const refreshed = await this.read(client, op.accountKey);
      op.status = 'complete'; op.refreshed = true; op.updatedAt = this.now(); this.write(journal);
      await this.publishSnapshot(refreshed, journal);
      return { outcome: op.outcome, refreshed: true };
    } catch (error) {
      if (op) {
        op.status = 'unconfirmed'; op.refreshed = false; op.updatedAt = this.now();
        try { this.write(journal); } catch {}
        const identityChanged = error.code === 'accountChanged' || !client || this.getClient() !== client || client.accountRevision !== this.lastSnapshot?._accountRevision;
        if (identityChanged) {
          try { await this.publish({ percent: null, tone: 'muted', stale: true, accountKey: null,
            resetCredits: { availableCount: null, cards: [], detailsComplete: false }, resetOperation: null }); } catch {}
        } else if (this.lastSnapshot?._accountKey === op.accountKey) {
          try { await this.publish({ ...this.format(this.lastSnapshot), accountKey: op.accountKey,
            resetCredits: normalizeResetCredits(this.lastSnapshot, this.now()), resetOperation: this.operation(op.accountKey, journal), stale: true }); } catch {}
        }
        return { outcome: 'unconfirmed', refreshed: false, message: '操作结果待确认，请刷新状态；不会自动再次使用卡片' };
      }
      if (journal && request.type === 'reset') {
        const previous = journal.operations.find(item => item.requestId === request.requestId);
        const unresolved = journal.operations.find(item => item.accountKey === request.accountKey && item.status !== 'complete');
        if (unresolved || (previous && previous.submitted !== false)) return { outcome: 'unconfirmed', refreshed: false };
        try {
          const terminal = this.recordNotSubmitted(journal, request);
          if (terminal) {
            if (snapshot?._accountKey === request.accountKey && error.code !== 'accountChanged' && client && this.getClient() === client && client.accountRevision === snapshot._accountRevision) {
              terminal.refreshed = true; this.write(journal);
              await this.publishSnapshot(snapshot, journal);
              return { outcome: 'notSubmitted', refreshed: true, message: '未发送重置请求，已刷新卡片状态' };
            }
            if (this.lastSnapshot?._accountKey === request.accountKey && error.code !== 'accountChanged' && client && this.getClient() === client && client.accountRevision === this.lastSnapshot._accountRevision) {
              await this.publish({ ...this.format(this.lastSnapshot), accountKey: request.accountKey,
                resetCredits: normalizeResetCredits(this.lastSnapshot, this.now()), resetOperation: this.operation(request.accountKey, journal), stale: true });
            }
            return { outcome: 'notSubmitted', refreshed: false, message: '未发送重置请求，请刷新状态后重试' };
          }
        } catch {}
      }
      const outcome = ['busy', 'accountChanged', 'identityUnavailable', 'creditUnavailable'].includes(error.code) ? error.code : 'error';
      return { outcome, refreshed: false, message: outcome === 'accountChanged' ? '账户已改变，请刷新后再操作' : '当前无法完成操作，请刷新状态' };
    } finally { this.activeRequestId = null; this.busy = false; release?.(); }
  }
}

module.exports = { ResetController, ResetCreditDetailsCache, normalizeResetCredits, deriveAccountKey, readConsistentSnapshot };
