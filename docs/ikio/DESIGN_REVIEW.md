# Current design review and redesign plan

Reviewed 25 October 2026 against the working tree after Drive commit `7544f5e`. Reference: [Ikio design approach](DESIGN_APPROACH.md) and the pinned UI UX Pro Max workflow linked there.

This is a source-informed UX review, not a new screenshot/browser audit or a live Home Assistant test. Findings below identify code-observable structure and behaviour; proposed layouts are design judgments. This review was followed by the owner-authorized implementation in specification section 40; the original observations below describe the pre-redesign state.

## Overall assessment

The shared foundation is sound: local bundles, restrained dark/light tokens, native controls, feature gating, touch-sized actions, state reconciliation and explicit missing-data handling. Energy, Light, Drive and Security provide an approved direction and should remain unchanged.

The remaining cards mostly use the original `group`/`row`/`reading` helpers directly. As a result, the code gives many controls equal visual prominence and can make a device task resemble a list of configuration fields. The best next step is card-specific hierarchy and grouping, preserving behaviour, rather than replacing the design system or making every card look like the alarm panel.

## Protected reference designs

| Card | Status | Review boundary |
| --- | --- | --- |
| Light | Keep as is | Preserve controls, grouping and repeated rows |
| Energy | Keep as is | Preserve summary hierarchy, graph, precision and device sparklines |
| Drive / Car | Keep as is, including unreleased committed refinement | Preserve image/identifiers, smaller readings and softer secure green |
| Security | Keep as is | Preserve inline keypad, coral countdown, direct arming and collapsed sensors |

Do not fix consistency by changing these references to match the older cards. Scope subsequent shared-component work so the references retain their appearance and interactions.

## Cross-card findings

| Priority | Evidence | Finding | Recommended treatment |
| --- | --- | --- | --- |
| High | Appliance `render()` calls `this.dialog` for configured manual-on confirmation; System restart calls `action(..., true)` which uses the shared dialog | Existing popups conflict with the owner's preferred inline flow | Replace their presentation with a compact inline review; preserve deliberate confirmation and cancellation for these existing consequential actions |
| High | Shared `select()` renders its label as `.sr`; Comfort collects select/button children into one trailing settings row | Multiple settings can lack a visible explanation and clear grouping | Give ambiguous settings visible labels and group advanced settings by task; do not change the helper globally without regression checks on approved cards |
| Medium | Comfort treats fridge as a normal secondary `reading()` | Fridge temperature is not sufficiently distinguished from room measurements | Small cold-blue fridge-labelled/icon reading, quieter than the main room value |
| Medium | Media, Cleaning and Appliance use a single row for primary and secondary controls | Actions have similar weight despite different frequency and importance | Give one frequent action a clear place; keep secondary controls compact and put infrequent settings behind a disclosure |
| Medium | System appends each metric, progress bar, capacity note and service block sequentially | Host health competes with service management and long metric lists | Stable CPU/RAM/disk rows, small supporting host readings, separate expandable service section |
| Medium | Camera renders a placeholder or player, controls, automation state and capture timestamp separately | The main live-view task and secondary automation settings could be grouped more clearly | Keep explicit on-demand live view; make automation a quiet details section and place capture status with snapshot action |
| Medium | Graph uses numbered readings for the legend; the shared plot already supports solid/dashed patterns | Legend-to-line association could be clearer without altering chart mathematics | Compact legend entries with matching line samples, exact names, values and units |
| Verify during mocks | Shared row gaps are often 4–6 px and labels are 11–12 px | Small text and dense adjacent actions need device-width/zoom verification | Keep 44 px interaction areas; verify local spacing/readability in browser, rather than automatically enlarging every approved card |

Source references: [shared controls](../../packages/ikio-card-ui/src/controls.js), [shared styles](../../packages/ikio-card-ui/src/styles.js), and the per-card files linked below.

## Redesign directions (subsequently implemented)

The order below prioritizes hierarchy and interaction improvements. Preserve every configured capability; proposed disclosures change presentation, not what the device supports.

### 1. Comfort — clear room reading and active device control

Source: [Comfort card](../../cards/ikio-climate-card/src/card.js), especially `render()`, `target()` and the final settings collection.

**Current:** room temperature is a hero reading; humidity and fridge join the same readings row. Device selection is a row of buttons. HVAC targets, modes and settings then appear as ranges/selects before select/button children are collected into another row. Feature guards and dual setpoint limits already exist.

**Proposed first view:** compact header → room temperature and humidity with a smaller distinct fridge reading → active-device selector only when multiple devices exist → current action and the selected device's principal target/control → quiet power reading when configured. Place fan mode, preset, swing and direction in an inline Settings section with visible field names.

