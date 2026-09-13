# Phoenix Date, Time & Document Plugins Architecture

**Status:** Canonical architecture contract  
**Scope:** Calendar, date-picker, precise-clock, document export, PDF, and print plugins.

## 1. Plugin inventory

| ID | Responsibility | Depends on |
|---|---|---|
| `plugin.calendar.gregorian` | Gregorian / میلادی calendar operations | DateTime, Locale, Timezone |
| `plugin.calendar.persian` | Persian Solar Hijri / شمسی operations | DateTime, Locale, Timezone |
| `plugin.calendar.islamic` | Islamic Hijri lunar / قمری operations | DateTime, Locale, Timezone |
| `plugin.date-picker` | Unified interactive date selection using the selected calendar | Calendar capabilities, i18n, Locale, Timezone |
| `plugin.precise-clock` | Accurate live time display and timezone-aware clock state | UTC time source, Timezone, Locale |
| `plugin.document.export` | Fetch authorized data through Query capabilities, compose and format a canonical document | Query capabilities, i18n, calendar, Media |
| `plugin.document.pdf` | Render canonical Export Document as PDF | `plugin.document.export` |
| `plugin.document.print` | Render canonical Export Document for printing | `plugin.document.export` |

## 2. Non-negotiable ownership

1. Each plugin has one responsibility and one owner.
2. Plugins consume public capabilities; they never access another module's repositories or tables directly.
3. Calendar plugins provide representation/conversion only. They do not own Booking, Schedule, or Appointment data.
4. `Date Picker` is the canonical interactive date-selection component; screens must not implement separate calendar-selection logic.
5. `Precise Clock` is the canonical live-clock capability; screens must not create competing time-sync implementations.
6. `Export Document` is the single canonical document composition capability.
7. PDF and Print are output adapters. They must not duplicate database querying, table construction, header/footer composition, localization, or calendar logic.
8. D1 remains the source of truth. Export data is an authorized snapshot, not a second source of truth.

## 3. Calendar plugin contract

All three calendar plugins implement the same versioned semantic contract:

- `toCalendar(instant, timezone)`
- `fromCalendar(date, timezone)`
- `format(instant, pattern, locale, timezone)`
- `parse(value, pattern, locale, timezone)`
- `getYear/getMonth/getDay/getWeekday`
- `getMonthName/getWeekdayName`
- `startOfDay/endOfDay`
- `startOfMonth/endOfMonth`
- `daysInMonth`

Canonical timestamps remain UTC. Calendar conversion changes representation, never the underlying instant.

### Gregorian

`plugin.calendar.gregorian` is the canonical Gregorian adapter. It owns Gregorian conversion, parsing, formatting, month/weekday names through i18n, and timezone-aware boundaries.

### Persian

`plugin.calendar.persian` is the canonical Persian Solar Hijri adapter. It owns Persian conversion, arithmetic, parsing, formatting, month/weekday names through i18n, and timezone-aware boundaries. It must not store a second authoritative Persian timestamp.

### Islamic

`plugin.calendar.islamic` is the canonical Islamic Hijri lunar adapter. Its calendar convention/version must be explicit whenever more than one calculation convention is possible, so historical reports remain reproducible.

## 4. Calendar selection

Calendar selection is independent from UI language:

```text
Explicit document/report/date-picker calendar
        ↓
Business/workspace preference
        ↓
User preference
        ↓
Locale default
```

Every exported or persisted date is reproducible from: UTC instant + calendar system/version + timezone + locale + format version.

## 5. Date Picker plugin

**ID:** `plugin.date-picker`  
**Role:** Unified interactive date/date-range selection adapter.

The Date Picker does not implement calendar arithmetic. It delegates all calendar operations to the selected calendar plugin.

### Responsibilities

- single-date selection;
- date-range selection;
- optional month/year selection;
- calendar switching when permitted;
- localized month/weekday names;
- RTL/LTR layout;
- min/max date constraints;
- disabled-date rules supplied by the owning domain capability;
- timezone-aware date boundaries;
- conversion of selected calendar values into canonical UTC/date values;
- accessibility and keyboard navigation;
- consistent validation/error states.

### Contract

```text
DatePickerRequest
├── calendar
├── locale
├── timezone
├── mode: single | range
├── value?
├── min?
├── max?
├── disabledDates?
└── displayProfile?
```

