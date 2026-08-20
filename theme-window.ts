import type { EmbedColorScheme } from "./messenger-types"
import { getEmbedMessageContent, makeEmbedMessage } from "./messenger-types"

/**
 * Works out whether the host page around an embedded iframe is light or dark, without asking the
 * host site to configure anything:
 *
 * 1. `data-color-scheme="light|dark"` on the iframe, when the site wants to pin it.
 * 2. Otherwise the first ancestor that actually paints a background - its brightness is what the
 *    embedded page has to sit against, whatever the site calls its theme internally.
 * 3. Otherwise the viewer's OS preference.
 */
export function detectHostColorScheme(element: HTMLElement): EmbedColorScheme {

    const attribute = element.dataset.colorScheme;
    if (attribute === 'light' || attribute === 'dark') return attribute;

    for (let node = element.parentElement; node; node = node.parentElement) {
        const channels = window.getComputedStyle(node).backgroundColor.match(/[\d.]+/g);
        if (!channels || channels.length < 3) continue;
        // Skip fully transparent backgrounds - they show whatever is painted further up.
        if (channels.length > 3 && Number(channels[3]) === 0) continue;

        const brightness = (Number(channels[0]) * 299 + Number(channels[1]) * 587 + Number(channels[2]) * 114) / 1000;
        return brightness < 128 ? 'dark' : 'light';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Tells an embedded RadPPTX page which color scheme to render in.
 *
 * The embedded page asks for the scheme once it has booted, so this works no matter which side
 * finishes loading first. Pass `resolveColorScheme` when the host knows its own theme better than
 * `detectHostColorScheme` can guess - from a store, a cookie, a `data-theme` attribute.
 *
 * @returns `push`, to re-send the scheme whenever the host's theme changes, and `cleanUp`
 */
export function addThemeToWindowElement(
    elementOrId: HTMLIFrameElement | string,
    resolveColorScheme: (iframe: HTMLIFrameElement) => EmbedColorScheme = detectHostColorScheme,
) {

    const resolveIframe = () => {
        const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
        return element instanceof HTMLIFrameElement ? element : undefined;
    };

    const push = () => {
        const iframe = resolveIframe();
        iframe?.contentWindow?.postMessage(makeEmbedMessage({
            type: "color-scheme-set",
            colorScheme: resolveColorScheme(iframe),
        }), '*');
    };

    const onMessage = (event: MessageEvent<unknown>) => {
        const content = getEmbedMessageContent(event);
        if (content?.type !== "color-scheme-requested") return;
        if (event.source !== resolveIframe()?.contentWindow) return;

        push();
    };

    window.addEventListener('message', onMessage);

    // The embedded page asks for the scheme as it boots, which covers the case where the host attaches
    // first. These cover the other order - a frame that had already finished loading before now.
    const iframe = resolveIframe();
    iframe?.addEventListener('load', push);
    push();

    return {
        push,
        cleanUp: () => {
            window.removeEventListener('message', onMessage);
            iframe?.removeEventListener('load', push);
        },
    };
}
