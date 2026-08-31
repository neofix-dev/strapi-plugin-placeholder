# Strapi Placeholder Generator

Generate tiny base64 placeholders for [Strapi](https://strapi.io/) images, ready to be
passed to the `blurDataURL` prop of `next/image`.

A placeholder is produced once, when a file is uploaded, and stored on the file record
itself — so it travels with the file wherever it is read from, whether that is the Strapi
GraphQL API directly or a downstream service.

Internal to NeoFix — this package is not published to npm. It is a fork of the
[upstream plugin](https://github.com/WalkingPizza/strapi-plugin-placeholder), which was
last released in May 2023 for Strapi v4.

## 🖌️ Supported Content

Any image sharp can decode, which covers JPEG, PNG, WebP, AVIF, TIFF, GIF and SVG —
vectors are rasterised through librsvg, so a blurred placeholder can sit behind an SVG
hero background. A file sharp cannot decode is left without a placeholder and the reason
is logged.

## ✨ Supported Strapi Versions

Strapi v5.

## ⚙️ Installation

The plugin is consumed straight from this repository, pinned to a tag. Add it to the
`dependencies` of the CMS that needs it:

```json
"strapi-plugin-placeholder": "neofix-dev/strapi-plugin-placeholder#v5.1.0"
```

### Releasing A Change

`dist/` is committed and there is no `prepare` script, so nothing is built at install
time — the tag is installed exactly as it was committed.

1. Change the sources under `server/src/`.
2. `yarn build`, then commit `dist/` **in the same commit**. Skipping this ships the
   previous build under a new tag, silently and without an error.
3. Tag the commit and push it.
4. Point each CMS at the new tag and reinstall.

A branch works in place of a tag while testing, but package managers pin the resolved
commit in their lockfile: after pushing another commit to the branch, `pnpm install`
reports everything as up to date and keeps the previous build. Use
`pnpm update strapi-plugin-placeholder` instead.

## 🔧 Configuration

### Enable The Plugin

Open or create the file `config/plugins.ts` and enable the plugin:

```ts
export default {
  // ...
  placeholder: {
    enabled: true,
    config: {
      size: 16,
      format: 'webp',
      quality: 20,
    },
  },
};
```

| Option        | Default  | Description                                            |
| ------------- | -------- | ------------------------------------------------------ |
| `size`        | `16`     | Longest edge of the placeholder in pixels, `4`–`64`    |
| `format`      | `'webp'` | Output format: `'webp'`, `'jpeg'`, `'png'` or `'avif'` |
| `quality`     | `20`     | Encoder quality, `1`–`100`                             |
| `removeAlpha` | `false`  | Drop the alpha channel before encoding                 |

`format` matters more than `size`: at placeholder dimensions a PNG spends almost
everything on headers, so the same image is roughly 10 KB as a 64px PNG, 840 bytes as a
16px PNG and 95 bytes as a 16px WebP.

### Regeneration

The placeholder is generated when a file is created and whenever its URL changes.
Metadata-only edits — renaming a file, editing its alternative text, moving it between
folders — leave it untouched, so they no longer re-download the image from the upload
provider. A file that has no placeholder yet does get one when it is next touched.

Updates that address more than one file are skipped entirely. The data of an update is
applied to every row its where clause matches, so a bulk folder move would otherwise
stamp one file's placeholder onto the whole selection.

An image the generator cannot read stores the empty string rather than null. Consumers
tend to expose the column through a non-nullable field, where a null is a hard error
instead of a missing blur, and an empty placeholder is still falsy — so the file is
attempted again the next time it is touched.

### Generate Placeholders For Existing Images

Changing `size`, `format` or `quality` does not rewrite the placeholders already stored,
and neither does upgrading the plugin. To bring an existing media library over, add a
one-off, env-gated module to the host project and set `BACKFILL_PLACEHOLDERS=true`.

`src/backfill-placeholders.ts`:

```ts
import type { Core } from '@strapi/strapi';

const BATCH_SIZE = 100;

// Waited before each retry. Spread over seconds rather than milliseconds: a failure
// here is usually the upload provider rate-limiting a long run of sequential requests,
// and that does not clear within a few hundred milliseconds. A run that retried three
// times inside two seconds still lost four perfectly healthy images to it.
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

export const backfillPlaceholders = async ({ strapi }: { strapi: Core.Strapi }) => {
  if (process.env.BACKFILL_PLACEHOLDERS !== 'true') return;

  // Nothing awaits this function, so an escaping error would surface as an unhandled
  // rejection and take the whole process down with it. A failed backfill must never
  // cost more than the backfill.
  try {
    const generator = strapi.plugin('placeholder').service('generator');
    // Resume point for a run that was interrupted: the id logged with the last
    // completed batch, passed back in as BACKFILL_FROM_ID.
    let cursor = Number(process.env.BACKFILL_FROM_ID ?? 0);
    let processed = 0;
    let failed = 0;

    strapi.log.info(`[backfill] starting from id ${cursor}`);

    for (;;) {
      // Every image is regenerated, so the selection is not narrowed by the current
      // value of the column. That keeps each row on its old placeholder right up to
      // the moment it is replaced — clearing the column up front would instead leave
      // every row empty for the length of the run.
      //
      // The id cursor is what ends the loop. It advances regardless of what is
      // written, so termination never depends on the outcome of a single file.
      const files = await strapi.db.query('plugin::upload.file').findMany({
        select: ['id', 'url'],
        where: { id: { $gt: cursor }, mime: { $startsWith: 'image/' } },
        orderBy: { id: 'asc' },
        limit: BATCH_SIZE,
      });

      if (files.length === 0) break;

      for (const file of files) {
        let placeholder = await generator.generate(file.url);

        for (const delay of RETRY_DELAYS_MS) {
          if (placeholder !== null) break;

          await new Promise((resolve) => setTimeout(resolve, delay));
          placeholder = await generator.generate(file.url);
        }

        if (placeholder === null) {
          failed += 1;
          // Named at info rather than error on purpose — see the note on levelFilter
          // below. A bare failure count with nothing to explain it is not much use.
          strapi.log.info(`[backfill] gave up on ${file.id} ${file.url}`);
        }

        // Written through knex rather than `strapi.db.query().update()`. That path
        // fires this plugin's own beforeUpdate hook, which would download the image a
        // second time and overwrite what is written here.
        await strapi.db
          .connection('files')
          .where({ id: file.id })
          .update({ placeholder: placeholder ?? '' });
      }

      cursor = files[files.length - 1].id;
      processed += files.length;
      strapi.log.info(`[backfill] ${processed} processed, ${failed} failed, last id ${cursor}`);
    }

    strapi.log.info(`[backfill] done: ${processed} processed, ${failed} failed`);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    strapi.log.info(`[backfill] aborted: ${reason}`);
  }
};
```

`src/index.ts`:

```ts
import { backfillPlaceholders } from './backfill-placeholders';

export default {
  register() {},

  bootstrap({ strapi }) {
    // Deliberately not awaited. Bootstrap runs before Strapi starts listening, and the
    // backfill takes minutes: awaiting it would leave the health endpoint unanswered
    // long enough for an orchestrator to call the container dead and restart it, over
    // and over, never getting further than the first few files. Left unawaited, Strapi
    // serves normally while the backfill works through the library behind it.
    void backfillPlaceholders({ strapi });
  },
};
```

Set the variable, deploy, wait for the `done` line, then unset it and deploy again.
While it is set the run repeats on every restart, which wastes bandwidth rather than
corrupting anything. Delete both files once every environment has been migrated.

The pass is idempotent, and running it twice is worth doing: it regenerates every row
rather than only the ones missing a placeholder, so a second run costs nothing but time
and repairs whatever the first lost to a transient failure.

Afterwards, the spread of what was written is worth a look. Anything left as the empty
string is a file the generator could not read — most often a row whose URL no longer
resolves at the upload provider:

```sql
SELECT CASE WHEN placeholder = '' THEN 'failed'
            WHEN placeholder IS NULL THEN 'never attempted'
            ELSE 'generated' END AS kind,
       count(*) AS files,
       round(avg(length(placeholder))) AS avg_chars,
       pg_size_pretty(sum(length(placeholder))::bigint) AS total
FROM files
WHERE mime LIKE 'image/%'
GROUP BY 1;
```

Note that Strapi's own logger config can hide the reason a file failed. `@strapi/logger`'s
`formats.levelFilter` is an exact-match allowlist and not a severity threshold, so a
host project combining it with a single `info` level discards every `error` record —
including the `[placeholder] Could not generate a placeholder for …` line that explains
each failure. That is why the loop above names its own failures at info level.
