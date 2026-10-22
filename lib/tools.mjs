import { defineTool } from '@deepseek-ai/dsh-tools';
import { INSTRUCTIONS } from './prompt.mjs';
import { normalizeName } from './domain.mjs';
import { lookupMiniProgram } from './mini-lookup.mjs';
export function definitions(store, latestUser = new Map()) {
  const output = { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] };
  const wrap = (name, description, parameters, execute) => defineTool({ name, description, parameters, output,
    async execute(args, exec) { try { return await execute(args, exec); } catch (e) { return { error: e.message }; } } });
  const string = (description, required = false) => ({ type: 'string', description, ...(required ? { required: true } : {}) });
  return [
    wrap('pocket_targets', '查询本地可核验的App/微信小程序启动目录。不匹配时不要猜ID；仍可添加入口待补充的待办。', {
      query: string('应用名称、别名或本地目录id，留空返回全部'),
    }, ({ query = '' }) => {
      const q = normalizeName(query);
      return { targets: store.data.targets.filter(t => !q || [t.id, t.name, ...t.aliases].some(n => normalizeName(n).includes(q))), note: '目录登记不代表已在真机验证。未找到时targetId省略。' };
    }),
    wrap('pocket_todo_add', '从用户本轮文本/截图提取事实后添加随手待办。自动解析应用名；包名和小程序ID只能来自目录，不由模型编造。', {
      title: string('待办标题，例如使用京东内购积分', true),
      targetName: string('截图或指令中的应用/小程序准确名称', true),
      kind: { type: 'string', enum: ['android_app', 'wechat_mini_program'], required: true, description: '独立Android App还是微信小程序' },
      targetId: string('只填pocket_targets返回的唯一匹配id，未找到或有歧义则省略'),
      details: string('业务说明及不确定信息'), evidence: string('用户原文/截图可见原文，不编造', true),
      sourceType: { type: 'string', enum: ['text', 'screenshot'], required: true },
      amount: string('截图/文字中明确的积分数、券面额等'), dueAt: string('到期日YYYY-MM-DD或带时区ISO；未知留空'),
      reminderAt: string('用户明确要求的提醒时间；未知留空，仅记录时间，不推送通知'),
    }, (args, exec) => {
      const sessionId = exec.agent?.session?.id ?? exec.agent?.id;
      return { ...store.add(args, { sessionId, messageId: latestUser.get(sessionId) }), mode: 'desktop_preview', note: '前往仅展示启动参数，未连接手机，不会实际打开应用；计划时间仅记录，不推送通知。' };
    }),
    wrap('pocket_todos', '列出随手待办及入口缺失情况。', {}, () => store.snapshot()),
    wrap('pocket_todo_update', '按用户要求完成或恢复一项待办。', {
      id: string('待办id', true), status: { type: 'string', enum: ['pending', 'done'], required: true },
    }, ({ id, status }) => ({ todo: store.update(id, { status }) })),
  ];
}
export function installTools(ctx, store) {
  const latestUser = new Map(), defs = definitions(store, latestUser), mounted = new WeakSet();
  ctx.on('session/event', (session, event) => {
    if (event.type === 'user/message' && event.data.source?.kind === 'user') latestUser.set(session.id, event.data.id);
  });
  for (const def of defs) ctx.effect(() => ctx.tools.register(def));
  const attach = agent => {
    if (!agent.ctx || mounted.has(agent)) return;
    mounted.add(agent);
    for (const def of defs) ctx.effect(() => agent.ctx.tools.register(def));
    ctx.effect(() => agent.ctx.systemPrompt.section({ name: 'pocket-todo', order: 945, text: INSTRUCTIONS }));
  };
  ctx.on('agent/created', ({ agent }) => attach(agent));
  for (const agent of ctx.agents.list()) attach(agent);
}

export function installMiniLookupTool(ctx, store, web) {
  const output = { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] };
  const definition = defineTool({
    name: 'pocket_mini_program_lookup',
    description: '联网查找微信小程序名称对应的原始ID并返回引用来源。只有微信/腾讯官方来源或至少两个独立网页一致时才自动登记；单来源或歧义只返回候选，不得猜测。',
    parameters: { name: { type: 'string', required: true, description: '用户提及或截图识别到的完整小程序名称' } },
    output,
    async execute({ name }) {
      try { return await lookupMiniProgram(store, web, name); }
      catch (error) { return { status: 'lookup_unavailable', error: error.message }; }
    },
  });
  ctx.effect(() => ctx.tools.register(definition));
  const mounted = new WeakSet();
  const attach = agent => {
    if (!agent.ctx || mounted.has(agent)) return;
    mounted.add(agent);
    const dispose = agent.ctx.tools.register(definition);
    ctx.effect(() => dispose);
  };
  ctx.on('agent/created', ({ agent }) => attach(agent));
  for (const agent of ctx.agents.list()) attach(agent);
}
