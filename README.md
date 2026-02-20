# Tensai TypeMaster Chrome Extension

This project is now structured as a Chrome extension:
- `popup.html`: dashboard view
- `quiz.html`: fullscreen quiz page (opened in a browser tab)

## Build

```sh
npm install
npm run build:extension
```

This outputs extension files into `dist/`.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist` folder

## Development

```sh
npm install
npm run start
```

This runs webpack-dev-server and opens the popup dashboard page.
