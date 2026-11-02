'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const dir=path.join(os.homedir(),'Library/Application Support/CodexUsageBadge');
const file=path.join(dir,'avatar-customization.json'),state=JSON.parse(fs.readFileSync(file,'utf8'));
const {acquireLock}=require(path.join(dir,'updater/core.cjs'));
const unlock=acquireLock(path.join(os.homedir(),'Library/Caches/CodexUsageBadge-manage.lock'));
if(!unlock)throw Error('插件正在安装或更新，请稍后重试');
try{
 const parent=path.join(dir,'avatar-backups')+path.sep;
 if(!state.backupDir.startsWith(parent)||!fs.realpathSync(state.backupDir).startsWith(parent))throw Error('备份位置无效');
 const allowed=new Set(['agent.cjs','manage.cjs','reset-controller.cjs','update-settings.json','avatar-customization.json']);
 const metaPath=path.join(state.backupDir,'backup-manifest.json');
 const manifest=fs.existsSync(metaPath)?JSON.parse(fs.readFileSync(metaPath,'utf8')):null;
 const entries=manifest?.schema===2?manifest.files:Object.fromEntries(['agent.cjs','manage.cjs','update-settings.json'].map(name=>[name,{existed:true}]));
 if(Object.keys(entries).some(name=>!allowed.has(name)))throw Error('备份清单无效');
 for(const[name,expected]of Object.entries(state.payloadHashes)){
   if(!allowed.has(name))throw Error('已安装清单无效');
   const target=path.join(dir,name),info=fs.lstatSync(target);
   if(info.isSymbolicLink()||!info.isFile()||hash(fs.readFileSync(target))!==expected)throw Error('文件已被其他更新修改，停止覆盖：'+name);
 }
 const backup={};
 for(const[name,meta]of Object.entries(entries))if(meta.existed){
   const source=path.join(state.backupDir,name),info=fs.lstatSync(source);
   if(info.isSymbolicLink()||!info.isFile())throw Error('备份文件无效');
   const data=fs.readFileSync(source);if(meta.sha256&&hash(data)!==meta.sha256)throw Error('备份校验失败');backup[name]=data;
 }
 // Preserve a receipt before replacing the previous version's metadata.
 fs.copyFileSync(file,file+'.restored-'+Date.now(),fs.constants.COPYFILE_EXCL);
 for(const[name,meta]of Object.entries(entries)){
   const target=path.join(dir,name);
   if(!meta.existed){if(fs.existsSync(target))fs.unlinkSync(target);continue;}
   const temp=target+'.restore-'+crypto.randomUUID();fs.writeFileSync(temp,backup[name],{mode:meta.mode??0o600,flag:'wx'});fs.renameSync(temp,target);
 }
 if(!manifest)fs.unlinkSync(file);
}finally{unlock();}
execFileSync('/bin/launchctl',['kickstart','-k',`gui/${process.getuid()}/com.codexusagebadge.agent`],{stdio:'inherit'});
console.log('已恢复安装本次更新前的插件版本和更新设置。');
