import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { z } from 'zod';
import { requestSchema } from './contracts.mjs';
const initializers = [];
export class PocketTodoControl extends TypertRemoteService {
  constructor(ctx, store, scanner) {
    super(ctx, 'pocketTodoControl', { namespace: 'pocketTodo' });
    for (const initialize of initializers) initialize.call(this);
    this.store = store; this.scanner = scanner; this.web = null; this.closed = false; this.closers = new Set();
    ctx.effect(() => () => { this.closed = true; for (const close of this.closers) close(); });
  }
  async dispatch(request) {
    const { action, data = {} } = requestSchema.parse(request);
    switch (action) {
      case 'state': return this.snapshot();
      case 'android-status': z.object({}).strict().parse(data); return this.scanner.inspect();
      case 'android-scan': { const v = z.object({ serial: z.string().min(1).max(200), refreshLabels: z.boolean().optional() }).strict().parse(data); return this.scanner.start(v.serial, { refreshLabels: v.refreshLabels }); }
      case 'android-cancel': z.object({}).strict().parse(data); return this.scanner.cancel();
      case 'mini-lookup': {
        if (!this.web) throw new Error('当前 DSH profile 未加载联网搜索服务');
        const { lookupMiniProgram } = await import('./mini-lookup.mjs');
        const v = z.object({ name: z.string().trim().min(2).max(100) }).strict().parse(data);
        return lookupMiniProgram(this.store, this.web, v.name);
      }
      case 'update': { const v = z.object({ id: z.string(), change: z.record(z.string(), z.json()) }).strict().parse(data); return { todo: this.store.update(v.id, v.change) }; }
      case 'import-targets': return this.store.importTargets(z.object({ targets: z.array(z.json()) }).strict().parse(data).targets);
      case 'launch': return this.store.launch(z.object({ id: z.string() }).strict().parse(data).id);
      default: throw new Error('不支持的操作');
    }
  }
  snapshot() { return { ...this.store.snapshot(), android: this.scanner.snapshot() }; }
  setWeb(web) { this.web = web || null; }
  async *watch(signal) {
    let pending = this.snapshot(), wake;
    const update = () => { pending = this.snapshot(); wake?.(); wake = null; };
    const stop = () => { wake?.(); wake = null; };
    this.store.listeners.add(update); this.scanner.listeners.add(update); this.closers.add(stop); signal?.addEventListener('abort', stop);
    try {
      while (!this.closed && !signal?.aborted) {
        if (pending) { const value = pending; pending = null; yield value; }
        else await new Promise(resolve => { wake = resolve; });
      }
    } finally { this.store.listeners.delete(update); this.scanner.listeners.delete(update); this.closers.delete(stop); signal?.removeEventListener('abort', stop); }
  }
}
for (const [name, stream] of [['dispatch', false], ['watch', true]]) {
  const decorator = stream ? Remote({ mode: 'stream' }) : Remote;
  decorator(PocketTodoControl.prototype[name], { kind: 'method', name, static: false, private: false, addInitializer(fn) { initializers.push(fn); } });
}
