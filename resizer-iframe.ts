import { getEmbedMessageContent, makeEmbedMessage } from "./messenger-types"

/**
 * The default id of the element whose content height is reported to the host window. It is the
 * container the embedded page's React root is mounted into, so its `scrollHeight` is the full height
 * of the rendered article even when the element itself is a fixed-height scroll container.
 */
const defaultMeasuredElementId = 'viewport-root';

function resolveElement(elementOrId: HTMLElement | string) {
    return typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
}

/**
 * Reports the embedded page's content height to the host window so it can size the iframe and keep
 * the scrollbar on its own page instead of inside the iframe.
 *
 * The height has to be re-reported on far more than `window.resize`: images and videos finish
 * loading, fonts swap, an MCQ reveals its explanation. Every trigger funnels into one animation-frame
 * debounced send that stays quiet while the height is unchanged.
 *
 * Once the host confirms it has applied a height, this document stops scrolling altogether - see
 * `onHeightApplied` below. That is conditional on the confirmation, never assumed.
 *
 * @returns a cleanup function that stops reporting
 */
export function addResizerToIFrame(elementOrId: HTMLElement | string = defaultMeasuredElementId) {

    let lastSentHeight: number | undefined;
    let scheduledFrame: number | undefined;

    const send = () => {
        scheduledFrame = undefined;
        const element = resolveElement(elementOrId);
        if (!element || element.scrollHeight === lastSentHeight) return;

        lastSentHeight = element.scrollHeight;
        window.parent.postMessage(makeEmbedMessage({
            type: "iframe-resized",
            scrollHeight: element.scrollHeight,
        }), '*');

        const r = document.getElementById('viewport-root');
        if (!r) return;
        
        console.table({ innerHeight, doc: document.documentElement.scrollHeight,
                body: document.body.scrollHeight, root: r.scrollHeight,
                rootRect: r.getBoundingClientRect().height });

    };

    const scheduleSend = () => {
        if (scheduledFrame !== undefined) return;
        scheduledFrame = requestAnimationFrame(send);
    };

    // Only once the host has actually applied a height do we know this document is not the scroller -
    // until then it has to keep scrolling normally, or a page whose host never runs the bridge would
    // be stranded at the iframe's default 150px with no way to reach the rest of the article.
    let overflowSuppressed = false;
    const previousOverflow = document.documentElement.style.overflow;

    const onHeightApplied = (event: MessageEvent<unknown>) => {
        if (overflowSuppressed || event.source !== window.parent) return;
        if (getEmbedMessageContent(event)?.type !== "iframe-height-applied") return;

        overflowSuppressed = true;
        // Chrome does not re-evaluate whether a scrollbar is still needed when the overflow is resolved
        // by the *parent* resizing the frame rather than by the content changing. The scrollbar from
        // before the frame fitted is left behind, rendered but with nothing to scroll. Declaring
        // outright that this document never scrolls both states the bridge's contract and clears it.
        document.documentElement.style.overflow = 'hidden';
    };

    window.addEventListener('message', onHeightApplied);

    const resizeObserver = new ResizeObserver(scheduleSend);
    const mutationObserver = new MutationObserver(scheduleSend);

    const observe = () => {
        const element = resolveElement(elementOrId);
        if (!element) return;
        resizeObserver.observe(element);
        mutationObserver.observe(element, { childList: true, subtree: true, attributes: true });
    };

    window.addEventListener('resize', scheduleSend);
    // Capture phase: `load` on an individual <img>/<video> does not bubble, but it is still dispatched
    // down through the window during capture. This is what catches late-loading media.
    window.addEventListener('load', scheduleSend, true);

    observe();
    scheduleSend();

    return () => {
        window.removeEventListener('resize', scheduleSend);
        window.removeEventListener('load', scheduleSend, true);
        window.removeEventListener('message', onHeightApplied);
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        if (scheduledFrame !== undefined) cancelAnimationFrame(scheduledFrame);
        if (overflowSuppressed) document.documentElement.style.overflow = previousOverflow;
    };
}

/**
 * Reports the current content height once, immediately. `addResizerToIFrame` already covers the
 * usual triggers - reach for this only to force a re-measure the observers cannot see.
 */
export function sendResizeMessage(elementOrId: HTMLElement | string = defaultMeasuredElementId) {
    const element = resolveElement(elementOrId);
    if (!element) return;

    window.parent.postMessage(makeEmbedMessage({
        type: "iframe-resized",
        scrollHeight: element.scrollHeight,
    }), '*');
}
