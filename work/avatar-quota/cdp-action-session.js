class CdpSession {
  constructor(target) {
    this.target = target; this.pending = new Map(); this.serial = 0; this.socket = null;
    this.contexts = new Map(); this.bindings = new Set(); this.bindingTasks = new Map(); this.mainFrameId = null; this.onAction = null;
    this.onReady = null; this.onDisconnect = null; this.readyTimer = null; this.rendererReady = false; this.closed = false;
  }
  isMainContext(id) {
    const context = this.contexts.get(id);
    return !!(isMainWindow(this.target) && this.mainFrameId && context?.auxData?.isDefault === true && context.auxData.frameId === this.mainFrameId);
  }
  mainContextId() { return [...this.contexts.keys()].reverse().find(id => this.isMainContext(id)) ?? null; }
  isOpen() { return !this.closed && this.socket?.readyState === 1; }
  notifyReady() {
    if (this.closed || this.readyTimer !== null) return;
    this.readyTimer = setTimeout(() => {
      this.readyTimer = null;
      if (this.isOpen() && this.mainContextId() !== null) Promise.resolve(this.onReady?.(this)).catch(() => {});
    }, 25);
  }
  async installBinding(id) {
    if (!this.isMainContext(id) || this.bindings.has(id)) return;
    if (this.bindingTasks.has(id)) return this.bindingTasks.get(id);
    const context = this.contexts.get(id);
    const task = this.request('Runtime.addBinding', { name: '__codexUsageBadgeAction', executionContextId: id })
      .then(() => { if (this.contexts.get(id) === context && this.isMainContext(id)) { this.bindings.add(id); this.notifyReady(); } })
      .catch(() => {})
      .finally(() => { if (this.bindingTasks.get(id) === task) this.bindingTasks.delete(id); });
    this.bindingTasks.set(id, task);
    return task;
  }
  handleEvent(message) {
    const params = message.params;
    if (message.method === 'Runtime.executionContextCreated' && params?.context) {
      this.contexts.set(params.context.id, params.context);
      this.installBinding(params.context.id).catch(() => {});
    } else if (message.method === 'Runtime.executionContextDestroyed') {
      if (this.isMainContext(params?.executionContextId)) this.rendererReady = false;
      this.contexts.delete(params?.executionContextId); this.bindings.delete(params?.executionContextId); this.bindingTasks.delete(params?.executionContextId);
    } else if (message.method === 'Runtime.executionContextsCleared') {
      this.rendererReady = false;
      this.contexts.clear(); this.bindings.clear(); this.bindingTasks.clear();
    } else if (message.method === 'Page.frameNavigated' && params?.frame && !params.frame.parentId) {
      this.mainFrameId = params.frame.id;
      // Revalidate the actual top-frame URL, not just a scan's old target URL.
      this.target = { ...this.target, url: params.frame.url };
      this.rendererReady = false;
      for (const id of this.contexts.keys()) this.installBinding(id).catch(() => {});
      this.notifyReady();
    } else if (message.method === 'Page.domContentEventFired' || message.method === 'Page.loadEventFired') {
      this.notifyReady();
    } else if (message.method === 'Runtime.bindingCalled' && params?.name === '__codexUsageBadgeAction' &&
      this.isMainContext(params.executionContextId) && this.bindings.has(params.executionContextId) &&
      typeof params.payload === 'string' && params.payload.length <= 8192) {
      let request; try { request = JSON.parse(params.payload); } catch { return; }
      Promise.resolve(this.onAction?.(this, request, params.executionContextId)).catch(() => {});
    }
  }
  async connect() {
    this.closed = false;
    const url = new URL(this.target.webSocketDebuggerUrl);
    if (url.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('CDP must use loopback');
    const ws = new WebSocket(url); this.socket = ws;
    ws.addEventListener('message', event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (!Object.hasOwn(message, 'id')) { this.handleEvent(message); return; }
      const pending = this.pending.get(message.id); if (!pending) return;
      this.pending.delete(message.id); clearTimeout(pending.timer);
      message.error || message.result?.exceptionDetails ? pending.reject(new Error('CDP evaluation failed')) : pending.resolve(message.result);
    });
    const disconnected = () => { this.closed = true; this.rendererReady = false; this.rejectPending(); this.onDisconnect?.(this); };
    ws.addEventListener('close', disconnected);
    ws.addEventListener('error', disconnected);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.close(); reject(new Error('CDP handshake timed out')); }, 4000);
      const finish = callback => { clearTimeout(timer); callback(); };
      ws.addEventListener('open', () => finish(resolve), { once: true });
      ws.addEventListener('error', () => finish(() => reject(new Error('CDP unavailable'))), { once: true });
      ws.addEventListener('close', () => finish(() => reject(new Error('CDP closed'))), { once: true });
    });
    await this.request('Page.enable');
    const tree = await this.request('Page.getFrameTree');
    this.mainFrameId = tree?.frameTree?.frame?.id ?? null;
    if (tree?.frameTree?.frame?.url) this.target = { ...this.target, url: tree.frameTree.frame.url };
    await this.request('Runtime.enable');
    await Promise.all([...this.contexts.keys()].map(id => this.installBinding(id)));
    this.notifyReady();
  }
  request(method, params = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP disconnected'));
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP request timed out')); }, 5000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.socket.send(JSON.stringify({ id, method, params })); }
      catch (error) { this.pending.delete(id); clearTimeout(timer); reject(error); }
    });
  }
  evaluate(expression, contextId = this.mainContextId()) {
    if (contextId === null || !this.isMainContext(contextId)) return Promise.reject(new Error('Default main context not ready'));
    return this.request('Runtime.evaluate', { expression, contextId, returnByValue: true, awaitPromise: true });
  }
  async deliverResetResult(requestId, result, contextId) {
    if (!this.isMainContext(contextId)) return;
    await this.request('Runtime.evaluate', { expression: `window.__codexUsageBadge?.resetResult?.(${JSON.stringify(requestId)},${JSON.stringify(result)})`,
      contextId, returnByValue: true, awaitPromise: true });
  }
  rejectPending() {
    clearTimeout(this.readyTimer); this.readyTimer = null;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('CDP disconnected')); }
    this.pending.clear(); this.contexts.clear(); this.bindings.clear(); this.bindingTasks.clear();
  }
  close() { this.closed = true; this.rendererReady = false; this.rejectPending(); this.socket?.close(); this.socket = null; }
}
