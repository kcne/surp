# Localization surface inventory

Every place the product puts words in front of a person, and the issue that
owns translating it. Epic: [#65](https://github.com/kcne/surp/issues/65).

This file is the checklist the epic closes against. A surface that is not
listed here has no owner, so add a row before translating it.

## How to read this

- **Namespace** — the catalog under `i18n/messages/<locale>/` the surface's
  strings belong in. Namespaces are product domains, not pages, so a page can
  be restructured without moving its strings.
- **Owner** — the child issue that translates the surface. The foundation
  ([#66](https://github.com/kcne/surp/issues/66)) ships the registry, the
  loader, the helpers, and this inventory; it translates nothing.
- Strings a user typed — passenger names, notes, station names, an agency's
  own storefront copy — are never translated. They are called out where the
  distinction is easy to get wrong.

### Owning issues

| Issue | Scope |
| --- | --- |
| [#67](https://github.com/kcne/surp/issues/67) | URL-based routing, homepage language detection |
| [#68](https://github.com/kcne/surp/issues/68) | Language controls, preserving navigation state |
| [#69](https://github.com/kcne/surp/issues/69) | API errors and maintenance results mapped to client messages |
| [#70](https://github.com/kcne/surp/issues/70) | Reservations, passengers, schedules, imports |
| [#71](https://github.com/kcne/surp/issues/71) | Auth, dashboard, settings, super-admin |
| [#72](https://github.com/kcne/surp/issues/72) | Storefront chrome |
| [#73](https://github.com/kcne/surp/issues/73) | Marketing, blog, legal content |
| [#74](https://github.com/kcne/surp/issues/74) | Bilingual metadata, sitemap, Markdown routes |
| [#75](https://github.com/kcne/surp/issues/75) | Excel, PDF, printable passenger lists |
| [#76](https://github.com/kcne/surp/issues/76) | Lead emails |
| [#77](https://github.com/kcne/surp/issues/77) | CI checks, bilingual browser tests, launch checks |

---

## 1. Application shell

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Root layout, `<html lang>`, OG locale | `app/layout.tsx` | — | #66 (done), #74 for per-locale metadata |
| Dashboard shell, sidebar navigation | `app/(dashboard)/layout.tsx`, `components/layout/Layout.tsx`, `components/layout/Sidebar.tsx` | `dashboard` | #71 |
| Header, account menu, sign-out toast | `components/layout/Header.tsx` | `dashboard` | #71 |
| Super-admin shell and shared blocks | `components/superadmin/SuperadminShell.tsx`, `components/superadmin/SuperadminShared.tsx`, `app/superadmin/layout.tsx` | `superAdmin` | #71 |
| Language switcher | new component | `common` | #68 |

## 2. Shared UI primitives

Translated once and reused everywhere, so they land with #71 and every other
translation issue consumes them.

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Table pagination, rows-per-page, page counters | `components/ui/data-table-pagination.tsx`, `components/ui/data-table.tsx` | `common` | #71 |
| Breadcrumb separator and "more" labels | `components/ui/breadcrumb.tsx` | `common` | #71 |
| Command palette empty state | `components/ui/command.tsx` | `common` | #71 |
| Generic delete confirmation | `components/ui/confirm-delete-dialog.tsx` | `common` | #71 |
| Calendar month and weekday labels | `components/ui/calendar.tsx` | `common` | #71 |
| Form field error rendering | `components/ui/form.tsx` | `common` | #71 |
| Modal shell titles and buttons | `components/forms/FormModalShell.tsx` | `common` | #71 |
| Toast host | `components/ui/toaster.tsx`, `hooks/use-toast.ts` | `common` | #71 |

## 3. Auth

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Login page, form labels, submit states | `app/(auth)/login/page.tsx` | `auth` | #71 |
| Login validation messages (zod) | `app/(auth)/login/page.tsx` | `auth` | #71 |
| Login failure toasts | `app/(auth)/login/page.tsx` | `errors` | #69, #71 |
| Sandbox demo entry and redirect | `app/(auth)/sandbox-demo/page.tsx`, `components/auth/sandbox-demo-redirect.tsx` | `auth` | #71 |

## 4. Dashboard and settings

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Dashboard overview | `app/(dashboard)/dashboard/page.tsx` | `dashboard` | #71 |
| Analytics page, chart axis and legend labels | `app/(dashboard)/analytics/page.tsx`, `hooks/useDashboardAnalyticsPage.ts` | `dashboard` | #71 |
| Agency user management, forms, table columns | `app/(dashboard)/agency-management/page.tsx`, `components/agency-management/*` | `dashboard` | #71 |
| Agency user delete and password-reset dialogs | `components/agency-management/DeleteAgencyUserDialog.tsx`, `components/agency-management/ResetAgencyUserPasswordModal.tsx` | `dashboard` | #71 |
| Agency user toasts | `hooks/useAgencyUsersManagement.ts` | `dashboard`, `errors` | #69, #71 |
| Settings page | `app/(dashboard)/settings/page.tsx` | `dashboard` | #71 |
| Data integrity summary, history, violations | `app/(dashboard)/settings/data-integrity/page.tsx`, `app/(dashboard)/settings/data-integrity/[key]/page.tsx`, `components/settings/*` | `dashboard` | #71 |
| Invariant names, descriptions, severities | `components/settings/invariant-status.tsx`, `components/settings/InvariantSummaryTable.tsx` | `dashboard` | #69, #71 |
| Breaking-change confirmation dialog | `components/data-integrity/ConfirmBreakingChangeDialog.tsx` | `dashboard` | #69, #71 |
| Storefront editor (the agency edits its own public page here) | `app/(dashboard)/storefront/page.tsx`, `app/(dashboard)/storefront/actions.ts` | `dashboard` | #71 |

Agency-authored storefront content edited on that page stays exactly as the
agency wrote it; only the editor's own labels are translated.

## 5. Schedules: stations, lines, rides

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Stations list, table columns, filters | `app/(dashboard)/stations/page.tsx`, `components/stations/StationsDataTable.tsx`, `components/stations/StationsTableColumns.tsx` | `schedules` | #70 |
| Station create/edit modal and validation | `components/stations/StationModal.tsx` | `schedules` | #70 |
| Station delete dialog | `components/stations/DeleteStationDialog.tsx` | `schedules` | #70 |
| Lines list and table columns | `app/(dashboard)/lines/page.tsx`, `components/lines/LinesDataTable.tsx`, `components/lines/LinesTableColumns.tsx` | `schedules` | #70 |
| Line modal, route builder, intermediate stops | `components/lines/LineModal.tsx`, `components/lines/LineRoute.tsx`, `components/lines/IntermediateStationsList.tsx` | `schedules` | #70 |
| Line delete and reverse dialogs | `components/lines/DeleteLineDialog.tsx`, `components/lines/ReverseLineDialog.tsx` | `schedules` | #70 |
| Schedule page, ride instances view | `app/(dashboard)/schedule/page.tsx`, `components/rides/RideInstancesView.tsx` | `schedules` | #70 |
| Ride modal, recurrence, days of week, exceptions | `components/rides/RideModal.tsx` | `schedules` | #70 |
| Rides table columns, delete dialog | `components/rides/RidesDataTable.tsx`, `components/rides/RidesTableColumns.tsx`, `components/rides/DeleteRideDialog.tsx` | `schedules` | #70 |
| Station, line, and ride validation messages | `utils/validators.ts` | `schedules` | #70 |
| Ride instance and seat helpers' user-facing labels | `utils/rideInstanceHelpers.ts`, `utils/seatHelpers.ts` | `schedules` | #70 |

## 6. Reservations and tickets

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Reservations dashboard, rides list, calendar | `app/(dashboard)/reservations/page.tsx`, `components/reservations/RidesListPanel.tsx`, `components/reservations/CalendarView.tsx`, `hooks/useReservationsDashboardPage.ts` | `reservations` | #70 |
| Ride instance seat map page | `app/(dashboard)/reservations/[rideInstanceId]/page.tsx`, `components/reservations/SeatMap.tsx`, `hooks/useRideInstanceSeatMapPage.ts` | `reservations` | #70 |
| Ride cards, summaries, occupancy, status badges | `components/reservations/RideInstanceCard.tsx`, `components/reservations/RideInstanceSummaryCard.tsx`, `components/reservations/primitives/*` | `reservations` | #70 |
| Reservation modal and all its sections | `components/reservations/ReservationModal.tsx`, `components/reservations/Reservation*Section.tsx`, `components/reservations/ReservationFormActions.tsx` | `reservations` | #70 |
| Return-ticket section and matching messages | `components/reservations/ReservationReturnTicketSection.tsx`, `utils/reservationReturnHelpers.ts`, `utils/reservationReturnMatching.ts`, `hooks/useReservationReturnSync.ts` | `reservations` | #70 |
| Passenger search within a reservation | `components/reservations/PassengerSearch.tsx` | `reservations` | #70 |
| Selected-seat bar and card | `components/reservations/SelectedSeatsBar.tsx`, `components/reservations/SelectedSeatsCard.tsx` | `reservations` | #70 |
| Cancel, bulk-cancel, delete dialogs | `components/reservations/CancelReservationDialog.tsx`, `components/reservations/BulkReservationCancelDialog.tsx`, `components/reservations/DeleteReservationDialog.tsx` | `reservations` | #70 |
| Ride instance info dialog | `components/reservations/RideInstanceInfoDialog.tsx` | `reservations` | #70 |
| Reservation submission toasts and conflict messages | `hooks/useReservationSubmission.ts`, `hooks/useReservationModalState.ts` | `reservations`, `errors` | #69, #70 |
| Tickets page | `app/(dashboard)/tickets/page.tsx`, `hooks/useTicketsPage.ts` | `reservations` | #70 |

## 7. Passengers

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Passengers list and table columns | `app/(dashboard)/passengers/page.tsx`, `components/passengers/PassengersDataTable.tsx`, `components/passengers/PassengersTableColumns.tsx` | `passengers` | #70 |
| Passenger form and modal | `components/passengers/PassengerForm.tsx`, `components/passengers/PassengerModal.tsx` | `passengers` | #70 |
| Duplicate and delete dialogs | `components/passengers/DuplicatePassengerDialog.tsx`, `components/passengers/DeletePassengerDialog.tsx`, `hooks/useDuplicatePassengerCheck.ts` | `passengers` | #70 |

## 8. Imports

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Import page and dropzone | `app/(dashboard)/reservations/import/page.tsx`, `components/reservations/import/ImportDropzone.tsx`, `hooks/useReservationsImportPage.ts` | `reservations` | #70 |
| Import rows table, row cells, summary bar | `components/reservations/import/ImportRowsTable.tsx`, `components/reservations/import/ImportRowCells.tsx`, `components/reservations/import/ImportSummaryBar.tsx` | `reservations` | #70 |
| Station combobox in import | `components/reservations/import/StationCombobox.tsx` | `reservations` | #70 |
| CSV parse, header mapping, and validation messages | `lib/csv-import/*` (notably `validateImportRows.ts`, `headerMapping.ts`, `parseCsv.ts`) | `reservations`, `errors` | #69, #70 |
| Import commit result toasts | `hooks/useImportCommit.ts` | `reservations`, `errors` | #69, #70 |

Header aliases in `lib/csv-import/headerMapping.ts` and station aliases in
`lib/csv-import/stationAliases.ts` match what agencies actually type into
spreadsheets. They are input data, not UI copy, and are not translated.

## 9. Passenger lists, exports, and print

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Passenger lists index and upcoming rides | `app/(dashboard)/passenger-lists/page.tsx`, `components/passenger-lists/UpcomingRidesTable.tsx`, `hooks/usePassengerListsPage.ts` | `reservations` | #70 |
| Passenger list detail and filters | `app/(dashboard)/passenger-lists/[rideId]/page.tsx`, `components/passenger-lists/PassengerListTable.tsx`, `components/passenger-lists/PassengerListFilters.tsx`, `hooks/usePassengerListDetailPage.ts` | `reservations` | #70 |
| Export dialog | `components/reservations/ExportPassengersDialog.tsx` | `exports` | #75 |
| Excel workbook: sheet name, column headers, totals | `hooks/useRideInstanceSeatMapPage.ts` | `exports` | #75 |
| PDF passenger list: title, headers, footer | `utils/passengerListPdf.ts`, `utils/passengerListHelpers.ts` | `exports` | #75 |
| PDF font coverage for Serbian diacritics | `utils/pdfFonts.ts` | — | #75 |
| Printable passenger list view | `app/(dashboard)/passenger-lists/[rideId]/page.tsx` | `exports` | #75 |

Generated documents have no browser to read a locale from, so #75 has to pass
one explicitly — the helpers in `i18n/format.ts` all take the locale as an
argument for exactly this reason.

## 10. Public storefront

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Storefront layout and chrome | `app/(storefront)/[agencySlug]/layout.tsx` | `storefront` | #72 |
| Storefront page: search, schedule table, labels | `app/(storefront)/[agencySlug]/page.tsx` | `storefront` | #72 |
| Storefront not-found | `app/(storefront)/[agencySlug]/not-found.tsx` | `storefront` | #72 |
| Storefront data shaping and labels | `lib/storefront.ts` | `storefront` | #72 |
| Storefront metadata | `app/(storefront)/[agencySlug]/page.tsx` | `storefront` | #74 |

Agency-authored content — name, description, contact details, notices — is
rendered as written and never duplicated per locale.

## 11. Marketing, blog, and legal

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Marketing layout, nav, footer | `app/(marketing)/layout.tsx`, `components/marketing/nav.tsx`, `components/marketing/footer.tsx` | `marketing` | #73 |
| Home page | `app/(marketing)/page.tsx` | `marketing` | #73 |
| Hero, video hero, logo bar, key stats | `components/marketing/hero.tsx`, `components/marketing/hero-video.tsx`, `components/marketing/logo-bar.tsx`, `components/marketing/key-stats.tsx` | `marketing` | #73 |
| Features grid, feature spotlight, problem framing | `components/marketing/features-grid.tsx`, `components/marketing/feature-spotlight.tsx`, `components/marketing/problem-framing.tsx` | `marketing` | #73 |
| Pricing cards and teaser | `components/marketing/pricing-cards.tsx`, `components/marketing/pricing-teaser.tsx`, `app/(marketing)/cene/page.tsx` | `marketing` | #73 |
| Testimonials, CTA band, answer block, section shell | `components/marketing/testimonials.tsx`, `components/marketing/cta-band.tsx`, `components/marketing/answer-block.tsx`, `components/marketing/section.tsx` | `marketing` | #73 |
| FAQ copy and its structured data | `components/marketing/faq.tsx`, `components/marketing/faq-json-ld.tsx` | `marketing` | #73, #74 |
| SEO landing pages (7 slugs, unchanged) | `app/(marketing)/softver-za-autobuske-agencije/`, `sistem-za-rezervacije-autobusa/`, `online-rezervacije-autobuskih-karata/`, `upravljanje-autobuskim-linijama/`, `vozni-red-online-sistem/`, `digitalizacija-autobuske-agencije/`, `surp-vs-excel/`, plus `components/marketing/seo-landing-page.tsx`, `lib/landing-pages.ts` | `marketing` | #73 |
| Funkcije and Za agencije pages | `app/(marketing)/funkcije/page.tsx`, `app/(marketing)/za-agencije/page.tsx` | `marketing` | #73 |
| Contact page and demo form | `app/(marketing)/kontakt/page.tsx`, `components/marketing/contact/demo-form.tsx` | `marketing` | #73 |
| Contact form validation and server action results | `app/(marketing)/kontakt/actions.ts` | `marketing`, `errors` | #69, #73 |
| Blog index and post pages | `app/(marketing)/blog/page.tsx`, `app/(marketing)/blog/[slug]/page.tsx`, `components/marketing/blog-card.tsx`, `lib/blog.ts` | `marketing` | #73 |
| Blog post bodies (3 Markdown files) | `content/blog/digitalizacija-operacija.md`, `content/blog/online-rezervacije-autobuske-karte.md`, `content/blog/seo-za-autobuske-agencije.md` | — (Markdown, not catalogs) | #73 |
| Markdown renderer chrome | `components/marketing/markdown-content.tsx` | `marketing` | #73 |
| Legal pages | `app/(marketing)/politika-privatnosti/page.tsx`, `app/(marketing)/uslovi-koriscenja/page.tsx`, `components/marketing/legal-page.tsx`, `components/marketing/simple-page.tsx` | `marketing` | #73 |
| Marketing not-found, global not-found | `app/(marketing)/not-found.tsx`, `app/not-found.tsx` | `errors` | #73 |

Blog bodies are long-form prose. They stay Markdown files with a per-locale
variant rather than moving into catalogs; #73 decides the file naming.

## 12. SEO, metadata, and machine-readable routes

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Site config: name, description, keywords, nav labels | `lib/seo.ts`, `content/brand-entity.json` | `marketing` | #74 |
| Root metadata, OG, Twitter cards | `app/layout.tsx` | `marketing` | #74 |
| Per-page metadata across 17 route files | every `export const metadata` / `generateMetadata` under `app/` | `marketing`, `storefront` | #74 |
| Canonicals and `hreflang` alternates | `lib/seo.ts`, per-page metadata | — | #74 |
| Organization and FAQ structured data | `lib/seo.ts`, `components/marketing/faq-json-ld.tsx` | — | #74 |
| Sitemap | `app/sitemap.ts` | — | #74 |
| Robots, plus the private-route `X-Robots-Tag` header | `app/robots.ts`, `middleware.ts` | — | #74 |
| `llms.txt` and `llms-full.txt` | `app/llms.txt/route.ts`, `app/llms-full.txt/route.ts` | — | #74 |
| Markdown mirror routes | `app/md/[slug]/route.ts`, `lib/landing-to-markdown.ts` | — | #74 |

## 13. Data-layer toasts and errors

Most success and failure messages are not in components at all — they live in
the mutation and query hooks, which is where #69 and #70 have to look.

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Create/update/delete toasts for stations, lines, rides | `infrastructure/hooks/mutations/useStationMutations.ts`, `useLineMutations.ts`, `useRideMutations.ts` | `schedules`, `errors` | #69, #70 |
| Create/update/delete toasts for passengers and reservations | `infrastructure/hooks/mutations/usePassengerMutations.ts`, `useReservationMutations.ts` | `passengers`, `reservations`, `errors` | #69, #70 |
| Invariant run toasts | `infrastructure/hooks/mutations/useInvariantMutations.ts` | `dashboard`, `errors` | #69, #71 |
| Confirmable update flow | `infrastructure/hooks/useConfirmableUpdate.ts`, `infrastructure/utils/breaking-change.ts` | `errors` | #69 |
| Query load-failure messages (11 of the 13 query hooks) | `infrastructure/hooks/queries/*` | `errors` | #69 |

## 14. Errors and system messages

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Login failure messages (invalid credentials, network, inactive user or tenant, password change required, forbidden) | `infrastructure/utils/errors.ts` | `auth`, `errors` | #69, #71 |
| `getApiErrorMessage`, which today passes raw API text straight to the screen | `infrastructure/utils/errors.ts` | `errors` | #69 |
| API error codes mapped to client text | new mapping module | `errors` | #69 |
| HTTP client failures | `infrastructure/requests/http-client.ts` | `errors` | #69 |
| Invariant and maintenance run results | `components/settings/*`, `components/data-integrity/ConfirmBreakingChangeDialog.tsx` | `errors` | #69 |
| Missing-message fallback logging | `i18n/reporting.ts` | — | #66 (done) |

`getApiErrorMessage` returning `error.response.data.message` is the single
biggest source of untranslated text: it puts whatever the API said on screen.
#69 replaces it with a mapping from stable codes, so API responses themselves
stay unchanged and existing consumers are unaffected.

## 15. Emails

| Surface | Files | Namespace | Owner |
| --- | --- | --- | --- |
| Lead confirmation email (Maizzle) | `api/emails/templates/marketing-lead-confirmation.html` | — (template per locale) | #76 |
| Lead notification email (Maizzle) | `api/emails/templates/marketing-lead-notification.html` | — (template per locale) | #76 |
| Email send path and subject lines | `api/src/marketing-leads/marketing-leads-email.service.ts`, `api/src/marketing-leads/email-templates/generated-email-templates.ts` | — | #76 |
| Locale carried from the contact form to the send | `app/(marketing)/kontakt/actions.ts`, `api/src/marketing-leads/dto/create-marketing-lead.dto.ts` | — | #76 |

An email has no request to read a locale from, so the language has to travel
with the lead. #76 decides whether that is a request field or a header.

## 16. Accessibility text

Screen-reader-only labels, `aria-label`, `aria-describedby`, and image `alt`
text are translated together with the component that renders them — they are
not a separate pass. The ones that exist today outside a page:

| Surface | Files | Owner |
| --- | --- | --- |
| Header account controls | `components/layout/Header.tsx` | #71 |
| Breadcrumb "more" control | `components/ui/breadcrumb.tsx` | #71 |
| Pagination controls | `components/ui/data-table-pagination.tsx` | #71 |
| Dialog, sheet, and alert-dialog close buttons | `components/ui/dialog.tsx`, `components/ui/sheet.tsx`, `components/ui/alert-dialog.tsx` | #71 |
| Marketing images and logos | `components/marketing/*` | #73 |
| Seat map seat states | `components/reservations/SeatMap.tsx` | #70 |

#77 checks that no surface ships with an untranslated accessible name.

## 17. Foundation, already delivered by #66

| Surface | Files |
| --- | --- |
| Locale registry | `i18n/locales.ts` |
| Tenant timezone and currency, business dates | `i18n/tenant.ts` |
| Namespace registry and root bundle | `i18n/namespaces.ts` |
| Catalogs, loader, Serbian emergency fallback | `i18n/messages.ts`, `i18n/messages/**` |
| Date, time, number, list, plural, calendar, sorting helpers | `i18n/format.ts` |
| Named ICU formats | `i18n/formats.ts` |
| Request config and locale seam | `i18n/request.ts`, `i18n/resolve-locale.ts` |
| Missing-message reporting and fallback rendering | `i18n/reporting.ts` |
| Registry-key ↔ formatting-tag mapping | `toAppLocale` in `i18n/locales.ts` |
| Tests, including the catalog completeness check | `i18n/__tests__/**` |
| Adding a locale | `docs/adding-a-locale.md` |
