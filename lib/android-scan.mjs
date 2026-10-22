import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { metadataApk } from './apk-metadata.mjs';
const exec = promisify(execFile);
const packagePattern = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/;
const serialPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/;
export function parseDevices(text) {
  return text.split(/\r?\n/).flatMap(line => {
    const m = line.trim().match(/^(\S+)\s+(device|offline|unauthorized|recovery|sideload|bootloader|no permissions)(?:\s|$)(.*)$/);
    if (!m || !serialPattern.test(m[1])) return [];
    const model = m[3].match(/(?:^|\s)model:(\S+)/)?.[1]?.replace(/_/g, ' ').slice(0,100) || '';
    return [{ serial: m[1], state: m[2], model, label: model || m[1] }];
  });
}
export function parseLauncherPackages(text) {
  const packages = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^([\w.]+)\/[\w.$]+$/);
    if (m && packagePattern.test(m[1])) packages.add(m[1]);
  }
  return [...packages].sort();
}
export function parseApkPaths(text) {
  return text.split(/\r?\n/).flatMap(line => {
    const m = line.trim().match(/^package:(\/[a-zA-Z0-9_~\/=+.,@%:-]+\.apk)$/);
    return m ? [m[1]] : [];
  });
}
export function parseBadging(text, expectedPackage, locale = 'zh-CN') {
  const pkg = text.match(/^package: name='([^']+)'/m)?.[1];
  if (pkg !== expectedPackage) throw new Error('APK 包名与设备查询结果不一致');
  const labels = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^application-label(?:-([^:]+))?:'(.*)'$/);
    if (!match) continue;
    const label = match[2].replace(/\\'/g, "'").replace(/\\n/g, ' ').trim();
    if (label && label.length <= 100 && !/^(@|0x[\da-f]+$|resource:)/i.test(label)) labels.set((match[1] || '').toLowerCase().replace(/_/g, '-'), label);
  }
  const fallback = (text.match(/^application: label='(.*)' icon='/m)?.[1] || text.match(/^launchable-activity: .* label='(.*)' icon='/m)?.[1] || '').replace(/\\'/g, "'").replace(/\\n/g, ' ').trim();
  if (!labels.has('') && fallback && fallback.length <= 100 && !/^(@|0x[\da-f]+$|resource:)/i.test(fallback)) labels.set('', fallback);
  const language = locale.toLowerCase().replace(/_/g, '-');
  const name = labels.get(language) || labels.get(language.split('-')[0]) || labels.get('') || [...labels.values()][0] || '';
  return { name, aliases: [...new Set(labels.values())].filter(v => v !== name).slice(0, 20) };
}
function executable(candidates) {
  return candidates.find(file => { try { fs.accessSync(file, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK); return fs.statSync(file).isFile(); } catch { return false; } }) || '';
}
export function discoverAndroidTools(config = {}, env = process.env, home = os.homedir()) {
  const roots = [...new Set([config.androidSdkRoot, env.ANDROID_SDK_ROOT, env.ANDROID_HOME, path.join(home,'Library/Android/sdk'), path.join(home,'Android/Sdk'), env.LOCALAPPDATA && path.join(env.LOCALAPPDATA,'Android/Sdk')].filter(Boolean))];
  const ext = process.platform === 'win32' ? '.exe' : '';
  const onPath = name => (env.PATH || '').split(path.delimiter).filter(Boolean).map(dir => path.join(dir, name + ext));
  const adbPath = config.adbPath ? executable([config.adbPath]) : executable([...onPath('adb'), ...roots.map(root => path.join(root,'platform-tools','adb'+ext))]);
  if (adbPath) roots.unshift(path.dirname(path.dirname(adbPath)));
  const aapts = [];
  for (const root of roots) {
    const dir = path.join(root, 'build-tools');
    try { for (const version of fs.readdirSync(dir).sort((a,b) => b.localeCompare(a,undefined,{numeric:true}))) aapts.push(path.join(dir,version,'aapt2'+ext)); } catch { /* SDK not installed at this candidate */ }
  }
  const aaptPath = config.aaptPath ? executable([config.aaptPath]) : executable([...onPath('aapt2'), ...aapts]);
  return { adbPath, aaptPath, adbAvailable: !!adbPath, labelsAvailable: !!aaptPath };
}
const failureText = error => {
  if (error.name === 'AbortError') return '扫描已取消';
  const raw = String(error.stderr || error.message || '未知错误');
  if (/unauthorized/i.test(raw)) return '手机尚未授权，请解锁手机并允许 USB 调试后重新检测';
  if (/offline|device .*not found|no devices|disconnected|closed|transport error/i.test(raw)) return '手机已断开或离线，请重新连接后扫描';
  if (error.killed || error.code === 'ETIMEDOUT') return '设备命令超时，请检查手机连接后重试';
  return raw.replace(/\s+/g, ' ').slice(0, 350);
};
export class AndroidScanner {
  constructor(store, config = {}, deps = {}) {
    this.store = store; this.config = config; this.run = deps.run || ((file,args,opts) => exec(file,args,{encoding:'utf8',timeout:15000,maxBuffer:8*1024*1024,windowsHide:true,...opts}));
    this.discover = deps.discover || (() => discoverAndroidTools(config));
    this.listeners = new Set(); this.state = { environment: this.discover(), devices: [], checkedAt: null, error: '', job: null };
    this.cacheFile = path.join(store.dir, 'android-label-cache.json');
    try { const v=JSON.parse(fs.readFileSync(this.cacheFile,'utf8')); this.cache = v.version === 1 && v.labels && typeof v.labels === 'object' ? v.labels : {}; } catch { this.cache = {}; }
    this.closed = false;
  }
  snapshot() { return structuredClone(this.state); }
  changed() { for (const f of this.listeners) { try { f(this.snapshot()); } catch { /* observer */ } } }
  async command(args, signal, opts = {}) {
    const r = await this.run(this.state.environment.adbPath,args,{signal,...opts});
    return typeof r === 'string' ? r : r.stdout || '';
  }
  async inspect() {
    this.state.environment = this.discover(); this.state.error = ''; this.state.devices = [];
    if (!this.state.environment.adbAvailable) this.state.error = '未找到 ADB。请安装 Android SDK Platform-Tools，或在插件配置中指定 adbPath。';
    else try { this.state.devices = parseDevices(await this.command(['devices','-l'])); } catch (e) { this.state.error = failureText(e); }
    this.state.checkedAt = new Date().toISOString(); this.changed(); return this.snapshot();
  }
  async start(serial, { refreshLabels = false } = {}) {
    if (this.closed) throw new Error('扫描服务已停止');
    if (this.running) throw new Error('已有扫描进行中，请等待或先取消');
    if (typeof serial !== 'string' || !serialPattern.test(serial)) throw new Error('请明确选择已连接的手机');
    const state = await this.inspect();
    if (this.running) throw new Error('已有扫描进行中');
    if (state.error) throw new Error(state.error);
    const device = state.devices.find(d => d.serial === serial);
    if (!device) throw new Error('所选设备未连接，请重新检测设备');
    if (device.state !== 'device') throw new Error(device.state === 'unauthorized' ? '请先在手机上允许 USB 调试，再重新检测设备' : '所选设备未就绪：' + device.state);
    this.controller = new AbortController();
    this.state.job = { id: randomUUID(), serial, deviceName: device.label, status: 'scanning', stage: '读取应用列表', total: 0, processed: 0, imported: 0, added: 0, updated: 0, unnamed: 0, warnings: [], startedAt: new Date().toISOString() };
    this.changed();
    this.running = this.scan(device, refreshLabels, this.controller.signal).finally(() => { this.running = null; this.controller = null; });
    return this.snapshot();
  }
  cancel() { this.controller?.abort(); return { cancelling: !!this.running }; }
  async scan(device, refreshLabels, signal) {
    const job = this.state.job, collected = [], nextCache = { ...this.cache };
    let temp;
    const shell = (...args) => this.command(['-s',device.serial,'shell',...args],signal);
    const warning = text => { if (job.warnings.length < 25) job.warnings.push(text); };
    try {
      const user = (await shell('am','get-current-user')).trim();
      if (!/^\d{1,6}$/.test(user)) throw new Error('无法确定手机当前用户，已停止扫描');
      job.user = Number(user);
      const raw = await shell('cmd','package','query-activities','--brief','--components','--user',user,'-a','android.intent.action.MAIN','-c','android.intent.category.LAUNCHER');
      if (/Error:|Exception|Unknown command|SecurityException/i.test(raw)) throw new Error('手机不支持应用入口查询：' + raw.slice(0,160));
      const packages = parseLauncherPackages(raw);
      if (!packages.length && !/No activities found|0 activities found/i.test(raw)) throw new Error('未能解析手机应用列表，未导入任何内容');
      if (packages.length > 1000) throw new Error('可启动应用超过1000个，请检查设备返回内容');
      job.total = packages.length;
      let locale = 'zh-CN';
      try { locale = (await shell('getprop','persist.sys.locale')).trim() || 'zh-CN'; } catch (e) { if (signal.aborted) throw e; }
      let fastMetadata = false;
      if (this.state.environment.labelsAvailable) {
        try { fastMetadata = /\/unzip\s*$/.test(await shell('command','-v','unzip')); } catch (e) { if (signal.aborted) throw e; }
      }
      job.readMode = fastMetadata ? 'metadata' : 'full_apk'; job.fullApkFallbacks = 0;
      if (!this.state.environment.labelsAvailable) warning('未找到 AAPT2：包名仍来自设备，无法读取的应用名称需要在目录中补充。安装 Android SDK Build-Tools 后可重新扫描。');
      temp = fs.mkdtempSync(path.join(os.tmpdir(),'pocket-android-scan-'));
      for (const pkg of packages) {
        signal.throwIfAborted(); job.stage = pkg; this.changed();
        let label = { name: '', aliases: [] };
        try {
          if (this.state.environment.labelsAvailable) {
            const paths = parseApkPaths(await shell('pm','path','--user',user,pkg));
            const apk = paths.find(p => /\/base\.apk$/.test(p)) || paths[0];
            if (!apk) throw new Error('无法读取 APK 路径');
            const stamp = (await shell('stat','-c','%s:%Y',apk)).trim();
            if (!/^\d+:\d+$/.test(stamp)) throw new Error('无法读取 APK 大小和更新时间');
            const size = Number(stamp.split(':')[0]);

            const key = createHash('sha256').update(JSON.stringify([device.serial,user,pkg,apk,stamp,locale])).digest('hex');
            const cached = nextCache[key];
            if (!refreshLabels && cached && typeof cached.name === 'string' && cached.name.length <= 100 && Array.isArray(cached.aliases)) label = cached;
            else {
              const local = path.join(temp,'base.apk');
              try {
                let metadataReady = false;
                if (fastMetadata) {
                  try {
                    const readEntry = (name,maxBuffer) => this.command(['-s',device.serial,'exec-out','unzip','-p',apk,name],signal,{encoding:null,maxBuffer,timeout:30000});
                    const manifest = await readEntry('AndroidManifest.xml',4*1024*1024);
                    let resources;
                    try { resources = await readEntry('resources.arsc',64*1024*1024); }
                    catch(e) { if (signal.aborted || !/not matched|not found|no file.*resources|filename.*resources/i.test(String(e.stderr||e.message))) throw e; }
                    fs.writeFileSync(local,metadataApk(manifest,resources)); metadataReady = true;
                  } catch(e) { if (signal.aborted) throw e; job.fullApkFallbacks++; }
                }
                if (!metadataReady) {
                  if (size > 512*1024*1024) throw new Error('APK超过512MB，跳过完整安装包名称读取');
                  await this.command(['-s',device.serial,'pull',apk,local],signal,{timeout:90000});
                  if (fs.statSync(local).size > 512*1024*1024) throw new Error('APK超过512MB');
                }
                const readLabels = async () => {
                  const dump = await this.run(this.state.environment.aaptPath,['dump','badging',local],{signal,timeout:20000,maxBuffer:8*1024*1024,encoding:'utf8'});
                  return parseBadging(typeof dump === 'string' ? dump : dump.stdout,pkg,locale);
                };
                try { label = await readLabels(); }
                catch(e) {
                  if (signal.aborted || !metadataReady || size > 512*1024*1024) throw e;
                  job.fullApkFallbacks++;
                  await this.command(['-s',device.serial,'pull',apk,local],signal,{timeout:90000});
                  if (fs.statSync(local).size > 512*1024*1024) throw new Error('APK超过512MB');
                  label = await readLabels();
                }
                nextCache[key] = label;
              } finally { fs.rmSync(local,{force:true}); }
            }
          }
        } catch (e) {
          if (signal.aborted) throw e;
          if (/device .*not found|offline|no devices|disconnected|transport error|unauthorized/i.test(String(e.stderr || e.message))) throw e;
          warning(pkg + '：' + failureText(e));
        }
        if (!label.name) job.unnamed++;
        collected.push({ id: 'android-' + createHash('sha256').update(pkg).digest('hex').slice(0,24), name: label.name || pkg, kind: 'android_app', packageName: pkg,
          aliases: label.aliases || [], origin: 'device', source: `Android ADB 扫描 · ${device.label} · 用户 ${user} · ${job.startedAt}${label.name ? '' : ' · 名称未读取，仅确认包名'}` });
        job.processed++; this.changed();
      }
      signal.throwIfAborted();
      if (collected.length) Object.assign(job, this.store.importDeviceTargets(collected));
      this.cache = Object.fromEntries(Object.entries(nextCache).slice(-3000));
      const cacheTemp = this.cacheFile + '.' + randomUUID() + '.tmp';
      try { fs.writeFileSync(cacheTemp,JSON.stringify({version:1,labels:this.cache}),{mode:0o600}); fs.renameSync(cacheTemp,this.cacheFile); }
      catch { warning('名称缓存未保存，下一次扫描将重新读取；已导入的应用目录不受影响。'); }
      finally { fs.rmSync(cacheTemp,{force:true}); }
      job.status = 'completed'; job.stage = collected.length ? '扫描完成，已导入应用目录' : '未找到可启动应用';
    } catch (e) {
      job.status = signal.aborted ? 'cancelled' : 'failed'; job.error = failureText(e); job.stage = signal.aborted ? '已取消，未导入扫描结果' : '扫描失败，未导入扫描结果';
    } finally { if (temp) fs.rmSync(temp,{recursive:true,force:true}); job.finishedAt = new Date().toISOString(); this.changed(); }
  }
  async close() { this.closed = true; this.controller?.abort(); await this.running; this.listeners.clear(); }
}
