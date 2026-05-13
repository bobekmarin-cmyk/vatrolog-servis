# Google OAuth verification — VatroLog

Ovaj dokument je gotov dosje koji koristiš u **Google Cloud Console → APIs &
Services → OAuth consent screen → Edit app** i kasnije pri **Submit for
verification**. Ne moraš ništa pisati od nule — sva polja su već formulirana.
Tvoj zadatak je copy-paste u Console + snimanje demo videa po skripti niže.

> **Domain**: jedina domena je `vatrolog.com`. Sve ostale (`app.vatrolog.hr`,
> `vatrolog.hr`) više ne postoje u kodu.

---

## 1. OAuth consent screen — App information

| Polje | Vrijednost |
| --- | --- |
| App name | `VatroLog` |
| User support email | `info@vatrolog.com` |
| App logo | upload `public/icon-512.png` (ili logo iz brand kita) |
| Application home page | `https://vatrolog.com` |
| Application privacy policy link | `https://vatrolog.com/legal/privacy` |
| Application terms of service link | `https://vatrolog.com/legal/terms` |
| Authorized domains | `vatrolog.com` |
| Developer contact information | `info@vatrolog.com` (i optional drugi tehnički kontakt) |

**Linkovi koje Google reviewer mora moći otvoriti bez prijave:**

- Homepage: <https://vatrolog.com>
- Privacy policy: <https://vatrolog.com/legal/privacy> (s vidljivom sekcijom
  „6. Google API Services i Gmail integracija”)
- Terms of service: <https://vatrolog.com/legal/terms>
- Gmail integration page: <https://vatrolog.com/legal/google-api>
- Footer link „Gmail integracija” na landing stranici (vidi
  `src/app/_landing/Footer.tsx`)

---

## 2. Scopes — popis i justifikacije

Aplikacija koristi **dva** scopea (oba sensitive po Google klasifikaciji); ne
tražimo niti jedan restricted scope.

### `https://www.googleapis.com/auth/gmail.send`

**Type:** Sensitive

**Justification (paste in „Why does your app need access to this scope?”
field):**

> VatroLog is a SaaS application for fire-extinguisher service workshops in
> Croatia. After the user explicitly connects their Gmail account, the app uses
> the `gmail.send` scope to send service documents (work order, intake receipt,
> register entry, delivery note PDFs) and customer notifications (e.g. monthly
> reminders for upcoming service deadlines) from the user's own Gmail address,
> on the user's behalf, exclusively when the user (or an automation the user has
> explicitly enabled in their workshop) initiates the send. The app never reads
> the inbox, drafts or any other mailbox folder — the `gmail.send` scope is
> chosen precisely because it grants send-only capability and does not give us
> read access. There is no alternative narrower scope that allows sending
> messages from the user's account.

**Where in the UI it is requested (for reviewer):**

- Tenant flow: `Postavke → Mail → Poveži Gmail` (`/admin/settings`, component
  `src/components/MailIntegrationsSection.tsx`).
- Vendor/platform flow (only platform operators): `Platform → Postavke → Email
  integracija → Poveži Gmail` (`src/app/platform/settings/SettingsClient.tsx`).

### `https://www.googleapis.com/auth/userinfo.email`

**Type:** Sensitive (treated as such by Google for branded apps)

**Justification:**

