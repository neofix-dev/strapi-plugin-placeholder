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

### Generate Placeholders For Existing Images

Changing `size`, `format` or `quality` does not rewrite the placeholders already stored.
To backfill the media library, add a one-off, env-gated step to the host project's
`src/index.ts` and start Strapi once with `BACKFILL_PLACEHOLDERS=true`:

```ts
const BATCH_SIZE = 100;

export default {
  register() {},

  async bootstrap({ strapi }) {
    if (process.env.BACKFILL_PLACEHOLDERS !== 'true') return;

    const generator = strapi.plugin('placeholder').service('generator');
    let processed = 0;

    for (;;) {
      const files = await strapi.db.query('plugin::upload.file').findMany({
        select: ['id', 'url'],
        where: { mime: { $startsWith: 'image/' }, placeholder: { $null: true } },
        orderBy: { id: 'asc' },
        limit: BATCH_SIZE,
      });

      if (files.length === 0) break;

      for (const file of files) {
        const placeholder = await generator.generate(file.url);

        // Store an empty string rather than null for files that cannot be processed,
        // otherwise the query above keeps returning them and the loop never ends.
        await strapi.db.query('plugin::upload.file').update({
          where: { id: file.id },
          data: { placeholder: placeholder ?? '' },
        });
      }

      processed += files.length;
      strapi.log.info(`[placeholder] backfilled ${processed} files`);
    }
  },
};
```

To regenerate everything after a config change, clear the column first:

```sql
UPDATE files SET placeholder = NULL WHERE mime LIKE 'image/%';
```

Remove the block once the backfill has run.
