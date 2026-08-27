import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Core } from '@strapi/strapi';
import sharp from 'sharp';
import { getService } from '../utils';

/**
 * Reads the bytes of the image the given URL points at. Remote URLs (served by an
 * upload provider such as Cloudflare R2) are fetched, local ones are read straight
 * from the public directory instead of being requested over HTTP from Strapi itself.
 */
const loadImage = async (strapi: Core.Strapi, url: string): Promise<Buffer> => {
  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  return readFile(path.join(strapi.dirs.static.public, url));
};

const generator = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Generates a base64 placeholder image for the given image.
   * @param url a local or remote image URL to generate a placeholder for
   * @returns a base64 encoded placeholder image, or null if it could not be generated
   */
  async generate(url: string): Promise<string | null> {
    try {
      const { size, format, quality, removeAlpha } = getService(strapi, 'settings').get();

      let pipeline = sharp(await loadImage(strapi, url)).resize(size, size, {
        fit: 'inside',
        withoutEnlargement: true,
      });

      if (removeAlpha) {
        pipeline = pipeline.removeAlpha();
      }

      const placeholder = await pipeline.toFormat(format, { quality }).toBuffer();

      return `data:image/${format};base64,${placeholder.toString('base64')}`;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      strapi.log.error(`[placeholder] Could not generate a placeholder for ${url}: ${reason}`);
      return null;
    }
  },
});

export default generator;
