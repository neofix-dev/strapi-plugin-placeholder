import { z } from 'zod';

/**
 * Output formats a placeholder can be encoded in. WebP is the default because it
 * produces by far the smallest payload at placeholder sizes — a 16px WebP is around
 * 160 bytes, where the same image as a PNG is several kilobytes.
 */
export const PLACEHOLDER_FORMATS = ['webp', 'jpeg', 'png', 'avif'] as const;

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

const configSchema = z
  .object({
    size: z.number().int().min(4).max(64).optional(),
    format: z.enum(PLACEHOLDER_FORMATS).optional(),
    quality: z.number().int().min(1).max(100).optional(),
    removeAlpha: z.boolean().optional(),
  })
  .strict();

export default {
  default: {
    size: 16,
    format: 'webp',
    quality: 20,
    removeAlpha: false,
  } satisfies PlaceholderSettings,
  validator(config: unknown) {
    configSchema.parse(config);
  },
};
