# Prompt: generate the station alias table for a tenant

CSV files from agencies name stations however the person typing them felt that
day — `BEOGRAD`, `BEOGRAD STEKO`, `NOVI SAD AVIA`, `batocina`, `edirne`,
`MONTENEGRO`. The
import page matches those against the tenant's real stations on its own
(exact → prefix → token overlap), but it deliberately refuses to guess when a
spelling is ambiguous or when the value is not a station at all.

This prompt closes that gap: it produces a reviewed alias table that turns the
remaining unknowns into confident matches, so an operator only has to touch the
rows that genuinely need a human.

Run it in Claude Code **from the repository root**. Output goes into
`ui/lib/csv-import/stationAliases.ts`.

---

## Prompt

> Copy everything between the lines into Claude Code. Replace the two
> placeholders on the first two lines before sending.

---

Tenant slug: `balbus-rs`
CSV file to map: `<absolute path to the agency CSV>`

You are producing a station alias table for the CSV reservation import.

**Step 1 — read the tenant's real stations.**

Ask me for a `PROD_API_URL`, `PROD_USERNAME` and `PROD_PASSWORD` for the
`balbus-rs` tenant, then read the station list. Do not put credentials in a file
and do not echo the password back to me.

```bash
TENANT=balbus-rs
TOKEN=$(curl -s -X POST "$PROD_API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: $TENANT" \
  -d "{\"username\":\"$PROD_USERNAME\",\"password\":\"$PROD_PASSWORD\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')

curl -s "$PROD_API_URL/stations?page=1&pageSize=100" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Slug: $TENANT" \
  | python3 -c 'import json,sys; [print(s["id"], "|", s["name"], "|", s.get("address","")) for s in json.load(sys.stdin)["items"]]'
```

Page through with `page=2`, `page=3`, … until you have read `total` stations.
If the API is unreachable, ask me for read-only `DATABASE_URL` access instead
and run `SELECT id, name, address FROM "Station" WHERE "tenantId" = (SELECT id
FROM "Tenant" WHERE slug = 'balbus-rs') AND "isActive" = true ORDER BY name;`.

**Step 2 — collect the distinct station spellings the CSV actually uses.**

Read both the departure column (`Polazi iz`) and the arrival column
(`Dolazi u`). Trim, then group case-insensitively and ignoring diacritics, so
`edirne`, `EDIRNE` and `Edirne` are one entry. Report each distinct spelling
with its row count, most frequent first.

**Step 3 — decide one outcome per spelling.** For each, pick exactly one:

- **`match`** — this spelling is a station in the list. Give its exact `name`.
  Only do this when you are confident. Consider that agencies abbreviate
  (`NIS` → `Niš AS`), append landmarks (`BEOGRAD STEKO` → the Steko petrol
  stop), drop diacritics (`batocina` → `Batočina`), and use foreign spellings
  (`edirne` → `Edirne`).
- **`manual`** — the spelling is genuinely not a station: a blank, a
  placeholder like `-` or `?`, or free text that names no place at all. Write a
  short Serbian `note` saying what it is. Expect this to be rare.
- **`ask`** — you cannot tell. Two stations are equally plausible, the
  spelling matches nothing in the list, or it names a place you cannot locate
  in the station list. List what you considered and ask me. Never guess here.

**Do not decide that a spelling is "not a real station" from the word alone.**
This is the single most damaging mistake you can make in this task, because
`manual` silently pushes work onto an operator for every affected row.

The station list is the only authority on what is a station. These routes run
to Istanbul, and the Turkish-end stops are named after the agency's own
landmarks — a stop can be called `AGENCIJA` (the agency office in Istanbul) or
`MONTENEGRO` (a location in Istanbul). Neither is a region or a country in this
data, and both are real stations. A name that reads like a country, a region, a
company, a hotel or a generic word is still a station if the tenant's station
list contains it, and if it is not in the list the correct outcome is `ask`, not
`manual`.

Ambiguity is the other thing to get right: `NIS` against both `Niš AS` and
`Niš - Nais` is an `ask`, not a coin flip. A wrong alias silently books
passengers onto the wrong stop, and nobody reviews a row the system says is
fine. When in doubt, choose `ask`.

Note that high-frequency spellings deserve the most care: a spelling used by
150 rows is worth asking me about, never worth guessing.

**Step 4 — show me a table before writing any code**, with columns: CSV
spelling, row count, outcome, target station, reasoning. Wait for my
confirmation. Then resolve every `ask` with me.

**Step 5 — write the result** into the `balbus-rs` entry of `ALIASES_BY_TENANT` in
`ui/lib/csv-import/stationAliases.ts`, replacing whatever is there. Rules:

- Keys are `normalizeKey(...)` output from `ui/lib/csv-import/normalize.ts`:
  ASCII (diacritics folded), uppercase, punctuation collapsed to single spaces,
  trimmed. `"  Beograd - Šteko "` becomes `"BEOGRAD STEKO"`. Verify each key by
  actually running `normalizeKey` — do not hand-fold.
- Use `stationName` with the station's exact name, not `stationId`. Names
  survive a reseed; cuids do not.
- Every `manual` entry gets `action: "manual"` and a `note`.
- Do not add an entry for a spelling that already matches a station exactly —
  the matcher handles those, and a redundant alias is one more thing to keep in
  sync.
- Keep entries sorted by key.

Expected shape:

```ts
"balbus-rs": {
  BEOGRAD: { stationName: "Beograd BAS" },
  MONTENEGRO: { stationName: "Montenegro Istanbul", note: "..." },
  NIS: { stationName: "Nis - eco" },
},
```

The tenant slug is the key the app looks up at runtime via `getTenantSlug()`,
so it must be the real slug (`balbus-rs`), not the agency's short name.

**Step 6 — verify.** Run `npx tsc --noEmit` in `ui/`, then tell me how many of
the CSV's distinct spellings now resolve automatically and which ones still
need an operator, and why.

---

## When to re-run this

Whenever the tenant adds, renames or retires stations, or when a new agency
file introduces spellings the table has never seen. The alias table is
generated input, not hand-maintained source — regenerate it rather than
patching entries one at a time.

## Why the aliases live in code

They are reviewed data. A wrong mapping puts a real passenger at the wrong
stop, so each entry should go through code review and ship with a deploy, not
be editable in a settings screen. If that tradeoff stops making sense — many
tenants, or operators who need to fix a mapping without a release — the natural
next step is a `StationAlias` table keyed by `tenantId`, with this file as the
seed.
