import { Core } from '@strapi/strapi';
declare const generator: ({ strapi }: {
    strapi: Core.Strapi;
}) => {
    /**
     * Generates a base64 placeholder image for the given image.
     * @param url a local or remote image URL to generate a placeholder for
     * @returns a base64 encoded placeholder image, or null if it could not be generated
     */
    generate(url: string): Promise<string | null>;
};
export default generator;
