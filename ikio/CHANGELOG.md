# Ikio changelog

## 0.9.0 — Focused Climate, Chip badge and live Alarmo activity

- Stream new Alarmo activity over the existing HA connection, preserving paginated history and falling back to incremental polling if streaming is unavailable.
- Make the shared Ikio Chip available as a native dashboard badge with the same visual editor.
- Redesign Climate around one climate entity per card, a compact target-temperature semicircle, mode colours and a segmented mode selector. Add optional current/humidity/power readings, larger temperature steps, visibility toggles and select/number position bindings. Remove fridge and fixed standalone humidity/fan slots; migrate existing climate power bindings.
- **Migration:** Climate now accepts only `climate.*` devices. Existing climate/sensor bindings remain and climate power migrates automatically; old humidifier/fan-only configurations need a climate entity. The separate humidity card will be designed later.
- Record the standing requirement for generic card designs and approval of both mock and configuration before implementation.

## 0.8.1 — Centered, tighter Server Monitor chips

- Center Extra readings chips in Server Monitor, including each wrapped row.
- Reduce their padding from 5 px / 10 px to 4 px / 8 px while retaining 44 px touch targets. Standalone Chip card styling is unchanged.

## 0.8.0 — Sensor chips and compact Server Monitor

- Add Ikio Chip: a standalone sensor card with native icon, optional name, stacked name/value, shared themes and tap/hold entity details.
- Reuse that chip in Server Monitor’s Extra readings above CPU/RAM/Disk rings. Configure any number of sensor/name rows; the former DB Size binding migrates automatically and remains removable through the editor.
- Replace tall service blocks with compact tiles: two per row on mobile and three on wider cards, with concise status indicators and optional power/restart controls. Preserve native details, disabled/pending states and inline restart confirmation.
- Extend HACS delivery, manual packages and versioned previews to all twelve cards.

## 0.7.1 — Compact, incremental Alarmo activity

- Keep activity in a scrollable region showing roughly 5–6 normal entries, with natural height for shorter lists and a subtle scrollbar.
- Load older activity near the bottom in batches of 20. Search progressively older time ranges and reuse cached events instead of downloading the entire configured history upfront.
- Refresh only new time ranges, preserve the reader’s position, retain loaded history across visibility pauses, and deduplicate overlapping boundaries.
- Preserve user attribution, avatars, native icons and entity details. No configuration changes are required.

## 0.7.0 — Alarmo area groups and activity timeline

- Group Alarmo sensor alerts by Home Assistant area with compact, wrapping chips and native sensor icons. Preserve bypassed/unavailable alerts and entity details.
- Add optional always-visible sensor activity, automatically including the alarm panel and monitored sensors. Show recorded states, date/time with seconds, area, and user name/avatar when available. Configure Show activity and an optional 1–168 hour window (default 24).
- Refresh activity every minute while visible, stop requests when disabled/hidden, and show explicit empty/error states. Render at most 200 recent events.
- Define the collection version only in ikio/package.json; private workspace manifests and local dependencies no longer repeat release versions.

## 0.6.4 — Server capacity display and graph precision

- Restore compact Server Monitor RAM/disk used / total captions, deriving total from used + remaining when needed. Round these capacities and RAM/disk percentages to whole numbers without changing calculations or thresholds.
- Show at most one decimal on network min/max graph labels. Other readings retain their existing precision.

## 0.6.3 — Server storage and network extrema

- Server Monitor accepts used + remaining memory/disk sensors, with automatic utilization and visual editor support. Existing percentage and total sensors remain supported.
- Add network graph minimum/maximum labels, readable rate units and subtle dashed guides based on the visible download/upload history.

## 0.6.2 — Theme-matched chart palette

- Apply the approved softer mint-to-orchid palette to Electricity history, device/Untracked sparklines and the Graph card. Use deeper hues in light mode and follow live Home Assistant theme changes.
- Match Server Monitor traffic to the chart palette with mint download and orchid upload; retain solid/dashed series, scales and history gaps.

## 0.6.1 — Automated card previews

- Generate actual compiled-card galleries, screenshots and PR comparisons in CI. Gate releases on immutable versioned preview publication and link exact-version screenshots from the README.

## 0.6.0 — Card names and YAML migration

