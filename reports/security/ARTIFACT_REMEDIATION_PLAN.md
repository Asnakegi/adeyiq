# Remediation plan: claude.ai artifacts that store or send shipment data (finding A-1, High)

**Status:** plan only. Nothing has been deleted, unpublished or republished. Every step marked **(approval)** needs the
owner's explicit go-ahead.

## What is affected

| Artifact (owner's claude.ai account) | Local source | What it does with data |
|---|---|---|
| AdeyIQ Cargo Builder | `adeyiq-builder.html` (not in the repo) | Stores every shipment in the artifact's shared database (`db.collection('shipments')`), visible to every viewer of the artifact. Writes full shipment rows (AWB, pieces, L×W×H, weight, goods, SHC, DG, UN, ULD, position) to the Google Sheet tab "Shipments", and builds and plans to "ULD builds" and "Load plans", through the viewer's Google Sheets connector |
| AdeyIQ Modules (home) | `adeyiq-modules.html` | Stores access requests (name, email, company, phone, message) in the shared artifact database |
| AdeyIQ Hold View, AdeyIQ Aircraft Data | `adeyiq-hold-view.html`, `adeyiq-aircraft-data.html` | Demo data only. Not affected, but they should get the same sharing review |

The website (adeyiq.vercel.app) does not do any of this; it was verified separately.

## Steps

1. **Inventory (owner, no data changed).** In claude.ai, open each artifact's sharing settings and note who has access
   (only you, specific people, or anyone with the link). Note where the links were posted (LinkedIn, chats, email).
2. **Contain (owner, approval).** If anyone other than you can open the builder or modules artifact, turn sharing off
   or make them private now. This stops new exposure immediately and deletes nothing.
3. **Assess the data (owner, read-only).**
   - In the Google Sheet, review the Shipments, ULD builds and Load plans tabs. Separate your own test rows from any
     third-party cargo.
   - In each artifact, look at what the shared database holds (Claude can list it read-only for you if you ask).
   - Write down whose data it is and when it was entered.
4. **Decide on the stored data (owner, approval).**
   - For third-party cargo or personal data you don't need, make a private, dated copy only if you must keep evidence,
     then delete the rows and database documents.
   - Keep the sheet's sharing Restricted throughout.
5. **Replace (Claude, after approval to publish).** Republish the builder artifact without the shared database and
   without the Sheets writes, using the website's model: cargo in the viewer's own browser storage, status-only usage
   (or none). Republish the modules artifact without the shared request store; its access button should link to the
   website form at https://adeyiq.vercel.app/#access. Simpler alternative: retire the artifacts and point people to the
   website.
6. **Verify (Claude, after republishing).** Repeat the website privacy test on the artifacts: synthetic cargo, every
   network call and storage write watched, a second viewer account confirming it cannot see the first viewer's cargo.
7. **Communicate (owner, possibly with legal advice).** If other people's cargo or contact details were visible to
   others, consider telling the people affected what happened, what was exposed, and what you did. Whether you are
   obliged to depends on where they are (for example the GDPR for EU contacts).
8. **Prevent.** Keep the claude.ai artifacts as your own drafts only. The website is the only public surface, and its
   privacy test runs in CI on every change.
