import path from 'node:path';
import os from 'node:os';
import Schema from '@deepseek-ai/schemastery';
import { TodoStore } from './store.mjs';
import { PocketTodoControl } from './native.mjs';
import { AndroidScanner } from './android-scan.mjs';
import { installTools, installMiniLookupTool } from './tools.mjs';
export const name = 'dsh-pocket-todo';
export const inject = ['tools', 'agents', 'systemPrompt', 'typert'];
export const Config = Schema.object({
  dataDir: Schema.string().default('').description('本地待办目录；默认按 DSH profile 隔离'),
  androidSdkRoot: Schema.string().default('').description('Android SDK 目录；留空自动检测'),
  adbPath: Schema.string().default('').description('adb 可执行文件路径；留空自动检测'),
  aaptPath: Schema.string().default('').description('aapt2 可执行文件路径；用于读取应用名称，留空自动检测'),
});
export function apply(ctx, config = {}) {
  const profile = ctx.get('profileContext')?.name || 'web';
  const root = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  const store = new TodoStore(config.dataDir || path.join(root, 'pocket-todo', profile));
  const scanner = new AndroidScanner(store, config);
  ctx.effect(() => async () => { await scanner.close(); store.close(); });
  const control = new PocketTodoControl(ctx, store, scanner);
  installTools(ctx, store);
  // Optional web search capability; the todo plugin still loads without it.
  ctx.inject(['web'], webCtx => {
    control.setWeb(webCtx.web);
    webCtx.effect(() => () => control.setWeb(null));
    installMiniLookupTool(ctx, store, webCtx.web);
  });
}
