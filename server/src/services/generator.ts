import type { Core } from '@strapi/strapi';
import { getPlaiceholder } from 'plaiceholder';
import { getService } from '../utils';

const generator = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Generates a base64 placeholder image for the given image.
   * @param url a local or remote image URL to generate a placeholder for
   * @returns a base64 encoded placeholder image
   */
  async generate(url: string): Promise<string | null> {
    try {
      const settings = getService(strapi, 'settings').get();
      const { base64 } = await getPlaiceholder(url, settings);
      return base64;
    } catch (e) {
      strapi.log.error(e);
      return null;
    }
  },
});

export default generator;
