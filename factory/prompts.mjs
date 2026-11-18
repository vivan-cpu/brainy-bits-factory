// animal and ocean Shorts get 3 to 8 times the views of the rest (Nov 2026 stats), so they come up about half the time
export const CATEGORIES = [
  'animals', 'space', 'ocean life', 'human body', 'animals', 'science', 'ocean life', 'earth and nature',
  'animals', 'weird history', 'insects and bugs', 'food science', 'ocean life', 'dinosaurs and fossils',
  'animals', 'technology', 'ocean life', 'psychology and the brain',
];

const WORLDS = 'ocean (sea, water animals), space (planets, stars), body (human body, health), lab (science, tech, chemistry, history), sky (weather, birds, flight), forest (land animals, plants, insects, nature)';

const SCENE_TYPES = `SCENE TYPES (fields)
- hook: {type, narration, mood, items: [{emoji, at}] (1-3)}
- trio: {type, narration, mood, items: [{emoji, label}] (1-3, label 1-3 words), pulse?: true for beating/throbbing things, dimAt?: word, dim?: [indexes of items that switch off/grey out at dimAt]}  (ONLY use dimAt/dim when the narration literally says something stops, dies, turns off or disappears. Never use it for emphasis.)
- compare: {type, narration, mood, left: {emoji, big, label, at?}, right: {emoji, big, label, at?}, winner?: "left"|"right", revealAt?: word}  (big = short text like "Cu" or "90%", max 6 chars; label max 3 words)
- stat: {type, narration, mood, emoji, value: number, prefix?: string, suffix?: string (e.g. " km/h", "%", "x"), label: 2-6 words, at?: word}
- orbit: {type, narration, mood, center: emoji, around: emoji, count: 3-10, ring?: fraction 0-1 to fill a progress ring (e.g. 0.67 for two thirds), label?: 2-6 words, at?: word}
- journey: {type, narration, mood, actor: emoji, props: [emoji, emoji] (ground scenery), flyer?: emoji passing in the background}
- bars: {type, narration, mood, bars: [{emoji, label (1-2 words), value: number}] (2-4 bars, same unit, the narration must say or clearly imply every value), unit?: short text after each number like "m" or "km/h", at?: word}  (a racing bar chart: best for comparing sizes, speeds, ages or amounts of 2-4 things)
- timeline: {type, narration, mood, steps: [{emoji, when (a year, age or time like "1928" or "Day 3", max 8 chars), label (1-3 words), at?: word}] (2-4 steps in time order)}  (best for how something changed or happened step by step)
- bigword: {type, narration, mood, text: 1-3 short words that slam onto the screen (the single most shocking word or number phrase of the video, like "1,000 YEARS" or "IT GLOWS"), emoji?, at?: word}  (use at most ONCE per video, on the reveal or the twist)
- outro: {type, narration, mood}`;

