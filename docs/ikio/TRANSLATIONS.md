# Contributing a language

Ikio follows `hass.locale.language`, then `hass.language`. Regional locales such as `el-GR` use their base language when no regional catalog exists. Missing messages or unsupported languages fall back to English. Without HA context, including the demo galleries, English is the default. There is no language setting to maintain on each card.

## Add a language

1. Copy `packages/ikio-card-ui/src/translations/en.json` to `<language>.json` in the same directory. Use a Home Assistant language code, for example `de` or `pt-BR` (register the latter as `pt-br`).
2. Translate the **values**, retaining the keys and every `{placeholder}` exactly. Most message IDs are their English source text, as in gettext; a contextual ID such as `activity.motion_clear` distinguishes meanings that share an English word. Values are plain text, never HTML.
3. Import the new JSON file in `packages/ikio-card-ui/src/translations/index.js` using the same import syntax as the existing files and add it to `catalogs`. No card files need changing.
4. Run `npm ci`, `npm run check:translations`, `npm test` and `npm run build`. Test long labels in a narrow dashboard and open the visual editors before submitting a pull request.

Example entry:

```json
{
  "Device settings": "Ρυθμίσεις συσκευής",
  "License plate: {p0}": "Πινακίδα κυκλοφορίας: {p0}",
  "{count} sensors bypassed": {
    "one": "{count} αισθητήρας σε παράκαμψη",
    "other": "{count} αισθητήρες σε παράκαμψη"
  }
}
```

Plural objects use `Intl.PluralRules` categories (`zero`, `one`, `two`, `few`, `many`, `other`). Keep `one` and `other`, and add any additional categories your language needs. All forms retain the same placeholders. English is the master catalog; the checker rejects missing/unknown messages, empty values, mismatched placeholders and unregistered literal messages. These checks also run in the shared package's tests and therefore in CI.

## Add a UI message as a developer

Import `t` from `@ikio/card-ui/i18n` (also re-exported by `@ikio/card-ui`) and call it at the presentation boundary:

```js
button(t(this.hass, "Restart {p0}", { p0: configuredName }), restart);
```

Add the entry to every registered catalog. For counts pass a `count` parameter. Translate complete sentences rather than joining translated fragments; the numbered placeholders in existing sentences may be reordered freely.

Keep configuration keys, service names/data, entity IDs, units, CSS classes and state-machine comparisons unchanged. Translate fallback UI labels, never the user's configured names, entity/area/person names or arbitrary integration options/messages. Use HA's formatters for native state text where available. Catalogs are bundled locally; changing language makes no translation network requests. Language updates should preserve ordinary card state and should not send device commands.

For previews, both `dev/previews/fixtures/collection.js` and `dev/previews/redesign.js` explicitly select English. Test another language by supplying the desired HA locale to the fixture cards; do not change the default screenshots to the contributor's browser language.