Output:

```text
DatePickerValue
├── calendarValue
├── calendarSystem
├── timezone
├── startInstant?
└── endInstant?
```

The picker returns canonical date/time values in addition to display values so callers do not need to reverse-engineer UI strings.

### Boundary rule

A date selected by a user is interpreted in the selected timezone. The calendar plugin converts the calendar value; the Date Picker does not create its own date-conversion algorithm.

For business rules such as booking availability, the Date Picker may consume a capability such as `CAP.BOOKING.CHECK_AVAILABILITY`; it must not query Booking tables directly.

### Anti-duplication

No page, form, Booking screen, report filter, or admin screen may implement another calendar picker with separate calendar arithmetic. They configure and reuse `plugin.date-picker`.

## 6. Precise Clock plugin

**ID:** `plugin.precise-clock`  
**Role:** Canonical accurate live-clock display and time-state provider.

The plugin is responsible for displaying the current time accurately for a requested timezone. It is not a business scheduler and does not own persisted appointments or schedules.

### Responsibilities

- obtain a trusted current-time baseline;
- display live time with seconds when requested;
- maintain timezone-aware clock state;
- apply locale-specific time formatting;
- support 12-hour and 24-hour profiles;
- support Gregorian/Persian/Hijri date display when requested by consuming calendar capabilities;
- handle clock drift using a trusted synchronization strategy;
- expose a stable current-instant value to consumers;
- support SSR/client hydration without visible time-state corruption;
- expose accuracy/status metadata when required.

### Canonical contract

```text
ClockRequest
├── timezone
├── locale
├── timeFormat: 12h | 24h
├── showSeconds
├── calendar?
└── syncProfile?
```

```text
ClockState
├── currentInstantUTC
├── localDateTime
├── timezone
├── locale
├── calendar?
├── synchronizedAt
└── accuracy/status
```

### Accuracy rules

- UTC/current instant remains canonical.
- The plugin must not depend on the browser's clock alone for high-accuracy displays when a trusted server/platform time source is available.
- Synchronization must correct drift without causing unstable visual jumps.
- Business operations such as Booking confirmation, Payment timestamps, Audit events, and transaction ordering use server-side canonical time, not the displayed clock.
- The displayed clock is informational unless a separate domain capability explicitly consumes a canonical server timestamp.

### Anti-duplication

No module should implement its own live-clock synchronization, timezone clock calculation, or localized clock formatter. It consumes `plugin.precise-clock` and, for calendarized dates, the canonical calendar plugins.

## 7. Export Document plugin

**ID:** `plugin.document.export`

This is the canonical document export engine. It receives an authorized request, obtains data through public Query capabilities, creates an immutable export snapshot, and composes the final format-neutral document model.

### Responsibilities

- retrieve data through canonical capabilities;
- enforce tenant and authorization boundaries;
- resolve locale, timezone and calendar;
- select a versioned template;
- build sections and tables;
- format dates, numbers and currency;
- add branding;
- add header and footer;
- add totals and summaries;
- include authorized attachments;
- record provenance/template version;
- validate the resulting document;
- support bounded/paginated processing for large exports;
- apply idempotency for durable artifact creation.

### Canonical pipeline

```text
Export Request
 → Authorization/Tenant validation
 → Locale/Timezone/Calendar resolution
 → Template resolution
 → Canonical Query capabilities
 → Immutable export snapshot
 → Document model
 → Tables + layout
 → Header + Footer + branding
 → Localization/date/number formatting
 → Validation
 → ExportDocument
```

### Document model

```text
ExportDocument
├── metadata
├── locale
├── timezone
├── calendar
├── template/version
├── branding
├── header
├── sections[]
│   ├── title
│   ├── blocks[]
│   └── tables[]
│       ├── columns[]
│       └── rows[]
├── footer
├── attachments[]
└── provenance/integrity
```

Header/footer belong exclusively to `Export Document`. They may contain logo, business name, title, report period, generated-at time, page-number placeholders, confidentiality labels, contact/legal text, and localized labels.

## 8. PDF plugin

**ID:** `plugin.document.pdf`

Dependency chain:

```text
PDF → Export Document
```

Canonical capability: `CAP.DOCUMENT.PDF.RENDER@1`.

