'use strict';
// Load templates only: no generated agent main, real socket, App Server or UI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const source = ['cdp-action-session.js', 'renderer-injector.js', 'startup-loops.js'].map(name => fs.readFileSync(path.join(__dirname, name), 'utf8')).join('\n');
const box = { module: { exports: {} }, setTimeout, clearTimeout, setInterval, clearInterval, AbortSignal,
  fetch: () => { throw new Error('Real network forbidden in startup tests'); },
  WebSocket: class { constructor() { throw new Error('Real socket forbidden in startup tests'); } },
  buildBootstrapScript: () => 'MOCK_BOOTSTRAP',
  isMainWindow: target => target.url === 'app://-/index.html' };
vm.runInNewContext(`${source}\nmodule.exports={CdpSession,RendererInjector,createStartupLoops};`, box);
const { CdpSession, RendererInjector, createStartupLoops } = box.module.exports;
const waitForEvent = () => new Promise(resolve => setTimeout(resolve, 65));
const target = { id: 'main', type: 'page', url: 'app://-/index.html', webSocketDebuggerUrl: 'ws://127.0.0.1/mock' };

function fixture({ bodyReady = false, initialContext = true, bindingFailures = 0 } = {}) {
  let pages = [target], discoveryFails = false;
  const sessions = [], log = [];
  const injector = new RendererInjector({ port: 0,
    fetchTargets: async () => { if (discoveryFails) throw new Error('Mock discovery outage'); return { ok: true, json: async () => pages }; },
    createSession: page => {
      const session = new CdpSession(page); session.mockBodyReady = bodyReady; session.mockGeneration = sessions.length;
      session.connect = async () => {
        session.socket = { readyState: 1, close() { this.readyState = 3; } }; session.mainFrameId = 'top';
        if (initialContext) session.contexts.set(1, { id: 1, auxData: { isDefault: true, frameId: 'top' } });
      };
      session.request = async (method, params) => {
        log.push({ generation: session.mockGeneration, method, params });
        if (method === 'Runtime.addBinding' && bindingFailures-- > 0) throw new Error('Mock transient binding failure');
        if (method === 'Runtime.evaluate' && params.expression === 'MOCK_BOOTSTRAP') {
          if (session.delayBootstrap) await session.delayBootstrap;
          return { result: { value: { ready: session.mockBodyReady } } };
        }
        return { result: { value: true } };
      };
      sessions.push(session); return session;
    }
  });
  return { injector, sessions, log, setPages: value => { pages = value; }, failDiscovery: value => { discoveryFails = value; } };
}

