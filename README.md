# Toolbar Icon Toggles

A [Spindle](https://docs.lumiverse.chat/) extension for [Lumiverse](https://lumiverse.chat/) that lets you
pick any icon button in the app — the row of icons above the chat input, the header, wherever — and toggle
whether it's shown or hidden. No permissions required.

## How it works

Lumiverse doesn't publish a fixed list of IDs for its own built-in icons, so instead of guessing at them,
this extension has *you* click the one you want:

1. Open the **Icons** tab in the sidebar drawer (or use "Toolbar Icon Toggles" in the input bar's **Extras**
   popover to jump there).
2. Click **+ Add icon**.
3. Click the real icon you want to manage anywhere in the app. Press `Esc` to back out instead.
4. Give it a short label (it suggests one from the icon's tooltip/text automatically) and hit **Save**.
5. Flip the switch next to it any time to show or hide that icon. The change applies instantly and is
   remembered the next time you load Lumiverse.

Each managed icon gets its own remove (×) button if you want to stop tracking it — that makes it
permanently visible again.

## Install

1. Push this folder to a GitHub repo (update the `author`, `github`, and `homepage` fields in
   `spindle.json` first).
2. In Lumiverse, open **Extensions → Install from Source** and paste the repo URL.
3. No permissions to approve — everything this extension uses (drawer tabs, DOM styling, storage, the
   input bar action) is free-tier.

You don't need to build anything yourself: if you don't commit a `dist/` folder, Lumiverse runs
`bun build` on `src/backend.ts` and `src/frontend.ts` automatically on install. `package.json` and
`tsconfig.json` are here for local editing/type-checking convenience (run `npm install -D
lumiverse-spindle-types` or `bun add -d lumiverse-spindle-types` if you want editor autocomplete).

## Good to know

- **Selectors, not magic.** When you click an icon, the extension saves a CSS selector for it —
  preferring a stable `id`, `aria-label`, `data-testid`, or `title` attribute if the element has one, and
  falling back to its position in the page if not. The first kind survives Lumiverse updates well; the
  positional fallback is more fragile and can stop matching if Lumiverse's layout changes underneath it.
  If a saved icon ever stops responding to its toggle, just remove it from the list and re-add it.
- **Hiding is visual only.** This uses CSS (`display: none`), so it only affects what's shown in your own
  browser — it doesn't disable the underlying feature, remove it for other users, or touch any Lumiverse
  settings.
- **Per-user.** Your toggle list is stored per-account (`spindle.userStorage`), so it won't affect other
  users even if an admin installs this extension server-wide.
- **Undo everything at once.** If you ever hide something you didn't mean to and can't find your way back
  to the Icons tab, disabling the extension from the Extensions panel immediately restores every icon —
  Lumiverse tears down an extension's injected styles as part of disabling it.

## Files

```
toolbar-icon-toggles/
├── spindle.json       extension manifest
├── package.json       local dev convenience (not required for install)
├── tsconfig.json       "
├── src/
│   ├── backend.ts      persists your toggle list to per-user storage
│   └── frontend.ts     the picker, the settings tab, and the show/hide styling
└── README.md
```
