# Security Specification — SUBAG TU PIM & PROTOKOL DITJENPAS

## 1. Data Invariants
1. Every document in `/users/{userId}` and its subcollections (`agendas`, `journals`, `holidayDuties`, `attachmentChunks`) belongs exclusively to `userId` (`ownerId == request.auth.uid`) and requires a verified email (`request.auth.token.email_verified == true`).
2. Subcollection documents (`agendas`, `journals`, `holidayDuties`, `attachmentChunks`) cannot be created unless the parent `/users/{userId}` profile document exists (Master Gate).
3. All document IDs (`userId`, `agendaId`, `journalId`, `dutyId`, `chunkId`) must match `^[a-zA-Z0-9_\-]+$` and be 1..128 characters.
4. All strings and arrays have strict upper size bounds matching `firebase-blueprint.json`.
5. `ownerId` and `createdAt` are immutable after creation; `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
6. No shadow/ghost fields are allowed on create (`hasOnly`) or update (`affectedKeys().hasOnly(...)`).
7. Terminal states (`status == 'Dibatalkan'` on agendas, `outcome == 'Selesai Dilaporkan'` on journals) block further non-admin edits.
8. PII (user email, officer phone numbers) is strictly isolated to the verified owner (`request.auth.uid == userId`); no blanket `isSignedIn()` reads exist.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read**: Anonymous client attempts `get` on `/users/uid1/agendas/a1`.
2. **Unverified Email Spoof**: Authenticated user with `email: 'regbimpaslpbrebes@gmail.com'` and `email_verified: false` attempts to write an agenda.
3. **Cross-User PII Read**: Verified User B attempts `get` on `/users/uidA/holidayDuties/d1` (containing officer phone numbers).
4. **Cross-User List Scraping**: Verified User B attempts `list` on `/users/uidA/agendas`.
5. **Identity Spoofing on Create**: Verified User A writes `/users/uidA/agendas/a1` with `ownerId: 'uidB'`.
6. **Shadow / Ghost Field Injection**: Verified User A creates an agenda with an extra undeclared field `isAdmin: true`.
7. **ID Poisoning**: Verified User A writes to `/users/uidA/agendas/bad$id..with..spaces`.
8. **Resource Exhaustion (Oversized String)**: Verified User A creates an agenda with a 5000-character `title` (limit 300).
9. **Array Overflow**: Verified User A creates a holiday duty with 35 officers (limit 30) or an agenda with 20 documents (limit 15).
10. **Immutable Field Tampering**: Verified User A updates an agenda attempting to change `ownerId` or `createdAt`.
11. **Timestamp Forgery**: Verified User A creates an agenda with a forged past client `createdAt` instead of `request.time`.
12. **Terminal State Bypass**: Non-admin verified User A attempts to update an agenda whose existing `status` is `'Dibatalkan'` or a journal whose existing `outcome` is `'Selesai Dilaporkan'`.
