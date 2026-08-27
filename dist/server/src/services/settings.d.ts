import { Core } from '@strapi/strapi';
import { PlaceholderConfig, PlaceholderSettings } from '../config';
declare const settings: ({ strapi }: {
    strapi: Core.Strapi;
}) => {
    /**
     * Helper that returns the plugin settings.
     * @returns the settings of the plugin
     */
    get(): PlaceholderSettings;
    /**
     * Helper that sets the plugin settings and returns them.
     * @param newSettings the desired settings for the plugin
     * @returns the new settings for the plugin
     */
    set(newSettings: PlaceholderConfig): PlaceholderConfig;
};
export default settings;
