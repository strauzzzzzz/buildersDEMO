# Crew website template

A static, one-page marketing site for small construction crews (bricklayers, finishers, roofers,
electricians, plumbers). Plain HTML, CSS and vanilla JS. No framework, no build step needed to open it.
All visible copy is in Russian; all brand data lives in **`config.json`**.

To make a site for a new crew you change `config.json` and the photos. No code changes.

## Quick start

1. Open `config.json` and replace every `[bracketed]` value and the sample texts.
2. Put your photos in `assets/images/` (see below) and list them in `config.json`.
3. (Recommended) run `node tools/prerender.mjs` once. See "Why prerender" below.
4. Deploy (see "Deploy for free").

To preview locally, serve the folder (browsers block `config.json` on `file://`):

```bash
python -m http.server 8000
```

then open http://localhost:8000. Opening `index.html` directly also works: it shows the content
baked by the last prerender run.

## Editing `config.json`

| Key | What it controls |
| --- | --- |
| `site` | Page `title`, `description`, `url` (canonical, used in sitemap), share image, browser theme colour |
| `brand` | Crew `name`, `tagline`, `legal` line in the footer (ИП/ООО, ИНН, ОГРН) |
| `location` | `city`, `serviceArea`, optional `address` (leave `""` to hide) |
| `contacts` | `phone` (shown), `phoneHref` (digits for the call link, e.g. `+79001234567`), `messenger` (`label` + `url` for Telegram or WhatsApp), `email`, `hours` |
| `nav` | Header menu labels and anchors |
| `hero` | Headline lines, subheadline, button labels, hero image, 4 key facts |
| `sections` | Eyebrow, title and intro text of every section |
| `services` | Cards: `icon` (`brick`, `finish`, `roof`, `electric`, `plumbing`, `tool`), `title`, `text`, `price` (free text, e.g. `"от 2 500 ₽ за м³"`) |
| `process` | The steps of the numbered list (keep it at five) |
| `guarantee.period` | Warranty period, reused everywhere through `{{guarantee.period}}` |
| `trust.items` | The four "how we work" blocks |
| `works.photos` | Gallery photos (see below). Empty list shows the "Фото скоро появятся" card |
| `reviews` | Real client reviews only: `{ "author", "text", "meta" }`. Empty list hides the block completely. Nothing is ever generated |
| `form` | `endpoint`, `format`, messages (see "Request form") |
| `seo` | `priceRange` and optional `openingHours` (e.g. `["Mo-Sa 08:00-20:00"]`) for structured data |
| `footer` | Set `showSampleNote` to `false` when the site is final |
| `features.hero3d` | `true` enables the optional 3D brick wall in the hero. Default `false` |

Tips:
- `{{some.key}}` inside any text is replaced by that value from the config, e.g. `{{location.city}}`.
- Values still containing `[brackets]` are treated as placeholders: they are not used as links and are left out of the structured data.
- Keep it valid JSON: double quotes, no trailing commas. Keys starting with `_` are notes and are ignored.

## Replacing photos

Sizes and formats are in `assets/images/README.md`. In short: for each photo provide a `.webp` and a
`.jpg` (4:3, about 1600 x 1200, under 250 KB), then add it to `config.json`:

```json
"works": {
  "photos": [
    {
      "src": "assets/images/works/kladka-01.jpg",
      "webp": "assets/images/works/kladka-01.webp",
      "width": 1600,
      "height": 1200,
      "alt": "Кирпичная стена дома после кладки",
      "caption": "Кладка стен одноэтажного дома"
    }
  ]
}
```

Also replace `assets/images/hero.*`, `assets/og-image.jpg` (1200 x 630), and the favicon files if you want.
Use real photos of the crew's own work. Do not use stock photos of people presented as the crew.
Free converters: squoosh.app (WebP + JPEG in the browser).

## Request form

The site has no backend. The form posts to `form.endpoint` if you set it:

