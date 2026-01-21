import generator from './generator';
import settings from './settings';

const services = {
  generator,
  settings,
};

export type PluginServices = {
  [key in keyof typeof services]: ReturnType<(typeof services)[key]>;
};

export default services;
