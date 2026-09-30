import { BaseProvider } from './base.js';
import { fetchJson } from '../../lib/http.js';

function summarizeLocally(headlines) {
  if (!headlines.length) {
    return 'No recent headlines are available from the connected news feeds. Check the source-health panel or configure a news provider.';
  }
  const selected = headlines.slice(0, 5);
  const bullets = selected.map((item) => {
    const region = item.region && item.region !== 'GLOBAL' ? item.region : 'GLOBAL';
    const title = String(item.title || '').replace(/\s+/g, ' ').slice(0, 230);
    return `• [${region}] ${title}${item.source ? ` — ${item.source}` : ''}`;
  });
  return `${bullets.join('\n')}\n\nOVERALL THREAT LEVEL: ELEVATED\nAutomated local digest from headlines; this is not an AI-generated assessment.`;
}

export class AIProvider extends BaseProvider {
  constructor(getHeadlines) {
    super('openai', { ttlMs: 30 * 60_000, requiredKeys: [], emptyValue: null });
    this.getHeadlines = getHeadlines;
  }
  get isConfigured() { return true; }
  getHealth() { return { ...super.getHealth(), configured: Boolean(this.secret('AI_API_KEY')) }; }
  async _fetchFresh() {
    const headlineResult = await this.getHeadlines();
    const headlines = Array.isArray(headlineResult) ? headlineResult : [];
    const apiKey = this.secret('AI_API_KEY');
    if (!apiKey) {
      return {
        content: summarizeLocally(headlines), model: 'local headline digest', source: 'local-fallback',
        fallback: true, generatedAt: new Date().toISOString(), headlineCount: headlines.length,
      };
    }
    const baseUrl = String(process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const payload = await fetchJson(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are WORLDGPZ, a careful OSINT news summarizer for ThaddeusTechz. Use only the supplied headlines. Do not invent facts, sources, casualty counts, or certainty. Clearly distinguish reported claims from verified information. Produce 3–5 concise regional bullets and a brief, cautious overall signal level.' },
          { role: 'user', content: `Summarize these ${Math.min(headlines.length, 35)} recent headlines. If evidence is thin, say so.\n\n${headlines.slice(0, 35).map((item) => `- ${item.title} (${item.source || 'source unknown'})`).join('\n')}` },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    }, 20_000);
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('OpenAI returned an empty briefing.');
    return { content, model: payload.model || process.env.AI_MODEL || 'gpt-4o-mini', source: 'openai', generatedAt: new Date().toISOString(), headlineCount: headlines.length };
  }
}
