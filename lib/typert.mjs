import { descriptors } from './contracts.mjs';
export const TYPERT = { package: 'dsh-pocket-todo', face: 'host', schemas: [], invocations: descriptors,
  model: { services: [{ key: 'pocketTodoControl', exportName: 'PocketTodoControl', tags: [], members: [
    { kind: 'method', name: 'dispatch', signature: 'dispatch(request: Request): Promise<JsonValue>' },
    { kind: 'method', name: 'watch', signature: 'watch(signal: AbortSignal): AsyncIterable<JsonValue>' },
  ], types: [] }], events: [], objects: [] } };
