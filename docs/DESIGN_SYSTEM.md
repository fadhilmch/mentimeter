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

## Radius, spacing and type

Named steps for the values the app already uses. Use these in new code instead of raw numbers.

| Token | Value | Notes |
| --- | --- | --- |
| `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius` | 8, 10, 12, 14px | Controls, inputs, small cards, cards |
| `--radius-pill` | 999px | Pills and chips. `50%` stays for circles |
| `--space-1` to `--space-7` | 4, 8, 12, 16, 24, 32, 48px | Gap, margin and padding |
| `--fs-xs`, `--fs-sm`, `--fs-base`, `--fs-md`, `--fs-lg` | 0.78, 0.85, 0.9, 1.05, 1.15rem | Body and UI text |

Existing exceptions, kept so the look does not drift: spacing values 5, 6, 10, 14, 18, 20, 22 and 28px, font sizes such as 0.72, 0.8, 0.88, 0.92 and 0.95rem, one-off radii (2 to 7, 9, 11, 16 to 30px), and `clamp()` display sizes for headings. Fold them into the steps only in a deliberate visual change with before/after screenshots.

## Rules

1. No hex or `rgb()` literals in `.vue` files. Add or reuse a token. Exceptions are listed with a reason in `client/src/__tests__/tokens.test.ts`, which fails on any new hex colour in a component. Per-theme palettes live in `themes.ts`.
2. Every new token needs a light and a dark value.
3. Text and its background must keep WCAG AA contrast (4.5:1). `client/src/__tests__/themes.test.ts` checks the presentation themes.
4. Do not use `var(--token, #fallback)`: the token always exists, and a wrong fallback hides mistakes.
5. Keep the supplied logo files unchanged.

## Checking a change

Run the app (`npm run dev:memory` in `server/` with the client built), then compare the landing, dashboard, editor, presenter and audience views in both modes before and after your change.
