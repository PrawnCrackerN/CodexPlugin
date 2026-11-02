class RendererInjector {
  constructor({ port, fetchTargets = fetch, createSession = target => new CdpSession(target), now = Date.now }) {
    Object.assign(this, { port, fetchTargets, createSession, now });
    this.sessions = new Map(); this.currentValue = null; this.scanning = false; this.stopped = false;
    this.bootstrapTasks = new Map(); this.lastBootstrap = new WeakMap(); this.valueRevision = 0;
    this.onEmpty = null;
  }
  async bootstrap(session, force = false) {
    if (this.stopped || !session.isOpen() || ![...this.sessions.values()].includes(session)) return;
    const contextId = session.mainContextId();
    if (contextId === null) return;
    const running = this.bootstrapTasks.get(session);
    if (running) { if (force) running.again = true; return running.promise; }
    const onlyBinding = !force && session.rendererReady && this.now() - (this.lastBootstrap.get(session) ?? 0) < 5000;
    const task = { again: false, promise: null };
    task.promise = (async () => {
      try {
        // A transient addBinding failure must recover on an ordinary scan even
        // when the same document and its already-visible renderer stay alive.
        await session.installBinding(contextId);
        if (this.stopped || !session.isMainContext(contextId) || session.mainContextId() !== contextId) return;
        if (onlyBinding) { await this.sendCurrentValue(session, contextId); return; }
        const result = await session.evaluate(buildBootstrapScript(), contextId);
        if (this.stopped || !session.isMainContext(contextId) || session.mainContextId() !== contextId) return;
        session.rendererReady = result?.result?.value?.ready === true;
        if (!session.rendererReady) return; // DOM is still being created; keep the live session.
        this.lastBootstrap.set(session, this.now());
        await this.sendCurrentValue(session, contextId);
      } catch {
        session.rendererReady = false;
        // A transient document/context replacement is not a socket failure.
        if (!session.isOpen()) this.removeSession(session);
      } finally {
        this.bootstrapTasks.delete(session);
        if (task.again && !this.stopped && session.isOpen()) session.notifyReady();
      }
    })();
    this.bootstrapTasks.set(session, task);
    return task.promise;
  }
  async sendCurrentValue(session, contextId = session.mainContextId()) {
    if (!this.currentValue || !session.rendererReady || contextId === null || this.stopped) return;
    // Capture the latest value only after installation, then repeat if an update
    // arrived while it was in flight. Never replay a pre-bootstrap snapshot.
    let revision;
    do {
      revision = this.valueRevision;
      await session.evaluate(`window.__codexUsageBadge?.update(${JSON.stringify(this.currentValue)})`, contextId);
    } while (!this.stopped && session.rendererReady && session.isMainContext(contextId) && revision !== this.valueRevision);
  }
  removeSession(session) {
    const previouslyConnected = this.sessions.size > 0;
    for (const [id, current] of this.sessions) if (current === session) this.sessions.delete(id);
    session.onReady = null; session.onDisconnect = null; session.close();
    if (previouslyConnected && this.sessions.size === 0 && !this.stopped) this.onEmpty?.();
  }
  async scan() {
    if (this.scanning || this.stopped) return;
    this.scanning = true;
    try {
      const response = await this.fetchTargets(`http://127.0.0.1:${this.port}/json/list`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error('CDP unavailable');
      const pages = (await response.json()).filter(target => target.type === 'page' && isMainWindow(target) && typeof target.webSocketDebuggerUrl === 'string');
      const live = new Set(pages.map(target => target.id));
      for (const [id, session] of this.sessions) if (!live.has(id) || !session.isOpen()) this.removeSession(session);
      await Promise.all(pages.map(async target => {
        let session = this.sessions.get(target.id);
        if (session && session.target.webSocketDebuggerUrl !== target.webSocketDebuggerUrl) { this.removeSession(session); session = null; }
        const existing = !!session;
        session ||= this.createSession(target);
        session.onAction = this.actionHandler;
        session.onReady = current => this.bootstrap(current, true);
        session.onDisconnect = current => { if (!current.isOpen()) this.removeSession(current); };
        try {
          if (!existing) {
            await session.connect();
            if (this.stopped) { session.close(); return; }
            this.sessions.set(target.id, session);
          }
          await this.bootstrap(session);
        } catch { this.removeSession(session); }
      }));
    } catch {
      // Discovery can briefly fail while Electron is creating a window. Keep
      // usable sessions and the ready App Server; disconnected sockets are gone.
      for (const session of this.sessions.values()) if (!session.isOpen()) this.removeSession(session);
    } finally { this.scanning = false; }
  }
  async update(value) {
    this.currentValue = value; this.valueRevision++;
    await Promise.all([...this.sessions.values()].map(async session => {
      const pending = this.bootstrapTasks.get(session);
      if (pending) { await pending.promise; return; } // Await latest-data replay before resetResult.
      try { await this.sendCurrentValue(session); }
      catch { session.rendererReady = false; if (!session.isOpen()) this.removeSession(session); else session.notifyReady(); }
    }));
  }
  stop() { this.stopped = true; for (const session of [...this.sessions.values()]) this.removeSession(session); }
}
