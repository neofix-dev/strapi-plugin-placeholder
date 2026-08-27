# Strapi Placeholder Generator

Generate base64 placeholders for [Strapi](https://strapi.io/) images.

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

### Generate Placeholders For Existing Images

Create the file `database/migrations/generate-placeholders-for-existing-images.js` with the following content:

```js
'use strict';

const FILES_TABLE = 'files';
const BATCH_SIZE = 1000;

async function up(trx) {
  let lastId = 0;

  while (true) {
    const files = await trx
      .select(['id', 'url'])
      .from(FILES_TABLE)
      .whereNot('url', null)
      .andWhereLike('mime', 'image/%')
      .andWhere('placeholder', null)
      .andWhere('id', '>', lastId)
      .orderBy('id', 'asc')
      .limit(BATCH_SIZE);

    for (const file of files) {
      const placeholder = await strapi
        .plugin('placeholder')
        .service('placeholder')
        .generate(file.url);

      if (placeholder)
        await trx.update('placeholder', placeholder).from(FILES_TABLE).where('id', file.id);
    }

    if (files.length < BATCH_SIZE) {
      break;
    }

    lastId = files[files.length - 1].id;
  }
}

async function down() {}

module.exports = { up, down };
```
