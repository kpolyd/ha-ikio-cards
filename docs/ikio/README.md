# Ikio design and implementation

[SPECIFICATION.md](SPECIFICATION.md) records the design contract; later sections override earlier proposals. Editable SVGs in `design/` illustrate compact layouts. The current interactive gallery is `dev/previews/collection.html`.

All eleven cards and two internal packages share one version, one collection changelog and `ikio-vX.Y.Z` release names. Every card has a visual editor. The optional global Home Assistant theme is independent of the card appearance setting.

See [installation](INSTALLATION.md), [migration](MIGRATION.md) and [implementation status](STATUS.md).

For future UI work, start with the [design approach](DESIGN_APPROACH.md) and [current design review and redesign priorities](DESIGN_REVIEW.md). Light, Energy, Drive and Security are the approved reference designs. The seven remaining cards now have an unreleased implementation and simulated mocks; see specification section 40. Build their standalone preview with `node scripts/build-redesign-preview.mjs`.
