/**
 * The wire format for the embed bridge between a host page and an embedded RadPPTX page.
 *
 * Every module in this folder is deliberately free of imports from anywhere else in the library:
 * `standalone-external.ts` is bundled and handed to third-party websites, so its source has to be
 * auditable on its own. Keep it that way - no MUI, no React, no npm packages, plain DOM only.
 *
 * This is also the one folder that uses relative imports rather than the `mss-radpptx/*` alias, so
 * that the folder can be lifted out and published on its own without the alias resolving to nothing.
 */

/**
 * Unchanged from the resizer-only protocol, so host pages still running the older standalone script
 * keep working against the newer embedded page.
 */
export const embedMessageSource = 'mss-iframe-resizer';

export type EmbedColorScheme = 'light' | 'dark';

export type EmbedMessage = {
    source: typeof embedMessageSource,
    content: EmbedMessageContent,
}

export type EmbedMessageContent =
    // Embedded page -> host window
    | { type: "iframe-resized", scrollHeight: number }
    | { type: "color-scheme-requested" }
    // Host window -> embedded page
    | { type: "color-scheme-set", colorScheme: EmbedColorScheme }
    | { type: "iframe-height-applied" };


export function makeEmbedMessage(content: EmbedMessageContent): EmbedMessage {
    return { source: embedMessageSource, content };
}

/** Narrows an arbitrary `MessageEvent` from an untrusted origin down to one of our messages. */
export function getEmbedMessageContent(event: MessageEvent<unknown>): EmbedMessageContent | undefined {
    const data: unknown = event.data;
    if (!data || typeof data !== 'object') return undefined;
    if (!('source' in data) || data.source !== embedMessageSource) return undefined;
    if (!('content' in data) || !data.content || typeof data.content !== 'object') return undefined;
    if (!('type' in data.content)) return undefined;

    const content = data.content;
    const type: unknown = content.type;

    if (type === "iframe-resized") {
        return 'scrollHeight' in content && typeof content.scrollHeight === 'number'
            ? { type, scrollHeight: content.scrollHeight }
            : undefined;
    }
    if (type === "color-scheme-requested" || type === "iframe-height-applied") {
        return { type };
    }
    if (type === "color-scheme-set") {
        return 'colorScheme' in content && (content.colorScheme === 'light' || content.colorScheme === 'dark')
            ? { type, colorScheme: content.colorScheme }
            : undefined;
    }
    return undefined;
}
