// Tapestry — smart search (paraphrase / scene-description → verse references)
//
// Ready to go, not yet active: this needs GROQ_API_KEY set as an environment
// variable on the Netlify site (Site settings → Environment variables), and
// this whole netlify/ folder needs the site to be deployed via a connected
// Git repo rather than plain drag-and-drop (serverless functions aren't part
// of a static-file drop — see the setup notes in the chat for the two ways
// to get there).
//
// Uses Groq's free tier (no credit card, ~1,000 requests/day at the time
// this was written) serving an open-weight model — genuinely free for
// personal-scale use, not a trial. This function only ever returns
// REFERENCES, never verse text — the app always resolves the actual wording
// live against bible-api.com, so an LLM never gets to "quote" scripture.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 501,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'GROQ_API_KEY is not set on this site yet — smart search is built but not activated.' }),
    };
  }

  let query;
  try {
    query = JSON.parse(event.body || '{}').query;
  } catch (e) {
    return { statusCode: 400, body: 'Invalid request body' };
  }
  if (!query || typeof query !== 'string' || query.length > 500) {
    return { statusCode: 400, body: 'Missing or invalid "query"' };
  }

  const systemPrompt = `You help identify Bible verse references from a paraphrase, a partial quote, or a description of a scene or event. Reply with ONLY a JSON array of up to 5 scripture references in the form "Book Chapter:Verse" or "Book Chapter:Verse-Verse" (e.g. ["Genesis 37:23-24", "Psalm 23:1"]). Never include verse text, commentary, or anything other than the JSON array. If nothing comes to mind with reasonable confidence, reply with [].`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Groq request failed', detail: text }) };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    let references = [];
    try {
      references = JSON.parse(content.trim());
      if (!Array.isArray(references)) references = [];
    } catch (e) {
      references = [];
    }
    references = references.filter(r => typeof r === 'string').slice(0, 5);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ references }),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not reach Groq', detail: String(e) }) };
  }
};
