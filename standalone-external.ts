import { addResizerToWindowElement } from "./resizer-window"
import { addThemeToWindowElement } from "./theme-window"

/**
 * The drop-in script for a website embedding a RadPPTX article page. Include it once and forget:
 *
 *     <script src=".../mss-radpptx-embed.js" defer></script>
 *     <iframe class="mss-radpptx-embed-page-iframe" data-content-id="123"
 *             style="width: 100%; border: 0"></iframe>
 *
 * Every matching iframe is then sized to its content and kept in the host page's light/dark scheme.
 *
 * Optional attributes on the iframe:
 *   `data-content-id`        the article to load, when `src` is not set directly
 *   `data-embed-base-url`    where to load it from, if not the default site
 *   `data-additional-padding` extra pixels below the content
 *   `data-color-scheme`      `light` or `dark` to pin the scheme instead of detecting it
 *
 * This file and the modules it imports are free of any other library code on purpose, so that a site
 * owner can read the whole of what they are including. Please keep it that way.
 */

const defaultEmbedBaseUrl = 'https://dicomtube.com/embed/article/';

function resolveSrc(iframe: HTMLIFrameElement) {
    const contentId = iframe.getAttribute('data-content-id');
    if (!contentId) return undefined;

    const baseUrl = iframe.getAttribute('data-embed-base-url') ?? defaultEmbedBaseUrl;
    return `${baseUrl.replace(/\/?$/, '/')}${contentId}`;
}

window.addEventListener('load', () => {

    const pushes: (() => void)[] = [];

    // Detection reads computed styles, and a busy site can touch <html> many times a frame, so coalesce.
    let scheduledFrame: number | undefined;
    const pushAll = () => {
        if (scheduledFrame !== undefined) return;
        scheduledFrame = requestAnimationFrame(() => {
            scheduledFrame = undefined;
            pushes.forEach(push => push());
        });
    };

    const attributeObserver = new MutationObserver(pushAll);

    document.querySelectorAll('.mss-radpptx-embed-page-iframe').forEach(element => {
        if (!(element instanceof HTMLIFrameElement)) return;

        const existingSrc = element.getAttribute('src');
        const src = existingSrc || resolveSrc(element);
        if (!src) return;

        // Both listeners go on before the document starts loading, so the embedded page's opening
        // request for a color scheme cannot arrive before anything is listening for it.
        addResizerToWindowElement(element);
        const { push } = addThemeToWindowElement(element);
        pushes.push(push);

        // Only this one attribute: the resizer writes `style` on every height change, and re-pushing
        // the scheme each time would be pure noise.
        attributeObserver.observe(element, { attributes: true, attributeFilter: ['data-color-scheme'] });

        // Only when it was not already set: re-assigning the same src reloads the frame in some browsers.
        if (!existingSrc) element.setAttribute('src', src);
    });

    if (pushes.length === 0) return;

    // A site's theme toggle nearly always flips a class or a data-* attribute on <html>; re-running the
    // detection afterwards picks up the new scheme without the site having to write any code.
    attributeObserver.observe(document.documentElement, { attributes: true });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pushAll);
});
