'use strict';
// File deployment only. Never connects to the app or restarts its background agent.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
function read(file,optional=false){
  let info;try{info=fs.lstatSync(file);}catch(e){if(optional&&e.code==='ENOENT')return null;throw e;}
  if(!info.isFile()||info.isSymbolicLink())throw Error('只允许普通文件：'+file);
  return{data:fs.readFileSync(file),mode:info.mode&0o777};
}
function atomic(file,data,mode){
  const temp=file+'.avatar-'+crypto.randomUUID();
  try{fs.writeFileSync(temp,data,{flag:'wx',mode});fs.renameSync(temp,file);}
  finally{try{fs.unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
function install({sourceDir=__dirname,installDir=path.join(os.homedir(),'Library/Application Support/CodexUsageBadge'),lockDir=path.join(os.homedir(),'Library/Caches/CodexUsageBadge-manage.lock'),acquireLock}={}){
  const manifest=JSON.parse(read(path.join(sourceDir,'package.json')).data);
  const payloadNames=Object.keys(manifest.payloadHashes);
  const allowed=new Set(['agent.cjs','manage.cjs','reset-controller.cjs']);
  if(payloadNames.length!==3||payloadNames.some(name=>!allowed.has(name)))throw Error('安装清单不完整');
  for(const name of payloadNames){
    const item=read(path.join(sourceDir,name));
    if(digest(item.data)!==manifest.payloadHashes[name])throw Error('定制文件校验失败：'+name);
    execFileSync(process.execPath,['--check',path.join(sourceDir,name)],{stdio:'pipe'});
  }
  const lock=acquireLock??require(path.join(installDir,'updater/core.cjs')).acquireLock;
  const unlock=lock(lockDir);if(!unlock)throw Error('插件正在安装或更新，请稍后重试');
  try{
    const names=[...payloadNames,'update-settings.json','avatar-customization.json'];
    const saved=Object.fromEntries(names.map(name=>[name,read(path.join(installDir,name),true)]));
    for(const name of payloadNames){
      const actual=saved[name]?digest(saved[name].data):null;
      if(actual!==manifest.baseHashes[name])throw Error('已安装文件发生变化，停止覆盖：'+name);
    }
    if(!saved['update-settings.json'])throw Error('缺少插件更新配置');
    const settings=JSON.parse(saved['update-settings.json'].data);
    if(settings.owner!=='codex-usage-badge-updater-v1')throw Error('更新配置不属于此插件');
    const prior=saved['avatar-customization.json']?JSON.parse(saved['avatar-customization.json'].data):null;
    const backupDir=path.join(installDir,'avatar-backups',new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomUUID().slice(0,8));
    fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
    const backupManifest={schema:2,files:{}};
    for(const name of names){
      const item=saved[name];backupManifest.files[name]=item?{existed:true,mode:item.mode,sha256:digest(item.data)}:{existed:false};
      if(item)fs.writeFileSync(path.join(backupDir,name),item.data,{mode:item.mode,flag:'wx'});
    }
    fs.writeFileSync(path.join(backupDir,'backup-manifest.json'),JSON.stringify(backupManifest,null,2)+'\n',{mode:0o600,flag:'wx'});
    const changed=[];
    try{
      for(const name of payloadNames){atomic(path.join(installDir,name),read(path.join(sourceDir,name)).data,saved[name]?.mode??0o600);changed.push(name);}
      atomic(path.join(installDir,'update-settings.json'),Buffer.from(JSON.stringify({...settings,enabled:false})+'\n'),saved['update-settings.json'].mode);changed.push('update-settings.json');
      const rollbackDir=prior?.version===manifest.version&&prior?.activation==='manual-required'?prior.backupDir:backupDir;
      const state={schema:2,name:'avatar-meteor-reset',version:manifest.version,rendererVersion:manifest.rendererVersion,installedAt:new Date().toISOString(),activation:'manual-required',backupDir:rollbackDir,deploymentBackupDir:backupDir,originalBackupDir:prior?.originalBackupDir??prior?.backupDir??null,payloadHashes:manifest.payloadHashes};
      atomic(path.join(installDir,'avatar-customization.json'),Buffer.from(JSON.stringify(state,null,2)+'\n'),0o600);changed.push('avatar-customization.json');
      for(const name of payloadNames)if(digest(read(path.join(installDir,name)).data)!==manifest.payloadHashes[name])throw Error('安装后校验失败：'+name);
      return{installedFiles:true,activation:'manual-required',backupDir:rollbackDir,deploymentBackupDir:backupDir,autoUpdate:false,version:manifest.version,rendererVersion:manifest.rendererVersion};
    }catch(error){
      for(const name of changed.reverse()){const item=saved[name],file=path.join(installDir,name);if(item)atomic(file,item.data,item.mode);else fs.unlinkSync(file);}
      throw error;
    }
  }finally{unlock();}
}
module.exports={install};
if(require.main===module){try{console.log(JSON.stringify(install()));}catch(error){console.error(error.message);process.exitCode=1;}}
