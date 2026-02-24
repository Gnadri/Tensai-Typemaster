# Tensai TypeMaster (Chrome Extension)

Tensai TypeMaster is a Chrome extension with:
- a popup dashboard (`popup.html` / `popup.js`)
- a full app page (`quiz.html`) powered by the React Native Web app in `App.tsx`

The extension runtime files are built into `dist/`.

## Project Structure

- `App.tsx`: main full app UI/logic (Quiz, Endless, TypeMaster, Leaderboard, Focus, saves)
- `popup.js`: popup dashboard logic (mini trainer + launch Full App)
- `index.web.js`: web entry for the full app bundle
- `mobile/src/styles/appStyles.ts`: shared styles for the full app
- `public/`: HTML templates used by webpack
- `dist/`: built extension files Chrome runs
- `manifest.json` (repo root): wrapper manifest for loading the repo root as unpacked extension
- `quiz.html` + `quiz-redirect.js` (repo root): redirect shim to `dist/quiz.html`
- `webpack.config.js`: build config (extension-safe, no `eval` devtool for extension builds)

## Build Requirements

- Node.js `>= 20`
- npm

## Install Dependencies

```sh
npm install
```

## Build Extension

```sh
npm run build:extension
```

This generates/updates:
- `dist/popup.html`
- `dist/popup.bundle.js`
- `dist/quiz.html`
- `dist/quiz.bundle.js`
- `dist/manifest.json` (copied by `scripts/copy-manifest.js`)

## Load in Chrome (Recommended)

You can load either the repo root (wrapper manifest) or `dist`.

### Option A: Load Repo Root (current repo setup)

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this project folder (repo root)

The root `manifest.json` points Chrome to `dist/...`.

### Option B: Load `dist` Directly

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the `dist` folder

## Development Workflows

### Rebuild on every source change (extension workflow)

```sh
npm run dev:extension
```

- Rebuilds `dist` in watch mode
- Reload the extension in `chrome://extensions` after changes

Windows helper:
- `DevWatchExtension.cmd` (starts watch mode for you)

### Run Webpack Dev Server (browser dev page)

```sh
npm run web
```

or

```sh
npm run start
```

Notes:
- Dev server is for development/testing in a normal browser page
- Chrome extension pages still require loading the built extension

## Current Features (High Level)

- Kana quiz modes (Hiragana/Katakana)
- JLPT modes (N5/N4, multiple reading/input modes)
- Focus mode (custom focus set built from selected items)
- Endless mode
- TypeMaster mode (Rapidfire/Burst)
- Leaderboards (all-time + session)
- Leaderboard import/export
- Save Manager (named leaderboard saves + named Focus state saves)
- Popup mini trainer dashboard + `Full App` button

## Data Storage

Local storage is handled through `AsyncStorage` (web-backed storage in the extension context).

Examples of stored data:
- leaderboard entries
- Focus items
- leaderboard snapshots (Save Manager)
- Focus snapshots (Save Manager)

## Troubleshooting

### Changes in `App.tsx` are not showing in Chrome

Chrome runs built files from `dist`, not `App.tsx` directly.

Rebuild and reload:

```sh
npm run build:extension
```

Then reload the extension in `chrome://extensions`.

### Extension CSP error about `unsafe-eval`

Use the provided scripts/build config (`webpack.config.js` is set up to avoid `eval` in extension builds).
If you still see this, reload the extension after rebuilding and make sure Chrome is loading this repo’s `dist`.

## Notes

- `dist/` is generated output (runtime files), not source-of-truth source code.
- Edit source files (`App.tsx`, `popup.js`, styles, etc.), then rebuild `dist`.
