# Phoenix Date & Document Export Plugins Architecture

**Status:** Canonical architecture contract

## 1. Plugin inventory

| ID | Responsibility | Depends on |
|---|---|---|
| `plugin.calendar.gregorian` | Gregorian / میلادی calendar operations | DateTime, Locale, Timezone |
| `plugin.calendar.persian` | Persian Solar Hijri / شمسی operations | DateTime, Locale, Timezone |
| `plugin.calendar.islamic` | Islamic Hijri lunar / قمری operations | DateTime, Locale, Timezone |
| `plugin.document.export` | Fetch authorized data through Query capabilities, compose and format a canonical document | Query capabilities, i18n, calendar, Media |
| `plugin.document.pdf` | Render canonical Export Document as PDF | `plugin.document.export` |
| `plugin.document.print` | Render canonical Export Document for printing | `plugin.document.export` |

## 2. Non-negotiable ownership

1. Each plugin has one responsibility and one owner.
2. Plugins consume public capabilities; they never access another module's repositories or tables directly.
3. Calendar plugins provide representation/conversion only. They do not own Booking, Schedule, or Appointment data.
4. `Export Document` is the single canonical document composition capability.
5. PDF and Print are output adapters. They must not duplicate database querying, table construction, header/footer composition, localization, or calendar logic.
6. D1 remains the source of truth. Export data is an authorized snapshot, not a second source of truth.

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
Explicit document/report calendar
        ↓
Business/workspace preference
        ↓
User preference
        ↓
Locale default
```

Every exported date is reproducible from: UTC instant + calendar system/version + timezone + locale + format version.

## 5. Export Document plugin

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

## 6. PDF plugin

**ID:** `plugin.document.pdf`

Dependency chain:

```text
PDF → Export Document
```

Canonical capability: `CAP.DOCUMENT.PDF.RENDER@1`.

It consumes `ExportDocument` plus a PDF render profile and returns a PDF `DocumentArtifact`.

It owns only PDF rendering concerns: pagination, fonts/assets, page breaks, PDF metadata, tables, headers/footers, images, and RTL/LTR rendering.

It must not query domain tables, rebuild document content, calculate domain totals, implement calendar conversion, or maintain a separate translation/header/footer system.

## 7. Print plugin

**ID:** `plugin.document.print`

Dependency chain:

```text
Print → Export Document
```

Canonical capability: `CAP.DOCUMENT.PRINT.RENDER@1`.

It consumes `ExportDocument` plus a Print render profile and returns a print-ready representation/artifact.

It owns only print concerns: print CSS/layout or equivalent renderer behavior, page breaks, margins, headers/footers, tables, and RTL/LTR handling.

It must not query domain tables, rebuild document content, calculate domain totals, or implement calendar/localization rules.

## 8. Canonical capability surface

| Capability | Owner | Type |
|---|---|---|
| `CAP.CALENDAR.GREGORIAN@1` | Gregorian | QUERY |
| `CAP.CALENDAR.PERSIAN@1` | Persian | QUERY |
| `CAP.CALENDAR.ISLAMIC@1` | Islamic | QUERY |
| `CAP.DOCUMENT.EXPORT@1` | Export Document | ORCHESTRATION |
| `CAP.DOCUMENT.PDF.RENDER@1` | PDF | OUTPUT |
| `CAP.DOCUMENT.PRINT.RENDER@1` | Print | OUTPUT |

PDF and Print are downstream consumers of `CAP.DOCUMENT.EXPORT`; neither is an alternate export engine.

## 9. Templates and localization

Templates are versioned and owned by Document Export. A template contains document type, field mappings, layout/table rules, localization keys, header/footer configuration, branding slots, and compatibility metadata. Templates never contain repository/database access.

The existing i18n registry is reused. Persian and Arabic default to RTL; English defaults to LTR. Calendar and locale remain independent settings. No plugin may contain a duplicate translation dictionary.

## 10. Security, audit and reproducibility

Export inherits source capability authorization and tenant isolation. Sensitive fields require explicit export permission. Durable exports record actor, organization/workspace, source capability, resource scope, locale, calendar, timezone, template/version, output format, creation time, and artifact reference. Historical financial documents use immutable transaction snapshots.

Export failures must distinguish authorization/tenant denial, source-data failure, template incompatibility, invalid locale/calendar, rendering failure, artifact-storage failure, and resource limits.

## 11. Anti-duplication gate

Before adding behavior: reuse an existing capability; extend it when the semantic responsibility is the same; create a new capability only for genuinely new responsibility. Never add direct database access to PDF/Print, duplicate header/footer logic, duplicate calendar arithmetic, or duplicate i18n dictionaries.

This document is architecture-only. Runtime adapters, manifests, renderer libraries, artifact storage and migrations are implementation work for later stages.
