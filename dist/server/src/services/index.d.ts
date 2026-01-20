declare const _default: {
    placeholder: ({ strapi }: {
        strapi: import("@strapi/types/dist/core").Strapi;
    }) => {
        generate(url: string): Promise<string>;
    };
    settings: ({ strapi }: {
        strapi: import("@strapi/types/dist/core").Strapi;
    }) => {
        get(): import("./settings").PluginSettings;
        set(newSettings: import("./settings").PluginSettings): import("./settings").PluginSettings;
    };
};
export default _default;
