const React = require('react'), h = React.createElement;
const { RemoteStreamCarrierError } = require('@deepseek-ai/dsh-api-gateway');
const css = `
.pocket{height:100%;overflow:auto;box-sizing:border-box;padding:32px;color:var(--dsw-alias-label-primary,inherit);background:var(--dsw-alias-bg-base,transparent);font:inherit}.pocket *{box-sizing:border-box}.pocket-inner{max-width:1100px;margin:auto}.pocket header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.pocket h1{font-size:27px;letter-spacing:-.8px;margin:7px 0}.pocket p{line-height:1.65}.pocket small,.pocket-muted{opacity:.65;font-size:12px}.pocket-kicker{font-size:11px;letter-spacing:2px;color:var(--dsw-alias-state-business-primary,#32877c)}.pocket button,.pocket select,.pocket input,.pocket textarea{font:inherit;color:inherit;border:1px solid var(--dsw-alias-border-l2,#8884);border-radius:9px;padding:9px 12px;background:var(--dsw-alias-bg-layer-1,transparent)}.pocket button{cursor:pointer}.pocket button:disabled{opacity:.5;cursor:wait}.pocket button.primary{background:#267b70;color:#fff;border-color:#267b70}.pocket button[aria-pressed=true]{background:#267b7018;border-color:#267b70;color:var(--dsw-alias-label-primary,inherit)}.pocket-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.pocket-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.pocket-stat{border:1px solid var(--dsw-alias-border-l2,#8883);border-radius:12px;padding:16px}.pocket-stat b{font-size:25px;font-weight:550;display:block;margin-top:6px}.pocket-bar{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}.pocket-search{margin-left:auto;min-width:160px;max-width:100%}.pocket-card{border:1px solid var(--dsw-alias-border-l2,#8883);border-radius:14px;margin:12px 0;padding:20px;display:grid;grid-template-columns:28px 1fr auto;gap:12px;align-items:start}.pocket-card h3{margin:0 0 7px;font-size:17px;font-weight:550}.pocket-card.done h3{text-decoration:line-through;opacity:.5}.pocket-card p{margin:8px 0}.pocket-check{accent-color:#267b70;width:18px;height:18px;margin-top:3px}.pocket-tag{font-size:11px;padding:4px 8px;border-radius:5px;background:#8881;margin-right:7px;display:inline-block}.pocket-warn{color:var(--dsw-alias-state-warning,#a56c16)}.pocket-error{color:var(--dsw-alias-state-error,#c44);white-space:pre-wrap}.pocket-empty{padding:56px 24px;text-align:center;border:1px dashed var(--dsw-alias-border-l2,#8884);border-radius:14px}.pocket details{margin-top:12px}.pocket summary{cursor:pointer;font-size:12px;opacity:.7}.pocket pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,monospace;padding:14px;background:#8881;border-radius:8px}.pocket-dialog-shade{position:fixed;inset:0;z-index:1000;background:#0006;display:grid;place-items:center;padding:24px}.pocket-dialog{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#222);border:1px solid var(--dsw-alias-border-l2,#8884);border-radius:16px;padding:24px;width:min(680px,100%);max-height:85vh;overflow:auto;box-shadow:0 20px 70px #0003}.pocket-dialog h2{margin-top:0;font-size:20px}.pocket-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pocket-form label{display:grid;gap:6px;font-size:12px}.pocket-form .full{grid-column:1/-1}.pocket textarea{width:100%;min-height:110px;resize:vertical}.pocket-target{padding:14px 0;border-bottom:1px solid #8882;display:flex;justify-content:space-between;gap:12px}.pocket-target code{font-size:12px;overflow-wrap:anywhere}.pocket-toast{padding:12px 16px;background:#267b7014;border-radius:10px;margin:14px 0}.pocket-note{border-left:3px solid #267b70;padding:4px 16px;margin:20px 0}.pocket-loading{padding:40px}.pocket-scan{padding:14px 0}.pocket-scan ol{padding-left:22px;line-height:1.9}.pocket-scan select{width:100%;margin:8px 0 14px}.pocket-scan progress{width:100%;height:10px;accent-color:#267b70}.pocket-scan label{display:block;margin:12px 0}.pocket-scan input[type=checkbox]{margin-right:8px;accent-color:#267b70}.pocket-foot{padding:24px 0;font-size:12px;opacity:.6}.pocket-note{padding:18px 20px;margin:16px 0;border:1px solid var(--dsw-alias-border-l2,#8883);border-radius:14px}.pocket-note h3{margin:0 0 6px;font-size:17px;font-weight:550}.pocket-lookup{display:grid;grid-template-columns:minmax(180px,1fr) auto;gap:8px;max-width:720px;margin:14px 0}.pocket-lookup-result{padding:12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,#8881);overflow-wrap:anywhere}.pocket-directory-heading{display:flex;align-items:baseline;justify-content:space-between;margin-top:28px}.pocket-directory-heading h3{margin:0}@media(max-width:700px){.pocket{padding:18px}.pocket-card{grid-template-columns:24px 1fr}.pocket-card>.pocket-actions{grid-column:2}.pocket-form{grid-template-columns:1fr}.pocket-stats{gap:7px}.pocket-stat{padding:12px}.pocket-search{margin-left:0;width:100%}.pocket-lookup{grid-template-columns:1fr}.pocket-note>.pocket-actions{align-items:stretch}}
`;
return { name: 'dsh-pocket-todo', inject: ['slots', 'remote', 'layout', 'uiWorkspace'], async apply(ctx) {
  const unmount = await ctx.remote.$mount({ package: 'dsh-pocket-todo', descriptors });
  const panel = await ctx.inject(['remote.pocketTodo'], scope => mountPanel(scope));
  return async () => { await panel.dispose(); await unmount(); };
} };
function mountPanel(ctx) {
  let snapshot = null, streamError = '', revision = 0; const listeners = new Set();
  const emit = () => { revision++; for (const f of listeners) f(); };
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const call = async (action, data) => {
    const result = await ctx.remote.pocketTodo.dispatch({ action, ...(data ? { data } : {}) });
    if (!result.ok) throw new Error(result.error.message); return result.value;
  };
  const stream = ctx.remote.$stream({ name: '随手待办', open: signal => ctx.remote.pocketTodo.watch(signal), ended: accepted => accepted ? new RemoteStreamCarrierError('待办连接已断开') : new Error('待办尚未就绪'), carrierFailed: e => { streamError = e.message; emit(); } });
  const reader = (async () => { try { for await (const item of stream) { snapshot = item.value; streamError = ''; item.accept(); emit(); } } catch (e) { streamError = e.message; emit(); } })();
  const date = s => s ? new Date(s).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '';
  const kind = k => k === 'wechat_mini_program' ? '微信小程序' : 'Android App';
  const emptyForm = { id: '', name: '', kind: 'wechat_mini_program', identifier: '', aliases: '', path: '', source: '' };
  function Panel() {
    React.useSyncExternalStore(subscribe, () => revision);
    const [tab, setTab] = React.useState('pending'), [query, setQuery] = React.useState('');
    const [dialog, setDialog] = React.useState(null), [launch, setLaunch] = React.useState(null), [binding, setBinding] = React.useState(null);
    const [form, setForm] = React.useState(emptyForm), [bulk, setBulk] = React.useState(''), [error, setError] = React.useState(''), [busy, setBusy] = React.useState(false), [notice, setNotice] = React.useState(null);
    const [android, setAndroid] = React.useState(null), [deviceSerial, setDeviceSerial] = React.useState(''), [refreshLabels, setRefreshLabels] = React.useState(false);
    const [lookupName, setLookupName] = React.useState(''), [lookupResult, setLookupResult] = React.useState(null);
    const state = snapshot, todos = state?.todos || [], targets = state?.targets || [];
    const run = async fn => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
    const button = (label, fn, props = {}) => h('button', { type: 'button', disabled: busy, onClick: () => run(fn), ...props }, label);
    const pending = todos.filter(t => t.status === 'pending'), missing = pending.filter(t => !t.launch);
    const filtered = todos.filter(t => tab === 'targets' ? false : tab === 'all' || tab === 'missing' ? tab !== 'missing' || !t.launch && t.status === 'pending' : t.status === tab)
      .filter(t => (t.title + t.targetName + t.details).toLowerCase().includes(query.toLowerCase()))
      .sort((a,b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || b.createdAt.localeCompare(a.createdAt));
    const showForm = (target, todo) => {
      setError(''); setBinding(todo || null);
      setForm(target ? { ...target, identifier: target.packageName || target.originalId, aliases: target.aliases.join('，') } : { ...emptyForm, name: todo?.targetName || '', kind: todo?.kind || emptyForm.kind }); setDialog('target');
    };
    const inspectAndroid = async () => {
      const value = await call('android-status'); setAndroid(value);
      const ready = value.devices.filter(d => d.state === 'device');
      setDeviceSerial(current => ready.some(d => d.serial === current) ? current : ready.length === 1 ? ready[0].serial : '');
    };
    const openAndroid = async () => { setDialog('android'); setError(''); await inspectAndroid(); };
    const lookupMini = async () => { setLookupResult(await call('mini-lookup', { name: lookupName })); };
    const registerCandidate = candidate => {
      setForm({ ...emptyForm, name: lookupName, kind: 'wechat_mini_program', identifier: candidate.originalId,
        source: (candidate.sources || []).map(source => source.url).join('\n') || '用户根据网页搜索结果手动核对' });
      setDialog('target');
    };
    const scan = state?.android || android;
    const scanning = scan?.job?.status === 'scanning';
    const dialogTitle = { launch: '前往 · 启动参数', import: '导入应用目录', target: '登记应用入口', android: '扫描 Android 手机 App' }[dialog];
    const close = () => { setDialog(null); setError(''); };
    const field = (label, key, props = {}) => h('label', { className: props.full ? 'full' : undefined }, label, h('input', { value: form[key] || '', onChange: e => setForm(v => ({ ...v, [key]: e.target.value })), ...Object.fromEntries(Object.entries(props).filter(([k]) => k !== 'full')) }));
    const save = async () => {
      const id = form.id || 'target-' + crypto.randomUUID();
      const target = { id, name: form.name, kind: form.kind, aliases: form.aliases.split(/[,，、\n]/).map(x => x.trim()).filter(Boolean), source: form.source, origin: 'user',
        ...(form.kind === 'android_app' ? { packageName: form.identifier, path: '' } : { originalId: form.identifier, path: form.path }) };
      await call('import-targets', { targets: [target] });
      if (binding) await call('update', { id: binding.id, change: { targetId: id } });
      setNotice({ text: '入口已登记。该标识尚未在真实手机上验证。' }); close();
    };
    const renderDialog = () => !dialog ? null : h('div', { className: 'pocket-dialog-shade', onClick: e => { if (e.target === e.currentTarget && !busy) close(); } }, h('section', { className: 'pocket-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': dialogTitle },
      h('div', { className: 'pocket-actions', style: { justifyContent: 'space-between' } }, h('h2', null, dialogTitle), button('关闭', close)),
      error && h('p', { className: 'pocket-error', role: 'alert' }, error),
      dialog === 'launch' && launch && h(React.Fragment, null,
        h('p', null, launch.targetName, ' · ', launch.title),
        launch.launch ? h(React.Fragment, null, h('pre', { 'aria-label': 'Android 启动参数' }, JSON.stringify(launch.launch, null, 2)), h('p', { className: 'pocket-muted' }, launch.launch.kind === 'wechat_mini_program' ? 'userName 是 gh_ 原始 ID。path 为空表示首页；SDK 需要你的移动应用 AppID、签名及对应平台权限配置。' : 'packageName 可交给手机端 PackageManager 启动入口。'), button('复制启动参数', async () => { await navigator.clipboard.writeText(JSON.stringify(launch.launch, null, 2)); setNotice({ text: '启动参数已复制' }); }))
          : h(React.Fragment, null, h('p', { className: 'pocket-warn' }, launch.message),
            ...(launch.resolution.candidates || []).map(t => button(`选择 ${t.name} · ${t.originalId || t.packageName}`, async () => { await call('update', { id: binding.id, change: { targetId: t.id } }); setLaunch(await call('launch', { id: binding.id })); }, { key: t.id })),
            button('补充入口', () => showForm(null, binding), { className: 'primary' })),
        h('p', { className: 'pocket-muted' }, '当前为电脑调试预览，不会启动手机，也不会消费积分。')),
      dialog === 'android' && h('div', { className: 'pocket-scan' },
        h('p', null, '连接手机后，自动读取当前 Android 用户的桌面应用名称和包名，并合并到应用目录。'),
        h('ol', null, h('li', null, '用支持数据传输的 USB 线连接电脑与 Android 手机。'), h('li', null, '在手机“开发者选项”中开启“USB 调试”。'), h('li', null, '解锁手机，允许这台电脑的 USB 调试请求，再点击“检测设备”。')),
        h('p', { className: 'pocket-muted' }, '名称通过临时解析安装包读取，临时副本在扫描后删除。微信小程序不属于独立 Android App，仍需单独登记原始 ID。'),
        button('检测设备', inspectAndroid, { disabled: busy || scanning }),
        scan?.error && h('p', { className: 'pocket-error', role: 'alert' }, scan.error),
        scan?.checkedAt && !scan.error && !scan.devices.length && h('p', { role: 'status', className: 'pocket-warn' }, '未检测到 Android 设备。请连接手机、开启并授权 USB 调试后重试。'),
        h('label', null, '选择手机', h('select', { 'aria-label': '选择 Android 手机', value: deviceSerial, disabled: busy || scanning, onChange: e => setDeviceSerial(e.target.value) }, h('option', { value: '' }, '请选择已授权的手机'), ...(scan?.devices || []).map(d => h('option', { key: d.serial, value: d.serial, disabled: d.state !== 'device' }, `${d.label} · ${d.serial} · ${d.state === 'device' ? '已连接' : d.state === 'unauthorized' ? '等待手机授权' : d.state === 'offline' ? '离线' : d.state}`)))),
        scan?.devices?.some(d => d.state === 'unauthorized') && h('p', { className: 'pocket-warn' }, '检测到未授权的手机，请在手机屏幕上点击“允许 USB 调试”，然后重新检测。'),
        h('label', null, h('input', { type: 'checkbox', checked: refreshLabels, disabled: busy || scanning, onChange: e => setRefreshLabels(e.target.checked) }), '重新读取应用名称（忽略缓存，扫描较慢）'),
        h('div', { className: 'pocket-actions' }, button(scanning ? '扫描中…' : '开始扫描并导入', async () => { setAndroid(await call('android-scan', { serial: deviceSerial, refreshLabels })); }, { className: 'primary', disabled: busy || scanning || !deviceSerial || !scan?.devices?.some(d => d.serial === deviceSerial && d.state === 'device') }), scanning && button('取消扫描', () => call('android-cancel'))),
        scan?.job && h('section', { 'aria-label': '手机扫描结果', 'aria-live': 'polite' },
          h('p', null, scanning ? `扫描进度：${scan.job.processed} / ${scan.job.total} 个应用` : scan.job.status === 'completed' ? `扫描完成：导入 ${scan.job.imported} 个应用，新增 ${scan.job.added} 个，更新 ${scan.job.updated} 个。` : scan.job.stage),
          scanning && h('progress', { 'aria-label': '扫描进度', value: scan.job.processed, max: Math.max(scan.job.total, 1) }),
          scanning && h('p', { className: 'pocket-muted' }, scan.job.stage, '。可以关闭窗口，扫描会在后台继续。'),
          scan.job.error && h('p', { className: 'pocket-error', role: 'alert' }, scan.job.error),
          scan.job.unnamed > 0 && h('p', { className: 'pocket-warn' }, `${scan.job.unnamed} 个应用未从安装包读取名称；包名已查询，可在目录补充名称。`),
          !!scan.job.warnings.length && h('details', null, h('summary', null, '查看未完整读取的项目'), ...scan.job.warnings.map((w,i) => h('p', { key: i, className: 'pocket-muted' }, w)))),
        scan?.environment && h('details', null, h('summary', null, '查看扫描环境'), h('p', null, `ADB：${scan.environment.adbPath || '未安装'}`), h('p', null, `应用名称读取工具：${scan.environment.aaptPath || '未安装 Android SDK Build-Tools / AAPT2；只能读取包名'}`))),
      dialog === 'target' && h('form', { onSubmit: e => { e.preventDefault(); run(save); } },
        h('div', { className: 'pocket-form' }, field('应用 / 小程序名称', 'name', { required: true }),
          h('label', null, '目标类型', h('select', { value: form.kind, disabled: !!binding || !!form.id, onChange: e => setForm(v => ({ ...v, kind: e.target.value, identifier: '', path: '' })) }, h('option', { value: 'wechat_mini_program' }, '微信小程序'), h('option', { value: 'android_app' }, 'Android App'))),
          field(form.kind === 'android_app' ? 'Android 包名' : '小程序原始 ID（gh_…）', 'identifier', { required: true, full: true, placeholder: form.kind === 'android_app' ? 'com.example.app' : 'gh_ 开头，不能填 wx 开头的 AppID' }),
          field('名称别名，用逗号分隔', 'aliases', { full: true }), form.kind === 'wechat_mini_program' && field('小程序页面路径（可选，留空进入首页）', 'path', { full: true }),
          field('来源 / 核对依据', 'source', { required: true, full: true, placeholder: '例如运营方接入文档网址、真机扫描、本人核对小程序资料' })),
        h('p', { className: 'pocket-muted' }, '登记只校验格式和保存来源，不代表标识真实性、OpenSDK 权限及页面可达性已验证。'),
        h('button', { type: 'submit', className: 'primary', disabled: busy }, busy ? '保存中…' : '保存入口')),
      dialog === 'import' && h(React.Fragment, null,
        h('p', null, '粘贴 JSON 数组导入已有应用目录，也可以直接使用“连接手机扫描”。整批校验后保存。'),
        h('pre', null, '[{"id":"my-app","name":"应用名","kind":"android_app","packageName":"com.example.app","aliases":[],"source":"设备扫描","origin":"device"}]'),
        h('textarea', { 'aria-label': '应用目录 JSON', value: bulk, onChange: e => setBulk(e.target.value), placeholder: '粘贴 JSON 数组' }),
        button('导入目录', async () => { const result = await call('import-targets', { targets: JSON.parse(bulk) }); setNotice({ text: `已导入 ${result.imported} 个入口` }); setBulk(''); close(); }, { className: 'primary' })))) ;
    return h('div', { className: 'pocket' }, h('style', null, css), h('div', { className: 'pocket-inner' },
      h('header', null, h('div', null, h('span', { className: 'pocket-kicker' }, 'POCKET / 随手记，随时前往'), h('h1', null, '随手待办'), h('p', { className: 'pocket-muted' }, '在主聊天发送一句话或手机截图，把想做的事留下来。')),
        h('div', { className: 'pocket-actions' }, button('刷新', async () => { snapshot = await call('state'); emit(); }))),
      notice && h('div', { className: 'pocket-toast', role: 'status' }, notice.text, ' ', notice.undo && button('撤销删除', async () => { await call('update', { id: notice.undo, change: { deleted: false } }); setNotice(null); }), button('收起', () => setNotice(null))),
      (streamError || error && !dialog) && h('p', { className: 'pocket-error', role: 'alert' }, streamError || error),
      h('div', { className: 'pocket-stats' }, ...[['待处理', pending.length], ['即将到期 · 7天内', pending.filter(t => t.dueAt && Date.parse(t.dueAt) >= Date.now() && Date.parse(t.dueAt) <= Date.now()+7*86400000).length], ['入口待补充', missing.length]].map(([label,n]) => h('div', { key: label, className: 'pocket-stat' }, h('small', null, label), h('b', null, n)))),
      h('div', { className: 'pocket-bar' }, ...[['pending','待处理'],['done','已完成'],['all','全部'],['missing','入口待补充'],['targets','应用目录']].map(([value,label]) => button(label, () => setTab(value), { key: value, 'aria-pressed': tab === value })), h('input', { className: 'pocket-search', 'aria-label': '搜索待办', placeholder: '搜索待办或应用', value: query, onChange: e => setQuery(e.target.value) })),
      !state ? h('p', { className: 'pocket-loading' }, '正在连接 DSH 待办服务…') : tab === 'targets' ? h(React.Fragment, null,
        h('section', { className: 'pocket-note' }, h('h3', null, 'Android 应用'), h('p', null, '扫描已连接手机读取应用名称和包名，也可以手动登记包名。'), h('div', { className: 'pocket-actions' }, button('扫描手机 App', openAndroid, { className: 'primary' }), button('手动添加包名', () => { setForm({ ...emptyForm, kind: 'android_app' }); setDialog('target'); }), button('导入目录 JSON', () => { setDialog('import'); setError(''); }))),
        h('section', { className: 'pocket-note' }, h('h3', null, '微信小程序'), h('p', null, '按名称搜索公开网页中的原始 ID，或手动填写 gh_ 原始 ID。搜索会显示来源；证据不足时请核对后登记。'),
          h('div', { className: 'pocket-lookup' }, h('input', { value: lookupName, onChange: e => setLookupName(e.target.value), placeholder: '输入小程序名称，例如京东内购', 'aria-label': '小程序名称' }), button('搜索原始 ID', lookupMini, { className: 'primary', disabled: busy || lookupName.trim().length < 2 })),
          lookupResult && h('div', { className: 'pocket-lookup-result', role: 'status' },
            h('strong', null, lookupResult.status === 'resolved_web' ? `已找到并登记：${lookupResult.target.originalId}` : lookupResult.status === 'already_configured' ? `目录已有：${lookupResult.target.originalId}` : lookupResult.status === 'not_found' ? '未找到可核验的原始 ID' : lookupResult.status === 'lookup_unavailable' ? '联网搜索不可用' : '找到候选，请核对后登记'),
            lookupResult.error && h('p', { className: 'pocket-error' }, lookupResult.error),
            lookupResult.note && h('p', { className: 'pocket-muted' }, lookupResult.note),
            ...(lookupResult.candidates || (lookupResult.status === 'needs_confirmation' ? [lookupResult] : [])).map((candidate, index) => h('div', { className: 'pocket-target', key: candidate.originalId + index }, h('div', null, h('code', null, candidate.originalId), ...(candidate.sources || []).map(source => h('p', { key: source.url }, h('a', { href: source.url, target: '_blank', rel: 'noreferrer' }, source.title || source.url)))), candidate.sources?.length ? button('核对并登记', () => registerCandidate(candidate)) : null)),
            ...(lookupResult.sources || []).map(source => h('p', { key: source.url }, h('a', { href: source.url, target: '_blank', rel: 'noreferrer' }, source.title || source.url))),
          ),
          button('手动添加小程序 ID', () => { setForm({ ...emptyForm, kind: 'wechat_mini_program' }); setDialog('target'); })),
        h('div', { className: 'pocket-directory-heading' }, h('h3', null, '已登记入口'), h('small', null, `${targets.length} 个`)),
        ...targets.filter(t => (t.name + t.aliases.join(' ')).toLowerCase().includes(query.toLowerCase())).map(t => h('div', { className: 'pocket-target', key: t.id }, h('div', null, h('strong', null, t.name), ' ', h('span', { className: 'pocket-tag' }, kind(t.kind)), t.name === t.packageName && h('span', { className: 'pocket-tag pocket-warn' }, '名称待补充'), h('p', null, h('code', null, t.originalId || t.packageName)), h('small', null, t.source)), button('编辑', () => showForm(t)))))
        : filtered.length ? filtered.map(t => h('article', { key: t.id, className: 'pocket-card' + (t.status === 'done' ? ' done' : '') },
          h('input', { type: 'checkbox', className: 'pocket-check', checked: t.status === 'done', 'aria-label': `完成：${t.title}`, disabled: busy, onChange: () => run(() => call('update', { id: t.id, change: { status: t.status === 'done' ? 'pending' : 'done' } })) }),
          h('div', null, h('h3', null, t.title), h('span', { className: 'pocket-tag' }, kind(t.kind)), h('span', { className: 'pocket-tag' }, t.targetName), h('span', { className: 'pocket-tag' + (t.launch ? '' : ' pocket-warn') }, t.launch ? '入口已登记' : t.resolution.status === 'ambiguous' ? '需选择目标' : '入口待补充'),
            t.amount && h('p', null, t.amount), t.dueAt && h('p', { className: Date.parse(t.dueAt) < Date.now() ? 'pocket-warn' : undefined }, `${Date.parse(t.dueAt) < Date.now() ? '已过期' : '有效期至'} · ${date(t.dueAt)}`), t.reminderAt && h('p', { className: 'pocket-muted' }, '计划提醒 · ' + date(t.reminderAt) + '（仅记录）'),
            t.details && h('p', { className: 'pocket-muted' }, t.details), h('details', null, h('summary', null, '查看识别依据'), h('p', null, t.evidence), h('small', null, `${t.sourceType === 'screenshot' ? '手机截图' : '文字指令'} · ${date(t.createdAt)}`), t.source.sessionId && button('返回来源聊天', () => ctx.uiWorkspace.openSession(t.source.sessionId)))),
          h('div', { className: 'pocket-actions' }, button('前往', async () => { setLaunch(await call('launch', { id: t.id })); setBinding(t); setDialog('launch'); }, { className: 'primary' }), button('删除', async () => { await call('update', { id: t.id, change: { deleted: true } }); setNotice({ text: `已删除「${t.title}」`, undo: t.id }); }))))
          : h('div', { className: 'pocket-empty' }, h('h3', null, query ? '没有匹配的待办' : '从一句话，或一张截图开始'), h('p', { className: 'pocket-muted' }, '在主聊天试试：“提醒我使用京东内购积分”，或上传包含积分和有效期的手机截图。'), h('p', { className: 'pocket-muted' }, '模型识别后会自动添加到这里，无需在本页重复输入。')),
      h('footer', { className: 'pocket-foot' }, '电脑预览 · 前往仅展示启动参数 · 日期使用北京时间 · 当前不发送系统通知'), renderDialog()));
  }
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'dsh-pocket-todo' }, Panel));
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'dsh-pocket-todo', label: () => '随手待办', order: 32 }, () => h('span', null, '✓')));
  return async () => { await stream.dispose(); await reader; listeners.clear(); };
}
