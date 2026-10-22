import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TodoStore } from '../lib/store.mjs';
import { parseDate, resolveTarget, targetSchema } from '../lib/domain.mjs';
import { definitions, installTools } from '../lib/tools.mjs';
const request = { title: '使用京东内购积分', targetName: '京东内购', kind: 'wechat_mini_program', sourceType: 'screenshot', evidence: '京东内购 1280积分 有效期2026-10-31', amount: '1280积分', dueAt: '2026-10-31' };
const mini = { id: 'test-mini', name: '京东内购', kind: 'wechat_mini_program', originalId: 'gh_testOnly123', source: '测试夹具，非真实京东标识' };
function fixture(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pocket-test-')); const s = new TodoStore(dir); t.after(() => { s.close(); fs.rmSync(dir, { recursive: true, force: true }); }); return s; }
test('unknown mini persists without fabricated ID or fallback to JD / WeChat app', t => {
  const s=fixture(t), {todo}=s.add(request);assert.equal(todo.launch,null);assert.equal(todo.resolution.status,'unresolved');
  assert.equal(s.launch(todo.id).mode,'desktop_preview');assert.equal(s.launch(todo.id).launch,null);
  assert.equal(todo.amount,'1280积分');assert.equal(todo.dueAt,'2026-10-31T15:59:59.000Z');
});
test('registering a mini mapping resolves earlier todo and returns mobile params', t => {
  const s=fixture(t), {todo}=s.add(request);s.importTargets([mini]);const p=s.launch(todo.id).launch;
  assert.equal(p.userName,mini.originalId);assert.equal(p.path,'');assert.equal(p.miniprogramType,0);assert.equal(p.requiresConfiguredWechatOpenSDK,true);assert.equal(p.packageName,undefined);
});
test('App alias resolves to package separate from mini program', t => {
  const {todo}=fixture(t).add({...request,title:'打开微信',targetName:'WeChat',kind:'android_app'});assert.equal(todo.launch.packageName,'com.tencent.mm');assert.equal(todo.launch.userName,undefined);
});
test('wx AppID and model-invented extra fields reject', t => {
  const s=fixture(t);assert.throws(()=>s.importTargets([{...mini,originalId:'wx0123456789'}]),/gh_/);assert.throws(()=>s.add({...request,originalId:'gh_madeup'}));assert.equal(s.snapshot().todos.length,0);assert.throws(()=>targetSchema.parse({...mini,packageName:'com.tencent.mm'}));
});
test('same-name targets require explicit choice and binding is stable', t => {
  const s=fixture(t);s.importTargets([mini,{...mini,id:'other',originalId:'gh_otherTest'}]);const {todo}=s.add(request);
  assert.equal(todo.resolution.status,'ambiguous');assert.equal(todo.launch,null);s.update(todo.id,{targetId:'test-mini'});assert.equal(s.launch(todo.id).launch.userName,mini.originalId);assert.throws(()=>s.update(todo.id,{targetId:'wechat'}),/类型/);
});
test('same message deduplicates but later independent requests do not', t => {
  const s=fixture(t),origin={sessionId:'s',messageId:'m1'},a=s.add(request,origin);assert.equal(s.add(request,origin).created,false);s.update(a.todo.id,{status:'done'});assert.equal(s.add(request,origin).created,false);assert.equal(s.add(request,{...origin,messageId:'m2'}).created,true);
});
test('delete is reversible and persistence survives reopening', t => {
  const s=fixture(t),{todo}=s.add(request);s.update(todo.id,{deleted:true});assert.equal(s.snapshot().todos.length,0);s.update(todo.id,{deleted:false,status:'done'});s.close();const restored=new TodoStore(s.dir);assert.equal(restored.snapshot().todos[0].status,'done');restored.close();
});
test('bulk import atomicity and duplicate ID protection', t => {
  const s=fixture(t);assert.throws(()=>s.importTargets([mini,{...mini,id:'bad',originalId:'wx_bad'}]));assert.equal(s.data.targets.length,2);assert.throws(()=>s.importTargets([mini,mini]),/重复/);
});
test('invalid dates reject; unknown dates stay unknown; timezone required', t => {
  const s=fixture(t);assert.throws(()=>s.add({...request,dueAt:'2026-02-30'}),/无效日期/);assert.throws(()=>parseDate('2026-10-22T10:00:00'));assert.throws(()=>s.add({...request,reminderAt:'2026-11-01'}),/晚于/);const {todo}=s.add({...request,dueAt:''});assert.equal(todo.dueAt,null);assert.equal(todo.reminderAt,null);
});
test('writer lock prevents data loss across live instances', t => {const s=fixture(t);assert.throws(()=>new TodoStore(s.dir),/另一个/);});
test('partial names never silently match an unrelated mini', t => {const s=fixture(t);s.importTargets([mini]);assert.equal(resolveTarget(s.data.targets,'京东','wechat_mini_program').status,'unresolved');});
test('actual DSH defineTool validates and executes structured model args', async t => {
  const s=fixture(t),defs=definitions(s,new Map([['s','m']])),add=defs.find(d=>d.name==='pocket_todo_add');assert.equal(defs.length,4);const v=await add.execute(request,{agent:{session:{id:'s'}}});assert.equal(v.created,true);assert.equal(v.todo.source.messageId,'m');const fail=await add.execute({...request,dueAt:'2026-99-01'},{agent:{id:'s'}});assert.match(fail.error,/无效日期/);
});
test('tools and instructions attach to existing and new chat agents once', t => {
  const s=fixture(t),events={},globals=[],scoped=[],prompts=[];
  const agent={ctx:{tools:{register:d=>{scoped.push(d.name);return()=>{};}},systemPrompt:{section:p=>{prompts.push(p.text);return()=>{};}}}};
  const ctx={effect:fn=>fn(),tools:{register:d=>{globals.push(d.name);return()=>{};}},on:(e,fn)=>{events[e]=fn;},agents:{list:()=>[agent]}};
  installTools(ctx,s);assert.equal(globals.length,4);assert.equal(scoped.length,4);assert.match(prompts[0],/截图/);events['agent/created']({agent});assert.equal(scoped.length,4);
});

test('model cannot bind a different application just because the package is known', t => {
 const s=fixture(t);assert.throws(()=>s.add({...request,targetName:'京东',kind:'android_app',targetId:'wechat'}),/名称不一致/);assert.equal(s.snapshot().todos.length,0);
});
