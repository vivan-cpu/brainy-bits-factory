export const CATEGORIES = [
  'animals', 'space', 'human body', 'science', 'earth and nature', 'ocean life', 'weird history',
  'food science', 'dinosaurs and fossils', 'technology', 'psychology and the brain', 'insects and bugs',
];

const WORLDS = 'ocean (sea, water animals), space (planets, stars), body (human body, health), lab (science, tech, chemistry, history), sky (weather, birds, flight), forest (land animals, plants, insects, nature)';

export function scriptPrompt({category, topic, used, emojiNames, feedback}) {
  return `You write scripts for "Brainy Bits", a YouTube Shorts channel. Brainy, a cute cartoon brain mascot, narrates ONE mind-blowing but TRUE fact per video. Audience: curious people of all ages. Tone: warm, punchy, playful, simple words. Never clickbait a false claim.

TASK: ${topic ? `Write a script about: "${topic}".` : `Pick ONE surprising, well-documented topic in the category "${category}".`}
${used.length ? `Do NOT repeat any of these already-used topics: ${used.slice(-120).join(' | ')}` : ''}
${feedback ? `A fact-checker rejected the previous draft for these reasons, fix them or pick a different topic: ${feedback}` : ''}

HARD RULES
- Facts must be accurate and supported by mainstream sources (NASA, Britannica, National Geographic, Smithsonian, peer-reviewed science). No myths, no rounded-up exaggerations, hedge with "about"/"up to" when values vary.
- Choose facts that are settled and uncontroversial with one widely agreed number. AVOID contested records ("biggest ever", "fastest ever", dinosaur sizes), outdated figures and superlatives unless certain. Use metric units exactly as spoken.
- The title must be literally true and fully delivered by the script.
- 5 to 7 scenes. Total narration 60 to 85 words (25 to 32 seconds spoken).
- Scene 1 MUST be type "hook" and must stop the scroll in the first 2 seconds: ONE short, bold sentence (6-14 words) that states the most shocking part of the fact or asks a question the viewer can't ignore. Make it concrete and specific. NEVER open with "Did you know", "Have you ever", "In this video", "Today" or "Hey guys". Good examples: "This animal can survive in space with no suit." / "Your body glows in the dark. You just can't see it." Up to 3 badges tease what's coming.
- "hookText": 2-5 punchy words shown huge on screen in the first second (for example "IT SURVIVES IN SPACE"). No emojis.
- Keep the energy high: short sentences, vivid verbs, at least one surprising twist in the middle ("But here's the crazy part...").
- Last scene MUST be type "outro" with narration exactly: "Like, share and subscribe to Brainy Bits for more weird facts!"
- Middle scenes: use at least 3 DIFFERENT types from trio, compare, stat, orbit, journey. Each middle scene narration is 1-2 short spoken sentences (8-22 words) and the visual must match what is being said.
- Every emoji value MUST be copied exactly from the ALLOWED EMOJI list below (snake_case). Pick the most literal match.
- Any "at", "dimAt" or "revealAt" value must be ONE word that appears in that same scene's narration.
- Narration is spoken English: no emojis, no hashtags, no brackets, no abbreviations like "km" (say "kilometers").
- world: one of ${WORLDS}.
- mood per scene: "wow" for the most surprising moments, otherwise "happy".

SCENE TYPES (fields)
- hook: {type, narration, mood, items: [{emoji, at}] (1-3)}
- trio: {type, narration, mood, items: [{emoji, label}] (1-3, label 1-3 words), pulse?: true for beating/throbbing things, dimAt?: word, dim?: [indexes of items that switch off/grey out at dimAt]}
- compare: {type, narration, mood, left: {emoji, big, label, at?}, right: {emoji, big, label, at?}, winner?: "left"|"right", revealAt?: word}  (big = short text like "Cu" or "90%", max 6 chars; label max 3 words)
- stat: {type, narration, mood, emoji, value: number, prefix?: string, suffix?: string (e.g. " km/h", "%", "x"), label: 2-6 words, at?: word}
- orbit: {type, narration, mood, center: emoji, around: emoji, count: 3-10, ring?: fraction 0-1 to fill a progress ring (e.g. 0.67 for two thirds), label?: 2-6 words, at?: word}
- journey: {type, narration, mood, actor: emoji, props: [emoji, emoji] (ground scenery), flyer?: emoji passing in the background}
- outro: {type, narration, mood}

OUTPUT exactly one JSON object:
{
 "topic": "short topic name",
 "hookText": "2-5 WORD HOOK",
 "category": "${category}",
 "world": "...",
 "title": "curious YouTube title, max 60 characters, no emojis",
 "description": "2 short sentences that add context + 3 to 5 hashtags including #shorts",
 "tags": ["8 to 12 search tags"],
 "sources": ["1 to 3 credible sources supporting the main facts"],
 "scenes": [ ... ]
}

ALLOWED EMOJI:
${emojiNames.join(', ')}`;
}

export function factCheckPrompt(spec) {
  const lines = spec.scenes.map((s, i) => `${i + 1}. ${s.narration}${s.type === 'stat' ? ` [on screen: ${s.prefix || ''}${s.value}${s.suffix || ''} ${s.label || ''}]` : ''}${s.type === 'compare' ? ` [on screen: ${s.left?.big} ${s.left?.label} vs ${s.right?.big} ${s.right?.label}]` : ''}`).join('\n');
  return `You are a strict fact-checker for an educational YouTube Shorts channel. Check every factual claim in this script, including on-screen numbers.
Topic: ${spec.topic}
Script:
${lines}
Title: ${spec.title}

Reject ONLY for real problems: a claim that is false, a popular myth, a clearly wrong number, or a title that is false. Do NOT reject for harmless vivid wording, rounding within normal ranges, unit naming (tons vs tonnes), or simplification for a general audience.

Return JSON: {"ok": true|false, "problems": ["each problem in one sentence"], "confidence": 0-1}`;
}
