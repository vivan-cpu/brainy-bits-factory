// Minimal Gemini client: JSON output, model fallback on overload/quota/retired models.
const DEFAULT_MODELS = 'gemini-3-flash-preview,gemini-flash-latest,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-flash-lite-latest';

// A model that is out of quota or timing out is rested for 10 minutes, so one bad model cannot slow every later call of the run.
const resting = new Map();

// images: optional [{mime, data (base64)}] sent before the prompt, for vision questions
export async function askJSON(prompt, {temperature = 0.9, timeoutMs = 120000, images = []} = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const all = (process.env.GEMINI_MODELS || DEFAULT_MODELS).split(',').map((s) => s.trim()).filter(Boolean);
  const awake = all.filter((m) => !(resting.get(m) > Date.now()));
  const models = awake.length ? awake : all;
  const errors = [];
  for (const model of models) {
    let bad = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: {'content-type': 'application/json', 'x-goog-api-key': key},
          body: JSON.stringify({
            contents: [{role: 'user', parts: [...images.map((im) => ({inline_data: {mime_type: im.mime, data: im.data}})), {text: prompt}]}],
            generationConfig: {temperature, responseMimeType: 'application/json'},
          }),
        });
        if ([429, 500, 503, 404].includes(res.status)) {
          errors.push(`${model}: HTTP ${res.status}`);
          if (res.status === 429) bad++;
          if (res.status === 404) { bad = 2; break; }
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        if (!res.ok) throw new Error(`${model}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        return {model, json: JSON.parse(text.replace(/^```json\s*|```$/g, ''))};
      } catch (e) {
        errors.push(`${model}: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
        if (e.name === 'AbortError') bad++;
      } finally {
        clearTimeout(timer);
      }
    }
    if (bad >= 2) resting.set(model, Date.now() + 10 * 60 * 1000);
  }
  throw new Error('All Gemini models failed: ' + errors.join(' | '));
}
