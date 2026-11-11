export const CATEGORIES = [
  'animals', 'space', 'human body', 'science', 'earth and nature', 'ocean life', 'weird history',
  'food science', 'dinosaurs and fossils', 'technology', 'psychology and the brain', 'insects and bugs',
];

const WORLDS = 'ocean (sea, water animals), space (planets, stars), body (human body, health), lab (science, tech, chemistry, history), sky (weather, birds, flight), forest (land animals, plants, insects, nature)';

const SCENE_TYPES = `SCENE TYPES (fields)
- hook: {type, narration, mood, items: [{emoji, at}] (1-3)}
- trio: {type, narration, mood, items: [{emoji, label}] (1-3, label 1-3 words), pulse?: true for beating/throbbing things, dimAt?: word, dim?: [indexes of items that switch off/grey out at dimAt]}  (ONLY use dimAt/dim when the narration literally says something stops, dies, turns off or disappears. Never use it for emphasis.)
- compare: {type, narration, mood, left: {emoji, big, label, at?}, right: {emoji, big, label, at?}, winner?: "left"|"right", revealAt?: word}  (big = short text like "Cu" or "90%", max 6 chars; label max 3 words)
- stat: {type, narration, mood, emoji, value: number, prefix?: string, suffix?: string (e.g. " km/h", "%", "x"), label: 2-6 words, at?: word}
- orbit: {type, narration, mood, center: emoji, around: emoji, count: 3-10, ring?: fraction 0-1 to fill a progress ring (e.g. 0.67 for two thirds), label?: 2-6 words, at?: word}
- journey: {type, narration, mood, actor: emoji, props: [emoji, emoji] (ground scenery), flyer?: emoji passing in the background}
- outro: {type, narration, mood}`;

export function longPrompt({category, used, emojiNames, feedback}) {
  return `You write scripts for "Brainy Bits", a YouTube channel where Brainy, a cute cartoon brain mascot, explains true, surprising facts. This script is for a 3 to 4 minute landscape video: six surprising facts on one theme, ordered so the most surprising fact comes last. Audience: curious people of all ages. Tone: warm, punchy, playful, simple words. Never clickbait a false claim.

TASK: Pick ONE specific, interesting theme in the category "${category}".
${used.length ? `Do NOT repeat any of these already-used topics: ${used.slice(-120).join(' | ')}` : ''}
${feedback ? `The previous draft was rejected for these reasons, fix them or pick a different theme: ${feedback}` : ''}

HARD RULES
- Facts must be accurate and supported by mainstream sources (NASA, Britannica, National Geographic, Smithsonian, peer-reviewed science). No myths, no rounded-up exaggerations, hedge with "about"/"up to" when values vary. Avoid contested records and superlatives unless certain. Use metric units exactly as spoken.
- Total narration 460 to 640 words across every scene.
- Scene 1 MUST be type "hook": ONE short, bold sentence (6-14 words) that teases the whole video. It must NOT give any answer and must contain no numbers. NEVER open with "Did you know", "Have you ever", "In this video", "Today" or "Hey guys". Its first item is shown huge from the first frame, so it must be the most literal emoji of the theme.
- "hookText": 2-5 punchy words shown huge in the first second. It teases, contains no number and no emojis.
- Scene 2 is a trio promising what is coming, in 15-25 words, without revealing any fact.
- Then exactly 6 facts. Each fact starts with one scene of type "chapter", numbered 1 to 6 in order. Its narration (5-12 words) teases that fact without answering it.
- After each chapter come 3 or 4 scenes of types trio, compare, stat, orbit or journey, using at least 2 different types per fact. Each scene's narration is 1-2 spoken sentences (14-32 words) and the visual must match what is being said. Reveal the answer in the second scene of the fact, not in the chapter.
- Vary the wording between facts, and link each fact to the next with a short tease at the end of its last scene.
- Last scene MUST be type "outro" with narration exactly: "Like, share and subscribe to Brainy Bits for more weird facts!"
- Every emoji value MUST be copied exactly from the ALLOWED EMOJI list below (snake_case). Pick the most literal match. Never use "brain" (Brainy the brain is already on screen) unless the fact is about the brain.
- Any "at", "dimAt" or "revealAt" value must be ONE word that appears in that same scene's narration.
- Narration is spoken English: no emojis, no hashtags, no brackets, no abbreviations like "km" (say "kilometers").
- world: one of ${WORLDS}.
- mood per scene: "wow" for the most surprising moments, otherwise "happy".

${SCENE_TYPES}
- chapter: {type, narration, mood, number: 1-6, title: 2-6 words naming the fact without answering it, emoji}

OUTPUT exactly one JSON object:
{
 "topic": "short theme name",
 "hookText": "2-5 WORD HOOK",
 "category": "${category}",
 "world": "...",
 "title": "curious YouTube title, max 70 characters, no emojis, literally true and fully delivered by the video",
 "description": "3 short sentences that add context + 3 to 5 hashtags. Do not use #shorts.",
 "tags": ["8 to 12 search tags"],
 "sources": ["3 to 6 credible sources supporting the main facts"],
 "scenes": [ ... ]
}

ALLOWED EMOJI:
${emojiNames.join(', ')}`;
}

