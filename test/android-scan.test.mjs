import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TodoStore } from '../lib/store.mjs';
import { AndroidScanner, parseDevices, parseLauncherPackages, parseApkPaths, parseBadging } from '../lib/android-scan.mjs';
import { metadataApk } from '../lib/apk-metadata.mjs';
import { inflateRawSync } from 'node:zlib';
import { PocketTodoControl } from '../lib/native.mjs';
function fixture(t, opts = {}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pocket-scan-test-')),store=new TodoStore(dir),calls=[];
 const run=async(file,args,options)=>{
  calls.push({file,args,options});
  if(opts.run) {const custom=await opts.run(file,args,options);if(custom!==undefined)return{stdout:custom};}
  if(args[0]==='devices')return{stdout:'List of devices attached\nphone1 device product:test model:Test_Phone transport_id:1\nphone2 device model:Second\n'};
  if(args.includes('get-current-user'))return{stdout:'0\n'};
  if(args.includes('query-activities'))return{stdout:'com.tencent.mm/.ui.LauncherUI\ncom.demo.app/.MainActivity\ncom.demo.app/.Other\n'};
  if(args.includes('getprop'))return{stdout:'zh-CN\n'};
  if(args.includes('path'))return{stdout:`package:/data/app/${args.at(-1)}/base.apk\npackage:/data/app/${args.at(-1)}/split_config.zh.apk\n`};
  if(args.includes('stat'))return{stdout:'1234:1700000000\n'};
  if(args.includes('pull')){fs.writeFileSync(args.at(-1),args.at(-2).split('/').at(-2));return{stdout:'1 file pulled'};}
  if(args[0]==='dump'){
   const pkg=fs.readFileSync(args.at(-1),'utf8');
   return{stdout:`package: name='${pkg}' versionCode='1'\napplication-label:'${pkg==='com.tencent.mm'?'WeChat':'Demo'}'\napplication-label-zh-CN:'${pkg==='com.tencent.mm'?'微信':'演示应用'}'\n`};
  }
  throw new Error('Unexpected command '+args.join(' '));
 };
 const scanner=new AndroidScanner(store,{}, {run,discover:()=>({adbPath:'/fake/adb',aaptPath:opts.noAapt?'':'/fake/aapt2',adbAvailable:true,labelsAvailable:!opts.noAapt})});
 t.after(async()=>{await scanner.close();store.close();fs.rmSync(dir,{recursive:true,force:true});});return{store,scanner,calls};
}
test('device parser distinguishes authorization/offline and rejects dangerous serials',()=>{
 const d=parseDevices('List of devices attached\nABC device product:x model:Pixel_8 transport_id:1\nDEF unauthorized\nGHI offline\n$(bad) device\n');
 assert.deepEqual(d.map(v=>v.state),['device','unauthorized','offline']);assert.equal(d[0].label,'Pixel 8');
});
test('launcher/APK parsing only accepts validated component names and APK paths',()=>{
 assert.deepEqual(parseLauncherPackages('2 activities found:\ncom.example/.Main\ncom.example/.Alias\ncom.test/com.test.Main\ncom.bad;touch/.Main\n'),['com.example','com.test']);
 assert.deepEqual(parseApkPaths('package:/data/app/~~test-123/com.a=+/base.apk\npackage:/data/app/bad;touch.apk\n'),['/data/app/~~test-123/com.a=+/base.apk']);
});
test('localized names and aliases come from APK metadata; wrong package rejects',()=>{
 const b="package: name='com.a'\napplication-label:'Example'\napplication-label-zh-CN:'示例'\napplication-label-zh-TW:'範例'\n";
 assert.deepEqual(parseBadging(b,'com.a','zh-CN'),{name:'示例',aliases:['Example','範例']});assert.equal(parseBadging(b,'com.a','en-US').name,'Example');assert.throws(()=>parseBadging(b,'com.other'),/不一致/);
});
test('scan scopes every device command, reads actual labels, deduplicates packages and preserves builtin ids',async t=>{
 const f=fixture(t);const task=f.store.add({title:'打开演示应用',targetName:'演示应用',kind:'android_app',sourceType:'text',evidence:'打开演示应用'}).todo;
 const initial=await f.scanner.start('phone1');assert.equal(initial.job.status,'scanning');await f.scanner.running;
 const j=f.scanner.snapshot().job;assert.equal(j.status,'completed');assert.equal(j.total,2);assert.equal(j.imported,2);assert.equal(j.added,1);assert.equal(j.updated,1);
 const wechat=f.store.data.targets.find(t=>t.id==='wechat');assert.equal(wechat.name,'微信');assert(wechat.aliases.includes('WeChat'));assert.equal(f.store.data.targets.filter(t=>t.packageName==='com.tencent.mm').length,1);
 assert.equal(f.store.launch(task.id).launch.packageName,'com.demo.app');
 for(const c of f.calls.filter(c=>c.file==='/fake/adb'&&c.args[0]!=='devices'))assert.deepEqual(c.args.slice(0,2),['-s','phone1']);
 const pulls=f.calls.filter(c=>c.args.includes('pull'));assert.equal(pulls.length,2);for(const c of pulls)assert.equal(fs.existsSync(path.dirname(c.args.at(-1))),false);
 assert(!f.calls.some(c=>c.args.some(a=>['install','start','am start','input','grant','root'].includes(a))));
});
test('rescan uses label cache; explicit refresh rereads APKs',async t=>{
 const f=fixture(t);await f.scanner.start('phone1');await f.scanner.running;await f.scanner.start('phone1');await f.scanner.running;
 assert.equal(f.calls.filter(c=>c.args.includes('pull')).length,2);assert.equal(f.scanner.state.job.added,0);
 await f.scanner.start('phone1',{refreshLabels:true});await f.scanner.running;assert.equal(f.calls.filter(c=>c.args.includes('pull')).length,4);
});
test('missing AAPT imports verified package names without fabricating labels',async t=>{
 const f=fixture(t,{noAapt:true});await f.scanner.start('phone1');await f.scanner.running;
 assert.equal(f.scanner.state.job.status,'completed');assert.equal(f.scanner.state.job.unnamed,2);assert.equal(f.store.data.targets.find(t=>t.packageName==='com.demo.app').name,'com.demo.app');assert.equal(f.store.data.targets.find(t=>t.id==='wechat').name,'微信');assert(!f.calls.some(c=>c.args.includes('pull')));
});
test('unauthorized and absent devices cannot start scan',async t=>{
 const f=fixture(t,{run:async(_file,args)=>args[0]==='devices'?'List of devices attached\nlocked unauthorized\n':undefined});
 await assert.rejects(f.scanner.start('locked'),/允许 USB 调试/);await assert.rejects(f.scanner.start('missing'),/未连接/);await assert.rejects(f.scanner.start('phone; touch /tmp/no'),/明确选择/);assert.equal(f.store.data.targets.length,2);
});
test('cancellation discards scan result, removes temporary APK and rejects concurrent scan',async t=>{
 let started;const pulling=new Promise(r=>{started=r;});let local;
 const f=fixture(t,{run:async(_file,args,options)=>{
  if(args.includes('pull')){local=args.at(-1);fs.writeFileSync(local,'partial');started();return await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('cancelled'),{name:'AbortError'})),{once:true}));}
 }});
 await f.scanner.start('phone1');await pulling;await assert.rejects(f.scanner.start('phone2'),/进行中/);const work=f.scanner.running;f.scanner.cancel();await work;
 assert.equal(f.scanner.state.job.status,'cancelled');assert.equal(f.store.data.targets.length,2);assert.equal(fs.existsSync(path.dirname(local)),false);
});
test('device disconnect prevents partial directory import',async t=>{
 const f=fixture(t,{run:async(_file,args)=>{if(args.includes('path')&&args.at(-1)==='com.tencent.mm')throw Object.assign(new Error('device not found'),{stderr:"error: device 'phone1' not found"});}});
 await f.scanner.start('phone1');await f.scanner.running;assert.equal(f.scanner.state.job.status,'failed');assert.equal(f.store.data.targets.length,2);assert.equal(f.scanner.state.job.imported,0);
});
test('per-app name failure still imports that verified package and reports warning',async t=>{
 const f=fixture(t,{run:async(_file,args)=>{if(args[0]==='dump'&&fs.readFileSync(args.at(-1),'utf8')==='com.demo.app')throw new Error('resource decode failure');}});
 await f.scanner.start('phone1');await f.scanner.running;assert.equal(f.scanner.state.job.status,'completed');assert.equal(f.scanner.state.job.unnamed,1);assert(f.scanner.state.job.warnings.some(w=>w.includes('com.demo.app')));
});
test('manual mappings, aliases and pending todo bindings survive scanning and repeat imports',async t=>{
 const f=fixture(t);f.store.importTargets([{id:'my-demo',name:'我的应用',kind:'android_app',packageName:'com.demo.app',aliases:['小演示'],source:'本人登记',origin:'user'}]);
 await f.scanner.start('phone1');await f.scanner.running;
 const e=f.store.data.targets.find(v=>v.id==='my-demo');assert.equal(e.name,'我的应用');assert.equal(e.source,'本人登记');assert(e.aliases.includes('演示应用'));assert(e.aliases.includes('小演示'));assert.equal(f.store.data.targets.filter(v=>v.packageName==='com.demo.app').length,1);
});
test('RPC accepts scan action only with the declared serial/refresh options',async t=>{
 const f=fixture(t),dispatch=PocketTodoControl.prototype.dispatch;
 await assert.rejects(dispatch.call({scanner:f.scanner},{action:'android-scan',data:{serial:'phone1',command:'rm -rf'}}));
 const r=await dispatch.call({scanner:f.scanner},{action:'android-status'});assert.equal(r.devices.length,2);
});

