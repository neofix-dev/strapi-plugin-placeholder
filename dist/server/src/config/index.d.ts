/**
 * Output formats a placeholder can be encoded in. WebP is the default because it
 * produces by far the smallest payload at placeholder sizes — a 16px WebP is around
 * 160 bytes, where the same image as a PNG is several kilobytes.
 */
export declare const PLACEHOLDER_FORMATS: readonly ["webp", "jpeg", "png", "avif"];
export type PlaceholderFormat = (typeof PLACEHOLDER_FORMATS)[number];
/** The plugin configuration, as it may be written in `config/plugins.ts`. */
export interface PlaceholderConfig {
    size?: number;
    format?: PlaceholderFormat;
    quality?: number;
    removeAlpha?: boolean;
}
/** The plugin configuration once Strapi has merged it with the defaults below. */
export type PlaceholderSettings = Required<PlaceholderConfig>;
declare const _default: {
    default: {
        size: number;
        format: "webp";
        quality: number;
        removeAlpha: false;
    };
    validator(config: unknown): void;
};
export default _default;
