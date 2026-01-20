import type { Core } from '@strapi/strapi';
import { PLUGIN_ID } from '../pluginId';

export interface PluginSettings {
  size?: number;
}

const settings = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Helper that returns the plugin settings.
   * @returns the settings of the plugin
   */
  get(): PluginSettings {
    return strapi.config.get(`plugin::${PLUGIN_ID}`) as PluginSettings;
  },

  /**
   * Helper that sets the plugin settings and returns them.
   * @param newSettings the desired settings for the plugin
   * @returns the new settings for the plugin
   */
  set(newSettings: PluginSettings): PluginSettings {
    strapi.config.set(`plugin::${PLUGIN_ID}`, newSettings);
    return newSettings;
  },
});

export default settings;
