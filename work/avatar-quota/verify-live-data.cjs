'use strict';
// Read only: query account usage through the bundled CLI, never the UI/debug port.
const {AppServerClient,formatRateLimits}=require('../../outputs/CodexAvatarQuota/agent.cjs');
const client=new AppServerClient({command:'/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex'});
client.on('server-exit',()=>{});
(async()=>{
 try{
  await client.start();
  const data=formatRateLimits(client.rateLimits);
  if(!Number.isFinite(data.percent))throw Error('No current quota received');
  console.log(JSON.stringify({source:'bundled Codex App Server',remainingPercent:data.percent,usedPercent:data.usedPercent,windowDurationMins:data.windowDurationMins,resetsAt:data.resetsAt,planType:data.planType,tone:data.tone,accountMatched:Boolean(data.accountKey),resetAvailable:data.resetCredits.availableCount,resetDetailCount:data.resetCredits.cards.length,resetDetailsComplete:data.resetCredits.detailsComplete,resetExpiries:data.resetCredits.cards.map(card=>card.expiresAt),checkedAt:new Date().toISOString()}));
 }finally{client.stop();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
