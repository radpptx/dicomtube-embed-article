# Embed script for article pages

A ~6 KB, dependency-free script that makes an embedded article page behave like part of your own
page: it grows the `<iframe>` to the height of the article, so the article never gets its own inner
scrollbar, and it tells the article whether your page is light or dark so it matches your design.

Nothing else. No cookies, no storage, no analytics, no network requests of its own, no third-party
code, no minification - the file you serve is the source you can read, top to bottom, in a few
minutes. [What it does and does not do](#what-the-script-does-and-does-not-do) spells that out.

## Install

Host `mss-radpptx-embed.js` on your own site (recommended - then nothing on your page loads from a
domain you do not control), include it once, and give each iframe the class:

```html
<script src="/js/mss-radpptx-embed.js" defer></script>

<iframe class="mss-radpptx-embed-page-iframe"
        data-content-id="123"
        style="width: 100%; border: 0"></iframe>
```

Every `.mss-radpptx-embed-page-iframe` on the page is then sized to its content and kept in your
page's color scheme. If you already set `src` yourself, the script leaves it alone.

| Attribute | Effect |
|---|---|
| `data-content-id` | which article to load, when you do not set `src` directly |
| `data-embed-base-url` | where to load it from, if not the default site |
| `data-additional-padding` | deliberate extra pixels below the content; normally leave it off |
| `data-color-scheme` | `light` or `dark`, to pin the scheme instead of letting it be detected |

### Content Security Policy

Serving the script from your own origin means no `script-src` exception is needed for it. You still
need `frame-src` to allow the site the article is loaded from. The script itself makes no network
requests, so no `connect-src` entry is required.

## How the color scheme is chosen

In order:

1. `data-color-scheme` on the iframe, if you set it.
2. Otherwise the background color of the nearest ancestor element that actually paints one - dark
   background, dark article. This is what makes it work with no configuration: whatever your site
   calls its theme internally, the background the iframe sits against is what the article has to
   match.
3. Otherwise the visitor's OS preference.

Your theme toggle is picked up automatically. Toggles nearly always flip a class or a `data-*`
attribute on `<html>`, and the script watches `<html>` for attribute changes and re-runs the
detection. It also follows the OS preference changing while the page is open.

If your site knows its own theme better than that guess, set `data-color-scheme` on the iframe from
your toggle - changes to that attribute are observed too, so assigning it is all that is needed.

## The protocol, in full

Host and article talk over `window.postMessage`. Four message types exist, and this is all of them:

| Direction | Message | Meaning |
|---|---|---|
| article → host | `{ type: "iframe-resized", scrollHeight }` | the content is now this many pixels tall |
| host → article | `{ type: "iframe-height-applied" }` | the host has applied a height to the frame |
| article → host | `{ type: "color-scheme-requested" }` | sent once as the article boots |
| host → article | `{ type: "color-scheme-set", colorScheme }` | `"light"` or `"dark"` |

Every message is wrapped as `{ source: "mss-iframe-resizer", content: <one of the above> }`. Anything
else arriving at your `message` handler is ignored, and each message is checked field by field before
it is used: `scrollHeight` must be a number, `colorScheme` must be exactly `"light"` or `"dark"`.

The script also requires `event.source` to be the `contentWindow` of the iframe it is managing, so
another frame on your page cannot resize or re-theme someone else's embed.

Messages are posted with a `'*'` target origin. That is deliberate and safe here: the payload is a
height and a light/dark flag, neither of which is a secret, and the alternative would mean pinning
the article's origin at build time so that self-hosting the article elsewhere would break. Nothing is
ever read out of your page and sent anywhere.

## What the script does and does not do

Everything it touches on your page:

- reads the `data-*` attributes listed above, and `src`, on elements carrying the embed class
- writes `style.height` on those iframes, and `src` if you did not set one
- reads the computed `background-color` of that iframe's ancestors, for the scheme detection
- listens for `message` on `window`, `load` on `window`, and `change` on the dark-mode media query
- observes attribute changes on `<html>` and on the iframes

Things it never does, and which you can confirm by reading the file:

- no `fetch`, `XMLHttpRequest`, `WebSocket`, or beacon - it sends nothing anywhere
- no cookies, `localStorage`, or `sessionStorage`
- no `eval`, `new Function`, or dynamically injected scripts
- no analytics, fingerprinting, or user tracking
- no reading of your page's text, form fields, or the visitor's input
- no dependencies of any kind - plain DOM only, so there is no supply chain behind it

Inside the iframe, the article sets `overflow: hidden` on its own document once your page confirms it
has applied a height, since at that point your page is the scroller. That is conditional on the
confirmation: an article whose host is *not* running this script keeps scrolling normally rather than
being stranded at the iframe's default 150px.

## Using the pieces directly

If you would rather compose the behavior yourself than use the drop-in, the folder's modules stand
alone and have no dependencies:

- `resizer-window.ts` - `addResizerToWindowElement(iframeOrId)`, sizes one iframe; returns a cleanup
  function.
- `theme-window.ts` - `addThemeToWindowElement(iframeOrId, resolveColorScheme?)`, keeps one iframe in
  your scheme; returns `{ push, cleanUp }`. Pass `resolveColorScheme` to bypass detection entirely,
  and call `push()` whenever your theme changes.
- `messenger-types.ts` - the wire format and the validator, if you want to speak the protocol from
  your own code.
- `standalone-external.ts` - the drop-in itself, which is nothing more than those two installers
  applied to every element with the class.

```ts
import { addResizerToWindowElement } from './resizer-window';
import { addThemeToWindowElement } from './theme-window';

addResizerToWindowElement(iframe);

const { push } = addThemeToWindowElement(iframe, () => myStore.isDark ? 'dark' : 'light');
myStore.subscribe(push);
```

The other two modules, `resizer-iframe.ts` and `theme-iframe.ts`, are the halves that run inside the
embedded article page. You do not need them to embed one; they are here so the whole of both sides of
the protocol can be read in one place.

## Browser support and troubleshooting

Modern browsers, compiled to ES2018. The host side uses `MutationObserver`, `requestAnimationFrame`
and `matchMedia`; the article side additionally uses `ResizeObserver`. Anything from roughly 2020
onward works.

**The iframe stays 150px tall.** The script did not attach, or the article never reported a height:
check that the iframe carries the `mss-radpptx-embed-page-iframe` class exactly, and that the script
tag is present and loading (it attaches on `window.load`, so iframes added later are not picked up -
call the installers yourself for those).

**The article's colors do not match.** The nearest ancestor painting a background is not the one your
eye reads as the page background - for example a transparent wrapper over a dark body. Set
`data-color-scheme` on the iframe and the detection is skipped.

**A gap below the article.** Remove `data-additional-padding` if you set it; the height reported is
already the full content height.
