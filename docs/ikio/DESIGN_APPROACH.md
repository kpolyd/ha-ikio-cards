# Ikio design approach

Owner decisions consolidated on 25 October 2026. This guide describes how Ikio should look and behave; [SPECIFICATION.md](SPECIFICATION.md) retains the chronological implementation contract. New explicit owner decisions supersede this guide. Keep both current when a direction changes.

## Product character

Ikio is a compact Home Assistant dashboard for everyday use on phones and larger displays. Make the device's current condition clear, then make its common action easy to reach. Use quiet teal surfaces, readable readings, restrained semantic accents, thin separators and native HA icons. Group related information with alignment and spacing. Avoid decorative chrome, excessive controls and generic dashboard ornaments.

Compactness means removing repetition and prioritizing content. It does not mean shrinking every label or touch target. Preserve full values, meaningful units, keyboard access and explicit unavailable states.

## Approved reference cards

These cards are liked as they are. They are references for future work, not targets for another design pass.

| Card | Preserve | What other cards can learn |
| --- | --- | --- |
| Light | Existing layout, grouping and controls | Repeated devices need consistent rows and direct controls |
| Energy | Current-power hierarchy, compact totals/bill columns, graph, device grid and fine sparklines | Give the most important value priority; align supporting information; let charts support readings |
| Drive / Car | Header with image and centred identifiers, two compact reading/status groups, location footer | Small icons beside label/value groups, quieter labels, semantic state colour |
| Security | Status emblem, modes, collapsed sensor details, bypass consent, inline PIN and live countdown | Clear device state, progressive disclosure, direct primary action, backend-confirmed feedback |

The reference baseline is release 0.5.6 plus committed Drive refinement `7544f5e` (softer green and smaller readings), which is not released. Preserve those committed refinements too. Do not alter these cards indirectly through shared CSS, a token sweep or shared chart behaviour. A genuine defect or accessibility finding can be documented without automatically redesigning an approved card.

## Decisions learned from iteration

| Preference | Apply it this way |
| --- | --- |
| Prefer inline interaction over popups | Keep controls, PIN entry, errors and additional settings in the card. An inline disclosure is suitable for secondary details. Native HA entity details remain available on tap/hold where appropriate. |
| Avoid unnecessary clicks | A normal supported action should be direct. Show confirmation only for an existing consequential action that needs deliberate consent; keep that review inline. Do not remove existing safeguards while changing their presentation. |
| Keep dense details out of the default view | Show a count/summary and let a labelled chevron disclosure reveal the list. Keep important alerts and required consent visible while collapsed. |
| Prefer smaller, balanced icons | Use small icons alongside values, not oversized decorative icons. The Security status emblem is a purposeful exception, not a header template for every card. |
| Labels should be quieter than values | Use size, weight and spacing to establish hierarchy. Avoid multiple equally prominent readings or repeated title/state text. |
| Keep rows compact | Add information within the current reading group when it fits. Do not increase every row just to add decoration or a secondary chart. |
| Keep the palette coherent | Use the existing colours and their semantic roles. Soft mint is the preferred secure colour for Drive; Security retains its approved brighter green. |
| Use the configured HA icon | Especially for individual sensor states, preserve native `ha-state-icon` rendering and user icon overrides. Never substitute emoji. |
| Make identifiers quiet and exact | Centre plate and VIN together; retain the minimal plate outline and raw VIN value. Do not use numeric formatting for identifiers. |
| Make history honest | Shared wattage means shared colour; missing data means a gap. Sparse device power changes use held samples and steps rather than fabricated ramps. |
| Avoid adding irrelevant information | Security no longer tracks people's locations. Give each card a clear purpose instead of accumulating unrelated household information. |

These are transferable principles. Device-specific choices (PIN pad, plate layout, tariff precision) stay in their own card; do not copy them everywhere.

## Visual vocabulary

Use the existing shared tokens in [styles.js](../../packages/ikio-card-ui/src/styles.js) and the optional [HA theme](../../ikio/themes/ikio.yaml). This table is a reference, not a request to replace card-local approved exceptions.

| Role | Dark | Light |
| --- | --- | --- |
| Dashboard | `#0D171B` | `#EDF3F1` |
| Card | `#17282E` | `#F3F7F6` |
| Recessed/control surface | `#21353B` | `#E4EEEB` |
| Divider | `#34474D` | `#BDCFCA` |
| Primary text | `#E5E9E7` | `#17282E` |
| Secondary text | `#A4ADB2` | `#50645F` |
| Interaction accent | `#90CAF9` | `#245D85` |
| Soft positive/temperature mint | `#A4E4B8` | `#28613E` |
| Open/warning | `#F2C66D` | `#805900` |
| Security delay coral | `#F08072` | `#B7473B` |
| Error | `#F2A69B` | `#9A3830` |
| Humidity | `#ADCFFF` | `#36597F` |
| Power reading | `#F2D487` | `#775600` |
| Fridge reading | `#B9E6FF` | `#245F73` |

HA appearance follows the user's HA theme; verify those colours separately. Chart value gradients use the owner-approved soft mint-to-orchid palette, with deeper light-mode equivalents, shared by Electricity and Graph. Server traffic uses its mint/orchid endpoints for series identity. These chart colours are special-purpose data encodings, not general UI accents. Do not reuse the alarming/delay coral for ordinary active controls without a new decision. Pair state colour with text/icon; unknown must never look secure.