(async () => {
  const cold = fixture();
  await cold.injector.update({ percent: 39 });
  await cold.injector.scan();
  assert.equal(cold.injector.sessions.size, 1, 'unfinished DOM retains a connected session');
  assert.equal(cold.sessions[0].rendererReady, false);
  cold.sessions[0].mockBodyReady = true;
  cold.sessions[0].handleEvent({ method: 'Page.domContentEventFired', params: {} });
  await waitForEvent();
  assert.equal(cold.sessions[0].rendererReady, true, 'DOMContentLoaded installs without another periodic scan');
  assert.ok(cold.log.at(-1).params.expression.includes('"percent":39'));

  const session = cold.sessions[0], beforeReload = cold.log.length;
  session.handleEvent({ method: 'Runtime.executionContextsCleared', params: {} });
  await cold.injector.update({ percent: 22 });
  session.handleEvent({ method: 'Runtime.executionContextCreated', params: { context: { id: 2, auxData: { isDefault: true, frameId: 'top' } } } });
  await waitForEvent();
  const replay = cold.log.slice(beforeReload).filter(item => item.method === 'Runtime.evaluate');
  assert.equal(replay[0].params.expression, 'MOCK_BOOTSTRAP');
  assert.ok(replay.at(-1).params.expression.includes('"percent":22'));
  assert.ok(replay.every(item => item.params.contextId === 2), 'replay is pinned to the new default main context');

  cold.failDiscovery(true); await cold.injector.scan();
  assert.equal(cold.injector.sessions.get('main'), session, 'transient /json/list failure keeps a usable session');
  cold.failDiscovery(false);
  session.closed = true; session.onDisconnect(session);
  assert.equal(cold.injector.sessions.size, 0);
  await cold.injector.update({ percent: 17 });
  await cold.injector.scan();
  cold.sessions[1].mockBodyReady = true;
  cold.sessions[1].handleEvent({ method: 'Page.domContentEventFired', params: {} });
  await waitForEvent();
  const reconnect = cold.log.filter(item => item.generation === 1 && item.method === 'Runtime.evaluate');
  assert.equal(reconnect[0].params.expression, 'MOCK_BOOTSTRAP');
  assert.ok(reconnect.at(-1).params.expression.includes('"percent":17'), 'reconnect replays current value after bootstrap');
  cold.injector.stop();

  const missingContext = fixture({ bodyReady: true, initialContext: false });
  await missingContext.injector.scan();
  assert.equal(missingContext.injector.sessions.size, 1);
  missingContext.sessions[0].handleEvent({ method: 'Runtime.executionContextCreated', params: { context: { id: 7, auxData: { isDefault: true, frameId: 'top' } } } });
  await waitForEvent();
  assert.equal(missingContext.sessions[0].rendererReady, true, 'late creation of the main context retries immediately');
  missingContext.injector.stop();

  const bindingRecovery = fixture({ bodyReady: true, bindingFailures: 1 });
  await bindingRecovery.injector.scan();
  assert.equal(bindingRecovery.sessions[0].rendererReady, true);
  assert.equal(bindingRecovery.sessions[0].bindings.has(1), false);
  await bindingRecovery.injector.scan();
  assert.equal(bindingRecovery.sessions.length, 1, 'binding recovery must not require reconnect or navigation');
  assert.equal(bindingRecovery.sessions[0].bindings.has(1), true);
  assert.equal(bindingRecovery.log.filter(item => item.method === 'Runtime.addBinding').length, 2);
  bindingRecovery.injector.stop();

  const staleReconnect = fixture({ bodyReady: true });
  let invalidations = 0, nextRead = 999999;
  staleReconnect.injector.onEmpty = () => {
    invalidations++; nextRead = 0;
    staleReconnect.injector.update({ percent: null, stale: true, accountKey: null,
      resetCredits: { availableCount: null, cards: [], detailsComplete: false } });
  };
  await staleReconnect.injector.update({ percent: 44, stale: false, accountKey: 'old-account', resetCredits: { availableCount: 2 } });
  await staleReconnect.injector.scan();
  staleReconnect.sessions[0].closed = true; staleReconnect.sessions[0].onDisconnect(staleReconnect.sessions[0]);
  assert.equal(invalidations, 1); assert.equal(nextRead, 0);
  staleReconnect.setPages([]); nextRead = 12345;
  await staleReconnect.injector.scan(); await staleReconnect.injector.scan();
  assert.equal(invalidations, 1); assert.equal(nextRead, 12345, 'empty scans do not repeatedly overwrite retry backoff');
  staleReconnect.setPages([target]); await staleReconnect.injector.scan();
  const staleReplay = staleReconnect.log.filter(item => item.generation === 1 && item.method === 'Runtime.evaluate' && item.params.expression !== 'MOCK_BOOTSTRAP');
  assert.ok(staleReplay.at(-1).params.expression.includes('"stale":true'));
  assert.ok(staleReplay.at(-1).params.expression.includes('"accountKey":null'));
  assert.ok(!staleReplay.at(-1).params.expression.includes('old-account'), 'new window never receives the old fresh identity');
  staleReconnect.injector.stop();

  const racing = fixture({ bodyReady: true });
  await racing.injector.update({ percent: 70 });
  await racing.injector.scan();
  let unblock;
  racing.sessions[0].delayBootstrap = new Promise(resolve => { unblock = resolve; });
  const beforeRace = racing.log.length;
  const bootstrap = racing.injector.bootstrap(racing.sessions[0], true);
  let updateFinished = false;
  const update = racing.injector.update({ percent: 16 }).then(() => { updateFinished = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(updateFinished, false, 'publish must wait for bootstrap to replay data before resetResult');
  unblock(); await bootstrap; await update;
  const updates = racing.log.slice(beforeRace).filter(item => item.method === 'Runtime.evaluate' && item.params.expression !== 'MOCK_BOOTSTRAP');
  assert.equal(updates.length, 1); assert.ok(updates[0].params.expression.includes('"percent":16'), 'data arriving during bootstrap is not overwritten by cached data');
  racing.injector.stop();

  const callbacks = new Map(); let scanCount = 0, readCount = 0, auxiliaryCount = 0, releaseAux;
  const slowAux = new Promise(resolve => { releaseAux = resolve; });
  const loops = createStartupLoops({
    scan: async () => { scanCount++; }, readUsage: () => { readCount++; },
    refreshAuxiliary: async () => { auxiliaryCount++; await slowAux; },
    setEvery: (callback, ms) => { callbacks.set(ms, callback); return ms; }, clearEvery: ms => callbacks.delete(ms)
  });
  await loops.start();
  assert.equal(scanCount, 1); assert.equal(auxiliaryCount, 1);
  await callbacks.get(1000)(); await callbacks.get(1000)(); await callbacks.get(5000)();
  assert.equal(scanCount, 3); assert.equal(readCount, 3); assert.equal(auxiliaryCount, 1, 'slow auxiliary job never blocks scan and never overlaps itself');
  releaseAux(); loops.stop(); assert.equal(callbacks.size, 0);

  // Validate the builder's actual AppServer patch using fake stdio and readline.
  // This path is supplied for a /tmp dry-build or defaults to the final package.
  const assembledPath = process.env.BADGE_STARTUP_AGENT || path.resolve(__dirname, '../../outputs/CodexAvatarQuota/agent.cjs');
  const assembled = fs.readFileSync(assembledPath, 'utf8');
  const classSource = assembled.slice(assembled.indexOf('class AppServerClient '), assembled.indexOf('function installUsageBadge()'));
  const child = new EventEmitter(); child.stdin = new EventEmitter(); child.stdin.writable = true;
  child.stdin.write = () => {}; child.stderr = { resume() {} }; child.kill = () => { child.killed = true; };
  const lines = new EventEmitter(); lines.close = () => {};
  let accountReads = 0;
  const accountBox = { module: { exports: {} }, process: { env: {} }, AGENT_VERSION: 'mock',
    setTimeout, clearTimeout,
    require(name) {
      if (name === 'node:events') return { EventEmitter };
      if (name === 'node:child_process') return { spawn: () => child };
      if (name === 'node:readline') return { createInterface: () => lines };
      throw new Error(`Unexpected dependency ${name}`);
    },
    readConsistentSnapshot: async () => { if (++accountReads === 1) throw new Error('Mock first-read timeout'); return { rateLimits: {} }; }
  };
  vm.runInNewContext(`${classSource}\nmodule.exports=AppServerClient;`, accountBox);
  const client = new accountBox.module.exports();
  client.request = async method => { assert.equal(method, 'initialize'); return {}; };
  await assert.rejects(client.start(), /Mock first-read timeout/);
  assert.equal(client.initialized, true); assert.equal(client.badgeReady, true);
  await client.refresh(); assert.equal(accountReads, 2); assert.equal(client.badgeReady, true);
  client.stop(); assert.equal(client.initialized, false); assert.equal(client.badgeReady, false);
  console.log('PASS: early DOM, late default context, event-driven reload, transient discovery, disconnect/reconnect current-value order, bootstrap/update race, independent startup scan cadence');
})().catch(error => { console.error(error); process.exitCode = 1; });
