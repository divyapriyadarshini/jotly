// Who am I in this document? A guest name plus one of five palette colours.
// Real accounts and guest sessions arrive in Phase 7.

export type CollabUser = { name: string; color: string };

const STORAGE_KEY = 'jotly:guest-identity';

// Label text colour for each cursor colour (the orange and ochre need dark text).
// Same order as --cursor-1 ... --cursor-5 in tokens.css.
const LABEL_TEXT = [
  'var(--paper-raised)',
  'var(--ink)',
  'var(--paper-raised)',
  'var(--ink)',
  'var(--paper-raised)',
];

type Swatch = { color: string; text: string };
let cachedPalette: Swatch[] | null = null;

// The colours live ONLY in tokens.css. We read their real values (hex codes) once,
// because TipTap's caret code only understands real colours, not var(...) references.
function getPalette(): Swatch[] {
  if (!cachedPalette) {
    const styles = getComputedStyle(document.documentElement);
    cachedPalette = LABEL_TEXT.map((text, index) => ({
      color: styles
        .getPropertyValue(`--cursor-${index + 1}`)
        .trim()
        .toLowerCase(),
      text,
    }));
  }
  return cachedPalette;
}

const ADJECTIVES = [
  'Quiet',
  'Brisk',
  'Amber',
  'Mossy',
  'Gentle',
  'Swift',
  'Bright',
  'Calm',
  'Wry',
  'Steady',
];
const ANIMALS = [
  'Heron',
  'Wren',
  'Otter',
  'Finch',
  'Badger',
  'Marten',
  'Plover',
  'Hare',
  'Lark',
  'Newt',
];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Anything that arrives from another browser (or from storage) must pass through here.
// Returns a clean user, or null if the data isn't acceptable.
export function sanitizeUser(raw: unknown): CollabUser | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const { name, color } = raw as { name?: unknown; color?: unknown };
  if (typeof name !== 'string' || typeof color !== 'string') {
    return null;
  }
  // Only accept a colour that exactly matches one of our palette values.
  const normalised = color.trim().toLowerCase();
  const swatch = getPalette().find((s) => s.color !== '' && s.color === normalised);
  if (!swatch) {
    return null;
  }
  const cleanName = name.trim().slice(0, 40);
  return { name: cleanName || 'Guest', color: swatch.color };
}

export function labelTextColor(color: string): string {
  return getPalette().find((s) => s.color === color)?.text ?? 'var(--paper-raised)';
}

export function getGuestIdentity(): CollabUser {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const user = sanitizeUser(JSON.parse(stored));
      if (user) {
        return user;
      }
    }
  } catch {
    // Storage unavailable or corrupt JSON: fall through and make a fresh identity.
  }

  const user: CollabUser = {
    name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
    color: pick(getPalette()).color,
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Not fatal: the identity just won't survive a refresh.
  }
  return user;
}