Keep current temperature distinct from target temperature; do not represent a target as a measured value. Preserve climate/humidifier/fan semantics, heat/cool dual targets, min/max/step, units, feature support, current selections and unavailable-device messaging. Keep valid room readings visible if the actuator is unavailable. Avoid a large decorative thermostat dial that increases the card substantially.

**Mock checks:** climate single/dual targets, fan-only, humidifier-only, multiple devices, fridge configured, unsupported features and unavailable actuator.

### 2. Media — prioritize what is playing and playback

Source: [Media card](../../cards/ikio-media-card/src/card.js).

**Current:** 48 px artwork and joined title/artist text form one row. Playback time/seek, transport/power, volume/mute, source, power consumption, backlight and each shortcut are appended in sequence.

**Proposed first view:** small artwork beside a clearly ranked title and quieter artist/source → one compact transport row centred on play/pause → thin seek line with elapsed/total time → volume and mute together. Keep source visible when routinely used; expose extra shortcuts/backlight under More controls when they would crowd the common task. Make power-off visually secondary to play/pause without removing it.

Do not invent artwork, seeking, volume or transport support. Retain the capability flags and no-artwork/off fallback. Prevent live position ticks from replacing a focused seek/volume control. Reserve artwork space and keep media titles readable with real long text.

**Mock checks:** playing, paused, off, missing artwork, long title, non-seekable source, unavailable player and optional controls.

### 3. Cleaning — state and one obvious action

Source: [Cleaning card](../../cards/ikio-vacuum-card/src/card.js), and its existing state-to-primary-action adapter.

**Current:** header combines state/battery; primary action, dock and suction share a row; maintenance/missions already use a native details disclosure. Error/status lines are separate.

**Proposed first view:** recognisable vacuum icon with state and quiet battery → current primary action with dock as a secondary action → small visibly labelled suction control. Retain the existing maintenance/mission disclosure, but make its summary more informative when data permits. Keep an actual error visible outside the disclosure.

Do not add a map, cleaning progress, duration or room coverage without a real configured source. Preserve start/pause/resume/stop state logic, return-to-dock relevance, capabilities, configured mission scripts and maintenance values. Battery must not imply operational readiness.

**Mock checks:** docked, cleaning, paused, returning, unavailable, error, missing battery and long mission names.

### 4. Appliance — distinguish timed runs from manual operation

Source: [Appliance card](../../cards/ikio-appliances-card/src/card.js).

**Current:** power/energy readings are grouped; each configured timed run contributes a start action and optional timer reading; manual on/off and stop share an action row. Configured manual-on confirmation uses a popup. A general backend-schedule note is always shown when timed runs exist.

**Proposed first view:** appliance name/state → aligned power and energy → timed-run choices grouped by purpose → active backend timer with stop action. Keep manual control visibly distinct from timed choices. Replace the existing manual-on dialog with an inline warning/Confirm/Cancel area when confirmation is configured. Put a short backend-schedule explanation next to the relevant controls instead of giving it equal weight to live status.

Do not silently replace one-tap timed scripts with a mandatory select-then-start flow; that would add a click. Do not fabricate timer progress when only remaining time is known. Preserve `confirm_manual_on`, backend scripts and the fact that manual off need not cancel a scheduled backend action. This card does not implement safety automation in the browser.

**Mock checks:** idle, timed run active, manual on, paused/unknown timer, multiple runs, confirmation open and unavailable switch.

### 5. System — resource summary before service management

Source: [System card](../../cards/ikio-server-monitor-card/src/card.js).

**Current:** temperature/uptime are grouped, then CPU/RAM/disk each append a reading and progress bar. Capacity and percentage can share a long string. Database/network readings, threshold notes and service groups follow. Restart confirmation uses the shared popup.

**Proposed first view:** host name with explicit availability → three aligned CPU/RAM/disk rows with a numeric value and thin utilization bar → quieter temperature/uptime and RX/TX readings → expandable Services section with per-service health and restrained controls. Show threshold exceptions in the main view. Use inline review for a configured restart action, retaining cancellation and explicit consent.

Keep compatible-unit conversion, capacity values, out-of-range warnings and user-configured thresholds. Do not invent red/amber utilization limits or classify an unavailable service as healthy. Do not color all ordinary readings green. Keep database units and network rates intact; no cumulative-to-rate inference.

**Mock checks:** online, offline/unknown, incomplete RAM/disk sources, out-of-range readings, threshold warning, multiple services and restart review.

### 6. Camera — on-demand viewing with a quiet control strip

Source: [Camera card](../../cards/ikio-camera-card/src/card.js).

**Current:** explicit on-demand native player with a text placeholder, live/open/close controls, optional camera power, snapshot action/automation and capture time. Hiding/disconnect stops the live view.

