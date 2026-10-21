# Design system

CrowdFlow's UI is built from CSS custom properties defined in `client/src/assets/main.css`, with light and dark values. Components read tokens; they do not hard-code colours.

## Colour tokens

| Token | Use |
| --- | --- |
| `--bg`, `--card`, `--line` | Page, surface and border |
| `--ink`, `--ink-2` | Primary and secondary text |
| `--lead`, `--lead-soft`, `--accent` | Brand and per-presentation accent |
| `--on-accent` | Text on a filled accent or lead surface |
| `--good`, `--danger`, `--danger-ink`, `--danger-soft` | Success, destructive actions, error text |
| `--inverse`, `--inverse-ink`, `--inverse-muted`, `--inverse-line` | Always-dark band (landing closing section) |
| `--t-*` | Presentation theme variables, set per theme and mode in `client/src/themes.ts` (`--t-correct` marks correct quiz answers) |

## Rules

1. No hex or `rgb()` literals in `.vue` files. Add or reuse a token. Exceptions: the logo artwork and per-theme palettes in `themes.ts`.
2. Every new token needs a light and a dark value.
3. Text and its background must keep WCAG AA contrast (4.5:1). `client/src/__tests__/themes.test.ts` checks the presentation themes.
4. Do not use `var(--token, #fallback)`: the token always exists, and a wrong fallback hides mistakes.
5. Keep the supplied logo files unchanged.

## Checking a change

Run the app (`npm run dev:memory` in `server/` with the client built), then compare the landing, dashboard, editor, presenter and audience views in both modes before and after your change.
