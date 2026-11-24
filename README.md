# Frame — AI Travel Carousel Studio

A lightweight HTML/CSS/JavaScript application that turns uploaded travel photographs into a designed Instagram carousel. AI planning uses [Puter.js](https://docs.puter.com/AI/chat/); slide composition and ZIP export run in the browser.

## Features

- Creative brief: destination, vibe, travel context, mood, slide count and text style.
- Multi-image upload with thumbnails and removal.
- Per-photo visual analysis using Puter AI.
- AI-generated JSON storyboard.
- Browser-based 1080 × 1350 PNG rendering.
- Slide preview and individual PNG download.
- ZIP export containing numbered PNGs and a README.

## Run locally

Puter.js requires the page to be served over HTTP(S), not opened as `file://`.

Python:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

Alternatively, use the VS Code Live Server extension.

## Puter setup

The page loads Puter.js using the official CDN:

```html
<script src="https://js.puter.com/v2/"></script>
```

Click **Connect Puter** to sign in. The application calls `puter.ai.chat()` from the browser and supplies uploaded `File` objects as image context. The default model is `gpt-6-luna`, following Puter's documented image-analysis example. Model availability can change; update `DEFAULT_MODEL` in `app.js` if required.

Puter uses a user-pays model. Users may be prompted to authenticate and may incur usage charges according to their Puter account and selected model.

Official references:
- https://docs.puter.com/getting-started/
- https://docs.puter.com/AI/chat/
- https://docs.puter.com/supported-platforms/

## Project structure

```
AI-Wardrobe/
├── index.html
├── styles.css
├── app.js
├── README.md
└── prompts/
    ├── travel-carousel-art-director-v1.md
    └── travel-carousel-art-director-v2-reference-driven.md
```

## Important implementation notes

- Original photographs remain in browser memory for the current session; no upload server is used.
- The storyboard is constrained to supported renderer layouts: `hero`, `polaroid`, `split`, `collage`, `note`, `closing`.
- The renderer uses Canvas API and native browser fonts. Decorative elements are intentionally lightweight; this first version is a functional MVP, not a full layer editor.
- Some browsers cannot decode HEIC images natively. Convert HEIC to JPEG before uploading if preview or rendering fails.
- AI image understanding and storyboard generation require network access and a Puter account.
- ZIP creation uses JSZip from jsDelivr.
- The AI's suggested location labels are treated as unverified unless supported by the image context. Always review before posting.

## Current MVP limitations

- No saved projects or persistent cloud storage.
- No drag-and-drop layer editor after rendering.
- No automatic background removal or advanced subject masking.
- No guarantee of exact landmark identification.
- No automatic retry if a selected Puter model is unavailable.
- AI-generated sticker assets are not yet included; the first version uses native emoji and Canvas-drawn paper treatments.

## Prompt references

The creative direction is based on the prompt documents in `prompts/`. The reference-driven v2 scrapbook principles are summarized in the renderer's planning prompt.
