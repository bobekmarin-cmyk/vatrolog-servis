# Ručni backup baze

Backup uvijek izvodi GitHub Actions workflow [`backup-db.yml`](../.github/workflows/backup-db.yml):
`pg_dump` → AES-256-GCM enkripcija → upload na R2/S3. Automatski ide svaki dan
u 02:15 UTC.

Ručno ga možete pokrenuti na dva načina.

---

## 1. Gumb na platformi (preporučeno)

**Platforma → Health → Backup arhiva (R2) → „Pokreni backup sada"**

Gumb okine isti workflow, prati status i osvježi tablicu arhive kad backup
završi. Ispod gumba se vide zadnja tri pokretanja s oznakom je li bilo ručno ili
automatsko i linkom na log.

### Što treba postaviti jednom

Gumb koristi GitHub API, pa mu treba token:

1. GitHub → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**
2. Repository access: **Only select repositories** → `vatrolog-servis`
3. Permissions → Repository permissions → **Actions: Read and write**
4. Kopirajte token pa ga u **Railway → servis aplikacije → Variables** dodajte kao:

   ```
   GITHUB_BACKUP_TOKEN=github_pat_...
   ```

Opcionalno postavite i `GITHUB_REPO=bobekmarin-cmyk/vatrolog-servis` ako se
repozitorij ikad preimenuje.

Dok token nije postavljen, gumb je onemogućen i piše što nedostaje — ostalo na
stranici radi normalno.

---

## 2. Direktno na GitHubu

**Actions → DB backup → Run workflow → Run workflow** (grana `main`).

Isti rezultat, bez potrebe za tokenom.

---

## Provjera da je backup stvarno nastao

Nakon što workflow završi (traje otprilike minutu), na istoj Health stranici u
tablici **Backup arhiva (R2)** mora se pojaviti novi zapis s današnjim datumom.
Ako se ne pojavi, otvorite log runa — najčešći uzroci su istekli S3 ključevi ili
`BACKUP_ENCRYPTION_KEY` koji nedostaje.

## Važno kod promjene baze

Workflow čita bazu iz **GitHub secreta** `DATABASE_URL`, a ne iz Railway
varijabli. Kad promijenite bazu (npr. selidba u drugu regiju), morate ažurirati
i taj secret:

**GitHub → Settings → Secrets and variables → Actions → `DATABASE_URL`**

Inače backup i dalje uredno prolazi — ali snima staru bazu.

### Koji URL kopirati — javni, ne privatni

GitHub Actions runner je izvan Railway mreže, pa privatni host
`postgres.railway.internal` odande **nije dostupan**. Za GitHub secret uvijek
uzmite **`DATABASE_PUBLIC_URL`** iz Railwaya (Postgres → Variables), oblika:

```
postgresql://postgres:...@nesto.proxy.rlwy.net:PORT/railway
```

Privatni `DATABASE_URL` (`postgres.railway.internal`) ostaje samo u Railway
varijablama aplikacije — tamo je i brži jer ne izlazi iz njihove mreže.

Ako se ipak upiše privatni URL, skripta to prepozna i prekine s jasnom porukom
umjesto da padne na nerazumljivoj DNS grešci.

## Vraćanje backupa

Postupak je opisan u [`launch-ops-checklist.md`](./launch-ops-checklist.md);
skripta je `npm run restore:db` i **nikad** se ne pokreće nad produkcijom
(odbija raditi ako je `RESTORE_TARGET_DATABASE_URL` jednak `DATABASE_URL`).
