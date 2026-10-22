import { z } from 'zod';
export const kindSchema = z.enum(['android_app', 'wechat_mini_program']);
const text = max => z.string().trim().min(1).max(max);
export const targetSchema = z.object({
  id: text(100).regex(/^[a-zA-Z0-9_-]+$/), name: text(100), kind: kindSchema,
  aliases: z.array(text(100)).max(40).default([]),
  packageName: z.string().trim().regex(/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/).optional(),
  originalId: z.string().trim().regex(/^gh_[a-zA-Z0-9]+$/, '原始 ID 必须是 gh_ 开头；wx 开头的是 AppID').optional(),
  path: z.string().trim().max(2048).default(''), source: text(1000),
  origin: z.enum(['builtin', 'user', 'device', 'web']).default('user'),
}).strict().superRefine((v, ctx) => {
  if (v.kind === 'android_app' && (!v.packageName || v.originalId || v.path)) ctx.addIssue({ code: 'custom', message: 'Android 应用只填写包名，不填写原始 ID 或小程序路径' });
  if (v.kind === 'wechat_mini_program' && (!v.originalId || v.packageName)) ctx.addIssue({ code: 'custom', message: '微信小程序只填写 gh_ 原始 ID，不填写 Android 包名' });
});
export const BUILTINS = [
  { id: 'wechat', name: '微信', aliases: ['WeChat'], kind: 'android_app', packageName: 'com.tencent.mm', source: '微信 Android 标准发行版；真机接入时以设备扫描结果为准', origin: 'builtin' },
  { id: 'jd-app', name: '京东', aliases: ['京东App', '京东商城'], kind: 'android_app', packageName: 'com.jingdong.app.mall', source: '京东 Android 标准发行版；真机接入时以设备扫描结果为准', origin: 'builtin' },
].map(v => targetSchema.parse(v));
export const normalizeName = s => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
export function resolveTarget(targets, name, kind, targetId) {
  const pool = targets.filter(t => !kind || t.kind === kind);
  const candidates = targetId ? pool.filter(t => t.id === targetId) : pool.filter(t => [t.name, ...t.aliases].some(n => normalizeName(n) === normalizeName(name)));
  return { status: candidates.length === 1 ? 'configured' : candidates.length ? 'ambiguous' : 'unresolved', candidates };
}
export function launchDescriptor(target) {
  return target.kind === 'android_app' ? { schemaVersion: 1, platform: 'android', kind: target.kind, packageName: target.packageName }
    : { schemaVersion: 1, platform: 'android', kind: target.kind, wechatPackageName: 'com.tencent.mm', userName: target.originalId, path: target.path, miniprogramType: 0, requiresConfiguredWechatOpenSDK: true };
}
export const dateInput = z.string().trim().max(50).default('').refine(s => !s || /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(s), '日期必须为 YYYY-MM-DD 或含时区的 ISO 时间');
export function parseDate(value, endOfDay = false) {
  if (!value) return null;
  dateInput.parse(value);
  const day = value.slice(0, 10);
  const valid = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(+valid) || valid.toISOString().slice(0, 10) !== day) throw new Error('无效日期');
  const raw = value.length === 10 ? `${value}T${endOfDay ? '23:59:59' : '09:00:00'}+08:00` : value;
  if (!Number.isFinite(Date.parse(raw))) throw new Error('无效时间');
  return new Date(raw).toISOString();
}
export const addSchema = z.object({
  title: text(200), targetName: text(100), kind: kindSchema, targetId: z.string().max(100).optional(),
  details: z.string().trim().max(4000).default(''), evidence: text(4000),
  sourceType: z.enum(['text', 'screenshot']), dueAt: dateInput, reminderAt: dateInput,
  amount: z.string().trim().max(200).default(''),
}).strict();
export function decorate(todo, targets) {
  const resolution = resolveTarget(targets, todo.targetName, todo.kind, todo.targetId);
  const target = resolution.status === 'configured' ? resolution.candidates[0] : null;
  return { ...todo, resolution, launch: target ? launchDescriptor(target) : null };
}
