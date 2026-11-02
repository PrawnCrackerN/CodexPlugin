'use strict';
// Explicit user-run activation of the already installed customization.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const dir=path.join(os.homedir(),'Library/Application Support/CodexUsageBadge');
const file=path.join(dir,'avatar-customization.json');
const state=JSON.parse(fs.readFileSync(file,'utf8'));
for(const name of Object.keys(state.payloadHashes)){
 const data=fs.readFileSync(path.join(dir,name));
 if(crypto.createHash('sha256').update(data).digest('hex')!==state.payloadHashes[name])throw Error('已安装文件变化，停止启用：'+name);
}
execFileSync('/bin/launchctl',['kickstart','-k',`gui/${process.getuid()}/com.codexusagebadge.agent`],{stdio:'inherit'});
const temp=file+'.pending';
fs.writeFileSync(temp,JSON.stringify({...state,activation:'requested',activationRequestedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600});
fs.renameSync(temp,file);
console.log('头像额度后台已重新加载。请回到 Codex，等待约 5–10 秒查看账户头像。');
console.log('鼠标停留 1 秒查看流星卡片；重置卡胶囊需持续按住 1.2 秒，提前松开会取消。');
console.log('长按满圈会使用真实重置卡；结果以账户接口刷新后的额度和卡数为准。');
