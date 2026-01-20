import { z } from 'zod';

const configSchema = z.object({
  size: z.number().min(4).max(64).optional(),
}).strict();

export default {
  default: {},
  validator(config: unknown) {
    configSchema.parse(config);
  },
};
