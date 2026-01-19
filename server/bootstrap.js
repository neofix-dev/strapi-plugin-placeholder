'use strict';

const { getService, canGeneratePlaceholder } = require('./utils');

module.exports = ({ strapi }) => {
  /* Generate a placeholder when a new image is uploaded or updates */

  const generatePlaceholder = async (event) => {
    const { data, where } = event.params;

    if(!data.url || !data.mime) {
      // If the returned data is missing a url or mime property (probably because we're doing an update)
      // then we'll need to pull these values from the upload.file plugin and merge them in.
      const documentId = where.documentId || where.id; // Support both formats for migration
      const file = await strapi.documents('plugin::upload.file').findOne({
        documentId
      });
      data.url = data.url ?? file.url;
      data.mime = data.mime ?? file.mime;
    }

    if (!canGeneratePlaceholder(data)) return;
    data.placeholder = await getService(strapi, 'placeholder').generate(data.url);
  };

  strapi.db.lifecycles.subscribe({
    models: ['plugin::upload.file'],
    beforeCreate: generatePlaceholder,
    beforeUpdate: generatePlaceholder,
  });
};
