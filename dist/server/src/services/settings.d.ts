import { Core } from '@strapi/strapi';
export interface PluginSettings {
    size?: number;
}
declare const settings: ({ strapi }: {
    strapi: Core.Strapi;
}) => {
    /**
     * Helper that returns the plugin settings.
     * @returns the settings of the plugin
     */
    get(): PluginSettings;
    /**
     * Helper that sets the plugin settings and returns them.
     * @param newSettings the desired settings for the plugin
     * @returns the new settings for the plugin
     */
    set(newSettings: PluginSettings): PluginSettings;
};
export default settings;