// themes for the daily true-story Short
export const STORY_CATEGORIES = [
  'weird history', 'survival against the odds', 'heroic and clever animals', 'accidental inventions and discoveries',
  'space missions', 'unbelievable coincidences', 'ocean and shipwreck mysteries', 'record-breaking journeys',
];

export function scriptPrompt({category, topic, used, emojiNames, feedback, story = false}) {
  return `You write scripts for "Brainy Bits", a YouTube Shorts channel. Brainy, a cute cartoon brain mascot, narrates ONE mind-blowing but TRUE fact per video. Audience: curious people of all ages. Tone: warm, punchy, playful, simple words. Never clickbait a false claim.

TASK: ${topic ? `Write a script about: "${topic}".` : story ? `Tell ONE gripping, TRUE, well-documented story in the theme "${category}": a real event, person or animal with a clear beginning, a problem, a turning point and a surprising ending.` : `Pick ONE surprising, well-documented topic in the category "${category}".`}
${story ? `STORY RULES (this video is a true story, not a list of facts)
- Follow one main character (a named person, animal, ship or place) through the event, in time order.
- Every scene must make the viewer want the next one: end scenes on a question, a danger or a "but".
- The ending is the payoff: the surprising outcome or twist lands in the last scene before the outro.
- Stick to what reliable sources say happened. Never invent dialogue, names, numbers or details. If something is uncertain, say "historians think" or "reportedly".
- Use journey scenes for travel or chases and compare or stat scenes for the turning point, so the story keeps moving on screen.
- Only use a stat scene for a real, meaningful number from the sources (a weight, a distance, a year count), never a filler number like 1.
- Legends that grew around the story (for example "he never dropped a single shell") must be told as legends ("soldiers said...") or left out.
` : ''}
${used.length ? `Do NOT repeat any of these already-used topics: ${used.slice(-120).join(' | ')}` : ''}
${feedback ? `A fact-checker rejected the previous draft for these reasons, fix them or pick a different topic: ${feedback}` : ''}

HARD RULES
- Facts must be accurate and supported by mainstream sources (NASA, Britannica, National Geographic, Smithsonian, peer-reviewed science). No myths, no rounded-up exaggerations, hedge with "about"/"up to" when values vary.
- Choose facts that are settled and uncontroversial with one widely agreed number. AVOID contested records ("biggest ever", "fastest ever", dinosaur sizes), outdated figures and superlatives unless certain. Use metric units exactly as spoken.
- The title must be literally true and fully delivered by the script.
- ${story ? '6 to 8 scenes. Total narration 80 to 110 words (35 to 45 seconds spoken).' : '5 to 7 scenes. Total narration 60 to 85 words (25 to 32 seconds spoken).'}
- Scene 1 MUST be type "hook" and must stop the scroll in the first 2 seconds: ONE short, bold sentence (6-14 words) that TEASES the fact and makes the viewer need the answer. It must NOT give the answer: no numbers, no measurements and no statement of the main fact. Make it concrete and specific. NEVER open with "Did you know", "Have you ever", "In this video", "Today" or "Hey guys". Bad (gives it away): "A sloth can hold its breath four times longer than a dolphin." Good (teases): "This sleepy animal beats a dolphin at one thing." / "Astronauts left something on the Moon that won't go away." Only the first item in the hook is required; up to 3 badges tease what's coming, and they must not reveal the answer either.
- The FIRST item of the hook scene is shown huge on screen from the very first frame. It must be the most literal emoji of the main subject (the animal, object or body part the video is about).
- "hookText": 2-5 punchy words shown huge on screen in the first second, and the only text on screen at that moment. It must tease, not answer, and must not contain a number (for example "IT BEATS A DOLPHIN" or "IT NEVER GOES AWAY"). No emojis.
- Scene 2 builds the suspense. The answer, with its number or main fact, lands in scene 3 or later, around the middle of the video.
- Keep the energy high: short sentences, vivid verbs, at least one surprising twist in the middle ("But here's the crazy part..."). The twist scene should be a compare, stat or orbit with a clear visual reveal, not a static row of icons.
- Last scene MUST be type "outro" with narration exactly: "Like, share and subscribe to Brainy Bits for more weird facts!"
- Middle scenes: use at least 3 DIFFERENT types from trio, compare, stat, orbit, journey. Each middle scene narration is 1-2 short spoken sentences (8-22 words) and the visual must match what is being said.
- Every emoji value MUST be copied exactly from the ALLOWED EMOJI list below (snake_case). Pick the most literal match. Never use "brain" (Brainy the brain is already on screen) unless the fact is about the brain.
- Any "at", "dimAt" or "revealAt" value must be ONE word that appears in that same scene's narration.
- Narration is spoken English: no emojis, no hashtags, no brackets, no abbreviations like "km" (say "kilometers").
- world: one of ${WORLDS}.
- mood per scene: "wow" for the most surprising moments, otherwise "happy".

${SCENE_TYPES}

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

Reject ONLY for real problems: a claim that is false, a popular myth, a clearly wrong number, a title that is false, or (in a story) an unverifiable legend or invented detail stated as certain fact. Do NOT reject for harmless vivid wording, rounding within normal ranges, unit naming (tons vs tonnes), or simplification for a general audience.

Return JSON: {"ok": true|false, "problems": ["each problem in one sentence"], "confidence": 0-1}`;
}
