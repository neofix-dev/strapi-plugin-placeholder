import type { Core } from '@strapi/strapi';

interface ContentTypeWithAttributes {
  attributes: Record<string, { type: string }>;
}

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  const uploadPlugin = strapi.plugin('upload');

  if (!uploadPlugin) {
    strapi.log.warn("Upload plugin is not installed, Placeholder plugin won't be started.");
    return;
  }

  /* Update the Media Library File content type, adding the placeholder field */
  const fileContentType = uploadPlugin.contentTypes.file as unknown as ContentTypeWithAttributes;
  fileContentType.attributes.placeholder = { type: 'text' };
};

export default register;