- **Formspree** (free): create a form, paste `https://formspree.io/f/xxxx` into `endpoint`, keep `"format": "json"`.
- **Netlify Forms**: set `"endpoint": "/"` and `"format": "form"`. The form is detected because it is in the static HTML (run prerender, which Netlify does for you via `netlify.toml`).
- **Telegram**: do not put a bot token in a public page. Point `endpoint` at a small serverless function or a no-code relay that forwards the JSON (`name`, `phone`, `task`, `address`, `page`) to your bot.

With an empty `endpoint` the form validates, then shows "form is not connected yet" and sends nothing.
It never pretends to succeed. A hidden honeypot field stops simple bots, no captcha.

## Why prerender

The browser renders the page from `config.json`, but `tools/prerender.mjs` bakes the same HTML into
`index.html` (and writes `sitemap.xml` and `robots.txt` from `site.url`). That gives you:

- a page that is fully readable with JavaScript off,
- real text and meta tags for Telegram/WhatsApp/Google previews (crawlers often skip JS),
- no flash of the old sample text.

If you skip it, the site still works: the browser notices that the baked content does not match
`config.json` and re-renders it. Netlify and the GitHub workflow below run the script automatically.

```bash
node tools/prerender.mjs
```

## Deploy for free

**Netlify**
1. Push this folder to a Git repository (or drag the folder into app.netlify.com/drop).
2. For a Git deploy, Netlify reads `netlify.toml` (runs the prerender, publishes the root).
3. Add your domain under Domain settings, then set `site.url` in `config.json`.

**GitHub Pages**
1. Push to a repository, branch `main`.
2. Settings, Pages, Source: **GitHub Actions**. The workflow `.github/workflows/pages.yml` prerenders and deploys.
3. Your site appears at `https://<user>.github.io/<repo>/`. Set `site.url` accordingly.

## Design decisions (made without asking)

- **Direction:** industrial and honest. Warm concrete neutrals, one safety-orange accent, thick rules, a faint blueprint grid, square corners.
- **Type:** Oswald (headings, uppercase) and Golos Text (body), both from Google Fonts with Cyrillic, loaded without blocking render.
- **Contrast:** buttons are orange with near-black text (white on orange fails AA). Orange used as text on light backgrounds is a darker shade.
- **Themes:** all colours are CSS custom properties in `:root`. Light/dark follows the system; the header toggle overrides it and remembers the choice.
- **Motion:** one easing family `cubic-bezier(0.22, 1, 0.36, 1)`. Only `transform` and `opacity` animate (the card shadow fades via a pseudo-element's opacity). Reveals only apply to content below the fold, play once, and nothing is hidden without JavaScript. Bounce exists only on the theme toggle (about 2% overshoot) and the success check (4%). Hero intro finishes in about 1 s. Escape closes the lightbox instantly (keyboard actions are not animated). `prefers-reduced-motion` removes all movement and the progress bar.
- **No-JS:** the content is in the HTML (via prerender), so headings, prices and contacts show without JavaScript. The form needs JavaScript to submit.
- **3D hero:** off by default. When on, Three.js `r128` is loaded from cdnjs after page load and idle time, pauses when offscreen or the tab is hidden, caps pixel ratio at 1.5, and is skipped on reduced-motion, data-saver, 2 GB or 2-core devices, falling back to the static hero image.
- **Mobile:** sticky bottom bar with "Позвонить" and "Заявка на смету"; header phone button; 44 px minimum touch targets.
- **Lightbox:** native `<dialog>` (focus trap, Escape), arrow keys, swipe, backdrop click, focus returns to the thumbnail.

## Files

```
index.html              page shell (content between render markers is generated)
config.json             ALL brand data
assets/css/styles.css   design tokens, layout, themes, motion
assets/js/render.js     config -> HTML (shared by browser and prerender)
assets/js/app.js        theme, scroll, reveal, lightbox, form
assets/js/hero3d.js     optional 3D hero (loaded only if enabled)
assets/images/          hero + works photos (+ README with sizes)
assets/og-image.jpg     social preview placeholder
assets/favicon.svg, apple-touch-icon.png
tools/prerender.mjs     optional: bake config into index.html, write sitemap/robots
sitemap.xml, robots.txt templates (regenerated by prerender from site.url)
netlify.toml, .github/workflows/pages.yml   optional deploy helpers
```
