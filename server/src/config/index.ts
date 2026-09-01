import { z } from 'zod';

const configSchema = z
  .object({
    size: z.number().min(4).max(64).optional(),
    removeAlpha: z.boolean().optional(),
  })
  .strict();

export default {
  default: { size: 10 },
  validator(config: unknown) {
    configSchema.parse(config);
  },
};
