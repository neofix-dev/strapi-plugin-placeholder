import type { Core } from '@strapi/strapi';
import mimeTypes from 'mime-types';
import { PLUGIN_ID } from './pluginId';

interface FileData {
  url?: string;
  mime?: string;
  name?: string;
  placeholder?: string | null;
}

/**
 * Checks whether the passed file has a MIME type that is supported by the plugin,
 * hence whether a placeholder can be generated.
 */
const canGeneratePlaceholder = (file: FileData): boolean => {
  let mime = file.mime;

  if (!mime && file.name) {
    // Only lookup the mime if file lacks the prop.
    const lookedUpMime = mimeTypes.lookup(file.name);
    if (lookedUpMime) {
      mime = lookedUpMime;
    }
  }

  return Boolean(mime?.startsWith('image/') && file.url);
};

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  /* Generate a placeholder when a new image is uploaded or updates */

  const generatePlaceholder = async (event: { params: { data?: FileData; where?: { documentId?: string; id?: string } } }) => {
    const { data, where } = event.params;

    if (!data) return;

    if (!data.url || !data.mime) {
      // If the returned data is missing a url or mime property (probably because we're doing an update)
      // then we'll need to pull these values from the upload.file plugin and merge them in.
      const documentId = where?.documentId || where?.id;
      if (documentId) {
        const file = await strapi.documents('plugin::upload.file').findOne({
          documentId,
        });
        if (file) {
          data.url = data.url ?? file.url;
          data.mime = data.mime ?? file.mime;
        }
      }
    }

    if (!canGeneratePlaceholder(data)) return;

    const placeholderService = strapi.plugin(PLUGIN_ID).service('placeholder');
    data.placeholder = await placeholderService.generate(data.url!);
  };

  strapi.db.lifecycles.subscribe({
    models: ['plugin::upload.file'],
    beforeCreate: generatePlaceholder,
    beforeUpdate: generatePlaceholder,
  } as unknown as Parameters<typeof strapi.db.lifecycles.subscribe>[0]);
};

export default bootstrap;
