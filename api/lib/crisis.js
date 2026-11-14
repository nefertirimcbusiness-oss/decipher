// The crisis net.
//
// Savid's prompt already tells him what to do when someone is in danger, but a
// prompt is not a guarantee: when the model is rate-limited, errors, or times out,
// the engine answers with its canned fallback ("I'm here, and I'm listening."),
// which is the wrong thing to say to someone who has just said they want to die.
// So the inbound message is checked here, in the API, before the model is called,
// and the crisis reply is returned no matter what the model does.
//
// The phrase list lives in this file on its own so it can be extended without
// touching the route. Matching is deliberately generous: a false positive costs
// someone a gentle, honest message; a false negative costs someone the one reply
// that mattered.

export const CRISIS_MESSAGE =
  "Before anything else — I want you to be safe. I'm an AI, so I can't call anyone for you, " +
  'and no one is watching this chat. 988 is there day or night, and they answer. ' +
  'Will you reach out to them?';

// Plain phrases are matched case-insensitively as whole words, allowing anything
// (including nothing) between the words, so "kill myself", "killing myself" and
// "kill my self" are one entry rather than three.
export const CRISIS_PHRASES = [
  'kill myself',
  'killing myself',
  'killed myself',
  'kill my self',
  'end my life',
  'ending my life',
  'ended my life',
  'take my life',
  'taking my life',
  'end it all',
  'ending it all',
  'end it',
  'want to die',
  'wanna die',
  'want to be dead',
  'wish i was dead',
  'wish i were dead',
  'better off dead',
  'no reason to live',
  'nothing to live for',
  "don't want to be here",
  'dont want to be here',
  'do not want to be here',
  "don't want to be alive",
  'dont want to be alive',
  "don't want to live",
  'dont want to live',
  'tired of living',
  'hurt myself',
  'hurting myself',
  'hurt my self',
  'harm myself',
  'harming myself',
  'self harm',
  'self-harm',
  'self harming',
  'cutting myself',
  'cut myself',
  'overdose',
  'overdosing',
  'unalive myself',
  'off myself',
  'not worth living'
];

// Bare words that are crisis language on their own, kept separate because they
// need a word boundary and nothing more.
export const CRISIS_WORDS = ['suicide', 'suicidal'];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whitespace or a hyphen between the words of a phrase, and a word boundary at
// each end so "skill myself" or "suicides" do not match.
const PHRASE_PATTERNS = CRISIS_PHRASES.map(
  (phrase) =>
    new RegExp(`\\b${phrase.split(/[\s-]+/).map(escapeRegExp).join('[\\s-]+')}\\b`, 'i')
);

const WORD_PATTERNS = CRISIS_WORDS.map((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i'));

const ALL_PATTERNS = [...PHRASE_PATTERNS, ...WORD_PATTERNS];

/**
 * Does this message contain crisis language?
 *
 * @param {string} message the user's own words, as typed
 * @returns {boolean}
 */
export function detectCrisis(message) {
  if (typeof message !== 'string' || !message.trim()) return false;
  // Apostrophes are typed several ways (’ vs ') and some people leave them out
  // entirely; normalise before matching so "don’t want to be here" is caught too.
  const text = message.normalize('NFKC').replace(/[\u2018\u2019\u02bc]/g, "'");
  return ALL_PATTERNS.some((pattern) => pattern.test(text));
}

// The engine's canned answer when the model call fails. It is a fine reply to
// almost anything except a crisis, where it would read as being ignored.
export const FALLBACK_REPLY_PREFIX = "I'm here, and I'm listening.";

export function isFallbackReply(text) {
  return typeof text !== 'string' || !text.trim() || text.trim().startsWith(FALLBACK_REPLY_PREFIX);
}
