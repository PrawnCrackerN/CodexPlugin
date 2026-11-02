const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'install-usage-badge.js'), 'utf8');
function take(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `renderer function ${name} exists`);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}
const context = vm.createContext({ Intl, Date, JSON, Map, Set, Number });
vm.runInContext(`
let value={},selected=null,operation=null,holdInput=null,tokenPinned=true;
const tokenPopover={hidden:false};let cancels=0;const announcements=[];
function cancelHold(){cancels++;holdInput=null;}
function announce(message){announcements.push(message);}
${['credits','deadline','resolveSelection','syncSelectedCard','selectedCurrent'].map(take).join('\n')}
globalThis.fixture={
  update(data){const previous=credits();value={resetCredits:data};syncSelectedCard(previous);},
  select(card){selected=card;tokenPopover.hidden=false;tokenPinned=true;},
  hold(){holdInput={kind:'keyboard',key:' '};},
  beginOperation(){operation={status:'submitting'};},
  inspect(){return JSON.parse(JSON.stringify({selected,current:selectedCurrent(),hidden:tokenPopover.hidden,holding:!!holdInput,cancels,label:deadline(selected),announcements}));},
  cards(){return credits();},
  label(card){return deadline(card);}
};`, context);
const f = context.fixture;
const snapshot = (cards, count=cards.length) => ({availableCount:count,cards,detailsComplete:true});
const a = {id:'A',expiresAt:null,expiryStatus:'unknown'};
f.update(snapshot([a]));f.select(f.cards().cards[0]);
assert.equal(f.inspect().label,'暂未获取到期时间');
f.update(snapshot([{...a,expiresAt:1893456000,expiryStatus:'dated'}]));
assert.equal(f.inspect().selected.expiresAt,1893456000);
assert.equal(f.inspect().hidden,false,'date completion keeps popover open');
assert.match(f.inspect().label,/到期$/);
f.update(snapshot([{...a,expiryStatus:'noExpiry'}]));
assert.equal(f.inspect().label,'无到期限制');
f.update(snapshot([{id:'A',expiresAt:null}]));
assert.equal(f.inspect().label,'暂未获取到期时间','legacy null does not imply unlimited expiry');
f.hold();const before=f.inspect().cancels;
f.update(snapshot([{id:'A',expiresAt:1893456000,expiryStatus:'dated'}]));
assert.equal(f.inspect().cancels,before,'same-ID metadata update does not retarget the gesture');
assert.equal(f.inspect().holding,true);
f.update(snapshot([{id:'B',expiresAt:1893456000,expiryStatus:'dated'}]));
assert.equal(f.inspect().holding,false,'ID replacement cancels held gesture');
assert.equal(f.inspect().hidden,true,'removed ID never maps to a different card');
f.update(snapshot([],1));f.select({key:'generic:0',id:null,expiresAt:null,generic:true});f.hold();
f.update(snapshot([{id:'C',expiresAt:1893456000,expiryStatus:'dated'}]));
assert.equal(f.inspect().selected.id,'C','generic selection gains current details');
assert.equal(f.inspect().holding,false,'generic-to-ID upgrade cancels held gesture');
assert.equal(f.inspect().hidden,false);
f.hold();f.update(snapshot([{id:'C',expiresAt:1893456000,expiryStatus:'dated'},{id:'D',expiresAt:null,expiryStatus:'noExpiry'}]));
assert.equal(f.inspect().holding,false,'eligible set change cancels gesture even when selected ID remains');
f.select(f.cards().cards[0]);f.beginOperation();
f.update(snapshot([],0));
assert.equal(f.inspect().selected.id,'C','in-flight operation selection stays bound to its request');
assert.match(source,/const VERSION = 1049;/);
assert.match(source,/observer\.observe\(document,/,'early injection does not require documentElement');
assert.match(source,/attributeFilter:\[[^\]]*'style'[^\]]*'hidden'/);
assert.match(source,/if\(records\.some\(r=>!root\.contains\(r\.target\)&&r\.target!==style\)\)/,'own mutations do not loop placement');
console.log('PASS renderer expiry synchronization, no-expiry semantics, identity cancellation, operation binding, and startup observer guards');
