import type { AskConfig, Refusal } from './types';

/**
 * Packs a whole question into a URL hash, so a link carries its own content and
 * there is nothing to store, look up, or leak.
 *
 * Deliberately synchronous. `CompressionStream` would produce a shorter string,
 * but decoding it is async, which means a shared link paints an empty page for a
 * frame before the question appears. A hash is never sent to a server, and ~1.2 kB
 * is comfortably inside every browser's URL limit, so the trade goes the other way.
 *
 * Keys are single letters purely to keep links short. `v` guards the shape: bump
 * it if the layout of the packed form ever changes, and old links will fall back
 * to the built-in question rather than decoding into nonsense.
 */

const VERSION = 1;

/**
 * A hostile or careless link should not be able to break the layout. The builder
 * imports these so its inputs stop where the codec would otherwise truncate.
 */
export const MAX_TEXT = 240;
export const MAX_REFUSALS = 24;
const MAX_WHISPERS = 24;

interface Packed {
  v: number;
  e: string;
  q: string;
  n: string;
  y: string;
  /** [label] or [label, note] — the note is omitted when empty. */
  r: string[][];
  w: string[];
  /** [headline, line, tally, tallyFirst, signoff, replay] */
  f: string[];
  t: string;
  c: number;
  /** [title, description] */
  m: string[];
}

/** C0 and C1 control characters, escaped rather than literal so this file stays copy-safe. */
// oxlint-disable-next-line no-control-regex -- Input sanitization intentionally matches control ranges.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');

/** Flattens to a single line, trims, and caps length. */
function clean(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== 'string') return '';
  // Control characters become a space rather than nothing. Every field here is
  // rendered as one line, and deleting the newline out of a two-line question
  // would run its last and first words together.
  return value.replaceAll(CONTROL_CHARS, ' ').replace(/\s+/gu, ' ').slice(0, max).trim();
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function pack(config: AskConfig): string {
  const packed: Packed = {
    v: VERSION,
    e: clean(config.eyebrow),
    q: clean(config.question),
    n: clean(config.note),
    y: clean(config.yes),
    r: config.refusals
      .slice(0, MAX_REFUSALS)
      .map((refusal) =>
        refusal.note ? [clean(refusal.no), clean(refusal.note)] : [clean(refusal.no)],
      ),
    w: config.whispers.slice(0, MAX_WHISPERS).map((whisper) => clean(whisper, 40)),
    f: [
      clean(config.finale.headline),
      clean(config.finale.line),
      clean(config.finale.tally),
      clean(config.finale.tallyFirst),
      clean(config.finale.signoff),
      clean(config.finale.replay),
    ],
    t: clean(config.theme, 32),
    c: config.chime ? 1 : 0,
    m: [clean(config.meta.title), clean(config.meta.description)],
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(packed)));
}

/**
 * Returns null for anything that is not a well-formed packed config of the
 * current version — a truncated paste, a hash meant for something else, or a
 * link from a future release. Callers fall back to the built-in question.
 */
export function unpack(text: string, fallback: AskConfig): AskConfig | null {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(fromBase64Url(text)));
  } catch {
    return null;
  }

  if (typeof raw !== 'object' || raw === null) return null;
  const packed = raw as Partial<Packed>;
  if (packed.v !== VERSION) return null;

  const question = clean(packed.q);
  if (question === '') return null;

  const refusals: Refusal[] = Array.isArray(packed.r)
    ? packed.r
        .slice(0, MAX_REFUSALS)
        .map((entry): Refusal => {
          const row = Array.isArray(entry) ? entry : [entry];
          const note = clean(row[1]);
          return note ? { no: clean(row[0]), note } : { no: clean(row[0]) };
        })
        .filter((refusal) => refusal.no !== '')
    : [];

  const whispers = Array.isArray(packed.w)
    ? packed.w
        .slice(0, MAX_WHISPERS)
        .map((whisper) => clean(whisper, 40))
        .filter((whisper) => whisper !== '')
    : [];

  const finale = Array.isArray(packed.f) ? packed.f : [];
  const meta = Array.isArray(packed.m) ? packed.m : [];
  const pick = (source: string[], index: number, spare: string): string =>
    clean(source[index]) || spare;

  return {
    eyebrow: clean(packed.e),
    question,
    note: clean(packed.n),
    yes: clean(packed.y) || fallback.yes,
    refusals: refusals.length > 0 ? refusals : fallback.refusals,
    whispers: whispers.length > 0 ? whispers : fallback.whispers,
    finale: {
      headline: pick(finale, 0, fallback.finale.headline),
      line: pick(finale, 1, fallback.finale.line),
      tally: pick(finale, 2, fallback.finale.tally),
      tallyFirst: pick(finale, 3, fallback.finale.tallyFirst),
      signoff: pick(finale, 4, fallback.finale.signoff),
      replay: pick(finale, 5, fallback.finale.replay),
    },
    theme: clean(packed.t, 32) || fallback.theme,
    chime: packed.c !== 0,
    meta: {
      title: pick(meta, 0, question),
      description: pick(meta, 1, fallback.meta.description),
    },
  };
}

/** The hash key, so other params could be added later without a breaking change. */
export const HASH_KEY = 'a';

/** Reads a packed config out of a full `location.hash`, or null if absent. */
export function fromHash(hash: string, fallback: AskConfig): AskConfig | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!body.startsWith(`${HASH_KEY}=`)) return null;
  const payload = body.slice(HASH_KEY.length + 1);
  return payload === '' ? null : unpack(payload, fallback);
}

export function toHash(config: AskConfig): string {
  return `#${HASH_KEY}=${pack(config)}`;
}