- Breaking: rename Light to Lights, Energy to Electricity, Drive to Vehicle, Security to Alarmo, System to Server Monitor, Comfort to Climate, Cleaning to Vacuum and Appliance to Appliances. Rename their custom element/editor IDs, workspace packages, source directories and individual bundle filenames. Media, Camera and Graph retain their identifiers.
- Update dashboard YAML types and individual resource URLs using the migration table. Existing entity bindings and card settings stay the same.

## 0.5.14 — System network history gaps

- Fix System network history losing valid intervals before unknown/unavailable readings. Preserve zero and nonzero intervals up to the exact gap boundary, including after downsampling, without filling missing data.

## 0.5.13 — Energy section separator

- Separate the main power history from individual device readings with the same thin divider, colour and compact spacing used above the distribution rings. Show it only when device readings exist; add no extra heading or empty row.

## 0.5.12 — Live Energy distribution rings

- Add optional cron-based billing cycles using Home Assistant's timezone, only for inclusive displayed period labels, with automatic reset-boundary rollover. Energy, bill and forecast values and validity rules remain sensor-driven. Existing timestamp bindings remain compatible.
- Add optional compact double rings beneath the Energy device grid: areas on the inner ring and devices in shades of their area's colour on the outer ring. Keep the existing card layout unchanged.
- Label devices directly with fine leader lines. Tap a device or area to inspect its whole watts in the centre; tap again or the centre to restore total. Preserve keyboard navigation, live selection and native details on hold.
- Reuse existing sensors and Home Assistant area assignments. Keep untracked consumption separate from smaller devices grouped into Other, conserve total power and report missing or inconsistent readings honestly.
- Enable through **Show labelled power distribution rings** in the visual editor and confirm that selected device circuits do not overlap. The graph defaults off and is normally 184 px tall, growing only to keep crowded labels readable.

## 0.5.11 — Ikio branding

- Add the approved house-and-dashboard tile logo to the repository and README displayed in GitHub and HACS details.
- Document the logo and HACS branding limitations. Ikio remains a dashboard card repository.

## 0.5.10 — System network history and status dots

- Request the initial network state and all recorded updates for the previous 30 minutes, including repeated values and attribute changes. Keep genuine missing history blank.
- Use the uptime sensor for the online indicator when no legacy availability binding exists: green for valid uptime, red for unavailable/offline, and neutral for unknown or invalid values.

## 0.5.9 — System details cleanup

- Remove the redundant Last 30 min heading above network readings, retaining the graph axis labels.
- Fix expanded System details: keep a single chevron, remove the duplicate heading and omit the extra divider for database-only details.
- Remove the Availability entity selector from the System editor, preserving existing bindings for compatibility.

## 0.5.8 — System mock fidelity and automatic setup

- Remove configurable metric thresholds. System warning/error limits are fixed at 70/85 and take precedence over old threshold configurations.

- Bring System proportions closer to the approved mock with responsive rings, a chevron footer and database details inside the collapsed section.
- Detect System availability and uptime formats automatically; remove the two interpretation settings from the editor while accepting legacy configurations.

## 0.5.7 — Compact cards and system overview

- Replace System usage bars with compact CPU/RAM/disk rings; show system temperature and adaptive uptime in the header. Replace standalone RX/TX values with a shared 30-minute Download/Upload history plot, explicit rate-unit conversion, batched bounded loading and missing-data gaps. Preserve thresholds, capacities, availability priority and native details.

- Tighten the seven redesigned cards after mock feedback: group readings/controls, reduce header and section overhead, use inline field labels, remove the oversized camera placeholder and duplicate single-series legend, and retain readable text and touch targets.

- Redesign Comfort, Media, Cleaning, Appliance, System, Camera and Graph using opt-in styles, visible settings labels, clearer hierarchy and inline disclosures. Keep Light, Energy, Drive and Security unchanged.
- Replace Appliance manual-on and System restart dialogs with inline consent; bound Camera live-view loading and ignore late requests. Add interactive mocks for all seven cards.

- Document Ikio's design approach, protected reference cards and a source-informed review of the remaining seven cards. Add advisory UI UX Pro Max guidance to the contributor workflow; no remaining-card redesign is implemented yet.
- Make Drive metric/status icons and values slightly smaller. Use the palette’s softer mint green for locked/closed status text and icons, with a matching darker green in light mode.