export function longPrompt({category, used, emojiNames, feedback, insights = ''}) {
  return `You write scripts for "Brainyvoo", a YouTube channel where Brainy, a cute cartoon brain mascot, explains true, surprising facts. This script is for a 3 to 4 minute landscape video: six surprising facts on one theme, ordered so the most surprising fact comes last. Audience: curious people of all ages. Tone: warm, punchy, playful, simple words. Never clickbait a false claim.

TASK: Pick ONE specific, interesting theme in the category "${category}".
${used.length ? `Do NOT repeat any of these already-used topics: ${used.slice(-120).join(' | ')}` : ''}
${feedback ? `The previous draft was rejected for these reasons, fix them or pick a different theme: ${feedback}` : ''}
${insights ? `WHAT THIS CHANNEL'S VIEWERS WATCH (real view counts): ${insights} Learn from the pattern: prefer the kind of subject, hook and title wording of the most watched ones, and avoid the style of the least watched. Never repeat their topics.` : ''}

HARD RULES
- Facts must be accurate and supported by mainstream sources (NASA, Britannica, National Geographic, Smithsonian, peer-reviewed science). No myths, no rounded-up exaggerations, hedge with "about"/"up to" when values vary. Avoid contested records and superlatives unless certain. Use metric units exactly as spoken.
- Total narration 460 to 640 words across every scene.
- Scene 1 MUST be type "hook": ONE short, bold sentence (6-14 words) that teases the whole video. It must NOT give any answer and must contain no numbers. NEVER open with "Did you know", "Have you ever", "In this video", "Today" or "Hey guys". Its first item is shown huge from the first frame, so it must be the most literal emoji of the theme.
- "hookText": 2-5 punchy words shown huge in the first second. It teases, contains no number and no emojis.
- Scene 2 is a trio promising what is coming, in 15-25 words, without revealing any fact.
- The six facts must each be about a different thing inside the theme, and none may be one of the already-used topics above.
- Then exactly 6 facts. Each fact starts with one scene of type "chapter", numbered 1 to 6 in order. Its narration (5-12 words) teases that fact without answering it.
- After each chapter come 3 or 4 scenes of types trio, compare, stat, orbit, journey, bars, timeline or bigword, using at least 2 different types per fact. Each scene's narration is 1-2 spoken sentences (14-32 words) and the visual must match what is being said. Reveal the answer in the second scene of the fact, not in the chapter.
- Vary the wording between facts, and link each fact to the next with a short tease at the end of its last scene.
- SUBSCRIBE ASK: the chapter scene of fact 6 (the best fact) must end with one playful sentence of 4 to 9 words containing the word "subscribe", for example "Subscribe before I show you the best one." It appears exactly once before the outro.
- Last scene MUST be type "outro" with narration exactly: "${OUTRO.en}"
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
 "title": "curious YouTube title, max 70 characters, no emojis, literally true and fully delivered by the video. It names the theme and the count, for example \"6 Ocean Animals That Break the Rules of Biology\"",
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

export function scriptPrompt({category, topic, used, emojiNames, feedback, story = false, insights = ''}) {
  return `You write scripts for "Brainyvoo", a YouTube Shorts channel. Brainy, a cute cartoon brain mascot, narrates ONE mind-blowing but TRUE fact per video. Audience: curious people of all ages. Tone: warm, punchy, playful, simple words. Never clickbait a false claim.

TASK: ${topic ? `Write a script about: "${topic}".` : story ? `Tell ONE gripping, TRUE, well-documented story in the theme "${category}": a real event, person or animal with a clear beginning, a problem, a turning point and a surprising ending.` : `Pick ONE surprising, well-documented topic in the category "${category}".`}
${story ? `STORY RULES (this video is a true story, not a list of facts)
- Follow one main character (a named person, animal, ship or place) through the event, in time order.
- Keep it family-friendly and uplifting or funny: this is a playful cartoon channel. Do NOT pick stories centred on mass death or atrocities (atomic bombings, genocides, terror attacks, deadly disasters, murders). Rescues, clever escapes, lucky accidents, animal heroes, strange coincidences and explorers are ideal.
- Every scene must make the viewer want the next one: end scenes on a question, a danger or a "but".
- The ending is the payoff: the surprising outcome or twist lands in the last scene before the outro.
- Stick to what reliable sources say happened. Never invent dialogue, names, numbers or details. If something is uncertain, say "historians think" or "reportedly".
- Use journey scenes for travel or chases, a timeline scene for the order of events and compare, stat or bigword scenes for the turning point, so the story keeps moving on screen.
- Only use a stat scene for a real, meaningful number from the sources (a weight, a distance, a year count), never a filler number like 1.
- Legends that grew around the story (for example "he never dropped a single shell") must be told as legends ("soldiers said...") or left out.
` : ''}
${used.length ? `Do NOT repeat any of these already-used topics: ${used.slice(-120).join(' | ')}` : ''}
${feedback ? `A fact-checker rejected the previous draft for these reasons, fix them or pick a different topic: ${feedback}` : ''}
${insights ? `WHAT THIS CHANNEL'S VIEWERS WATCH (real view counts): ${insights} Learn from the pattern: prefer the kind of subject, hook and title wording of the most watched ones, and avoid the style of the least watched. Never repeat their topics.` : ''}

HARD RULES
- Facts must be accurate and supported by mainstream sources (NASA, Britannica, National Geographic, Smithsonian, peer-reviewed science). No myths, no rounded-up exaggerations, hedge with "about"/"up to" when values vary.
- Child safety: many viewers are children. Never pick or phrase a fact so that copying it could hurt someone (swallowing objects or chemicals, fire, electricity, holding breath, dangerous stunts, dieting or medical advice). If a topic touches this, tell it as something that happens in nature or in a lab, and never as something the viewer could try.
- Choose facts that are settled and uncontroversial with one widely agreed number. AVOID contested records ("biggest ever", "fastest ever", dinosaur sizes), outdated figures and superlatives unless certain. Use metric units exactly as spoken.
- The title must be literally true and fully delivered by the script. It must NAME the subject (the animal, person, object or event) in plain words so a stranger knows what the video is about, and add one curiosity gap. Bad (vague): "The snack that changed history". Good: "A melted chocolate bar invented the microwave".
- ${story ? '6 to 8 scenes. Total narration 86 to 116 words (36 to 46 seconds spoken).' : '5 to 7 scenes. Total narration 66 to 92 words (26 to 34 seconds spoken).'}
- Scene 1 MUST be type "hook" and must stop the scroll in the first second: ONE short, bold sentence (6-14 words) that says the single most surprising TRUE claim of the video straight away and NAMES the subject in plain words, so a stranger instantly knows what this is about and thinks "no way, how?". Numbers are welcome. Viewers swipe away from vague teases, so NEVER write one. NEVER open with "Did you know", "Have you ever", "In this video", "Today" or "Hey guys". Bad (vague, nobody knows what it is about): "There is a massive secret about our neighborhood." / "This sleepy animal beats a dolphin at one thing." Good (the claim itself): "A T-Rex lived closer in time to you than to a Stegosaurus." / "This shrimp punches so fast that the water around it boils." / "A sloth can hold its breath longer than a dolphin."${story ? ' For a story, the hook says who or what it is about and the most unbelievable true thing that happened, but it keeps the ending for later.' : ''} Only the first item in the hook is required; up to 3 badges show related things.
- The FIRST item of the hook scene is shown huge on screen from the very first frame. It must be the most literal emoji of the main subject (the animal, object or body part the video is about).
- "hookText": 3-6 words shown huge over a real photo in the first second, and the only text on screen at that moment. It is the hook's claim squeezed into a headline that NAMES the subject, for example "T-REX NEVER MET STEGOSAURUS", "THIS SHRIMP BOILS WATER", "OCTOPUSES HAVE 3 HEARTS". Never a vague phrase like "TOTAL SPACE DOMINATION" or "IT NEVER GOES AWAY". No emojis, no word longer than 12 letters.
- "photo": what a REAL photograph for the opening should show. "subject" is the thing itself in 2-5 plain English words, with no action or setting ("a peacock mantis shrimp", "a three-toed sloth", not "a swimming sloth"). "queries" are 2 or 3 short search phrases for Wikimedia Commons, best first: the plain common name of the thing itself in 1 or 2 words, then the scientific name ("mantis shrimp", "Odontodactylus scyllarus"). Never add an action or a place to a query: "sloth", not "swimming sloth". Pick something that can really be photographed: the animal, object, planet, place, machine or body part. For a story about a person, use the animal, ship, place or object of the story, never a private or living person.
- SUBSCRIBE ASK (very important): the scene right BEFORE the final twist scene must END with one quick, playful sentence of 4 to 9 words that contains the word "subscribe" and gives a reason tied to this video's answer, so viewers subscribe while they are still curious. Examples: "Subscribe, because the answer is wild." / "Quick, subscribe before I tell you!" / "Subscribe if you can guess it." Write a fresh one each time. It appears exactly once before the outro. It is NEVER a scene of its own: it is the last sentence inside a normal scene that first says 8 or more words about the topic.
- Scene 2 says why the claim sounds impossible, or asks the "how?" the viewer is thinking. The middle scenes then prove and explain it with concrete numbers.
- SAVE ONE FINAL TWIST: the last scene before the outro delivers an even stranger related fact that the hook did not mention ("And the craziest part..."). That is the payoff viewers stay for. It should be a compare, stat, bars or bigword scene with a clear visual reveal, not a static row of icons.
- Keep the energy high: short sentences, vivid verbs, no filler.
- Last scene MUST be type "outro" with narration exactly: "${OUTRO.en}"
- Middle scenes: use at least 3 DIFFERENT types from trio, compare, stat, orbit, journey, bars, timeline, bigword, and no more than one trio. Prefer the type that SHOWS the fact: bars for comparing amounts, timeline for a sequence, bigword for the shock line. Each middle scene narration is 1-2 short spoken sentences (8-22 words) and the visual must match what is being said.
- Every emoji value MUST be copied exactly from the ALLOWED EMOJI list below (snake_case). Pick the most literal match. Never use "brain" (Brainy the brain is already on screen) unless the fact is about the brain.
- Any "at", "dimAt" or "revealAt" value must be ONE word that appears in that same scene's narration.
- Narration is spoken English: no emojis, no hashtags, no brackets, no abbreviations like "km" (say "kilometers").
- world: one of ${WORLDS}.
- mood per scene: "wow" for the most surprising moments, otherwise "happy".

${SCENE_TYPES}

OUTPUT exactly one JSON object:
{
 "topic": "short topic name",
 "hookText": "3-6 WORD HEADLINE OF THE CLAIM",
 "photo": {"subject": "...", "queries": ["...", "..."]},
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

export const OUTRO = {
  en: 'Subscribe to Brainyvoo for new weird facts every day!',
  hi: 'हर दिन नए मज़ेदार फैक्ट्स के लिए ब्रेनीवू को सब्सक्राइब करें!',
};

// Hindi channel: same rules, but everything the viewer hears or reads is in Hindi
export function withLanguage(prompt, lang) {
  if (lang !== 'hi') return prompt;
  return `${prompt}

LANGUAGE OVERRIDE (this beats any English-only rule above): this video is for a HINDI channel.
- Every "narration", "hookText", "title", "description", "label", "big" text and chapter "title" is in natural, simple, spoken Hindi written in Devanagari script, the way a friendly Indian YouTuber talks. Common English words that Indians say in Hindi (science, planet, record, battery) are fine, written in Devanagari.
- Write numbers in narration as Hindi words (for example "चालीस", "दो सौ"). On-screen "value" fields stay numbers.
- "photo" (its subject and queries) stays in English. No hookText word may be longer than 12 letters.
- The outro narration must be exactly: "${OUTRO.hi}"
- The SUBSCRIBE ASK sentence is in Hindi and must contain the word "सब्सक्राइब".
- "tags" mix Hindi and English search words. "sources" stay in English.
- "at", "dimAt" and "revealAt" must be one Hindi word copied exactly from that scene's narration.`;
}

export function factCheckPrompt(spec) {
  const lines = spec.scenes.map((s, i) => `${i + 1}. ${s.narration}${s.type === 'stat' ? ` [on screen: ${s.prefix || ''}${s.value}${s.suffix || ''} ${s.label || ''}]` : ''}${s.type === 'compare' ? ` [on screen: ${s.left?.big} ${s.left?.label} vs ${s.right?.big} ${s.right?.label}]` : ''}${s.type === 'bars' ? ` [on screen bar chart: ${(s.bars || []).map((b) => `${b.label} ${b.value}${s.unit || ''}`).join(', ')}]` : ''}${s.type === 'timeline' ? ` [on screen timeline: ${(s.steps || []).map((b) => `${b.when} ${b.label}`).join(', ')}]` : ''}${s.type === 'bigword' ? ` [on screen: ${s.text}]` : ''}`).join('\n');
  return `You are a strict fact-checker for an educational YouTube Shorts channel. Check every factual claim in this script, including on-screen numbers and the opening headline.
Topic: ${spec.topic}
Opening headline shown on screen: ${spec.hookText || '(none)'}
Script:
${lines}
Title: ${spec.title}

Reject ONLY for real problems: a claim that is false, a popular myth, a clearly wrong number, a title that is false, or (in a story) an unverifiable legend or invented detail stated as certain fact. Do NOT reject for harmless vivid wording, rounding within normal ranges, unit naming (tons vs tonnes), or simplification for a general audience.

Return JSON: {"ok": true|false, "problems": ["each problem in one sentence"], "confidence": 0-1}`;
}
