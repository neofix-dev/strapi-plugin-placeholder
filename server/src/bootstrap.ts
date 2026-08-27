import type { Core } from '@strapi/strapi';
import mimeTypes from 'mime-types';
import { getService } from './utils';

interface FileData {
  url?: string;
  mime?: string;
  name?: string;
  placeholder?: string | null;
}

type WhereClause = Record<string, unknown> | undefined;

/**
 * Checks whether the passed file has a MIME type that is supported by the plugin,
 * hence whether a placeholder can be generated.
 *
 * Every image type is let through rather than matched against a list of formats:
 * sharp decodes more than is obvious — SVG is rasterised through librsvg, for
 * instance — and a format missing from such a list would silently lose its
 * placeholder, where an undecodable one merely fails and is logged.
 */
const canGeneratePlaceholder = (file: FileData): file is FileData & { url: string } => {
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

/**
 * Checks that the where clause of an update addresses exactly one file.
 *
 * A placeholder describes one specific image, while the data of an update is applied to
 * every row the clause matches. Bulk operations — moving a selection into a folder, for
 * instance — would otherwise stamp the placeholder of whichever file was read first onto
 * all of them. Those operations only ever change metadata, so skipping them loses nothing.
 */
const targetsSingleFile = (where: WhereClause): boolean => {
  const identifier = where?.documentId ?? where?.id;

  return typeof identifier === 'string' || typeof identifier === 'number';
};

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  /* Generate a placeholder when a new image is uploaded or updates */

  const generatePlaceholder = async (event: {
    params: { data?: FileData; where?: WhereClause };
  }) => {
    const { data, where } = event.params;

    if (!data) return;

    // An update carries only the changed fields, so read the stored row to fill the gaps
    // and to find out whether a placeholder is already there. The where clause is passed
    // through as it stands: Strapi addresses files by `documentId` in some code paths and
    // by `id` in others.
    let storedFile: FileData | null = null;

    if (where) {
      if (!targetsSingleFile(where)) return;

      storedFile = (await strapi.db.query('plugin::upload.file').findOne({
        select: ['url', 'mime', 'name', 'placeholder'],
        where,
      })) as FileData | null;

      if (storedFile) {
        data.url = data.url ?? storedFile.url;
        data.mime = data.mime ?? storedFile.mime;
      }
    }

    const isUrlChanging = Boolean(data.url && data.url !== storedFile?.url);

    // Nothing to do for metadata-only edits: renaming a file, editing its alternative
    // text or moving it between folders must not re-download the image from the upload
    // provider only to produce the very same placeholder again. A file that has no
    // placeholder yet still gets one here, which backfills older uploads as they are
    // touched.
    if (!isUrlChanging && storedFile?.placeholder) return;

    if (!canGeneratePlaceholder(data)) return;

    const generatorService = getService(strapi, 'generator');
    data.placeholder = await generatorService.generate(data.url);
  };

  strapi.db.lifecycles.subscribe({
    models: ['plugin::upload.file'],
    beforeCreate: generatePlaceholder,
    beforeUpdate: generatePlaceholder,
  });
};

export default bootstrap;
