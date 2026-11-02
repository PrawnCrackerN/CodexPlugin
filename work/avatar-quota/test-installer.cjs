'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {install}=require('../../outputs/CodexAvatarQuota/install-files.cjs');
const sourceDir=path.resolve('outputs/CodexAvatarQuota'),live=path.join(os.homedir(),'Library/Application Support/CodexUsageBadge');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'avatar-install-test-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let locked=false;
const acquireLock=()=>{assert.equal(locked,false);locked=true;return()=>{locked=false;}};
function fixture(name){const dir=path.join(temp,name);fs.mkdirSync(dir);for(const file of ['agent.cjs','manage.cjs','reset-controller.cjs','update-settings.json','avatar-customization.json'])fs.copyFileSync(path.join(live,file),path.join(dir,file));return dir;}
try{
 const dir=fixture('success'),result=install({sourceDir,installDir:dir,acquireLock});
 const pkg=JSON.parse(fs.readFileSync(path.join(sourceDir,'package.json')));
 for(const[file,expected]of Object.entries(pkg.payloadHashes))assert.equal(hash(fs.readFileSync(path.join(dir,file))),expected);
 const state=JSON.parse(fs.readFileSync(path.join(dir,'avatar-customization.json')));
 assert.equal(state.activation,'manual-required');assert.equal(state.rendererVersion,pkg.rendererVersion);assert.equal(locked,false);
 const backup=JSON.parse(fs.readFileSync(path.join(result.backupDir,'backup-manifest.json')));
 assert.equal(backup.files['reset-controller.cjs'].existed,true);
 assert.equal(backup.files['reset-controller.cjs'].sha256,pkg.baseHashes['reset-controller.cjs']);
 for(const[name,info]of Object.entries(backup.files))if(info.existed)assert.equal(hash(fs.readFileSync(path.join(result.backupDir,name))),info.sha256);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'update-settings.json'))).enabled,false);
 console.log('PASS file-only deployment, payload hashes, backup, settings, metadata, lock release');
 const changed=fixture('changed');fs.appendFileSync(path.join(changed,'agent.cjs'),'\n// unexpected change');
 assert.throws(()=>install({sourceDir,installDir:changed,acquireLock}),/停止覆盖/);assert.equal(locked,false);assert.equal(hash(fs.readFileSync(path.join(changed,'reset-controller.cjs'))),pkg.baseHashes['reset-controller.cjs']);
 console.log('PASS modified installed file refused without deploying');
 const sym=fixture('symlink');fs.unlinkSync(path.join(sym,'manage.cjs'));fs.symlinkSync(path.join(live,'manage.cjs'),path.join(sym,'manage.cjs'));
 assert.throws(()=>install({sourceDir,installDir:sym,acquireLock}),/普通文件/);assert.equal(locked,false);
 console.log('PASS symlink refused and lock released');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
