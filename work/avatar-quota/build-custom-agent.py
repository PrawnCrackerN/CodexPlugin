from pathlib import Path
import shutil

root = Path(__file__).resolve().parent
source = (root / 'original-agent.cjs').read_text()
def replace_once(old, new):
    global source
    assert source.count(old) == 1, f'Expected one source anchor: {old[:90]!r}'
    source = source.replace(old, new, 1)

replace_once('"use strict";', '"use strict";\nconst { ResetController, normalizeResetCredits, deriveAccountKey, readConsistentSnapshot } = require("./reset-controller.cjs");')
renderer = (root / 'install-usage-badge.js').read_text().strip()
assert renderer.startswith('function installUsageBadge()')
start = source.index('function installUsageBadge() {')
end = source.index('\nfunction installProjectColors()', start)
source = source[:start] + renderer + '\n' + source[end:]
needle = "return {percent, windowLabel: window && weekly(window) ? '周' : '', tone:quotaTone(percent),"
replacement = """return {percent, windowLabel: window && weekly(window) ? '周' : '', tone:quotaTone(percent),
    planType: plan,
    resetsAt: Number.isFinite(window?.resetsAt) && window.resetsAt > 0 ? window.resetsAt : null,
    windowDurationMins: Number.isFinite(window?.windowDurationMins) && window.windowDurationMins > 0 ? window.windowDurationMins : null,
    usedPercent: validWindow(window) ? Math.max(0, Math.min(100, window.usedPercent)) : null,"""
assert source.count(needle) == 1
source = source.replace(needle, replacement)
needle = "return { key, label, percent, tone,"
replacement = """return { key, label, percent, tone,
      resetsAt: Number.isFinite(window?.resetsAt) && window.resetsAt > 0 ? window.resetsAt : null,
      windowDurationMins: Number.isFinite(window?.windowDurationMins) && window.windowDurationMins > 0 ? window.windowDurationMins : null,
      usedPercent: validWindow(window) ? Math.max(0, Math.min(100, window.usedPercent)) : null,"""
assert source.count(needle) == 1
source = source.replace(needle, replacement)

# Retain authoritative count/null semantics in both the structured renderer data
# and the original plain-text title. Detail lists can be capped by the server.
start = source.index('function formatResetCredits(response) {')
end = source.index('\nfunction formatPrimaryRateLimits(response)', start)
source = source[:start] + '''function formatResetCredits(response) {
  const summary = normalizeResetCredits(response);
  if (summary.availableCount === null) return ['重置卡：暂不可用'];
  const expiry = formatResetTime(summary.cards.map(card => card.expiresAt).filter(value => Number.isFinite(value)).sort((a,b) => a-b)[0]);
  return [`重置卡：${summary.availableCount} 张可用`, ...(summary.availableCount > 0 && expiry ? [`最近到期：${expiry}`] : [])];
}
''' + source[end:]
replace_once('  const single = formatPrimaryRateLimits(response);', '''  const single = formatPrimaryRateLimits(response);
  single.resetCredits = normalizeResetCredits(response);
  single.accountKey = typeof response?._accountKey === 'string' ? response._accountKey : null;''')
replace_once("return { ...current, percent: null, title, tone: 'muted', stale: true,", "return { ...current, percent: null, title, tone: 'muted', stale: true, accountKey: null,")

# App Server remains stdio only; no new HTTP endpoint or credential provider.
replace_once('this.child=null; this.lines=null; this.pending=new Map(); this.serial=0; this.rateLimits=null;',
             'this.child=null; this.lines=null; this.pending=new Map(); this.serial=0; this.rateLimits=null; this.accountRevision=0; this.badgeReady=false; this.initialized=false;')
replace_once('''      } else if(message.method==='account/rateLimits/updated') {
        this.rateLimits=mergeRateLimitsResponse(this.rateLimits,message.params);
        this.emit('rate-limits',this.rateLimits);
      }''', '''      } else if(message.method==='account/updated') {
        this.accountRevision++;
        this.rateLimits=null;
        this.emit('rate-limits-dirty', 'account');
      } else if(message.method==='account/rateLimits/updated') {
        // Notifications are deltas; verify account and obtain a fresh full
        // snapshot before re-enabling any earned-reset action.
        this.emit('rate-limits-dirty', 'limits');
      }''')
replace_once("this.rateLimits=mergeRateLimitsResponse(null,await this.request('account/rateLimits/read'));",
             'this.rateLimits=await readConsistentSnapshot(this);')
replace_once("    this.child?.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\\n');", "    this.child?.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\\n');\n    this.initialized=true; this.badgeReady=true;")
replace_once('    const child=this.child; this.child=null;', '    const child=this.child; this.child=null; this.initialized=false; this.badgeReady=false;')

# The template accepts binding events only from the default top frame of an
# allowed main app target. It never installs a binding in isolated worlds.
start = source.index('class CdpSession {')
end = source.index('\nclass RendererInjector {', start)
source = source[:start] + (root / 'cdp-action-session.js').read_text().rstrip() + source[end:]
start = source.index('class RendererInjector {')
end = source.index('\nconst resolverFs =', start)
source = source[:start] + (root / 'renderer-injector.js').read_text().rstrip() + '\n' + source[end:]
start = source.index('function buildBootstrapScript() {')
end = source.index('\nclass CdpSession {', start)
source = source[:start] + '''function buildBootstrapScript() {
  const installers = [installUsageBadge,installProjectColors,installProjectSizes,installThreadTokens]
    .map(fn => `try { (${fn.toString()})(); } catch {}`).join('\\n');
  return `(() => { if (!document.documentElement || !document.body) return {ready:false};
    ${installers}
    return {ready: !!window.__codexUsageBadge?.status}; })()`;
}
''' + source[end:]
replace_once('async function main() {', (root / 'startup-loops.js').read_text().rstrip() + '\n\nasync function main() {')

