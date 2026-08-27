declare const services: {
    generator: ({ strapi }: {
        strapi: import('@strapi/types/dist/core').Strapi;
    }) => {
        generate(url: string): Promise<string | null>;
    };
    settings: ({ strapi }: {
        strapi: import('@strapi/types/dist/core').Strapi;
    }) => {
        get(): import('./settings').PluginSettings;
        set(newSettings: import('./settings').PluginSettings): import('./settings').PluginSettings;
    };
};
export type PluginServices = {
    [key in keyof typeof services]: ReturnType<(typeof services)[key]>;
};
export default services;
