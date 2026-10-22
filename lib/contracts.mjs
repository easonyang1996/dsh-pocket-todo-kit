import { z } from 'zod';
export const requestSchema = z.object({ action: z.enum(['state', 'update', 'import-targets', 'launch', 'android-status', 'android-scan', 'android-cancel', 'mini-lookup']), data: z.json().optional() }).strict();
export const descriptor = (method, stream = false) => ({
  id: `dsh-pocket-todo#pocketTodo/${method}`, service: 'pocketTodoControl', namespace: 'pocketTodo', method, invocation: { kind: 'direct' },
  parameters: method === 'dispatch' ? [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-pocket-todo#Request', create: () => requestSchema } }] : [],
  ...(stream ? { mode: 'stream', cancellation: { parameter: 'signal' } } : {}),
  result: { mode: 'strict', typeSymbol: 'dsh-pocket-todo#Json', create: () => z.json() },
});
export const descriptors = [descriptor('dispatch'), descriptor('watch', true)];