## 0.5.6 — Collapsible alarm sensor details

- Collapse Security sensor details by default. Tap the count/status summary to expand or collapse sensor names and HA icons; keep live alert counts, bypass consent and the PIN pad visible.

## 0.5.5 — Live alarm countdown and reliable sensor loading

- Show a live exit/entry countdown and shrinking progress ring synchronized with Alarmo. Use coral for delay indicators, preserve amber open-sensor warnings and green confirmed armed states. Keep the inline PIN pad and wait for backend state confirmation when the timer expires.
- Reduce the Security header shield to 32 px within the existing circle.
- Preserve discovered Alarmo sensors when hiding the card, restart interrupted discovery on return, and restore subscriptions without waiting for a sensor update. Time out unanswered discovery after five seconds and retry in the background instead of leaving the loading message indefinitely.

## 0.5.4 — Automatic Alarmo sensors and clearer Energy totals

- Draw device sparklines as held values with steps at recorded updates, preventing sparse history from fabricating gradual ramps. Preserve missing-data gaps.

- Discover enabled sensors from Alarmo automatically for the selected area/master, with full friendly/device names, live HA icons, configuration updates and lifecycle cleanup. Optional card sensor rows remain extras/fallback.
- Arm Home/Away in one tap when no PIN is required. The bypass checkbox supplies explicit consent without a separate confirmation screen; required PINs and exit delays remain.
- Show Alarmo rejection reasons immediately and cancel the pending timeout. Treat failed/empty sensor discovery as unknown, never a green all-clear.
- Reduce Drive metric/status icons further to 24 px, or 20 px on narrow cards.
- Right-align estimated bill/forecast labels and values. Display Day/Night/Total energy to one decimal with a small kWh suffix on each value, retaining full calculation precision.

## 0.5.3 — Finer graphs and smaller vehicle details

- Reduce device and Untracked sparkline strokes from 1 px to 0.8 px, retaining the main graph line, shared colour thresholds and automatic vertical scaling.
- Reduce Drive metric/status icons to 28 px, or 22 px on narrow cards.
- Show only the VIN value at 11 px, retaining its accessible label and native sensor details.
- Reduce plate text by 1 px and tighten the outline/padding while keeping the plate and VIN centred. The existing Plate country code editor setting supports GR, another code or an empty country section.

## 0.5.2 — Consistent device sparkline colours

- Use the main Energy graph's configured colour thresholds and full palette for device and Untracked sparklines, so the same wattage has the same colour in every graph.
- Retain automatic vertical scaling per device to keep small variations visible, independently of colour thresholds.
- Thin sparkline strokes to 1 px, retaining row height, missing-data gaps and the main graph's existing line width.

## 0.5.1 — Car image entities and refined vehicle details

- Add a visual-editor car-image entity selector. Use the entity picture or URL state and follow picture/token changes automatically, with clear unavailable status and no camera streaming.
- Match the approved Drive mockup with larger icons beside smaller labels, retaining full values, native details and narrow-card layouts.
- Style the smaller license plate with a neutral outline and country divider, with no coloured band or fill. Centre it with the VIN underneath; expose an optional country code, defaulting to GR.
- Preserve uploaded/static image alternatives and rebuild the synchronized HACS bundle.

## 0.5.0 — Device history, Alarmo controls and vehicle images

- Add compact device power sparklines, including Untracked, with automatic observed min/max scaling and green-to-red colours. Batch device history with the main graph and preserve gaps and unit conversion.
- Redesign Security with an Alarmo-style mode selector, a larger shield and prominent armed colours. Move compact sensor labels with native HA icons above the modes.
- Keep the PIN pad inside the card and visible while armed, including bypassed, triggered and entry/exit-delay states. Use inline arming review and code entry without action popups.
- Add an unchecked-by-default Alarmo bypass checkbox only when open sensors are present. Preserve required codes and exit delay, display confirmed bypass status, and clear transient codes/selections after use and lifecycle changes.
- Remove Security presence rows and their editor section; existing configuration is accepted but those rows are no longer displayed.
- Match Drive secure-state colours to Security. Add an optional image upload/local URL and compact license-plate text and VIN sensor rows between the title and image. Preserve exact VIN text and native sensor details.
- Rebuild the synchronized HACS bundle and keep asset-free release delivery.

