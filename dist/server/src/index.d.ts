declare const _default: {
    register: ({ strapi }: {
        strapi: import('@strapi/types/dist/core').Strapi;
    }) => void;
    bootstrap: ({ strapi }: {
        strapi: import('@strapi/types/dist/core').Strapi;
    }) => void;
    config: {
        default: {
            size: number;
            format: "webp";
            quality: number;
            removeAlpha: false;
        };
        validator(config: unknown): void;
    };
    services: {
        generator: ({ strapi }: {
            strapi: import('@strapi/types/dist/core').Strapi;
        }) => {
            generate(url: string): Promise<string | null>;
        };
        settings: ({ strapi }: {
            strapi: import('@strapi/types/dist/core').Strapi;
        }) => {
            get(): import('./config').PlaceholderSettings;
            set(newSettings: import('./config').PlaceholderConfig): import('./config').PlaceholderConfig;
        };
    };
};
export default _default;