test('real installed AAPT2 reads an Android manifest label without a phone', async t=>{
 const {discoverAndroidTools}=await import('../lib/android-scan.mjs');const tools=discoverAndroidTools();
 if(!tools.aaptPath){t.skip('Android Build-Tools not installed');return;}
 const root=path.dirname(path.dirname(path.dirname(tools.aaptPath))),platforms=path.join(root,'platforms');
 let jar;try{jar=fs.readdirSync(platforms).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})).map(v=>path.join(platforms,v,'android.jar')).find(f=>fs.existsSync(f));}catch{}
 if(!jar){t.skip('Android platform android.jar not installed');return;}
 const {execFile}=await import('node:child_process'),{promisify}=await import('node:util'),exec=promisify(execFile);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pocket-aapt-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const manifest=path.join(dir,'AndroidManifest.xml'),apk=path.join(dir,'fixture.apk');
 const res=path.join(dir,'res/drawable');fs.mkdirSync(res,{recursive:true});fs.writeFileSync(path.join(res,'icon.xml'),'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#000000" android:pathData="M0,0h24v24h-24z"/></vector>');const compiled=path.join(dir,'compiled.zip');await exec(tools.aaptPath,['compile','--dir',path.join(dir,'res'),'-o',compiled]);
 fs.writeFileSync(manifest,'<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.pocket.scanner.fixture"><uses-sdk android:minSdkVersion="23" android:targetSdkVersion="34"/><application android:label="扫描测试" android:icon="@drawable/icon"><activity android:name=".MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>');
 await exec(tools.aaptPath,['link','-o',apk,'--manifest',manifest,'-I',jar,compiled],{timeout:15000});
 const {stdout}=await exec(tools.aaptPath,['dump','badging',apk],{timeout:15000});
 assert.equal(parseBadging(stdout,'com.pocket.scanner.fixture').name,'扫描测试');
 const data=fs.readFileSync(apk),end=data.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
 const entry=name=>{let cursor=data.readUInt32LE(end+16);while(data.readUInt32LE(cursor)===0x02014b50){
  const n=data.readUInt16LE(cursor+28),extra=data.readUInt16LE(cursor+30),comment=data.readUInt16LE(cursor+32),found=data.subarray(cursor+46,cursor+46+n).toString();
  if(found===name){const local=data.readUInt32LE(cursor+42),offset=local+30+data.readUInt16LE(local+26)+data.readUInt16LE(local+28),bytes=data.subarray(offset,offset+data.readUInt32LE(cursor+20));return data.readUInt16LE(cursor+10)===8?inflateRawSync(bytes):bytes;}
  cursor+=46+n+extra+comment;
 }throw new Error('Missing fixture ZIP entry');};
 const reduced=path.join(dir,'metadata.apk');fs.writeFileSync(reduced,metadataApk(entry('AndroidManifest.xml'),entry('resources.arsc')));
 const small=await exec(tools.aaptPath,['dump','badging',reduced],{timeout:15000});assert.equal(parseBadging(small.stdout,'com.pocket.scanner.fixture').name,'扫描测试');
});


