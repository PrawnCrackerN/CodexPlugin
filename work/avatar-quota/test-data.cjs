'use strict';
const assert = require('node:assert/strict');
const {formatRateLimits,mergeRateLimitsResponse}=require('../../outputs/CodexAvatarQuota/agent.cjs');
const snapshot=(used,extra={})=>({rateLimitsByLimitId:{codex:{limitId:'codex',planType:'prolite',primary:{usedPercent:used,windowDurationMins:10080,resetsAt:1793930493},secondary:null,...extra}}});
for(const [used,remaining,tone] of [[49,51,'normal'],[50,50,'warning'],[90,10,'warning'],[91,9,'danger'],[100,0,'danger']]){
 const value=formatRateLimits(snapshot(used));
 assert.equal(value.percent,remaining);assert.equal(value.tone,tone);
 assert.equal(value.resetsAt,1793930493);assert.equal(value.windowDurationMins,10080);
 assert.equal(value.usedPercent,used);assert.equal(value.planType,'prolite');
}
const liveShape=formatRateLimits(snapshot(51));
assert.equal(liveShape.percent,49);
const unknown=formatRateLimits(snapshot(undefined));
assert.equal(unknown.percent,null);assert.equal(unknown.usedPercent,null);assert.equal(unknown.tone,'muted');
const authoritative=formatRateLimits({rateLimits:{planType:'pro',primary:{usedPercent:1,windowDurationMins:10080}},rateLimitsByLimitId:{codex:null}});
assert.equal(authoritative.percent,null);
const previous={accountId:'old',...snapshot(51)};
const replaced=mergeRateLimitsResponse(previous,{accountId:'new',rateLimits:null,rateLimitsByLimitId:{codex:null}});
assert.equal(formatRateLimits(replaced).percent,null);
const plus=formatRateLimits({rateLimits:{planType:'plus',primary:{usedPercent:20,windowDurationMins:300,resetsAt:1793490000},secondary:{usedPercent:40,windowDurationMins:10080,resetsAt:1793930493}}});
assert.equal(plus.rings[1].percent,60);assert.equal(plus.rings[1].resetsAt,1793930493);
console.log('PASS: quota boundaries, metadata, unknown, authoritative bucket, account changes, Plus windows');
