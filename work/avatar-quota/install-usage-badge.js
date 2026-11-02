function installUsageBadge() {
  const VERSION = 1049;
  const KEY = '__codexUsageBadge';
  if (window[KEY]?.version === VERSION) { window[KEY].place(); return; }
  window[KEY]?.destroy?.();
  const NS = 'http://www.w3.org/2000/svg';
  const root = document.createElement('div');
  root.id = 'codex-usage-badge';
  root.dataset.phase = 'idle';
  root.dataset.tone = 'muted';
  root.innerHTML = `
    <svg class="mq-ring" viewBox="0 0 64 64" role="img" aria-label="正在读取额度">
      <circle class="mq-ring-track" cx="32" cy="32" r="26"></circle>
      <circle class="mq-ring-value" cx="32" cy="32" r="26" pathLength="100" transform="rotate(-90 32 32)"></circle>
      <circle class="mq-ring-dot" cx="32" cy="6" r="2.1"></circle>
    </svg>
    <div class="mq-panel-hit" aria-hidden="true">
      <div class="mq-panel" id="codex-usage-tooltip" role="region" aria-label="Codex 额度与重置卡">
        <div class="mq-content">
          <div class="mq-heading"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3ZM20 2v4M18 4h4"/></svg><span class="mq-window">额度状态</span></span><span class="mq-plan" hidden></span></div>
          <div class="mq-hero"><span class="mq-quota">—</span><span class="mq-percent">%</span></div>
          <div class="mq-caption"><span>剩余可用</span><span class="mq-used">已使用 —</span></div>
          <div class="mq-rule"></div>
          <div class="mq-reset"><span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6h5"/></svg>距离下次重置</span><strong class="mq-days">—</strong></div>
          <div class="mq-time-rail" role="img" aria-label="重置周期暂不可用"><span class="mq-time-used"></span><span class="mq-time-now"></span></div>
          <div class="mq-time-labels"><span>周期开始</span><span>重置</span></div>
          <div class="mq-credit" aria-label="额度重置卡">
            <div class="mq-credit-row"><span class="mq-credit-label">额度重置卡</span><div class="mq-tokens" role="group" aria-label="可用重置卡"></div><span class="mq-credit-count"></span></div>
            <div class="mq-token-popover" id="codex-reset-credit" role="dialog" aria-modal="false" aria-label="重置卡详情" hidden>
              <button class="mq-ribbon" type="button"><span class="mq-ribbon-copy"><span class="mq-ribbon-title">暂未获取到期时间</span><span class="mq-ribbon-detail" hidden></span></span><svg class="mq-ribbon-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11a2 2 0 0 0-2 2c0 3.1-.4 5.6-1.3 8M14 13c0 3.5-.4 6.2-1 8M6 18c.5-1.7.6-3.2.6-5a5.4 5.4 0 0 1 10.8 0c0 3-.2 5.4-.8 8M3.5 13a8.5 8.5 0 0 1 17 0M5.5 5.2a10.5 10.5 0 0 1 13 0"/></svg><svg class="mq-ribbon-edge" aria-hidden="true"><path pathLength="100"></path></svg></button>
            </div>
          </div>
          <div class="mq-source">正在读取真实额度</div>
          <span class="mq-action-status" role="status" aria-live="polite"></span>
        </div>
      </div>
    </div>
    <svg class="mq-effects" aria-hidden="true"><path class="mq-outline" pathLength="100"></path><g class="mq-particles"></g></svg>`;
  const style = document.createElement('style');
  style.id = 'codex-usage-badge-style';
  style.textContent = `
    #codex-usage-badge{--mq-accent:light-dark(#36926a,#91e3b8);--mq-core:light-dark(#216347,#e6ffef);--mq-muted:light-dark(#6a7d97,#a7b9d3);--mq-line:light-dark(#dce5f2,#354c6b);--mq-card:light-dark(#fcfdff,#17263d);position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.45;color:light-dark(#26354a,#eaf1fc);text-align:left}
    #codex-usage-badge[data-tone="warning"]{--mq-accent:light-dark(#a97e2b,#e3c781);--mq-core:light-dark(#755317,#fff4d6)}
    #codex-usage-badge[data-tone="danger"]{--mq-accent:light-dark(#bd5a4a,#efac9c);--mq-core:light-dark(#8e382d,#ffe8e1)}
    #codex-usage-badge[data-tone="muted"]{--mq-accent:light-dark(#87918c,#97a19c);--mq-core:light-dark(#68716c,#d0d7d2)}
    #codex-usage-badge[hidden],#codex-usage-badge [hidden]{display:none!important}
    #codex-usage-badge .mq-ring{position:absolute;overflow:visible;pointer-events:none}
    #codex-usage-badge .mq-ring-track{fill:none;stroke:var(--mq-line);stroke-width:1.7}
    #codex-usage-badge[data-empty="true"] .mq-ring-track{stroke:var(--mq-accent);opacity:.3}
    #codex-usage-badge .mq-ring-value{fill:none;stroke:var(--mq-accent);stroke-width:2.4;stroke-linecap:round}
    #codex-usage-badge .mq-ring-dot{fill:var(--mq-accent)}
    #codex-usage-badge .mq-panel-hit{position:absolute;width:350px;height:360px;pointer-events:none}
    #codex-usage-badge .mq-panel{position:absolute;inset:0;background:linear-gradient(140deg,light-dark(#edf4fd,#20334f),var(--mq-card) 65%);border-radius:25px;box-shadow:0 20px 50px light-dark(#24457518,#00000055);clip-path:inset(100% 0 0 0 round 25px);opacity:0;transition:clip-path 400ms cubic-bezier(.2,.8,.2,1),opacity 160ms ease}
    #codex-usage-badge[data-phase="assembling"] .mq-panel,#codex-usage-badge[data-phase="open"] .mq-panel{clip-path:inset(-60px -60px -60px -60px round 25px);opacity:1}
    #codex-usage-badge[data-phase="open"] .mq-panel-hit{pointer-events:auto}
    #codex-usage-badge .mq-content{position:relative;padding:22px 24px;box-sizing:border-box;height:100%;opacity:0;transform:translateY(8px);transition:transform 250ms ease,opacity 200ms ease}
    #codex-usage-badge[data-phase="open"] .mq-content{opacity:1;transform:translateY(0)}
    #codex-usage-badge .mq-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--mq-muted);font-size:13px}
    #codex-usage-badge .mq-heading>span:first-child{display:flex;align-items:center;gap:7px}
    #codex-usage-badge .mq-heading svg,#codex-usage-badge .mq-reset svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
    #codex-usage-badge .mq-plan{font-size:11px;letter-spacing:.15em;padding:3px 7px;border-radius:6px;background:light-dark(#e6eefb,#2b405f);color:var(--mq-muted)}
    #codex-usage-badge .mq-hero{display:flex;align-items:baseline;gap:5px;margin-top:12px;font-variant-numeric:tabular-nums}
    #codex-usage-badge .mq-quota{font-size:62px;letter-spacing:-.06em;font-weight:500;line-height:1.05}
    #codex-usage-badge .mq-percent{font-size:24px;font-weight:400}
    #codex-usage-badge .mq-caption{display:flex;justify-content:space-between;gap:12px;color:var(--mq-muted);font-size:12px;margin-top:6px}
    #codex-usage-badge .mq-rule{height:1px;background:var(--mq-line);margin:18px 0 17px}
    #codex-usage-badge .mq-reset{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px}
    #codex-usage-badge .mq-reset>span{color:var(--mq-muted);display:flex;align-items:center;gap:6px;white-space:nowrap}
    #codex-usage-badge .mq-reset strong{font-size:18px;font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums}
    #codex-usage-badge .mq-time-rail{margin-top:16px;position:relative;height:2px;background:var(--mq-line);border-radius:2px}
    #codex-usage-badge .mq-time-used{display:block;width:0;height:2px;background:var(--mq-muted);opacity:.55}
    #codex-usage-badge .mq-time-now{position:absolute;left:0;top:-2px;width:6px;height:6px;border-radius:50%;background:var(--mq-muted);transform:translateX(-50%)}
    #codex-usage-badge .mq-time-labels{display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--mq-muted)}
    #codex-usage-badge .mq-source{margin-top:10px;font-size:11px;color:var(--mq-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#codex-usage-badge .mq-credit{position:relative;margin-top:15px;padding-top:12px;border-top:1px solid var(--mq-line)}
#codex-usage-badge .mq-credit-row{display:flex;align-items:center;gap:8px;min-height:32px}
#codex-usage-badge .mq-credit-label{font-size:12px;color:var(--mq-muted);white-space:nowrap}
#codex-usage-badge .mq-tokens{display:flex;align-items:center;gap:3px}
#codex-usage-badge .mq-token{display:inline-flex;align-items:center;justify-content:center;width:28px;height:32px;border:0;border-radius:8px;background:light-dark(#e6eefb,#2b4265);color:light-dark(#577dad,#b9d0f1);padding:0}
#codex-usage-badge .mq-token svg{width:17px;height:17px}
#codex-usage-badge .mq-token:hover,#codex-usage-badge .mq-token[aria-expanded="true"]{background:light-dark(#d8e6fa,#36527a)}
#codex-usage-badge .mq-token:disabled{opacity:.55;cursor:default}
#codex-usage-badge .mq-credit-count{margin-left:auto;font-size:11px;color:var(--mq-muted);white-space:nowrap}
#codex-usage-badge .mq-credit-empty{font-size:11px;color:var(--mq-muted);white-space:nowrap}
#codex-usage-badge .mq-credit-unknown{font:inherit;font-size:11px;color:var(--mq-muted);border:0;background:transparent;padding:4px 0;min-height:28px;white-space:nowrap}
#codex-usage-badge .mq-token-popover{position:absolute;right:0;bottom:calc(100% + 8px);z-index:9;width:292px;max-width:100%;box-sizing:border-box}
#codex-usage-badge .mq-token-popover:after{content:"";position:absolute;left:0;right:0;bottom:-24px;height:26px}
#codex-usage-badge .mq-ribbon{position:relative;display:flex;align-items:center;gap:12px;width:100%;height:60px;box-sizing:border-box;padding:12px 22px;border:1px solid light-dark(#b8cdec,#536f96);border-radius:999px;background:linear-gradient(112deg,light-dark(#dce8fb,#294568),light-dark(#edf4ff,#35527a) 62%,light-dark(#e1ecfc,#2a4568));color:light-dark(#315985,#d7e8ff);text-align:left;font:inherit;box-shadow:0 9px 24px light-dark(#264b791f,#00000055),inset 0 1px 0 light-dark(#ffffffa6,#cce1ff17);touch-action:none;user-select:none;-webkit-user-select:none;transform-origin:center;transition:transform 100ms cubic-bezier(.2,.75,.2,1),box-shadow 240ms ease;overflow:hidden}
#codex-usage-badge .mq-ribbon:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 20%,light-dark(#ffffff4d,#d6e9ff10) 43%,transparent 64%)}
#codex-usage-badge .mq-ribbon-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px;position:relative}
#codex-usage-badge .mq-ribbon-title{font-size:13px;font-weight:500;white-space:nowrap}
#codex-usage-badge .mq-ribbon-detail{font-size:11px;color:light-dark(#627e9f,#b7cdea);white-space:nowrap}
#codex-usage-badge .mq-ribbon-arrow{width:20px;height:20px;flex:0 0 20px;opacity:.42;transition:opacity 160ms ease,color 160ms ease;color:light-dark(#4c78b8,#a4c9ff)}
#codex-usage-badge .mq-ribbon:hover .mq-ribbon-arrow,#codex-usage-badge .mq-ribbon:focus-visible .mq-ribbon-arrow,#codex-usage-badge .mq-credit[data-state="holding"] .mq-ribbon-arrow{opacity:1}
#codex-usage-badge .mq-ribbon:disabled{opacity:1;cursor:default}
#codex-usage-badge .mq-credit[data-state="holding"] .mq-ribbon{transform:scale(.985);box-shadow:0 5px 15px light-dark(#264b791f,#00000055),inset 0 1px 0 light-dark(#ffffffa6,#cce1ff17)}
#codex-usage-badge .mq-ribbon-edge{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
#codex-usage-badge .mq-ribbon-edge path{fill:none;stroke:light-dark(#4c78b8,#a4c9ff);stroke-width:2;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100;opacity:0}
#codex-usage-badge .mq-ribbon-foot{display:none}
#codex-usage-badge .mq-credit-cancel{font:inherit;font-size:11px;background:transparent;border:0;padding:3px 7px;border-radius:6px;color:light-dark(#41658e,#bbd1ef)}
#codex-usage-badge .mq-credit[data-state="success"] .mq-ribbon{transition-duration:180ms}
@media(max-width:380px){#codex-usage-badge .mq-ribbon{gap:9px;padding:12px 18px}#codex-usage-badge .mq-ribbon-title{font-size:12px}}
@media(prefers-reduced-motion:reduce){#codex-usage-badge .mq-ribbon{transform:none!important;transition:none!important}#codex-usage-badge .mq-ribbon-edge{display:none}}
@media(pointer:coarse){#codex-usage-badge .mq-credit-cancel{min-height:44px}#codex-usage-badge .mq-token{width:44px;height:44px}#codex-usage-badge .mq-credit{margin-top:10px;padding-top:8px}}
@media(max-width:380px) and (pointer:coarse){#codex-usage-badge .mq-credit[data-count="3"] .mq-credit-count{display:none}}
#codex-usage-badge .mq-ribbon-arrow,#codex-usage-badge .mq-token svg{fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
#codex-usage-badge .mq-action-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
#codex-usage-badge .mq-credit-unknown{cursor:default}
#codex-usage-badge button{font-family:inherit}
    #codex-usage-badge .mq-effects{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;color:var(--mq-accent)}
    #codex-usage-badge .mq-outline{fill:none;stroke:var(--mq-accent);stroke-width:1;stroke-linecap:round;opacity:0;stroke-dasharray:100;stroke-dashoffset:100;filter:drop-shadow(0 0 3px var(--mq-accent))}
    #codex-usage-badge .mq-comet-trail{fill:none;stroke:var(--mq-accent);stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round}
    #codex-usage-badge .mq-comet-head{fill:var(--mq-core);filter:drop-shadow(0 0 3px var(--mq-accent))}
    #codex-usage-badge .mq-comet-seed{fill:none;stroke:var(--mq-accent);stroke-width:2.4;stroke-linecap:round}
    @media(max-width:380px){#codex-usage-badge .mq-content{padding-left:20px;padding-right:20px}#codex-usage-badge .mq-quota{font-size:58px}}
    @media(prefers-reduced-motion:reduce){#codex-usage-badge .mq-panel{clip-path:none!important;transition:opacity 140ms ease!important}#codex-usage-badge .mq-content{transform:none!important;transition:opacity 140ms ease!important}#codex-usage-badge .mq-effects{display:none!important}}`;
  const $ = s => root.querySelector(s);
  const ringSvg = $('.mq-ring'), ring = $('.mq-ring-value'), dot = $('.mq-ring-dot');
  const panelHit = $('.mq-panel-hit'), panel = $('.mq-panel'), effects = $('.mq-effects');
  const outline = $('.mq-outline'), particles = $('.mq-particles');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => x * x * (3 - 2 * x);
  let value = { percent:null, title:'正在读取 Codex 剩余用量', stale:true };
  let account = null, avatar = null, rail = null, phase = 'idle', disposed = false;
  let geometry = null, flights = [], frame = 0, runId = 0, waitTimer = 0, leaveTimer = 0, fadeTimer = 0, placementTimer = 0;
  let overAvatar = false, overPanel = false, focused = false, keyboard = false, armed = true, lastPointer = null;
  const creditBox=$('.mq-credit'),tokenGroup=$('.mq-tokens'),tokenPopover=$('.mq-token-popover'),creditAction=$('.mq-ribbon'),creditEdge=$('.mq-ribbon-edge path');
  const cleanup=[];
  let selected=null,tokenPinned=false,tokenCloseTimer=0,focusTimer=0,tokenSignature='',tokenEntries=[];
  let holdInput=null,holdFrame=0,holdRevision=0,holdProgress=0,operation=null,operationTimer=0,snapshotRevision=0;
  const terminalOutcomes=new Set(['reset','alreadyRedeemed','nothingToReset','noCredit','notSubmitted']);
  function listen(target,type,fn,options){target.addEventListener(type,fn,options);cleanup.push(()=>target.removeEventListener(type,fn,options));}
  function announce(text){setText('.mq-action-status',text);}
  function freshAccount(){return !value.stale&&currentPercent()!==null&&typeof value.accountKey==='string'&&!!value.accountKey&&Number.isFinite(value.updatedAt)&&Date.now()-value.updatedAt<150000;}
  function credits(){
    const data=value.resetCredits||{},count=Number.isInteger(data.availableCount)&&data.availableCount>=0?data.availableCount:null,seen=new Set();
    const cards=(Array.isArray(data.cards)?data.cards:[]).filter(c=>c&&typeof c.id==='string'&&c.id&&!seen.has(c.id)&&seen.add(c.id)).map(c=>{const expiresAt=Number.isFinite(c.expiresAt)&&c.expiresAt>0?c.expiresAt:null;return {key:`card:${c.id}`,id:c.id,expiresAt,expiryStatus:expiresAt!==null?'dated':c.expiryStatus==='noExpiry'?'noExpiry':'unknown',expirySource:['live','cached'].includes(c.expirySource)?c.expirySource:'unknown'};}).sort((a,b)=>(a.expiresAt??Infinity)-(b.expiresAt??Infinity));
    return {count,cards:count===null?[]:cards.slice(0,count),complete:data.detailsComplete===true};
  }
  function operationBusy(){return !!operation&&['submitting','checking','refreshing'].includes(operation.status);}
  function deadline(card){if(card?.expiryStatus==='noExpiry')return '无到期限制';if(!Number.isFinite(card?.expiresAt))return '暂未获取到期时间';const parts=new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(card.expiresAt*1000),p=type=>parts.find(x=>x.type===type)?.value||'';return `${p('month')}月${p('day')}日 ${p('hour')}:${p('minute')} 到期`;}
  function resolveSelection(c,selection){
    if(!selection)return null;
    if(selection.id)return c.cards.find(card=>card.id===selection.id)||null;
    const match=/^generic:(\d+)$/.exec(selection.key||''),index=match?Number(match[1]):-1;
    if(index<0||c.count===null||index>=c.count)return null;
    return c.cards[index]||{key:`generic:${index}`,id:null,expiresAt:null,expiryStatus:'unknown',generic:true};
  }
  function syncSelectedCard(previousCredits){
    const c=credits(),membership=data=>JSON.stringify([data.count,data.cards.map(card=>card.id).sort()]);
    // A changed eligible-card set invalidates a gesture; it may never retarget a held card.
    if(holdInput&&previousCredits&&membership(previousCredits)!==membership(c)){cancelHold();announce('卡片信息已更新，请重新长按');}
    if(!selected||operation)return;
    const next=resolveSelection(c,selected);
    if(!next){cancelHold();selected=null;tokenPopover.hidden=true;tokenPinned=false;return;}
    if(holdInput&&next.id!==selected.id){cancelHold();announce('卡片信息已更新，请重新长按');}
    selected=next;
  }
  function selectedCurrent(){return resolveSelection(credits(),selected);}
  function canConsume(){
    const card=selectedCurrent();
    return !disposed&&!document.hidden&&phase==='open'&&!operation&&freshAccount()&&credits().count>0&&card&&(!card.expiresAt||card.expiresAt*1000>Date.now())&&typeof window.__codexUsageBadgeAction==='function'&&typeof window.crypto?.randomUUID==='function';
  }
  function updateCreditEdge(){
    const w=creditAction.clientWidth,h=creditAction.clientHeight,r=(h-2)/2;
    if(w>0&&h>2)creditEdge.setAttribute('d',`M ${w/2} 1 H ${w-1-r} A ${r} ${r} 0 0 1 ${w-1-r} ${h-1} H ${r+1} A ${r} ${r} 0 0 1 ${r+1} 1 H ${w/2}`);
    creditEdge.style.strokeDashoffset=String(100-holdProgress*100);creditEdge.style.opacity=holdProgress>0?'1':'0';
  }
  function clearHoldInput(){const input=holdInput;holdInput=null;if(input?.kind==='pointer'){try{if(creditAction.hasPointerCapture(input.id))creditAction.releasePointerCapture(input.id);}catch{}}}
  function cancelHold(){holdRevision++;cancelAnimationFrame(holdFrame);holdFrame=0;holdProgress=0;clearHoldInput();updateCreditEdge();}
  function abortHold(){if(!holdInput)return;cancelHold();renderCredits();announce('已取消，未提交重置');}
  function hideToken(restoreFocus=false){
    const key=selected?.key;cancelHold();clearTimeout(tokenCloseTimer);tokenCloseTimer=0;tokenPopover.hidden=true;tokenPinned=false;selected=null;
    if(operation?.status==='settled'){clearTimeout(operationTimer);operation=null;tokenSignature='';}
    if(restoreFocus){const index=tokenEntries.findIndex(e=>e.key===key);const button=tokenGroup.querySelector(`[data-token-index="${index}"]`);if(button){suppressFocus=true;button.focus();suppressFocus=false;}}
    renderCredits();
  }
  let suppressFocus=false;
  function openToken(entry,pin=false){
    if(!entry||holdInput||operationBusy())return;
    clearTimeout(tokenCloseTimer);tokenCloseTimer=0;
    if(operation?.status==='settled'){operation=null;holdProgress=0;}
    selected=operation?.selection||entry;tokenPinned=tokenPinned||pin;tokenPopover.hidden=false;cancelClose();renderCredits();
  }
  function scheduleTokenClose(){clearTimeout(tokenCloseTimer);if(tokenPinned||holdInput||operationBusy())return;tokenCloseTimer=setTimeout(()=>{if(!creditBox.matches(':hover')&&!creditBox.contains(document.activeElement))hideToken();},180);}
  function ticketIcon(parent){const icon=svg('svg',{viewBox:'0 0 24 24','aria-hidden':'true'},parent);svg('path',{d:'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7ZM15 5v2m0 3v1m0 3v1m0 3v1'},icon);}
  function renderCredits(){
    const c=credits(),unresolved=!!operation&&operation.status!=='settled';
    const signature=JSON.stringify([c.count,c.cards,c.complete,unresolved?operation.requestId:null]);
    if(signature!==tokenSignature){
      tokenSignature=signature;
      const focusedToken=tokenGroup.contains(document.activeElement),existing=new Map([...tokenGroup.querySelectorAll('button')].map(button=>[button.dataset.tokenKey,button]));
      tokenEntries=[];
      if(c.count>0){
        for(let i=0;i<Math.min(c.count,3);i++)tokenEntries.push(c.cards[i]||{key:`generic:${i}`,id:null,expiresAt:null,expiryStatus:'unknown',generic:true});
      }else if(unresolved){tokenEntries=[{...(operation.selection||{}),key:'operation-recovery',recovery:true}];}
      const desired=tokenEntries.map((entry,index)=>{
        const b=existing.get(entry.key)||document.createElement('button');
        if(!existing.has(entry.key)){b.type='button';if(entry.recovery)b.textContent='核对状态';else ticketIcon(b);}
        b.className=entry.recovery?'mq-credit-unknown':'mq-token';b.dataset.tokenKey=entry.key;b.dataset.tokenIndex=String(index);b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','codex-reset-credit');b.setAttribute('aria-label',entry.recovery?'核对重置状态，不会再次重置':`${entry.id?'重置卡':'重置卡详情'}，${deadline(entry)}`);return b;
      });
      // Metadata updates reuse the focused button instead of tearing down the open popover.
      for(const node of [...tokenGroup.children])if(!desired.includes(node))node.remove();
      desired.forEach((node,index)=>{if(tokenGroup.children[index]!==node)tokenGroup.insertBefore(node,tokenGroup.children[index]||null);});
      if(!desired.length){const empty=document.createElement('span');empty.className='mq-credit-empty';empty.textContent=c.count===0?'暂无可用卡':'暂不可用';tokenGroup.appendChild(empty);}
      if(focusedToken&&!tokenGroup.contains(document.activeElement)){
        const index=tokenEntries.findIndex(entry=>entry.key===selected?.key),button=desired[index>=0?index:0];
        if(button){suppressFocus=true;button.focus();suppressFocus=false;}
      }
    }
    setText('.mq-credit-count',c.count===null?'':`${c.count} 张`);creditBox.dataset.count=String(c.count??'unknown');
    tokenGroup.querySelectorAll('button').forEach((b,index)=>{b.disabled=operationBusy()||!!holdInput;b.setAttribute('aria-expanded',String(!tokenPopover.hidden&&(tokenEntries[index]?.key===selected?.key||tokenEntries[index]?.recovery&&!!operation)));});
    let state=holdInput?'holding':'ready',title=deadline(selected),detail='',label=`${title}，长按 1.2 秒重置，松开取消`;
    if(operation){state=operation.status;
      const names={submitting:'正在重置额度',checking:'正在核对状态',refreshing:'正在刷新状态',unconfirmed:'核对状态'};
      title=names[state]||({reset:'重置完成',alreadyRedeemed:'此卡已使用',nothingToReset:'当前无需重置',noCredit:'暂无可用重置卡',notSubmitted:'未提交重置'}[operation.result?.outcome]||'状态已刷新');
      detail=state==='unconfirmed'?'结果待确认，不会再次重置':state==='settled'?(operation.result?.outcome==='notSubmitted'?'卡片未使用':'额度与卡片已刷新'):'请稍候';label=`${title}，${detail}`;
    }else if(holdInput){label=`${title}，继续按住，松开取消，使用后消耗 1 张`;}
    else if(!freshAccount()){title=deadline(selected);detail='账户状态暂不可用';label=`${title}，${detail}`;}
    else if(selected?.expiresAt&&selected.expiresAt*1000<=Date.now()){detail='此卡已到期';label=`${title}，${detail}`;}
    else if(typeof window.__codexUsageBadgeAction!=='function'){detail='重置服务暂不可用';label=`${title}，${detail}`;}
    creditBox.dataset.state=state;setText('.mq-ribbon-title',title);setText('.mq-ribbon-detail',detail);$('.mq-ribbon-detail').hidden=!detail;
    creditAction.disabled=operationBusy()||(!operation&&!holdInput&&!canConsume());creditAction.setAttribute('aria-label',label);creditAction.setAttribute('aria-busy',String(operationBusy()));updateCreditEdge();
  }
  function clearOperationTimer(){clearTimeout(operationTimer);operationTimer=0;}
  function operationTimeout(){clearOperationTimer();const id=operation?.requestId;operationTimer=setTimeout(()=>{if(disposed||operation?.requestId!==id||operation.status==='settled')return;operation.status='unconfirmed';holdProgress=0;render();announce('重置结果待确认，请核对状态');},30000);}
  function reconcileOperation(){
    if(!operation)return;
    if(operation.accountKey!==value.accountKey){resetAccountState();return;}
    if(operation.serverComplete&&operation.result?.outcome==='notSubmitted'){operation.status='settled';clearOperationTimer();holdProgress=0;announce('重置未提交，卡片未使用');return;}
    if(operation.serverComplete&&operation.result?.refreshed&&terminalOutcomes.has(operation.result.outcome)&&snapshotRevision>operation.startRevision&&freshAccount()&&value.updatedAt>=operation.startedAt){
      operation.status='settled';clearOperationTimer();holdProgress=0;announce({reset:'额度已重置，真实状态已刷新',alreadyRedeemed:'此卡此前已使用，真实状态已刷新',nothingToReset:'当前无需重置，真实状态已刷新',noCredit:'暂无可用重置卡，真实状态已刷新'}[operation.result.outcome]);
    }
  }
  function resetResult(requestId,result){
    if(disposed||!operation||operation.requestId!==requestId||operation.accountKey!==value.accountKey||!result)return;
    clearOperationTimer();
    if(operation.status==='settled')return;
    if(terminalOutcomes.has(result.outcome)){operation.result={outcome:result.outcome,refreshed:result.refreshed===true};operation.status=result.refreshed?'refreshing':'unconfirmed';}
    else operation.status='unconfirmed';
    reconcileOperation();if(operation&&operation.status==='refreshing')operationTimeout();holdProgress=0;render();
    if(operation?.status==='unconfirmed')announce('结果待确认，请点击核对状态；不会再次重置');
  }
  function ingestOperation(remote){
    if(!remote||remote.accountKey!==value.accountKey||typeof remote.requestId!=='string'||!remote.requestId)return;
    if(!['pending','unconfirmed','complete'].includes(remote.status))return;
    if(!operation||operation.requestId!==remote.requestId){
      if(remote.status==='complete')return;
      cancelHold();clearOperationTimer();operation={requestId:remote.requestId,accountKey:remote.accountKey,status:remote.status==='pending'?'submitting':'unconfirmed',startedAt:0,startRevision:snapshotRevision-1,selection:selected||{key:'operation',id:null,expiresAt:null,recovery:true},result:null,serverComplete:false};tokenSignature='';if(remote.status==='pending')operationTimeout();
    }
    operation.serverComplete=remote.status==='complete';
    if(terminalOutcomes.has(remote.outcome))operation.result={outcome:remote.outcome,refreshed:remote.refreshed===true};
    if(remote.status==='unconfirmed'){operation.status='unconfirmed';clearOperationTimer();}
    reconcileOperation();
  }
  function resetAccountState(){cancelHold();clearOperationTimer();operation=null;selected=null;tokenPinned=false;tokenPopover.hidden=true;tokenSignature='';clearTimeout(tokenCloseTimer);clearTimeout(focusTimer);announce('');}
  function sendAction(type){
    if(!operation||operation.accountKey!==value.accountKey)return;
    const payload={type,requestId:operation.requestId,accountKey:operation.accountKey};if(type==='reset'&&operation.selection?.id)payload.creditId=operation.selection.id;
    operationTimeout();
    try{if(typeof window.__codexUsageBadgeAction!=='function')throw new Error('bridge unavailable');window.__codexUsageBadgeAction(JSON.stringify(payload));}
    catch{clearOperationTimer();operation.status='unconfirmed';holdProgress=0;render();announce('结果待确认，请核对状态');}
  }
  function submitReset(){
    if(!canConsume()){abortHold();return;}
    const selection={...selectedCurrent()},requestId=window.crypto.randomUUID();
    operation={requestId,accountKey:value.accountKey,startedAt:Date.now(),startRevision:snapshotRevision,status:'submitting',selection,result:null,serverComplete:false};
    clearHoldInput();holdRevision++;holdFrame=0;render();announce('正在重置额度');sendAction('reset');
  }
  function startHold(input){
    if(holdInput||!canConsume())return;cancelHold();holdInput=input;tokenPinned=true;cancelClose();clearTimeout(tokenCloseTimer);renderCredits();announce('持续按住，松开取消');
    if(input.kind==='pointer'){try{creditAction.setPointerCapture(input.id);}catch{}}
    const id=++holdRevision,start=performance.now();
    function tick(now){if(disposed||id!==holdRevision||!holdInput)return;if(!canConsume()){abortHold();return;}holdProgress=Math.min(1,(now-start)/1200);updateCreditEdge();if(holdProgress===1){submitReset();return;}holdFrame=requestAnimationFrame(tick);}
    holdFrame=requestAnimationFrame(tick);
  }
  function withinCapsule(event){const box=creditAction.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top,r=box.height/2;if(x<0||x>box.width||y<0||y>box.height)return false;const cx=x<r?r:x>box.width-r?box.width-r:x;return (x-cx)**2+(y-r)**2<=r*r;}
  function tokenFromEvent(event){const b=event.target.closest?.('button[data-token-index]');return b&&tokenGroup.contains(b)?tokenEntries[Number(b.dataset.tokenIndex)]:null;}
  listen(tokenGroup,'pointerover',event=>{const entry=tokenFromEvent(event);if(entry)openToken(entry);});
  listen(tokenGroup,'pointerout',scheduleTokenClose);listen(tokenGroup,'focusin',event=>{if(!suppressFocus)openToken(tokenFromEvent(event));});listen(tokenGroup,'click',event=>openToken(tokenFromEvent(event),true));
  listen(tokenPopover,'pointerenter',()=>{clearTimeout(tokenCloseTimer);cancelClose();});listen(tokenPopover,'pointerleave',scheduleTokenClose);
  listen(creditBox,'focusout',event=>{if(event.relatedTarget&&creditBox.contains(event.relatedTarget))return;clearTimeout(focusTimer);focusTimer=setTimeout(()=>{if(!creditBox.contains(document.activeElement)&&!tokenPinned&&!operationBusy())hideToken();},0);});
  listen(creditAction,'pointerdown',event=>{if(event.button!==0||event.isPrimary===false||!canConsume())return;event.preventDefault();creditAction.focus({preventScroll:true});startHold({kind:'pointer',id:event.pointerId});});
  listen(creditAction,'pointermove',event=>{if(holdInput?.kind==='pointer'&&holdInput.id===event.pointerId&&(!withinCapsule(event)||event.buttons===0))abortHold();});
  listen(creditAction,'pointerleave',event=>{if(holdInput?.kind==='pointer'&&holdInput.id===event.pointerId)abortHold();});
  for(const type of ['pointerup','pointercancel'])listen(document,type,event=>{if(holdInput?.kind==='pointer'&&holdInput.id===event.pointerId)abortHold();});
  listen(creditAction,'lostpointercapture',event=>{if(holdInput?.kind==='pointer'&&holdInput.id===event.pointerId)abortHold();});
  listen(creditAction,'keydown',event=>{if(![' ','Enter'].includes(event.key)||(!canConsume()&&!holdInput))return;event.preventDefault();if(event.repeat||holdInput)return;startHold({kind:'keyboard',key:event.key});});
  listen(document,'keyup',event=>{if(holdInput?.kind==='keyboard'&&holdInput.key===event.key){event.preventDefault();abortHold();}});
  listen(creditAction,'blur',abortHold);listen(window,'blur',abortHold);listen(creditAction,'contextmenu',event=>event.preventDefault());
  listen(creditAction,'click',event=>{event.preventDefault();if(holdInput||operationBusy())return;if(operation?.status==='settled'){hideToken(true);return;}if(operation?.status==='unconfirmed'&&operation.accountKey===value.accountKey){operation.status='checking';render();announce('正在核对状态，不会再次重置');sendAction('refresh');}});
  const visible = el => {
    if (!el?.isConnected) return false;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const rounded = n => Math.max(0, Math.min(100, Math.round(n)));
  function currentPercent() {
    return value.stale || !Number.isFinite(value.percent) ? null : rounded(value.percent);
  }
  function setText(selector, text) { const el = $(selector); if (el.textContent !== text) el.textContent = text; }
  function applyTheme() {
    const html = document.documentElement;
    const explicit = html.dataset.theme || (html.classList.contains('dark') ? 'dark' : html.classList.contains('light') ? 'light' : '');
    root.style.colorScheme = explicit === 'dark' || explicit === 'light' ? explicit : systemDark.matches ? 'dark' : 'light';
  }
  function render() {
    const q = currentPercent();
    root.dataset.tone = q === null ? 'muted' : q < 10 ? 'danger' : q <= 50 ? 'warning' : 'normal';
    root.dataset.empty = String(q === 0);
    setText('.mq-quota', q === null ? '—' : String(q));
    $('.mq-percent').hidden = q === null;
    setText('.mq-used', q === null ? '已使用 —' : `已使用 ${100-q}%`);
    const weekly = value.windowLabel === '周' || (Number.isFinite(value.windowDurationMins) && value.windowDurationMins >= 10080 && value.windowDurationMins % 10080 === 0);
    const windowName = weekly ? '本周额度' : value.windowDurationMins === 300 ? '5小时额度' : '账户额度';
    setText('.mq-window', windowName);
    const plan = String(value.planType || '').toLowerCase();
    $('.mq-plan').hidden = !plan;
    setText('.mq-plan', plan.startsWith('pro') ? 'PRO' : plan.toUpperCase());
    ring.setAttribute('stroke-dasharray', `${q ?? 0} 100`);
    const a = (-90 + (q ?? 0) * 3.6) * Math.PI / 180;
    dot.setAttribute('cx', String(32 + 26 * Math.cos(a)));
    dot.setAttribute('cy', String(32 + 26 * Math.sin(a)));
    const showingRing = phase === 'idle' || phase === 'waiting';
    ring.style.opacity = showingRing && q !== null && q > 0 ? '1' : '0';
    dot.style.opacity = ring.style.opacity;
    ringSvg.setAttribute('aria-label', q === null ? 'Codex 额度暂不可用' : `${windowName}剩余 ${q}%`);
    const reset = !value.stale && Number.isFinite(value.resetsAt) && value.resetsAt > 0 ? value.resetsAt * 1000 : null;
    const remaining = reset === null ? null : Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    let countdown = '—';
    if (remaining === 0) countdown = '等待重置';
    else if (remaining !== null && remaining >= 86400) countdown = `${Math.floor(remaining / 86400)} 天`;
    else if (remaining !== null && remaining >= 3600) countdown = `${Math.floor(remaining / 3600)} 小时`;
    else if (remaining !== null && remaining >= 60) countdown = `${Math.floor(remaining / 60)} 分钟`;
    else if (remaining !== null) countdown = `${remaining} 秒`;
    setText('.mq-days', countdown);
    const resetLabel = reset === null ? '重置时间暂不可用' : new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(reset);
    $('.mq-days').setAttribute('aria-label', reset === null ? resetLabel : `${resetLabel} 重置`);
    const period = Number.isFinite(value.windowDurationMins) && value.windowDurationMins > 0 ? value.windowDurationMins * 60 : null;
    const progress = reset !== null && period !== null ? clamp(1 - remaining / period) : null;
    $('.mq-time-used').style.width = `${(progress ?? 0) * 100}%`;
    $('.mq-time-now').style.left = `${(progress ?? 0) * 100}%`;
    $('.mq-time-now').hidden = progress === null;
    $('.mq-time-rail').setAttribute('aria-label', progress === null ? '重置周期暂不可用' : `${Math.round(progress * 100)}% 周期已过，${resetLabel} 重置`);
    const updated = Number.isFinite(value.updatedAt) ? new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(value.updatedAt) : null;
    renderCredits();
    setText('.mq-source', operationBusy() ? (operation.status==='submitting'?'正在重置额度':'正在核对额度与卡片') : operation?.status==='unconfirmed' ? '重置结果待确认 · 点击卡券核对' : value.stale ? '额度暂不可用 · 正在重新连接' : q === null ? '额度暂不可用 · 等待账户数据' : updated ? `当前账户 · 更新于 ${updated}` : '正在读取真实额度');
  }
  function findAccount() {
    const nav = [...document.querySelectorAll('nav[data-app-navigation-rail]')].find(visible);
    if (!nav) return null;
    const buttons = [...nav.querySelectorAll('button,[role="button"]')].filter(visible);
    const semantic = buttons.filter(b => /account|profile|账户|帐号|账号|个人资料|个人信息|个人菜单|用户菜单/i.test([b.getAttribute('aria-label'),b.getAttribute('data-testid'),b.getAttribute('data-app-action'),b.getAttribute('title')].filter(Boolean).join(' ')));
    let button = semantic.at(-1);
    if (!button) {
      // Only avatar-bearing footer buttons are acceptable as a structural fallback.
      const footer = [...nav.children].filter(visible).at(-1);
      button = buttons.filter(b => footer?.contains(b) && b.querySelector('span.relative.isolate.inline-flex')).at(-1);
    }
    if (!button) return null;
    const candidates = [...button.querySelectorAll('span.relative.isolate.inline-flex,img,[data-slot="avatar"],[data-testid*="avatar"],[class*="avatar"],[class*="Avatar"],svg')].filter(visible);
    const validFace = el => { const r = el.getBoundingClientRect(),min=el.matches('span.relative.isolate.inline-flex')?12:18; return r.width >= min && r.width <= 64 && Math.abs(r.width-r.height)<6; };
    let face = candidates.find(el => el.matches('span.relative.isolate.inline-flex') && validFace(el)) || candidates.find(validFace);
    if (!face) { const r = button.getBoundingClientRect(); if (r.width <= 64 && r.height <= 64) face = button; }
    return face ? { nav, button, face } : null;
  }
  function onFocus() { focused = true; if (keyboard) startWait(); }
  function onBlur() { focused = false; leave(); }
  function onAccountClick() { idle(); armed = false; }
  function bindAccount(next) {
    if (account === next?.button && avatar === next?.face) return;
    if (account) {
      account.removeEventListener('focus', onFocus); account.removeEventListener('blur', onBlur);
      account.removeEventListener('click', onAccountClick, true);
      removeDescription();
    }
    if (rail) resizeObserver.unobserve(rail);
    if (avatar) resizeObserver.unobserve(avatar);
    idle(); overAvatar = false; overPanel = false; focused = false; armed = true;
    account = next?.button ?? null; avatar = next?.face ?? null; rail = next?.nav ?? null;
    if (account) {
      account.addEventListener('focus', onFocus); account.addEventListener('blur', onBlur);
      account.addEventListener('click', onAccountClick, true);
    }
    if (rail) resizeObserver.observe(rail);
    if (avatar) resizeObserver.observe(avatar);
  }
  function addDescription() {
    if (!account) return;
    const ids = new Set((account.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add('codex-usage-tooltip'); account.setAttribute('aria-describedby', [...ids].join(' '));
  }
  function removeDescription() {
    if (!account) return;
    const ids = (account.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== 'codex-usage-tooltip');
    if (ids.length) account.setAttribute('aria-describedby', ids.join(' ')); else account.removeAttribute('aria-describedby');
  }
  function place() {
    if (disposed || !document.body) return;
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
    if (!root.isConnected) document.body.appendChild(root);
    applyTheme(); bindAccount(findAccount());
    if (!visible(avatar) || !visible(account)) { root.hidden = true; idle(); return; }
    root.hidden = false;
    const a = avatar.getBoundingClientRect();
    const size = Math.max(a.width, a.height) + 18;
    const ringBox = { x:a.left+a.width/2-size/2, y:a.top+a.height/2-size/2, size };
    const pw = Math.min(350, innerWidth-16), availableAbove = Math.max(0,ringBox.y-26);
    const sideFits = ringBox.x+size+14+pw <= innerWidth-8;
    const beside = availableAbove<360 && sideFits;
    const ph = beside ? Math.min(360,innerHeight-16) : Math.min(360,availableAbove);
    const px = beside ? ringBox.x+size+14 : Math.max(8, Math.min(ringBox.x-2, innerWidth-pw-8));
    const py = beside ? Math.max(8,Math.min(a.top+a.height/2-ph/2,innerHeight-ph-8)) : Math.max(8,ringBox.y-ph-18);
    const next = { w:innerWidth,h:innerHeight,cx:a.left+a.width/2,cy:a.top+a.height/2,r:size*26/64,px,py,pw,ph,ringBox };
    if (geometry && ['flying','assembling','open','returning'].includes(phase) && (Math.abs(geometry.cx-next.cx)>1 || Math.abs(geometry.cy-next.cy)>1 || geometry.pw!==next.pw || geometry.py!==next.py)) idle();
    geometry = next;
    if(lastPointer && phase==='waiting'){
      overAvatar=lastPointer.x>=ringBox.x&&lastPointer.x<=ringBox.x+size&&lastPointer.y>=ringBox.y&&lastPointer.y<=ringBox.y+size;
      if(!held())idle();
    }
    Object.assign(ringSvg.style,{left:`${ringBox.x}px`,top:`${ringBox.y}px`,width:`${size}px`,height:`${size}px`});
    Object.assign(panelHit.style,{left:`${px}px`,top:`${py}px`,width:`${pw}px`,height:`${ph}px`});
    panel.style.overflowY=ph<360?'auto':'visible';
    $('.mq-content').style.minHeight=ph<360?'360px':'';
    effects.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
  }
  function setPhase(next) {
    phase = next; root.dataset.phase = next;
    panelHit.setAttribute('aria-hidden',String(next!=='open'));panel.inert=next!=='open';
    if (next === 'open') addDescription(); else removeDescription();
  }
  function cancelClose() { clearTimeout(leaveTimer); leaveTimer = 0; }
  function stopMotion() { runId++; cancelAnimationFrame(frame); clearTimeout(waitTimer); clearTimeout(fadeTimer); cancelClose(); }
  function idle() { cancelHold();hideToken();stopMotion(); particles.replaceChildren(); outline.style.opacity='0'; outline.style.strokeDashoffset='100'; setPhase('idle'); render(); if (!overAvatar && !overPanel && !focused) armed=true; }
  function held() { return overAvatar || overPanel || (keyboard && focused) || (!tokenPopover.hidden && (tokenPinned || creditBox.contains(document.activeElement))) || operationBusy() || !!holdInput; }
  function startWait() {
    cancelClose();
    if (disposed || !armed || phase!=='idle' || root.hidden || account?.getAttribute('aria-expanded')==='true') return;
    setPhase('waiting'); waitTimer=setTimeout(launch,1000);
  }
  function leave() {
    if (held()) return;
    if (phase==='waiting') { idle(); return; }
    if (phase==='open' && !leaveTimer) leaveTimer=setTimeout(()=>{leaveTimer=0;if(!held())close();},260);
  }
  function perimeter(g,t) {
    const r=24,w=g.pw-2,h=g.ph-2,l=g.px+1,top=g.py+1;
    const pieces=[{n:w-2*r,f:u=>({x:l+r+u*(w-2*r),y:top})},{n:Math.PI*r/2,f:u=>({x:l+w-r+r*Math.cos(-Math.PI/2+u*Math.PI/2),y:top+r+r*Math.sin(-Math.PI/2+u*Math.PI/2)})},{n:h-2*r,f:u=>({x:l+w,y:top+r+u*(h-2*r)})},{n:Math.PI*r/2,f:u=>({x:l+w-r+r*Math.cos(u*Math.PI/2),y:top+h-r+r*Math.sin(u*Math.PI/2)})},{n:w-2*r,f:u=>({x:l+w-r-u*(w-2*r),y:top+h})},{n:Math.PI*r/2,f:u=>({x:l+r+r*Math.cos(Math.PI/2+u*Math.PI/2),y:top+h-r+r*Math.sin(Math.PI/2+u*Math.PI/2)})},{n:h-2*r,f:u=>({x:l,y:top+h-r-u*(h-2*r)})},{n:Math.PI*r/2,f:u=>({x:l+r+r*Math.cos(Math.PI+u*Math.PI/2),y:top+r+r*Math.sin(Math.PI+u*Math.PI/2)})}];
    let distance=((t%1)+1)%1*pieces.reduce((sum,p)=>sum+p.n,0);
    for(const p of pieces){if(distance<=p.n)return p.f(distance/p.n);distance-=p.n;}return{x:l+r,y:top};
  }
  function svg(name,attrs,parent=particles) { const el=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));parent.appendChild(el);return el; }
  function curve(f,t) { const a=1-t;return{x:a*a*a*f.s.x+3*a*a*t*f.c1.x+3*a*t*t*f.c2.x+t*t*t*f.d.x,y:a*a*a*f.s.y+3*a*a*t*f.c1.y+3*a*t*t*f.c2.y+t*t*t*f.d.y}; }
  function setupFlights() {
    particles.replaceChildren(); const g=geometry,q=currentPercent()??0,count=28;
    const x=g.px+1,y=g.py+1,w=g.pw-2,h=g.ph-2,r=24;
    outline.setAttribute('d',`M ${x+r} ${y+h} H ${x+w-r} Q ${x+w} ${y+h} ${x+w} ${y+h-r} V ${y+r} Q ${x+w} ${y} ${x+w-r} ${y} H ${x+r} Q ${x} ${y} ${x} ${y+r} V ${y+h-r} Q ${x} ${y+h} ${x+r} ${y+h}`);
    flights=Array.from({length:count},(_,i)=>{
      const start=-Math.PI/2+(q/100*Math.PI*2)*(i+.5)/count;
      const s={x:g.cx+g.r*Math.cos(start),y:g.cy+g.r*Math.sin(start)},d=perimeter(g,.55+i/count);
      const c1={x:Math.max(6,Math.min(g.w-6,s.x+(i%3-1)*22)),y:s.y-66-(i%4)*8};
      const c2={x:Math.max(4,Math.min(g.w-4,d.x+Math.sin(i*1.7)*30)),y:d.y+46};
      const span=q/100*Math.PI*2/count*.7;
      const a={x:g.cx+g.r*Math.cos(start-span/2),y:g.cy+g.r*Math.sin(start-span/2)},b={x:g.cx+g.r*Math.cos(start+span/2),y:g.cy+g.r*Math.sin(start+span/2)};
      const group=svg('g',{}),seed=svg('path',{class:'mq-comet-seed',d:`M ${a.x} ${a.y} A ${g.r} ${g.r} 0 0 1 ${b.x} ${b.y}`},group);
      const tails=[0,1,2].map(j=>svg('path',{class:'mq-comet-trail',opacity:.18+j*.23},group));
      const head=svg('circle',{class:'mq-comet-head',cx:s.x,cy:s.y,r:1.6+(i%3)*.25,opacity:0},group);
      return{s,d,c1,c2,seed,tails,head,delay:(i%7)*24,duration:.73+(i%5)*.035};
    });
  }
  function drawFlight(f,u,reverse) {
    const t=smooth(clamp(u)),p=curve(f,t);f.head.setAttribute('cx',p.x);f.head.setAttribute('cy',p.y);f.head.setAttribute('opacity',u>0&&u<1?'1':'0');
    const stride=.045*Math.sin(Math.PI*clamp(u));
    for(let j=0;j<3;j++){
      const parts=[];for(let k=0;k<4;k++){const offset=(3-j)*stride-k*stride/3,z=curve(f,clamp(t+(reverse?offset:-offset)));parts.push(`${k?'L':'M'} ${z.x.toFixed(2)} ${z.y.toFixed(2)}`);}
      f.tails[j].setAttribute('d',parts.join(' '));f.tails[j].style.opacity=u>0&&u<1?String(.17+j*.25):'0';
    }
  }
  function openComplete() {
    setPhase('open');particles.replaceChildren();outline.style.opacity='.36';outline.style.strokeDashoffset='0';render();
    if(!held())leaveTimer=setTimeout(close,450);
  }
  function launch() {
    if(disposed || phase!=='waiting' || !visible(account) || account.getAttribute('aria-expanded')==='true'){idle();return;}
    place(); if(phase!=='waiting'||!geometry||root.hidden||!held()||geometry.ph<80){idle();return;} armed=false;
    const q=currentPercent();
    if(reduced.matches || q===null || q===0){setPhase('assembling');const id=++runId;fadeTimer=setTimeout(()=>{if(id===runId)openComplete();},160);return;}
    setupFlights();setPhase('flying');const id=++runId,start=performance.now();
    function tick(now){
      if(id!==runId)return;const elapsed=now-start;ring.style.opacity=String(1-clamp(elapsed/130));dot.style.opacity=ring.style.opacity;let landed=0;
      flights.forEach(f=>{const u=clamp((elapsed-150-f.delay)/(1200*f.duration));f.seed.style.opacity=String(1-clamp((elapsed-f.delay)/160));drawFlight(f,u,false);if(u>=1)landed++;});
      if(landed){outline.style.opacity=String(.28+.42*landed/flights.length);outline.style.strokeDashoffset=String(100-landed/flights.length*100);}
      if(landed>=Math.ceil(flights.length*.25)&&phase==='flying')setPhase('assembling');
      if(landed===flights.length){openComplete();return;}frame=requestAnimationFrame(tick);
    }frame=requestAnimationFrame(tick);
  }
  function close() {
    cancelClose();if(phase==='waiting'){idle();return;}if(phase!=='open')return;
    const q=currentPercent();if(reduced.matches||q===null||q===0||!geometry){idle();return;}
    setupFlights();setPhase('returning');const id=++runId,start=performance.now();flights.forEach(f=>f.seed.style.opacity='0');
    function tick(now){if(id!==runId)return;const elapsed=now-start;let done=0;
      flights.forEach(f=>{const u=clamp((elapsed-f.delay*.35)/650);drawFlight(f,1-u,true);if(u>=1)done++;});
      outline.style.opacity=String(.36*(1-clamp(elapsed/240)));ring.style.opacity=String(clamp((elapsed-460)/230));dot.style.opacity=ring.style.opacity;
      if(done===flights.length){idle();return;}frame=requestAnimationFrame(tick);
    }frame=requestAnimationFrame(tick);
  }
  function onPointerMove(event) {
    lastPointer={x:event.clientX,y:event.clientY};
    if(root.hidden || !geometry || !visible(account))return;
    const{x,y,size}=geometry.ringBox,was=overAvatar;
    overAvatar=event.clientX>=x&&event.clientX<=x+size&&event.clientY>=y&&event.clientY<=y+size;
    const g=geometry;
    const inPanel=event.clientX>=g.px&&event.clientX<=g.px+g.pw&&event.clientY>=g.py&&event.clientY<=g.py+g.ph;
    const inBridge=event.clientX>=Math.min(x,g.px)&&event.clientX<=Math.max(x+size,g.px+g.pw)&&event.clientY>=g.py+g.ph&&event.clientY<=y+2;
    overPanel=['flying','assembling','open'].includes(phase)&&(inPanel||inBridge);
    if(overAvatar&&!was)startWait();
    if(held())cancelClose();else{leave();if(phase==='idle')armed=true;}
  }
  function onPointerLeave() {lastPointer=null;overAvatar=false;overPanel=false;leave();if(phase==='idle')armed=true;}
  function onKeyDown(event) {if(event.key==='Tab')keyboard=true;if(event.key==='Escape'){if(holdInput){cancelHold();renderCredits();announce('已取消，未提交重置');}else if(!tokenPopover.hidden){hideToken(true);}else{idle();armed=false;}}}
  function onPointerDown(event) {keyboard=false;if(!creditBox.contains(event.target)&&!tokenPopover.hidden&&!operationBusy())hideToken();if(!panelHit.contains(event.target)&&!account?.contains(event.target)){idle();}}
  function onVisibility() {if(document.hidden){idle();overAvatar=false;overPanel=false;lastPointer=null;}else{armed=true;place();render();}}
  function onReducedChange(){idle();}
  function schedulePlacement(){if(disposed||placementTimer)return;placementTimer=setTimeout(()=>{placementTimer=0;place();},100);}
  const resizeObserver=new ResizeObserver(schedulePlacement);
  const observer=new MutationObserver(records=>{
    if(records.some(r=>!root.contains(r.target)&&r.target!==style))schedulePlacement();
  });
  observer.observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','data-theme','aria-label','data-testid','aria-expanded','data-app-navigation-rail']});
  listen(document,'DOMContentLoaded',schedulePlacement);listen(window,'pageshow',schedulePlacement);listen(window,'focus',schedulePlacement);
  document.addEventListener('pointermove',onPointerMove,{passive:true});
  document.addEventListener('pointerleave',onPointerLeave);
  document.addEventListener('pointerdown',onPointerDown,true);
  document.addEventListener('keydown',onKeyDown,true);
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('resize',schedulePlacement);
  window.addEventListener('scroll',schedulePlacement,true);
  reduced.addEventListener('change',onReducedChange);systemDark.addEventListener('change',applyTheme);
  const freshnessTimer=setInterval(()=>{
    if(disposed)return;
    if(!document.hidden&&(!account||!visible(account)||!visible(avatar)||root.hidden||!root.isConnected))place();
    if(!value.stale&&Number.isFinite(value.updatedAt)&&Date.now()-value.updatedAt>=150000){value={...value,percent:null,stale:true};idle();}
    else if(phase==='open')render();
  },1000);
  window[KEY]={
    version:VERSION,place,resetResult,
    update(next){
      const prev=currentPercent(),previousCredits=credits(),accountChanged=Object.prototype.hasOwnProperty.call(next,'accountKey')&&next.accountKey!==value.accountKey;if(accountChanged){resetAccountState();value={percent:null,stale:true,resetCredits:{availableCount:null,cards:[],detailsComplete:false}};}value={...value,...next};snapshotRevision++;
      if(!Number.isFinite(value.updatedAt)||Date.now()-value.updatedAt>=150000)value={...value,percent:null,stale:true};
      if(prev!==currentPercent()&&['flying','assembling','returning'].includes(phase))idle();
      syncSelectedCard(accountChanged?null:previousCredits);ingestOperation(value.resetOperation);reconcileOperation();if(holdInput&&!canConsume())abortHold();render();place();
    },
    status(){return{version:VERSION,placed:!root.hidden&&visible(avatar)&&root.isConnected,anchorFound:!!account,percent:currentPercent(),windowLabel:value.windowLabel??'',tone:root.dataset.tone,mode:'avatar',phase,resetAvailable:credits().count,resetState:holdInput?'holding':operation?.status??'ready',updatedAt:value.updatedAt??null,stale:!!value.stale,badgeCount:document.querySelectorAll('#codex-usage-badge').length};},
    destroy(){
      if(disposed)return;disposed=true;cancelHold();clearOperationTimer();clearTimeout(tokenCloseTimer);clearTimeout(focusTimer);cleanup.splice(0).forEach(fn=>fn());stopMotion();clearTimeout(placementTimer);clearInterval(freshnessTimer);observer.disconnect();resizeObserver.disconnect();
      if(account){account.removeEventListener('focus',onFocus);account.removeEventListener('blur',onBlur);account.removeEventListener('click',onAccountClick,true);removeDescription();}
      document.removeEventListener('pointermove',onPointerMove);document.removeEventListener('pointerleave',onPointerLeave);document.removeEventListener('pointerdown',onPointerDown,true);document.removeEventListener('keydown',onKeyDown,true);document.removeEventListener('visibilitychange',onVisibility);
      window.removeEventListener('resize',schedulePlacement);window.removeEventListener('scroll',schedulePlacement,true);reduced.removeEventListener('change',onReducedChange);systemDark.removeEventListener('change',applyTheme);
      root.remove();style.remove();if(window[KEY]?.version===VERSION)delete window[KEY];
    }
  };
  render();place();
}