test('fast metadata scan transfers only manifest/resources and avoids full APK pulls',async t=>{
 let pkg;
 const f=fixture(t,{run:async(_file,args)=>{
  if(args.includes('command')&&args.includes('unzip'))return '/system/bin/unzip\n';
  if(args.includes('exec-out')){pkg=args.at(-2).split('/').at(-2);return args.at(-1)==='resources.arsc'?emptyResourceTable():Buffer.from('binary-manifest');}
  if(args[0]==='dump'){const archive=fs.readFileSync(args.at(-1));assert.equal(archive.readUInt32LE(0),0x04034b50);return `package: name='${pkg}'\napplication: label='${pkg==='com.tencent.mm'?'微信':'快速应用'}' icon=''\n`;}
 }});
 await f.scanner.start('phone1');await f.scanner.running;
 assert.equal(f.scanner.state.job.status,'completed');assert.equal(f.scanner.state.job.readMode,'metadata');assert.equal(f.scanner.state.job.fullApkFallbacks,0);assert.equal(f.calls.filter(c=>c.args.includes('exec-out')).length,4);assert(!f.calls.some(c=>c.args.includes('pull')));assert.equal(f.store.data.targets.find(v=>v.packageName==='com.demo.app').name,'快速应用');
});

test('unsupported metadata reader falls back to full APK, while abort never does',async t=>{
 const f=fixture(t,{run:async(_file,args)=>{
  if(args.includes('command')&&args.includes('unzip'))return '/system/bin/unzip\n';
  if(args.includes('exec-out'))throw new Error('unzip read failed');
 }});
 await f.scanner.start('phone1');await f.scanner.running;assert.equal(f.scanner.state.job.status,'completed');assert.equal(f.scanner.state.job.fullApkFallbacks,2);assert.equal(f.calls.filter(c=>c.args.includes('pull')).length,2);
});

function emptyResourceTable(){const b=Buffer.alloc(12);b.writeUInt16LE(2);b.writeUInt16LE(12,2);b.writeUInt32LE(12,4);return b;}
test('metadata APK rejects malformed resources and oversized manifest',()=>{
 assert.throws(()=>metadataApk(Buffer.from('manifest'),Buffer.from('bad')),/资源表/);assert.throws(()=>metadataApk(Buffer.alloc(4*1024*1024+1)),/manifest/);
});
