declare const _default: {
    register: ({ strapi }: {
        strapi: import("@strapi/types/dist/core").Strapi;
    }) => void;
    bootstrap: ({ strapi }: {
        strapi: import("@strapi/types/dist/core").Strapi;
    }) => void;
    config: {
        default: {};
        validator(config: unknown): void;
    };
    services: {
        generator: ({ strapi }: {
            strapi: import("@strapi/types/dist/core").Strapi;
        }) => {
            generate(url: string): Promise<string>;
        };
        settings: ({ strapi }: {
            strapi: import("@strapi/types/dist/core").Strapi;
        }) => {
            get(): import("./services/settings").PluginSettings;
            set(newSettings: import("./services/settings").PluginSettings): import("./services/settings").PluginSettings;
        };
    };
};
export default _default;