replace_once('''  let refreshingProjectSizes = false;
  injector.currentValue''', '''  let refreshingProjectSizes = false;
  let mainAbsentSince = null;
  const resetController = new ResetController({
    getClient: () => client?.badgeReady && !pending ? client : null,
    publish: value => injector.update(value), format: formatRateLimits,
    journalPath: require('node:path').join(__dirname, 'reset-operations.json')
  });
  injector.onEmpty = () => {
    // Invalidate once on the last-window disconnect, not on every empty scan.
    // Keep the stdio client alive during the grace interval, but never replay
    // its old identity or reset cards as fresh into a newly created window.
    nextRead = 0;
    injector.update({ ...unavailableValue(injector.currentValue), accountKey: null,
      resetCredits: { availableCount: null, cards: [], detailsComplete: false }, resetOperation: null }).catch(() => {});
  };
  injector.actionHandler = async (session, request, contextId) => {
    if (!resetController.validate(request)) return;
    const result = await resetController.handle(request);
    await session.deliverResetResult(request.requestId, result, contextId);
  };
  injector.currentValue''')
replace_once("log('主窗口连接正常，进度条已注入。');", "log('主窗口连接已建立，界面就绪后自动挂载。');")
replace_once('''    if (injector.sessions.size === 0) {
      const old = client; client = null; old?.stop();
      nextRead = 0;
      injector.currentValue = unavailableValue(injector.currentValue);
    }''', '''    if (injector.sessions.size > 0) mainAbsentSince = null;
    else {
      mainAbsentSince ??= Date.now();
      // Window/document construction may briefly hide all targets. Preserve the
      // initialized App Server across that gap and any in-flight reset/read.
      if (client && Date.now() - mainAbsentSince >= 15000 && !pending && !resetController.busy) {
        const old = client; client = null; old?.stop();
        nextRead = 0;
        injector.currentValue = unavailableValue(injector.currentValue);
      }
    }''')
replace_once('if (stopped || pending || Date.now() < nextRead || injector.sessions.size === 0) return;',
             'if (stopped || pending || resetController.busy || Date.now() < nextRead || injector.sessions.size === 0) return;')
replace_once("injector.update({ ...formatRateLimits(data), updatedAt: Date.now(), stale: false }).catch(() => {});",
             'resetController.publishSnapshot(data).catch(() => injector.update(unavailableValue(injector.currentValue)).catch(() => {}));')
replace_once("        current.on('server-exit', () => {", '''        current.on('rate-limits-dirty', reason => {
          if (client !== current || stopped) return;
          nextRead = 0;
          if (reason === 'account') {
            injector.update({ ...unavailableValue(injector.currentValue), accountKey: null,
              resetCredits: { availableCount: null, cards: [], detailsComplete: false }, resetOperation: null }).catch(() => {});
          } else {
            injector.update({ ...injector.currentValue, stale: true }).catch(() => {});
          }
        });
        current.on('server-exit', () => {''')
replace_once('''        await current.start();
        if (stopped) current.stop();''', '''        await current.start();
        current.badgeReady = true;
        if (stopped) current.stop();''')
replace_once('''      const old = client;
      client = null;
      old?.stop();
      failures++;''', '''      const old = client;
      // A rate-limit read timeout does not invalidate an initialized stdio
      // session. Keep it so a retry does not repeat the startup/auth handshake.
      if (!old?.initialized || !old.child?.stdin.writable) { client = null; old?.stop(); }
      failures++;''')
replace_once('nextRead = Date.now() + Math.min(60000, 10000 * failures);',
             'nextRead = Date.now() + ([1000, 3000, 10000][failures - 1] ?? 30000);')
start = source.index('  const tick = async () => {')
end = source.index('  let stopTimer = null;', start)
source = source[:start] + '''  const startupLoops = createStartupLoops({
    scan, readUsage,
    refreshAuxiliary: async () => { await refreshThreadTokens(injector, tokenReader); await updateProjectSizes(); },
    onError: () => { if (!stopped) log('后台刷新暂不可用，等待下次重试。'); }
  });
''' + source[end:]
replace_once('    clearInterval(timer);', '    startupLoops.stop();')
replace_once('  await guardedTick();', '  await startupLoops.start();')
replace_once("var AGENT_VERSION = '0.9.4';", "var AGENT_VERSION = '0.9.4-avatar-meteor.3';")
# Export transport-independent pieces for mock testing without running main.
replace_once('  buildBootstrapScript, formatRateLimits, mergeRateLimitsResponse, isMainWindow, resolveCodexBin, AppServerClient, main };',
             '  buildBootstrapScript, formatRateLimits, mergeRateLimitsResponse, isMainWindow, resolveCodexBin, AppServerClient, CdpSession, RendererInjector, createStartupLoops, ResetController, normalizeResetCredits, deriveAccountKey, main };')
out = root.parent.parent / 'outputs' / 'CodexAvatarQuota' / 'agent.cjs'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(source)
shutil.copyfile(root / 'reset-controller.cjs', out.parent / 'reset-controller.cjs')
print(out)
manage = (root / 'original-manage.cjs').read_text()
assert manage.count('r.status.version===46') == 1
manage = manage.replace('r.status.version===46', 'r.status.version===1049')
(out.parent / 'manage.cjs').write_text(manage)
