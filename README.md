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

Changing `size`, `format` or `quality` does not rewrite the placeholders already stored.
To backfill the media library, add a one-off, env-gated step to the host project's
`src/index.ts` and start Strapi once with `BACKFILL_PLACEHOLDERS=true`:

```ts
const BATCH_SIZE = 100;
const ATTEMPTS = 3;

export default {
  register() {},

  async bootstrap({ strapi }) {
    if (process.env.BACKFILL_PLACEHOLDERS !== 'true') return;

    const generator = strapi.plugin('placeholder').service('generator');
    let cursor = 0;
    let processed = 0;
    let failed = 0;

    for (;;) {
      // Paginated by an id cursor rather than by re-running the `placeholder IS NULL`
      // query. The cursor guarantees the loop moves forward whatever ends up written,
      // so termination never depends on the value stored for a file that fails.
      const files = await strapi.db.query('plugin::upload.file').findMany({
        select: ['id', 'url'],
        where: {
          id: { $gt: cursor },
          mime: { $startsWith: 'image/' },
          placeholder: { $null: true },
        },
        orderBy: { id: 'asc' },
        limit: BATCH_SIZE,
      });

      if (files.length === 0) break;

      for (const file of files) {
        let placeholder = null;

        // A placeholder is one download away from the upload provider, so a failure is
        // as likely to be a blip as it is to be an unusable file. Retrying separates the
        // two: what still fails after several attempts is treated as permanent.
        for (let attempt = 1; attempt <= ATTEMPTS && placeholder === null; attempt += 1) {
          if (attempt > 1) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }

          placeholder = await generator.generate(file.url);
        }

        if (placeholder === null) failed += 1;

        // Written through knex rather than `strapi.db.query().update()`. That path fires
        // the plugin's own beforeUpdate hook, which finds the stored placeholder still
        // empty, downloads the image a second time and overwrites what is written here —
        // doubling the traffic, and undoing the record of a file that cannot be decoded.
        await strapi.db
          .connection('files')
          .where({ id: file.id })
          .update({ placeholder: placeholder ?? '' });
      }

      cursor = files[files.length - 1].id;
      processed += files.length;
      strapi.log.info(`[placeholder] ${processed} processed, ${failed} failed`);
    }

    strapi.log.info(`[placeholder] done: ${processed} processed, ${failed} failed`);
  },
};
```

Remove the block once the backfill has run.

To regenerate everything after a config change, clear the column first — a file that
already has a placeholder is skipped, so reinstalling the plugin on its own changes
nothing for existing rows:

```sql
UPDATE files SET placeholder = NULL WHERE mime LIKE 'image/%';
```

Afterwards, the spread of what was written is worth a look. Anything left as the empty
string is a file the generator could not read — most often a row whose URL no longer
resolves at the upload provider:

```sql
SELECT CASE WHEN placeholder = '' THEN 'failed' ELSE 'generated' END AS kind,
       count(*) AS files,
       round(avg(length(placeholder))) AS avg_chars,
       pg_size_pretty(sum(length(placeholder))::bigint) AS total
FROM files
WHERE mime LIKE 'image/%'
GROUP BY 1;
```

Note that Strapi's own logger config can hide the reason. `@strapi/logger`'s
`formats.levelFilter` is an exact-match allowlist and not a severity threshold, so a
host project combining it with a single `info` level discards every `error` record —
including the `[placeholder] Could not generate a placeholder for …` line that explains
each failure.