> Used solely to read the email address of the connected Google account so that
> the application can display it back to the user in the UI ("Connected as
> example@gmail.com"). This is critical for user control and transparency —
> users need to verify which Google account is currently authorised to send
> mail on their behalf, and to recognise it before disconnecting. The app does
> not use this scope to read any profile information beyond the email address.

---

## 3. Limited Use disclosure (English) — copy-paste ready

Use the same wording on the OAuth consent screen if Google asks for an explicit
Limited Use statement, and verify it matches the wording in
`/legal/google-api`:

> VatroLog's use and transfer of information received from Google APIs to any
> other app will adhere to the
> [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
> including the Limited Use requirements. We use the `gmail.send` scope only to
> send emails the user explicitly initiates from within VatroLog (service
> documents and customer notifications) and the `userinfo.email` scope only to
> display the connected Google account address back to the user. We do not read
> the user's mailbox, do not store message contents, do not share Google user
> data with third parties, do not use it for advertising, and do not use it to
> develop, improve or train generalised AI/ML models.

The same wording is published publicly at
`https://vatrolog.com/legal/google-api` (section „4. Limited Use disclosure
(English)”) and referenced from `/legal/privacy#google-api`.

---

## 4. Authorized redirect URIs (OAuth Client → Web application)

Add **all four**:

- `https://vatrolog.com/api/gmail/callback` — per-tenant flow
  (`src/lib/gmail.ts`, `getRedirectUri()`).
- `https://vatrolog.com/api/platform/gmail/callback` — vendor/platform flow
  (`src/lib/platformGmail.ts`, `getPlatformRedirectUri()`).
- `http://localhost:3000/api/gmail/callback` — local development.
- `http://localhost:3000/api/platform/gmail/callback` — local development.

> Production URIs are computed from `NEXT_PUBLIC_APP_URL`
> (`getPublicAppUrl()`); set it to `https://vatrolog.com` so both `gmail.ts` and
> `platformGmail.ts` produce exact matches. If a non-default vendor URI is ever
> required (proxy/staging), override `GOOGLE_REDIRECT_URI_PLATFORM`. There is
> intentionally no `GOOGLE_REDIRECT_URI_TENANT` — the tenant URI is always
> `${NEXT_PUBLIC_APP_URL}/api/gmail/callback`.

---

## 5. Authorized JavaScript origins

- `https://vatrolog.com`
- `http://localhost:3000`

(No client-side OAuth flow is used; origins are listed for completeness.)

---

## 6. App data handling — answers for the verification questionnaire

| Question | Answer |
| --- | --- |
| Which platforms does your app run on? | Web (responsive, primarily desktop). |
| What does your app do? | SaaS for fire-extinguisher service workshops in Croatia: customer database, work orders, parts/labels inventory, mandatory PDF documents (work order, register entry, delivery note), reminders to customers about upcoming service deadlines. |
| Why does your app need this OAuth scope? | See section 2 above. |
| Are you a service provider acting on behalf of multiple clients (TSP)? | No, single product. |
| Where do you store Google user data? | OAuth refresh and access tokens in our managed Postgres (Vercel/Supabase, EU region), encrypted at rest with AES-256-GCM (key separate from auth secret). No mailbox content is ever stored. |
| Do you transfer Google user data to any third party? | No third-party sharing. Data is processed on our hosting infrastructure (Vercel EU + Postgres EU) only. |
| Do you use Google user data for AI/ML training? | No. |
| Do you sell Google user data? | No. |
| How can users revoke access? | In-app: `Postavke → Mail → Odspoji Gmail` (deletes encrypted tokens and revokes refresh token via `https://oauth2.googleapis.com/revoke`). Externally: `myaccount.google.com/permissions`. Both flows are documented at `https://vatrolog.com/legal/google-api` (section 5). |
| Logging | Each successful and failed send is logged in the `EmailLog` table (timestamp, recipient, subject, status). Each integration change (connect/disconnect/refresh) is recorded in `AuditLog`. |

---

## 7. Brand verification

Required before sensitive scopes are approved:

1. **Domain ownership**: prove `vatrolog.com` in Google Search Console with the
   same Google account used for the OAuth project. Add a TXT record
   (`google-site-verification=...`) and confirm.
2. **App logo**: upload a square logo (≥ 120×120 PNG, transparent or solid
   background) representing VatroLog. Use the same logo as on the landing page.

---

## 8. Demo video — script (60–120 seconds, English narration optional)

The reviewer expects to see (a) the public landing with the privacy/terms
links, (b) the in-app screen where the user grants Gmail access with our
disclosure visible, (c) the Google OAuth consent screen showing both scopes,
(d) actual usage (sending an email through `gmail.send`), and (e) the
disconnect path. A continuous screen recording with cursor highlighting is
sufficient — no editing required.

### Scene 1 — Public landing (10 s)

- Open <https://vatrolog.com>.
- Scroll down to the footer and hover over the **„Gmail integracija”** link to
  show it is present and clickable.
- Click it briefly; once the `/legal/google-api` page is visible (showing the
  Limited Use disclosure), click back.

### Scene 2 — Sign in (10 s)

- Click **„Otvori aplikaciju” / „Prijava”**.
- Sign in with a demo tenant account (workshop admin role).

### Scene 3 — Mail settings, prominent disclosure (15 s)

- Navigate to `Postavke → Mail`.
- Pause on the Gmail card so the disclosure box is visible:
  „Što tražimo od Googlea: gmail.send / userinfo.email … Ne čitamo inbox … Limited Use…”.
- Click **„Poveži Gmail račun”**.

### Scene 4 — Google OAuth consent screen (15 s)

- The Google-hosted consent screen opens.
- Hover/highlight the two scopes shown by Google:
  - „Send email on your behalf” (`gmail.send`)
  - „See your primary Google Account email address” (`userinfo.email`)
- Click **Continue** / **Allow** with the demo Google account.

### Scene 5 — Connected state (10 s)

- App returns to `Postavke → Mail`.
- The Gmail card now shows the connected email address and the timestamp.

### Scene 6 — Actual usage of `gmail.send` (25 s)

- Open an existing work order or generated register entry.
- Click **„Pošalji kupcu e-poštom”** (or open a customer detail and trigger
  „Pošalji upisnike e-poštom”).
- Confirm in the dialog; the email is sent through Gmail API
  (`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`).
- Briefly show the success toast and (optionally) open the recipient inbox to
  show the message arrived from the connected Gmail address.

### Scene 7 — Disconnect (10 s)

- Back in `Postavke → Mail`, click **„Odspoji”** on the Gmail card.
- Confirm. The card returns to the disconnected state.
- Mention narration / overlay text:
  „Tokens are deleted and revoked at Google. Users can additionally revoke
  access at myaccount.google.com/permissions.”
- Briefly open
  <https://myaccount.google.com/permissions> in a new tab to show that VatroLog
  is no longer listed (or that the user could remove it manually here).

### Scene 8 — Outro (5 s)

- Show the URL bar at `https://vatrolog.com/legal/google-api` to make the
  Limited Use disclosure URL clearly visible at the end of the video.

> Upload as unlisted YouTube video and paste the URL into the verification
> form.

---

## 9. Production environment variables (must be set on Vercel before submit)

| Var | Value |
| --- | --- |
| `APP_BASE_URL` | `https://vatrolog.com` |
| `NEXT_PUBLIC_APP_URL` | `https://vatrolog.com` |
| `GOOGLE_CLIENT_ID` | OAuth Client ID from Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret |
| `GOOGLE_REDIRECT_URI_PLATFORM` | (optional) override only if behind a proxy that rewrites the path |
| `ENCRYPTION_KEY` | ≥ 32 random chars, **different** from `AUTH_SECRET` and `PLATFORM_AUTH_SECRET` |

`getRedirectUri()` (tenant) and `getPlatformRedirectUri()` both call
`getPublicAppUrl()` from `src/lib/appVersion.ts`. With
`NEXT_PUBLIC_APP_URL=https://vatrolog.com` set, the redirect URIs are exactly:

- `https://vatrolog.com/api/gmail/callback`
- `https://vatrolog.com/api/platform/gmail/callback`

These must match the URIs registered in Cloud Console character-for-character;
no trailing slash, lowercase scheme/host.

Also verify (one-time before submit):

- `EmailLog` and `AuditLog` are populated after a real send (open
  `/platform/email-log` and confirm a row appears for a tenant Gmail send).
- Disconnect from `Postavke → Mail` actually removes
  `Company.gmailRefreshTokenEnc` (or wipes `PlatformIntegration` for vendor)
  and calls `https://oauth2.googleapis.com/revoke`.

---

## 10. Submission checklist

- [ ] Domain `vatrolog.com` verified in Search Console under the same Google
      account as the Cloud project.
- [ ] OAuth consent screen filled with all values from section 1.
- [ ] App logo uploaded.
- [ ] Both scopes added with the justifications from section 2.
- [ ] All four redirect URIs from section 4 added to the OAuth client.
- [ ] Production env vars from section 9 set on Vercel; production deploy
      successful.
- [ ] Privacy policy reachable at `https://vatrolog.com/legal/privacy` (with
      the new section 6) and links to `/legal/google-api`.
- [ ] `https://vatrolog.com/legal/google-api` reachable and linked from the
      landing footer.
- [ ] Demo video recorded by the script in section 8 and uploaded as
      unlisted YouTube.
- [ ] In-app disclosure visible above the **Poveži Gmail** button on both
      tenant and vendor screens.
- [ ] Test send completes end-to-end on production with a real Gmail account.
- [ ] Click **„Submit for verification”** in Cloud Console.

After submission Google typically responds within a few business days; reply
to their emails from the same `info@vatrolog.com` mailbox so they can match
the developer contact in section 1.