Use the HA/system font. Keep established 12 px card radii, 10 px card padding and thin dividers. Use the existing 4/6/8/10/12 px compact spacing vocabulary deliberately; larger section gaps should establish grouping rather than inflate every row. For the seven redesigned cards, start with a 16 px title, 18 px header icon, 18–24 px principal reading, 13–14 px ordinary values and 11–12 px supporting labels. The owner rejected the first spacious mock set: prefer grouped rows, inline labels and 6 px section gaps. These are project starting points, not a global stylesheet migration. Use the approved card-specific sizes where they differ.

Keep visible icon size independent of hit area: Drive's 22 px / narrow 18 px icons still sit in 44 px targets. Preserve at least 44 CSS px interaction targets as Ikio's touch-friendly convention; this is not a claim that WCAG defines a universal 44 px minimum. Prefer useful spacing between adjacent actions over shrinking their targets. Use tabular figures for changing readings and timers.

## Layout and interaction

1. State the card's purpose in a compact header: name and a useful current status. Add a real icon or image only when it helps recognition.
2. Put the primary reading or task next. Keep the common action on this first view.
3. Group supporting metrics in aligned rows or two/three columns when space allows. Reflow within the card's container, not the viewport alone.
4. Put advanced modes, maintenance, service lists or infrequent actions behind an inline disclosure. Give it a descriptive label, a chevron and programmatic expanded state.
5. Show actionable warnings, backend errors and required consent without making the user expand a settings section. Keep normal informational notes quieter and shorter than errors.
6. Preserve capability gating, direct entity details, backend scripts and selected values. Changing the design must not invent capabilities or replace backend control logic with frontend timers.

Show pending feedback near the action and wait for HA confirmation. Bound loading and offer recovery; do not show indefinite loading or hide valid readings because another part failed. Preserve field focus, PIN/slider interaction and disclosure state through ordinary updates. Stop unnecessary timers/streams while hidden or disconnected. Never turn a countdown reaching zero into proof of a device state.

Use real buttons, selects, ranges and details/summary where appropriate. Expose visible names for ambiguous settings: an accessible name alone does not help a sighted user understand several similarly styled dropdowns. Icon-only familiar transport actions can remain compact with an accessible name. Wrap long names and identifiers; do not rely on hover-only text to recover clipped essentials. A smaller font is not a substitute for reflow.

For fridge temperature, retain a distinct small cold-blue reading with a fridge-specific icon/label, approximately 20% quieter than the principal room reading as previously requested. Exact sizing belongs in the Comfort mockup; the goal is to distinguish appliance interior temperature from room temperature.

## Applying UI UX Pro Max

External reference: [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill). This review used upstream commit [`d14efff8ed1faa4187f004f79926f428c8074ec7`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/d14efff8ed1faa4187f004f79926f428c8074ec7).

Use its [skill workflow](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/d14efff8ed1faa4187f004f79926f428c8074ec7/.claude/skills/ui-ux-pro-max/SKILL.md) and [web/general quick reference](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/d14efff8ed1faa4187f004f79926f428c8074ec7/.claude/skills/ui-ux-pro-max/references/quick-reference.md) as advisory checks. Its native-mobile `pro-rules.md` requires adaptation: these are HA Web Components in a webview, not SwiftUI, Flutter, React or Tailwind components.

For an existing card, search one relevant UX concern at a time rather than regenerating a design system. Examples using a verified local checkout of the skill:

```sh
python /path/to/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py 'visible label input' --domain ux
python /path/to/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py 'loading feedback' --domain ux
python /path/to/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py 'touch target spacing' --domain ux
```

Check the actual result identity and applicability. Retry an off-topic query once; if it still misses, label the recommendation as general/project guidance. Search ranking is not proof that a rule applies. Do not import a suggested font, animation framework, chart library or palette solely because it appears in a result. Do not use its generic large page spacing or minimum body-size suggestions to enlarge approved compact cards. Preserve Ikio's semantic colours, HA icon system, local bundles and owner preferences. A third-party skill is optional reference material, not a runtime dependency or authority over repository rules.

The reference was consulted from a pinned scratch checkout for this review. It was not installed globally or vendored into Ikio. Future use can consult the links or an available verified installation; absence of the tool does not block routine work.

## Redesign workflow and acceptance

Use [DESIGN_REVIEW.md](DESIGN_REVIEW.md) to pick a card. Start with its main task and retain its configured capabilities. Show a compact mockup using simulated data before implementing a substantial new layout, following the owner's established iteration pattern. Include normal, busy and unavailable states so the mock is reviewable. Keep each redesign separate from refactoring and releases.

Verify container widths around 280, 320, 390 and 520 px plus a wider layout. Check dark/light/HA appearances, long names, large values, zoom/text enlargement, keyboard navigation, focus visibility and reduced motion. Check 4.5:1 for normal text and 3:1 for meaningful non-text indicators against their actual backgrounds; decorative separators can remain subtle. Test error/pending states and retain usable controls without hover.

Run focused card behaviour tests and normal build/HACS checks after implementation; broaden tests when shared code changes. DOM tests do not prove visual fit. Browser fixtures do not prove native HA icon, media or device behaviour. Record those verification levels separately. Do not claim a live-device result without live evidence.

The owner subsequently authorized the seven-card implementation and mocks in specification section 40. Keep the four reference cards protected. No merge or release is authorized by that implementation request; the Drive refinement and this work remain unreleased.
