import crypto from 'node:crypto';
import { fetchText } from '../../lib/http.js';
import { safeSourceUrl } from '../mission.js';

export const PUBLIC_NEWS_FEEDS = [
  { source: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { source: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
];
const MAX_BYTES = 1024 * 1024;
function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, code) => {
    if (code[0] !== '#') return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[code.toLowerCase()];
    const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : '';
  });
}
const clean = (text, max) => decodeXml(text).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// Deliberately limited XML reader: no DTDs, external entities, network expansion, or executable markup.
export function parseNewsFeed(xml, { source, now = Date.now() } = {}) {
  if (typeof xml !== 'string' || Buffer.byteLength(xml) > MAX_BYTES) throw new Error('RSS feed exceeded size limit');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('RSS DTD/entity declarations are not allowed');
  const root = { name: '#document', children: [], text: '' };
  const stack = [root];
  const tokens = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<[^>]+>|[^<]+/gy;
  let offset = 0;
  let nodes = 0;
  while (offset < xml.length) {
    tokens.lastIndex = offset;
    const match = tokens.exec(xml);
    if (!match) throw new Error('Malformed RSS XML');
    const token = match[0]; offset = tokens.lastIndex;
    if (token.startsWith('<!--') || token.startsWith('<?')) continue;
    if (token.startsWith('<![CDATA[')) { stack.at(-1).text += token.slice(9, -3); continue; }
    if (token.startsWith('</')) {
      const name = token.slice(2, -1).trim();
      if (stack.length === 1 || stack.at(-1).name !== name) throw new Error('Malformed RSS closing tag');
      const node = stack.pop(); stack.at(-1).text += node.text;
    } else if (token.startsWith('<')) {
      const parsed = /^<([\w:.-]+)([\s\S]*?)(\/?)>$/.exec(token);
      if (!parsed || ++nodes > 12_000 || stack.length > 32) throw new Error('Malformed or overly complex RSS XML');
      if (parsed[2].replace(/\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*')/g, '').trim()) throw new Error('Malformed RSS attributes');
      const node = { name: parsed[1], attributes: parsed[2], text: '', children: [] };
      stack.at(-1).children.push(node);
      if (!parsed[3]) stack.push(node);
    } else {
      if (stack.length === 1 && token.replace(/^\uFEFF/, '').trim()) throw new Error('Malformed RSS document text');
      stack.at(-1).text += token;
    }
  }
  if (stack.length !== 1 || root.children.length !== 1 || !['rss', 'feed', 'rdf:RDF'].includes(root.children[0].name)) throw new Error('Invalid RSS document');
  const entries = [];
  const walk = (node) => { if (['item', 'entry'].includes(node.name)) entries.push(node); else node.children.forEach(walk); };
  walk(root);
  const seen = new Set();
  const results = [];
  for (const entry of entries.slice(0, 200)) {
    const field = (...names) => entry.children.find((child) => names.includes(child.name));
    const title = clean(field('title')?.text || '', 500);
    const link = field('link');
    const href = /\bhref\s*=\s*["']([^"']+)["']/.exec(link?.attributes || '')?.[1];
    const rawUrl = decodeXml(href || link?.text.trim() || '');
    const url = !/[\u0000-\u0020]/.test(rawUrl) ? safeSourceUrl(rawUrl) : null;
    if (!title || !url || seen.has(url)) continue;
    const date = field('pubDate', 'published', 'updated', 'dc:date')?.text.trim();
    const parsedTime = date ? Date.parse(date) : NaN;
    const time = Number.isFinite(parsedTime) && parsedTime > 0 ? parsedTime : null;
    if (time !== null && (time > now || time < now - 168 * 3_600_000)) continue;
    seen.add(url);
    results.push({ id: `rss-${crypto.createHash('sha256').update(url).digest('hex').slice(0, 20)}`, external_id: url,
      type: 'news', severity: 'info', title, description: clean(field('description', 'summary', 'content')?.text || '', 700),
      url, source: source || 'Public RSS feed', time, publishedAt: time === null ? null : new Date(time).toISOString(),
      latitude: null, longitude: null, provenance: { kind: 'reported', feed: source || 'RSS', timestampKnown: time !== null, verified: false },
    });
    if (results.length >= 80) break;
  }
  return results.sort((a, b) => (b.time || 0) - (a.time || 0) || a.id.localeCompare(b.id));
}

export async function fetchPublicNews({ now = Date.now() } = {}) {
  const settled = await Promise.allSettled(PUBLIC_NEWS_FEEDS.map(async (feed) => parseNewsFeed(
    await fetchText(feed.url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml' } }, 8_000, MAX_BYTES), { source: feed.source, now },
  )));
  const seen = new Set();
  const articles = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .filter((article) => { if (seen.has(article.url)) return false; seen.add(article.url); return true; })
    .sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, 100);
  if (!articles.length) throw new Error('Public RSS feeds returned no usable reports');
  articles.partial = settled.some((result) => result.status === 'rejected');
  return articles;
}
