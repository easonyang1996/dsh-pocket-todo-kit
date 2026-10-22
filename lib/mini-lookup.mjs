import { createHash } from 'node:crypto';
import { normalizeName, targetSchema } from './domain.mjs';

const ID = /\bgh_[a-zA-Z0-9]{8,40}\b/g;
const clean = value => String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|#160);/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ').trim().slice(0, 120_000);
const normalized = value => normalizeName(clean(value));

function publicHttps(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
      !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i.test(parsed.hostname);
  } catch { return false; }
}

function sourceEvidence(source, body, name) {
  const title = clean(source.title);
  const snippet = clean(source.snippet);
  const text = clean(`${title} ${snippet} ${body}`);
  const needle = normalized(name);
  const spans = [...text.matchAll(ID)].filter(match => {
    const start = Math.max(0, match.index - 300), end = Math.min(text.length, match.index + match[0].length + 300);
    return normalized(text.slice(start, end)).includes(needle);
  });
  return [...new Set(spans.map(match => match[0]))].map(originalId => ({
    originalId,
    source: { url: source.url, title: title || source.url, snippet: (snippet || text).slice(0, 500) },
  }));
}

function slug(name, originalId) {
  const base = normalizeName(name).replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'mini';
  const digest = createHash('sha256').update(`${name}\0${originalId}`).digest('hex').slice(0, 10);
  return `web-${base}-${digest}`;
}

/** Search public web sources for a name-to-gh_ mapping. Low-confidence results are never saved. */
export async function lookupMiniProgram(store, web, name) {
  const query = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  if (query.length < 2) throw new Error('请提供至少两个字的小程序名称');
  const exact = store.data.targets.filter(target => target.kind === 'wechat_mini_program' &&
    [target.name, ...target.aliases].some(value => normalizeName(value) === normalizeName(query)));
  if (exact.length === 1) return { status: 'already_configured', target: exact[0], sources: [] };
  if (exact.length > 1) return { status: 'ambiguous_local', candidates: exact.map(target => ({ name: target.name, id: target.id, originalId: target.originalId })) };

  const queries = [`"${query}" 微信小程序 原始ID gh_`, `"${query}" 小程序 "gh_"`];
  const results = await Promise.all(queries.map(q => web.search({ query: q, maxResults: 8 })));
  const byUrl = new Map();
  for (const source of results.flatMap(result => result.sources || [])) {
    if (publicHttps(source.url)) byUrl.set(source.url, { ...source, bodies: [] });
  }
  const sources = [...byUrl.values()].slice(0, 8);
  await Promise.all(sources.slice(0, 5).map(async source => {
    try {
      const page = await web.fetch({ url: source.url });
      if (page.statusCode >= 200 && page.statusCode < 300) source.bodies.push(clean(page.body?.content));
    } catch { /* Search snippets remain usable evidence when page fetch is unavailable. */ }
  }));

  const evidence = sources.flatMap(source => sourceEvidence(source, source.bodies.join(' '), query));
  const grouped = new Map();
  for (const item of evidence) {
    const group = grouped.get(item.originalId) || { originalId: item.originalId, sources: [], hosts: [] };
    if (!group.sources.some(source => source.url === item.source.url)) group.sources.push(item.source);
    const host = new URL(item.source.url).hostname.toLowerCase();
    if (!group.hosts.includes(host)) group.hosts.push(host);
    grouped.set(item.originalId, group);
  }
  const candidates = [...grouped.values()].sort((a, b) => b.sources.length - a.sources.length);
  if (candidates.length !== 1) return {
    status: candidates.length ? 'ambiguous_web' : 'not_found', query,
    candidates: candidates.map(candidate => ({ ...candidate, confidence: candidate.hosts.length >= 2 ? 'corroborated' : 'single_source' })),
    note: '网页结果不是微信官方目录；未自动登记或生成可拉起参数。',
  };

  const candidate = candidates[0];
  const official = candidate.sources.some(source => {
    try { const host = new URL(source.url).hostname.toLowerCase(); return host === 'weixin.qq.com' || host.endsWith('.weixin.qq.com') || host.endsWith('.tencent.com'); }
    catch { return false; }
  });
  if (candidate.hosts.length < 2 && !official) return {
    status: 'needs_confirmation', query, ...candidate, confidence: 'single_source',
    note: '只找到一个非微信/腾讯来源；请确认名称和来源后再登记。',
  };

  const target = targetSchema.parse({
    id: slug(query, candidate.originalId), name: query, kind: 'wechat_mini_program',
    aliases: [], originalId: candidate.originalId, path: '',
    source: `网页搜索核验：${candidate.sources.map(source => source.url).join(' ; ')}`,
    origin: 'web',
  });
  store.importTargets([target]);
  return { status: 'resolved_web', target, confidence: official ? 'official_domain' : 'corroborated', sources: candidate.sources,
    note: '原始ID来自公开网页证据并已加入本地目录；这不能证明小程序允许当前调用方拉起。' };
}
