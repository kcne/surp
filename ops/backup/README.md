# Backup baze

Dnevni `pg_dump` produkcione baze na S3-kompatibilan storage, kao zaseban Railway cron servis.

Ovo je jedina mreža ispod produkcionih podataka. Railway Postgres kod nas ne radi sopstveni backup.

## Kako je postavljeno

| | |
|---|---|
| Kad | `0 1 * * *` UTC — 02:00 zimi, 03:00 leti |
| Šta | Ceo dump u custom formatu (`-Fc`), komprimovan |
| Gde | `daily/` (30 dana) i `monthly/` (365 dana) |
| Prava | Samo `PutObject` — job ne može ništa da obriše |

`pg_dump` čita iz jednog MVCC snapshota, pa je dump konzistentan i dok se upisuju rezervacije. Noćni termin je izabran zbog opterećenja i zbog čistije tačke oporavka, ne zbog ispravnosti.

## Gde backup stoji

Skripta govori običan S3 API i ne zna kod koga je bucket. Provajder se menja jednom promenljivom — `BACKUP_S3_ENDPOINT`. Radi sa Railway-evim bucketom, Tigrisom, Cloudflare R2, Backblaze B2 ili pravim AWS S3.

Izbor provajdera je izbor **od čega je backup nezavisan**:

| Gde | Štiti od | Ne štiti od |
|---|---|---|
| Bucket kod istog provajdera kao baza | Loše migracije, obrisane tabele, otkaza baze | Gubitka naloga, greške u naplati, brisanja projekta, ispada provajdera |
| Bucket kod drugog provajdera | Svega gore | — |

Za ono zbog čega ovaj epik postoji — **loša migracija ili backfill pokvari podatke** — isti provajder je sasvim dovoljan. To je i najverovatniji scenario, ubedljivo.

Praktičan savet: uzmi ono što možeš da postaviš **danas**. Backup koji postoji kod istog provajdera vredi neuporedivo više od savršenog koji čeka. Nedeljna kopija kod drugog provajdera se dodaje kasnije, kad zatreba.

Jedno **ne**: Railway Volume nije mesto za backup. Nije verzionisan, nema lifecycle, i deli sudbinu projekta sa bazom — to je kopija, ne backup.

## Zašto odvojen bucket i odvojen ključ

Bez obzira na provajdera, backup **ne** deli bucket sa slikama tiketa (`enclosed-shoebox-uzuh-ovk`).

Ključ aplikacije živi u web servisu izloženom internetu i to je najverovatnije što će da procuri. Backup koji se može obrisati tim ključem nije backup. Ovo važi kod svakog provajdera i nije stvar izbora.

Backup bucket ima svoj ključ, i taj ključ nema pravo brisanja. Retencija ide isključivo kroz lifecycle pravila.

## Postavljanje

### 1. Bucket i kredencijali

Napravi nov bucket (npr. `surp-db-backups`) i nov access key **samo za njega**, sa `PutObject` i `GetObject`, bez `DeleteObject`.

`GetObject` treba za restore i za čitanje `latest.json`.

### 2. Lifecycle pravila

Ovo je celokupna retencija — job ne briše ništa:

| Prefiks | Pravilo |
|---|---|
| `daily/` | Expire after 30 days |
| `monthly/` | Expire after 365 days |

Bez ovih pravila bucket raste neograničeno. Postavi ih pre prvog pokretanja.

### 3. Railway servis

Nov servis u istom projektu kao baza, da ide preko privatne mreže:

- Root directory: `ops/backup`
- Builder: Dockerfile
- Cron schedule: `0 1 * * *`

Promenljive:

```
DATABASE_URL           = ${{Postgres.DATABASE_URL}}   # privatna mreza, ne javni proxy
BACKUP_S3_BUCKET       = surp-db-backups
BACKUP_S3_ENDPOINT     = <S3 endpoint bucketa>   # npr. https://t3.storageapi.dev
AWS_ACCESS_KEY_ID      = <kljuc samo za backup bucket>
AWS_SECRET_ACCESS_KEY  = <...>
AWS_DEFAULT_REGION     = auto
```

`DATABASE_URL` uzmi kao referencu na Postgres servis, ne kao javni proxy URL — tako saobraćaj ne izlazi iz Railway mreže.

### 4. Probno pokretanje

Pokreni servis ručno i proveri log. Očekivano:

```
[backup] dumping database
[backup] dump written: 2847362 bytes
[backup] verifying archive
[backup] archive verified: 184 entries
[backup] uploading s3://surp-db-backups/daily/surp-20260911T010000Z.dump
[backup] confirming upload
[backup] writing heartbeat
[backup] done: daily/surp-20260911T010000Z.dump (2847362 bytes, sha256 a3f9c1e8b204)
```

Svaki korak koji ne prođe obara run sa ne-nultim izlazom. Job ne ume da „delimično uspe".

## Vežba oporavka

**Backup koji nije nijednom vraćen je pretpostavka, ne mreža.** Ovu vežbu treba proći jednom pre prve migracije iz #15, i posle toga kvartalno.

```bash
# Scratch baza — lokalni docker-compose je dovoljan
docker compose -f api/docker-compose.yml up -d
createdb -h localhost -U postgres surp_restore_drill

export TARGET_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/surp_restore_drill'
export BACKUP_S3_BUCKET=surp-db-backups
export BACKUP_S3_ENDPOINT=<S3 endpoint bucketa>
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

./ops/backup/restore.sh
```

Skripta na kraju ispiše broj redova po tabeli. **Uporedi ih sa produkcijom** — `pg_restore` koji izađe sa nulom je slabiji dokaz nego što zvuči.

Skripta odbija da piše preko baze čiji URL liči na produkciju. Za pravi oporavak treba eksplicitno:

```bash
ALLOW_PRODUCTION_RESTORE=yes-i-am-restoring-production ./ops/backup/restore.sh
```

## Pravi oporavak

1. **Zaustavi API servis** da niko ne piše preko oporavka u toku.
2. Nađi tačku oporavka: `aws s3 ls s3://surp-db-backups/daily/ --endpoint-url ...`
3. Restore u **novu** bazu, ne preko postojeće — stara ostaje kao dokaz dok se ne potvrdi da je nova ispravna.
4. Proveri brojeve redova i pusti provere integriteta iz Podešavanja.
5. Prebaci `DATABASE_URL` na novu bazu, pa podigni API.

Korak 3 je bitan: restore preko oštećene baze uništava i dokaz o tome šta se desilo.

## Šta ovde još ne postoji

- **Alarm ako backup izostane.** `latest.json` nosi vreme poslednjeg uspešnog backupa; provera da je mlađi od 26h ide kao invarijanta u #23, gde već postoji kanal za alarm. Do tada backup treba pogledati ručno.
- **Client-side enkripcija.** Dump sadrži lične podatke putnika — imena, telefone, mejlove. Trenutno se oslanjamo na enkripciju koju bucket radi sam. Enkripcija ključem koji ne živi kod provajdera je jača, ali uvodi čuvanje ključa: izgubljen ključ znači bezvredne backupe. Zasebna odluka.
