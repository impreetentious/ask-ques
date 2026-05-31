# Accessibility notes

Ask Ques is designed so the joke does not depend on excluding people.

- Both choices are native `button` elements. Pressing No always advances a rung; there is no
  pointer-only dead end.
- Keyboard focus holds the No button in its home position. It remains visible, reachable and
  actionable through the complete ladder.
- The question is the page’s `h1`. Rung notes and the line under the finale are announced through a
  polite live region.
- Answering, and asking again, unmounts the button that was just pressed. Focus moves to the new
  `h1` rather than dropping to the top of the document, so the headline is announced once and the
  next Tab continues from where the page now is.
- `prefers-reduced-motion: reduce` pins the No button, stops the heartbeat, motes, whispers and
  burst, and retains the copy, scales, buttons and finale.
- The interface uses the theme’s contrast-conscious ink, muted text, and accent pairings. Any new
  theme should preserve comparable contrast before it is added to `themes.ts`.

Manual checks before a release: tab through both actions, activate them with Enter and Space, confirm
focus lands on the headline after yes and after a replay, test the browser’s reduced-motion setting,
and verify the narrowest phone viewport has no clipped Yes button.
