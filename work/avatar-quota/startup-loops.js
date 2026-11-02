function createStartupLoops({ scan, readUsage, refreshAuxiliary, onError = () => {}, setEvery = setInterval, clearEvery = clearInterval }) {
  let stopped = false, scanning = false, auxiliaryBusy = false, scanTimer, auxiliaryTimer;
  const scanOnce = async () => {
    if (stopped || scanning) return;
    scanning = true;
    try {
      await scan();
      if (!stopped) Promise.resolve(readUsage()).catch(onError);
    } catch (error) { onError(error); }
    finally { scanning = false; }
  };
  const auxiliaryOnce = async () => {
    if (stopped || auxiliaryBusy) return;
    auxiliaryBusy = true;
    try { await refreshAuxiliary(); } catch (error) { onError(error); }
    finally { auxiliaryBusy = false; }
  };
  return {
    async start() {
      scanTimer = setEvery(scanOnce, 1000);
      auxiliaryTimer = setEvery(auxiliaryOnce, 5000);
      await scanOnce();
      if (!stopped) auxiliaryOnce();
    },
    stop() { stopped = true; clearEvery(scanTimer); clearEvery(auxiliaryTimer); }
  };
}
