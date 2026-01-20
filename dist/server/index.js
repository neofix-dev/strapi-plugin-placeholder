"use strict";
const mimeTypes = require("mime-types");
const zod = require("zod");
const plaiceholder = require("plaiceholder");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const mimeTypes__default = /* @__PURE__ */ _interopDefault(mimeTypes);
const PLUGIN_ID = "placeholder";
const canGeneratePlaceholder = (file) => {
  let mime = file.mime;
  if (!mime && file.name) {
    const lookedUpMime = mimeTypes__default.default.lookup(file.name);
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
    const placeholderService = strapi.plugin(PLUGIN_ID).service("placeholder");
    data.placeholder = await placeholderService.generate(data.url);
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
  uploadPlugin.contentTypes.file.attributes.placeholder = {
    type: "text"
  };
};
const configSchema = zod.z.object({
  size: zod.z.number().min(4).max(64).optional()
}).strict();
const config = {
  default: {},
  validator(config2) {
    configSchema.parse(config2);
  }
};
const placeholder = ({ strapi }) => ({
  /**
   * Generates a base64 placeholder image for the given image.
   * @param url a local or remote image URL to generate a placeholder for
   * @returns a base64 encoded placeholder image
   */
  async generate(url) {
    try {
      const settingsService = strapi.plugin(PLUGIN_ID).service("settings");
      const settings2 = settingsService.get();
      const { base64 } = await plaiceholder.getPlaiceholder(url, settings2);
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
  placeholder,
  settings
};
const index = {
  register,
  bootstrap,
  config,
  services
};
module.exports = index;
//# sourceMappingURL=index.js.map