## 0.4.0 — Compact mobile controls

- Compact Drive into two rows with icons for range/fuel/odometer and locks/doors/windows.
- Add state-based secure/alert/error/unknown colours and native sensor details on status tap/hold.
- Move parking into the header and preserve a plain maps link beside location age.

- Reorganize Energy into a left-focused current-power reading, stacked Day/Night/Total column and quieter estimated/forecast bill column.
- Show whole watts without rounding calculations or history; add faint dashed min/mid/max graph guides and aligned labels.
- Place Untracked alongside device readings; calculated Untracked is read-only rather than an action button.

- Add an optional Lights visual-editor toggle to group by location, packing compatible consecutive areas into three-light rows.
- Use 44 px light buttons, clear area headings/dividers, live counts and an Unassigned group without repeated location labels.
- Keep native details on hold, stable controls during state updates and visible unavailable statuses.

## 0.3.2 — HACS download compatibility

- Serve the tracked, verified collection bundle from raw tagged repository content to avoid oversized GitHub release-redirect headers in HACS 2.0.5.
- Publish releases without attached assets so HACS falls back to repository files; retain full ZIPs in CI artifacts.
- Verify that the tracked HACS bundle/notices exactly match a fresh build before publishing. No changes to card configuration or functionality.

## 0.3.1 — HACS support

- Add HACS custom Dashboard repository support with a single self-contained bundle containing all eleven cards and editors.
- Publish validated GitHub releases with the HACS asset, reproducible ZIP and dependency notices.
- Preserve manual installation and existing Ikio card configuration; document migration to HACS-managed resources.

## 0.3.0 — public repository migration

- Rename Aethora to Ikio across all eleven cards, shared packages, theme, editors, bundles and documentation.
- Import the full collection into ha-ikio-cards with fresh history, generic examples and no 3D card or household bindings.
- Keep the compact layouts, energy graph refinements, automatic lock states and editor typing fix from 0.2.3.
- Breaking namespace change: migrate saved `custom:aethora-*-card` types to `custom:ikio-*-card` and use the Ikio resource URL.

## 0.2.3 — in development

- Fix interrupted typing in visual editors across all eleven cards, including Energy device names.
- Preserve focused fields when Home Assistant echoes configuration changes; continue applying external edits and list operations.

## 0.2.2 — in development

- Fix car lock indicators for HA binary lock sensors, including configurations saved with the previous locked/unlocked default.
- Automatically combine native locks and binary lock sensors; retain explicit inverted-binary mapping.
- Distinguish genuine unavailable/unknown/transitional/jammed states without changing door/window indicators.

## 0.2.1 — in development

- Make compact spacing the default throughout the collection: smaller padding, 4 px section gaps, 44 px reading targets and 24 px main values.
- Keep slider labels inline and combine related media, appliance, camera and location controls into rows without hiding readings.
- Use a plain Open location in maps link beside parking details.
- Reduce idle camera placeholder space and keep full native live-view sizing.
- Keep narrow-screen control rows usable rather than stacking every control.

## 0.2.0 — in development

- Replace light brightness bars and percentages with Home Assistant entity/device area labels; keep tap-to-toggle and native details on hold.
- Add optional location labels in the lights visual editor and refresh areas when registry metadata changes.
- Compact Home Energy header/totals while retaining 44 px interactive targets.
- Replace the energy graph footer with readable min/max vertical-axis labels from the displayed history window. Standalone Graph retains its footer.
- Version imported card resources so a new collection resource URL also refreshes its entry modules.

## 0.1.0 — in development

- Shared compact UI and native Home Assistant editor compatibility.
- Light Studio with mixed switches/lights, inline brightness, native details on hold.

- Implement the remaining ten cards: Graph, Energy, Comfort, Appliance, Media, Cleaning, Security, Camera, System and Drive.
- Add shared stable controls, native-style schema editors and optional matching HA dark/light theme.
- Add value-based graph gradients, billing-cycle totals, clickable circuit readings, Alarmo override confirmation and car status summaries.
