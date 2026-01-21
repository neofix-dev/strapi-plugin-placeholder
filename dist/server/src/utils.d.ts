import type { Core } from '@strapi/strapi';
import type { PluginServices } from './services';
/**
 * Helper that retrieves one of the available services of this plugin from Strapi.
 * @param strapi the Strapi instance
 * @param serviceName the name of the service to retrieve
 * @returns the typed service
 */
export declare const getService: <ServiceName extends "generator" | "settings">(strapi: Core.Strapi, serviceName: ServiceName) => PluginServices[ServiceName];
