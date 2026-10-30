# Ikio Chip

Follow the root guide. Use the shared sensor chip renderer and opt-in styles; Server Monitor reuses them. Preserve sensor icons, name/value formatting, theme selection and native entity details on tap/hold. Keep exactly one chip with no added title or outer card surface.

The standalone card and badge opt into the approved compact surface (28 px without a name, 34 px with a stacked name). Show name defaults off and belongs only in configuration. Icon override uses the native HA icon picker and falls back to the entity icon when cleared. Preserve the transparent 44 px hit target and keep Server Monitor's existing chip geometry unchanged.
