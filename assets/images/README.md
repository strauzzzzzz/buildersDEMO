# Images: sizes and formats

| File | Size | Notes |
| --- | --- | --- |
| `hero.webp` + `hero.jpg` | 1200 x 900 (4:3) | Hero picture, also the fallback when the 3D hero is off. Replace with a real photo of your work (no stock photos of people posed as the crew). |
| `works/*.webp` + `works/*.jpg` | 1600 x 1200 (4:3) | Gallery photos. Aim for under 250 KB each. |
| `../og-image.jpg` | 1200 x 630 | Social share preview (Telegram, WhatsApp, VK). Under 300 KB. |
| `../apple-touch-icon.png` | 180 x 180 | Home-screen icon. |
| `../favicon.svg` | any (vector) | Browser tab icon. |

Always provide BOTH `.webp` (small, modern) and `.jpg` (fallback). Name files in latin letters
without spaces, e.g. `kladka-01.webp`. List each photo in `config.json` under `works.photos`.