**Proposed first view:** name/state → compact idle preview surface with an obvious live-view action → native live player after request → small action strip for stop/snapshot/power → capture age and a separate expandable automation section. A still preview is optional future functionality only if a real supported source can be reused without starting a stream; otherwise keep an honest placeholder.

Preserve on-demand streaming, lifecycle cleanup, snapshot provenance and separate power entity. Clearly distinguish powered off, unavailable and loading. Do not autoplay streams to make a mock attractive, add continuous polling for snapshots or invent a last-captured time.

**Mock checks:** idle, live, loading failure, powered off, unavailable, capture time missing and snapshot controls absent.

### 7. Graph — polish legend and reading hierarchy

Source: [Graph card](../../cards/ikio-graph-card/src/card.js), [shared plot/history](../../packages/ikio-graph/src/index.js).

**Current:** title, hero value for a single series, shared history plot and optional numbered legend readings. The shared renderer already uses solid/dashed patterns, preserves gaps and rejects incompatible units for a shared graph.

**Proposed first view:** retain the single-series hero and plot; for several series, use compact matching line samples beside each name/current value. Keep the time window and units easy to read. Avoid turning the legend into large controls or adding chart settings to the default view.

Retain the value-colour model, line-pattern differentiation, history batching, unit checks, missing-data gaps, and existing graph semantics. Multiple series already have non-colour differentiation; the opportunity is making the legend correspondence explicit. Scope any shared renderer additions behind a Graph-only option so Energy remains unchanged. Mixed-unit refusal is existing behaviour to preserve, not a new feature to add.

**Mock checks:** one/multiple series, same names, long labels, missing/constant data, unit mismatch and narrow container.

## Reference queries and applicability

Read the upstream skill and general/web quick reference, then ran its pinned local Python search with these focused inputs:

| Query | Domain | Verified fit |
| --- | --- | --- |
| `touch target spacing` | UX | Relevant Touch Spacing/Touch Target Size/Text Reflow results; preserve Ikio's 44 CSS px targets and verify spacing in actual web layouts |
| `visible label input` | UX | Input Labels directly supports visibly naming ambiguous Comfort/Media settings |
| `text contrast` | UX | Contrast Readability and Color Contrast support measuring actual token pairs |
| `loading feedback` | UX | Loading Indicators and Loading States support stable, contextual feedback without a blanket timing rule |
| `progressive disclosure controls`, retried as `progressive disclosure` | UX | Off-topic results; no verified search match. Disclosure recommendations come from the skill's general content-priority guidance and the owner's approved Security interaction |
| `mixed units series`, retried as `multiple series units` | Chart | No verified mixed-unit rule. Existing source enforces unit compatibility. The returned Line Chart guidance is relevant only for named/line-style series differentiation |

No generated palette, font pairing or framework recommendation was applied. Search scores were not treated as design evidence.

## Checks performed and remaining verification

Inspected all seven remaining card renderers and relevant shared controls/history code; checked approved reference tokens and prior specification decisions. Computed the following opaque foreground/card-background contrast ratios using sRGB relative luminance:

| Foreground role | Dark on `#17282E` | Light on `#F3F7F6` |
| --- | --- | --- |
| Primary text | 12.43:1 | 14.10:1 |
| Secondary text | 6.67:1 | 5.84:1 |
| Soft mint | 10.42:1 | 6.78:1 |
| Warning amber | 9.48:1 | 5.81:1 |
| Delay coral | 5.83:1 | 4.89:1 |

These sampled pairs exceed 4.5:1 for normal text. This is not a complete accessibility certification: opacity, selected/control backgrounds, graphs, native HA rendering and user-provided HA themes need separate checks. No current browser screenshots, screen-reader testing or live device testing were performed for this documentation review. Earlier tests and historical gallery checks do not prove future mockups fit.

Next concrete design step: Comfort mockups using simulated state, followed by Media. Use the same review/approve/implement sequence for the remaining proposals, keeping the four reference cards protected. No version bump, merge or release accompanies this review.


## Implementation follow-up

Section 40 implements these directions across all seven cards. The opt-in refinement helper leaves approved cards untouched. Rebuild the simulated, self-contained gallery with `node scripts/build-redesign-preview.mjs`; the source fixtures cover normal, busy and unavailable states and dark/light appearances. Focused behaviour tests and full workspace checks are recorded with this work. Browser download failed in this environment, so the new layouts have DOM/fixture validation but no fresh browser geometry or native-HA verification. The gallery uses the actual implementation code, not generated screenshots. Changes remain unreleased.


## Compactness follow-up

The owner rejected the first implementation gallery as too spacious. Section 41 revises the seven opt-in layouts around shared rows, inline field labels, smaller headers, less decoration and fewer repeated readings. Existing capabilities, readable values, touch targets and disclosure access remain. This supersedes the spacious first mock, not the four approved reference cards. Browser layout verification remains pending.
