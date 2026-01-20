import type { Core } from '@strapi/strapi';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  const uploadPlugin = strapi.plugin('upload');

  if (!uploadPlugin) {
    strapi.log.warn("Upload plugin is not installed, Placeholder plugin won't be started.");
    return;
  }

  /* Update the Media Library File content type, adding the placeholder field */
  (uploadPlugin.contentTypes.file as { attributes: Record<string, unknown> }).attributes.placeholder = {
    type: 'text',
  };
};

export default register;
