import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { BUILTINS, targetSchema, addSchema, parseDate, decorate, normalizeName } from './domain.mjs';
const clone = v => structuredClone(v);
export class TodoStore {
  constructor(dir) {
    this.dir = dir; this.listeners = new Set(); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.file = path.join(dir, 'state.json'); this.lock = path.join(dir, 'writer.lock');
    try { this.fd = fs.openSync(this.lock, 'wx', 0o600); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const pid = Number(fs.readFileSync(this.lock, 'utf8'));
      if (!Number.isInteger(pid) || pid < 1) throw new Error('待办数据锁无效，请检查 writer.lock');
      try { process.kill(pid, 0); throw new Error('待办数据正被另一个 DSH 实例使用，请使用独立 dataDir'); }
      catch (err) { if (err.code !== 'ESRCH') throw err; }
      fs.unlinkSync(this.lock); this.fd = fs.openSync(this.lock, 'wx', 0o600);
    }
    fs.writeFileSync(this.fd, String(process.pid));
    try {
      this.data = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : { version: 1, todos: [], targets: clone(BUILTINS) };
      if (this.data.version !== 1 || !Array.isArray(this.data.todos)) throw new Error('不支持的待办数据版本');
      this.data.targets = z.array(targetSchema).parse(this.data.targets);
    } catch (e) { this.close(); throw e; }
  }
  save(next) {
    const temp = this.file + '.' + randomUUID() + '.tmp';
    try {
      const fd = fs.openSync(temp, 'wx', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(next, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temp, this.file); this.data = next;
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    for (const f of this.listeners) { try { f(this.snapshot()); } catch { /* observers cannot roll back persistence */ } }
  }
  snapshot() { return clone({ version: 1, todos: this.data.todos.filter(t => !t.deletedAt).map(t => decorate(t, this.data.targets)), targets: this.data.targets }); }
  add(input, provenance = {}) {
    const args = addSchema.parse(input);
    const dueAt = parseDate(args.dueAt, true), reminderAt = parseDate(args.reminderAt);
    if (dueAt && reminderAt && Date.parse(reminderAt) > Date.parse(dueAt)) throw new Error('提醒时间不能晚于有效期');
    if (args.targetId) {
      const target = this.data.targets.find(t => t.id === args.targetId && t.kind === args.kind);
      if (!target) throw new Error('目标标识不存在，请先查询应用目录');
      if (![target.name, ...target.aliases].some(n => normalizeName(n) === normalizeName(args.targetName))) throw new Error('目录标识与应用名称不一致，请重新核对目标');
    }
    const source = { sessionId: String(provenance.sessionId || ''), messageId: String(provenance.messageId || '') };
    // Repeated calls for one source message deduplicate even after completion/deletion.
    const base = { ...args, dueAt, reminderAt };
    const dedupKey = createHash('sha256').update(JSON.stringify([source.sessionId, source.messageId, base])).digest('hex');
    const existing = this.data.todos.find(t => t.dedupKey === dedupKey);
    if (existing) return { created: false, todo: decorate(existing, this.data.targets) };
    const todo = { id: randomUUID(), ...base, source, dedupKey, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const next = clone(this.data); next.todos.push(todo); this.save(next);
    return { created: true, todo: decorate(todo, this.data.targets) };
  }
  update(id, change) {
    const patch = z.object({ status: z.enum(['pending', 'done']).optional(), deleted: z.boolean().optional(), targetId: z.string().max(100).nullable().optional() }).strict().parse(change);
    const next = clone(this.data), todo = next.todos.find(t => t.id === id);
    if (!todo) throw new Error('待办不存在');
    if (patch.targetId) {
      const target = next.targets.find(t => t.id === patch.targetId);
      if (!target || target.kind !== todo.kind) throw new Error('目标不存在或类型不匹配');
      todo.targetId = target.id; todo.targetName = target.name;
    } else if (patch.targetId === null) delete todo.targetId;
    if (patch.status) todo.status = patch.status;
    if (patch.deleted !== undefined) todo.deletedAt = patch.deleted ? new Date().toISOString() : null;
    todo.updatedAt = new Date().toISOString(); this.save(next); return decorate(todo, next.targets);
  }
  importTargets(input) {
    const targets = z.array(targetSchema).min(1).max(1000).parse(input);
    if (new Set(targets.map(t => t.id)).size !== targets.length) throw new Error('导入数据含重复 id');
    const next = clone(this.data);
    for (const t of targets) {
      const i = next.targets.findIndex(v => v.id === t.id);
      if (i >= 0 && next.targets[i].kind !== t.kind) throw new Error('不能改变已有目标的类型');
      if (i >= 0) next.targets[i] = t; else next.targets.push(t);
    }
    this.save(next); return { imported: targets.length };
  }
  importDeviceTargets(input) {
    const targets = z.array(targetSchema).min(1).max(1000).parse(input);
    if (targets.some(t => t.kind !== 'android_app' || t.origin !== 'device')) throw new Error('设备扫描只能导入 Android 应用');
    const next = clone(this.data); let added = 0, updated = 0;
    for (const target of targets) {
      const existing = next.targets.filter(t => t.kind === 'android_app' && t.packageName === target.packageName);
      if (!existing.length) { next.targets.push(target); added++; continue; }
      for (const old of existing) {
        const aliases = [...new Set([...old.aliases, target.name, ...target.aliases])].filter(v => v !== old.name && v !== target.packageName).slice(0,40);
        // Preserve stable ids, human names/aliases, and manual provenance. A name
        // previously missing can be filled by an actual device label next time.
        old.name = old.name === old.packageName ? target.name : old.name;
        old.aliases = aliases.filter(v => v !== old.name);
        if (old.origin !== 'user') { old.source = target.source; old.origin = 'device'; }
      }
      updated++;
    }
    this.save(next); return { imported: targets.length, added, updated };
  }
  launch(id) {
    const todo = this.snapshot().todos.find(t => t.id === id);
    if (!todo) throw new Error('待办不存在');
    return { mode: 'desktop_preview', title: todo.title, targetName: todo.targetName, resolution: todo.resolution, launch: todo.launch,
      message: todo.launch ? '已生成启动参数，未连接手机、未实际启动。小程序仍需完成 OpenSDK 配置并真机验证。' : '尚无唯一可用入口，请在应用目录登记标识，或为此待办选择目标。' };
  }
  close() { if (this.fd !== undefined) { fs.closeSync(this.fd); this.fd = undefined; fs.unlinkSync(this.lock); } }
}
