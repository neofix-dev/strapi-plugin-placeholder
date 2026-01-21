import mimeTypes from "mime-types";
import { z } from "zod";
import { getPlaiceholder } from "plaiceholder";
const PLUGIN_ID = "placeholder";
const getService = (strapi, serviceName) => {
  return strapi.plugin(PLUGIN_ID).service(serviceName);
};
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
const bootstrap = ({ strapi }) => {
  const generatePlaceholder = async (event) => {
    const { data, where } = event.params;
    if (!data) return;
    if (!data.url || !data.mime) {
      const documentId = where?.documentId || where?.id;
      if (documentId) {
        const file = await strapi.documents("plugin::upload.file").findOne({
          documentId
        });
        if (file) {
          data.url = data.url ?? file.url;
          data.mime = data.mime ?? file.mime;
        }
      }
    }
    if (!canGeneratePlaceholder(data)) return;
    const generatorService = getService(strapi, "generator");
    data.placeholder = await generatorService.generate(data.url);
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
const configSchema = z.object({
  size: z.number().min(4).max(64).optional()
}).strict();
const config = {
  default: {},
  validator(config2) {
    configSchema.parse(config2);
  }
};
const generator = ({ strapi }) => ({
  /**
   * Generates a base64 placeholder image for the given image.
   * @param url a local or remote image URL to generate a placeholder for
   * @returns a base64 encoded placeholder image
   */
  async generate(url) {
    try {
      const settings2 = getService(strapi, "settings").get();
      const { base64 } = await getPlaiceholder(url, settings2);
      return base64;
    } catch (e) {
      strapi.log.error(e);
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
