import { getEmbedMessageContent, makeEmbedMessage } from "./messenger-types"

/**
 * Sizes an embedded RadPPTX page's iframe to the height of its content, so the iframe never grows a
 * scrollbar of its own and the host page scrolls instead.
 *
 * Add `data-additional-padding="16"` to the iframe for extra room below the content.
 *
 * @returns a cleanup function that stops resizing
 */
export function addResizerToWindowElement(elementOrId: HTMLIFrameElement | string) {

    const onMessage = (event: MessageEvent<unknown>) => {
        const content = getEmbedMessageContent(event);
        if (content?.type !== "iframe-resized") return;

        const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
        if (!(element instanceof HTMLIFrameElement)) return;

        // The message is the only thing tying an event to an iframe - without this any other frame on
        // the page could resize ours.
        if (event.source !== element.contentWindow) return;

        const additionalPadding = Number(element.getAttribute("data-additional-padding")) || 0;
        element.style.height = `${content.scrollHeight + additionalPadding}px`;

        // Tells the embedded page that its height is being driven from out here, which is the one thing
        // it cannot work out for itself. See `addResizerToIFrame` for what it does with that.
        element.contentWindow?.postMessage(makeEmbedMessage({ type: "iframe-height-applied" }), '*');
    };

    window.addEventListener('message', onMessage);

    return () => window.removeEventListener('message', onMessage);
}