It consumes `ExportDocument` plus a PDF render profile and returns a PDF `DocumentArtifact`.

It owns only PDF rendering concerns: pagination, fonts/assets, page breaks, PDF metadata, tables, headers/footers, images, and RTL/LTR rendering.

It must not query domain tables, rebuild document content, calculate domain totals, implement calendar conversion, or maintain a separate translation/header/footer system.

## 9. Print plugin

**ID:** `plugin.document.print`

Dependency chain:

```text
Print → Export Document
```

Canonical capability: `CAP.DOCUMENT.PRINT.RENDER@1`.

It consumes `ExportDocument` plus a Print render profile and returns a print-ready representation/artifact.

It owns only print concerns: print CSS/layout or equivalent renderer behavior, page breaks, margins, headers/footers, tables, and RTL/LTR handling.

It must not query domain tables, rebuild document content, calculate domain totals, or implement calendar/localization rules.

## 10. Canonical capability surface

| Capability | Owner | Type |
|---|---|---|
| `CAP.CALENDAR.GREGORIAN@1` | Gregorian | QUERY |
| `CAP.CALENDAR.PERSIAN@1` | Persian | QUERY |
| `CAP.CALENDAR.ISLAMIC@1` | Islamic | QUERY |
| `CAP.DATE_PICKER.SELECT@1` | Date Picker | UI/INTERACTION |
| `CAP.PRECISE_CLOCK.NOW@1` | Precise Clock | QUERY |
| `CAP.DOCUMENT.EXPORT@1` | Export Document | ORCHESTRATION |
| `CAP.DOCUMENT.PDF.RENDER@1` | PDF | OUTPUT |
| `CAP.DOCUMENT.PRINT.RENDER@1` | Print | OUTPUT |

PDF and Print are downstream consumers of `CAP.DOCUMENT.EXPORT`; neither is an alternate export engine.

## 11. Plugin dependency graph

```text
                         ┌─────────────────────┐
                         │ Gregorian Calendar  │
                         └──────────┬──────────┘
                                    │
┌─────────────────┐      ┌──────────▼──────────┐      ┌─────────────────┐
│ Persian Calendar│─────▶│     Date Picker     │◀─────│ Islamic Calendar│
└─────────────────┘      └─────────────────────┘      └─────────────────┘
          │                         │
          └────────────┬────────────┘
                       ▼
              ┌────────────────┐
              │ Precise Clock  │
              └────────────────┘

Domain Query Capabilities
           │
           ▼
    ┌─────────────────┐
    │ Export Document │
    └───────┬─────────┘
        ┌───┴───┐
        ▼       ▼
       PDF     Print
```

The dependency direction is always toward public capabilities. UI components, reports, PDF, and Print do not become alternate owners of date/time or document behavior.

## 12. Templates and localization

Templates are versioned and owned by Document Export. A template contains document type, field mappings, layout/table rules, localization keys, header/footer configuration, branding slots, and compatibility metadata. Templates never contain repository/database access.

The existing i18n registry is reused. Persian and Arabic default to RTL; English defaults to LTR. Calendar and locale remain independent settings. No plugin may contain a duplicate translation dictionary.

## 13. Security, audit and reproducibility

Export inherits source capability authorization and tenant isolation. Sensitive fields require explicit export permission. Durable exports record actor, organization/workspace, source capability, resource scope, locale, calendar, timezone, template/version, output format, creation time, and artifact reference. Historical financial documents use immutable transaction snapshots.

Date Picker constraints that depend on domain state must be resolved through the owning capability. The Precise Clock must never be treated as authoritative for transaction timestamps. Server-side timestamps remain authoritative for audit, payment, booking, and state transitions.

## 14. Anti-duplication gate

Before adding behavior: reuse an existing capability; extend it when the semantic responsibility is the same; create a new capability only for genuinely new responsibility.

Never:

- add direct database access to Date Picker, Clock, PDF, or Print;
- duplicate header/footer logic;
- duplicate calendar arithmetic;
- duplicate i18n dictionaries;
- implement a second live-clock synchronization engine;
- implement a second date-picker/calendar engine inside a screen;
- use displayed/localized date strings as canonical persisted values.

This document is architecture-only. Runtime adapters, manifests, renderer libraries, artifact storage and migrations are implementation work for later stages.
