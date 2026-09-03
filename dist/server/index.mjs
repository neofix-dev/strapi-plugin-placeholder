import mimeTypes from "mime-types";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const PLUGIN_ID = "placeholder";
const getService = (strapi, serviceName) => {
  return strapi.plugin(PLUGIN_ID).service(serviceName);
};
const FILE_CONTENT_FIELDS = [
  "hash",
  "ext",
  "size",
  "width",
  "height",
  "formats"
];
const canGeneratePlaceholder = (file) => {
  let mime = file.mime;
  if (!mime && file.name) {
    const lookedUpMime = mimeTypes.lookup(file.name);
    if (lookedUpMime) {
      mime = lookedUpMime;
    }
  }
  return Boolean(mime?.startsWith("image/") && file.url);
};
const targetsSingleFile = (where) => {
  const identifier = where?.documentId ?? where?.id;
  return typeof identifier === "string" || typeof identifier === "number";
};
const bootstrap = ({ strapi }) => {
  const generatePlaceholder = async (event) => {
    const { data, where } = event.params;
    if (!data) return;
    let storedFile = null;
    if (where) {
      if (!targetsSingleFile(where)) return;
      storedFile = await strapi.db.query("plugin::upload.file").findOne({
        select: ["url", "mime", "name", "placeholder"],
        where
      });
      if (storedFile) {
        data.url = data.url ?? storedFile.url;
        data.mime = data.mime ?? storedFile.mime;
      }
    }
    const carriesNewBytes = FILE_CONTENT_FIELDS.some((field) => data[field] !== void 0);
    if (!carriesNewBytes && storedFile?.placeholder) return;
    if (!canGeneratePlaceholder(data)) return;
    const generatorService = getService(strapi, "generator");
    data.placeholder = await generatorService.generate(data.url) ?? "";
  };
  strapi.db.lifecycles.subscribe({
    models: ["plugin::upload.file"],
    beforeCreate: generatePlaceholder,
    beforeUpdate: generatePlaceholder
  });
};
const register = ({ strapi }) => {
  const uploadPlugin = strapi.plugin("upload");
  if (!uploadPlugin) {
    strapi.log.warn("Upload plugin is not installed, Placeholder plugin won't be started.");
    return;
  }
  const fileContentType = uploadPlugin.contentTypes.file;
  fileContentType.attributes.placeholder = { type: "text" };
};
const PLACEHOLDER_FORMATS = ["webp", "jpeg", "png", "avif"];
const configSchema = z.object({
  size: z.number().int().min(4).max(64).optional(),
  format: z.enum(PLACEHOLDER_FORMATS).optional(),
  quality: z.number().int().min(1).max(100).optional(),
  removeAlpha: z.boolean().optional()
}).strict();
const config = {
  default: {
    size: 16,
    format: "webp",
    quality: 20,
    removeAlpha: false
  },
  validator(config2) {
    configSchema.parse(config2);
  }
};
const loadImage = async (strapi, url) => {
  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  return readFile(path.join(strapi.dirs.static.public, url));
};
const generator = ({ strapi }) => ({
  /**
   * Generates a base64 placeholder image for the given image.
   * @param url a local or remote image URL to generate a placeholder for
   * @returns a base64 encoded placeholder image, or null if it could not be generated
   */
  async generate(url) {
    try {
      const { size, format, quality, removeAlpha } = getService(strapi, "settings").get();
      let pipeline = sharp(await loadImage(strapi, url)).resize(size, size, {
        fit: "inside",
        withoutEnlargement: true
      });
      if (removeAlpha) {
        pipeline = pipeline.removeAlpha();
      }
      const placeholder = await pipeline.toFormat(format, { quality }).toBuffer();
      return `data:image/${format};base64,${placeholder.toString("base64")}`;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      strapi.log.error(`[placeholder] Could not generate a placeholder for ${url}: ${reason}`);
      return null;
    }
  }
});
const settings = ({ strapi }) => ({
  /**
   * Helper that returns the plugin settings.
   * @returns the settings of the plugin
   */
  get() {
    return strapi.config.get(`plugin::${PLUGIN_ID}`);
  },
  /**
   * Helper that sets the plugin settings and returns them.
   * @param newSettings the desired settings for the plugin
   * @returns the new settings for the plugin
   */
  set(newSettings) {
    strapi.config.set(`plugin::${PLUGIN_ID}`, newSettings);
    return newSettings;
  }
});
const services = {
  generator,
  settings
};
const index = {
  register,
  bootstrap,
  config,
  services
};
export {
  index as default
};
