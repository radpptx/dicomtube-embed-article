import type { EmbedColorScheme } from "./messenger-types"
import { getEmbedMessageContent, makeEmbedMessage } from "./messenger-types"

export namespace addThemeToIFrame {
    export type Options = {
        /**
         * The element carrying the `light`/`dark` class. Defaults to `<html>`, which is what the
         * whole page - including anything portalled to `document.body` - cascades from.
         */
        target?: HTMLElement;
        /** Called whenever the applied scheme changes, e.g. to mirror it into a ThemeModeController. */
        onChange?: (colorScheme: EmbedColorScheme) => void;
    }
}

/**
 * Makes the embedded page follow the host window's light/dark appearance.
 *
 * There is nothing to hook into on the React side: `ViewportThemeProvider` builds its MUI theme with
 * `colorSchemeSelector: 'class'` and `colorSchemeNode={null}`, meaning it deliberately never picks a
 * mode itself and simply follows a `light`/`dark` class on an ancestor. So all this does is set that
 * class - same mechanism `useBasicThemeModeController` uses in a non-embedded app.
 *
 * The host may install its side before or after this document boots, so instead of waiting for a
 * broadcast we ask for the current scheme and let the host answer. Until it does, the viewer's own
 * OS preference is applied so the page is never briefly styled in the wrong scheme.
 *
 * @returns a cleanup function that stops following the host
 */
export function addThemeToIFrame(options: addThemeToIFrame.Options = {}) {

    const { target = document.documentElement, onChange } = options;

    let applied: EmbedColorScheme | undefined;

    const apply = (colorScheme: EmbedColorScheme) => {
        if (colorScheme === applied) return;
        applied = colorScheme;

        target.classList.remove('light', 'dark');
        target.classList.add(colorScheme);
        // Keeps native scrollbars, form controls and the canvas behind the page in the same scheme.
        target.style.colorScheme = colorScheme;

        onChange?.(colorScheme);
    };

    const onMessage = (event: MessageEvent<unknown>) => {
        if (event.source !== window.parent) return;

        const content = getEmbedMessageContent(event);
        if (content?.type !== "color-scheme-set") return;

        apply(content.colorScheme);
    };

    window.addEventListener('message', onMessage);

    apply(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    window.parent.postMessage(makeEmbedMessage({ type: "color-scheme-requested" }), '*');

    return () => window.removeEventListener('message', onMessage);
}
