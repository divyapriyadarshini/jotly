import type { DecorationAttrs } from '@tiptap/pm/view';
import { labelTextColor, sanitizeUser } from './identity';

// Draws the little coloured caret + name label for a remote collaborator.
// `rawUser` comes from another browser, so it is validated before use.
export function renderCaret(rawUser: Record<string, unknown>): HTMLElement {
  const user = sanitizeUser(rawUser);
  const caret = document.createElement('span');
  if (!user) {
    return caret;
  }

  caret.classList.add('remote-caret');
  caret.style.borderColor = user.color;

  const label = document.createElement('span');
  label.classList.add('remote-caret-label');
  label.style.backgroundColor = user.color;
  label.style.color = labelTextColor(user.color);
  // textContent (not innerHTML): the name is always treated as plain text, never as HTML.
  label.textContent = user.name;

  caret.append(label);
  return caret;
}

// The soft tinted highlight over text a collaborator has selected.
export function renderSelection(rawUser: Record<string, unknown>): DecorationAttrs {
  const user = sanitizeUser(rawUser);
  if (!user) {
    return {};
  }
  return {
    class: 'remote-selection',
    // user.color is guaranteed to be one of our own palette values, so this string is safe.
    style: `background-color: color-mix(in srgb, ${user.color} 25%, transparent);`,
  };
}
