# Security Specification — SUBAG TU PIM & PROTOKOL DITJENPAS

## 1. Data Invariants
1. Shared institutional unit data lives under `/workspaces/ditjenpas_utama` and its subcollections (`agendas`, `journals`, `holidayDuties`, `attachmentChunks`). Every operation requires an authenticated user with a verified email (`request.auth.token.email_verified == true`).
2. Subcollection documents under `/workspaces/{workspaceId}` cannot be read or written unless the parent `/workspaces/{workspaceId}` document exists (Master Gate) and `workspaceId == 'ditjenpas_utama'`.
3. Private user profile documents (`/users/{userId}`) and legacy per-user subcollections remain strictly isolated to the verified owner (`request.auth.uid == userId`) or owner-allowlisted `sharedEmails`.
4. All document IDs (`workspaceId`, `userId`, `agendaId`, `journalId`, `dutyId`, `chunkId`) must match `^[a-zA-Z0-9_\-]+$` and be 1..128 characters.
5. All strings and arrays have strict upper size bounds matching `firebase-blueprint.json`.
6. `ownerId`, `workspaceId`, and `createdAt` are immutable after creation; `updatedBy` must equal `request.auth.uid`; `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
7. No shadow/ghost fields are allowed on create (`hasOnly`) or update (`affectedKeys().hasOnly(...)`).
8. Terminal states (`status == 'Dibatalkan'` on agendas, `outcome == 'Selesai Dilaporkan'` on journals) block further non-admin edits.
9. All `allow list` rules strictly validate `resource.data` (`existing().workspaceId == workspaceId && existing().visibility == 'shared_unit'`) with zero `get()`/`exists()` calls.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read**: Anonymous client attempts `get` on `/workspaces/ditjenpas_utama/agendas/a1`.
2. **Unverified Email Spoof**: Authenticated user with `email: 'regbimpaslpbrebes@gmail.com'` and `email_verified: false` attempts to write an agenda.
3. **Cross-User Profile PII Read**: Verified User B attempts `get` on `/users/uidA` when not in `sharedEmails`.
4. **Arbitrary Workspace Injection**: Verified user attempts to create `/workspaces/rogue_ws`.
5. **Identity Spoofing on Create**: Verified User A writes `/workspaces/ditjenpas_utama/agendas/a1` with `ownerId: 'uidB'` or `updatedBy: 'uidB'`.
6. **Shadow / Ghost Field Injection**: Verified user creates an agenda with an extra undeclared field `isAdmin: true`.
7. **ID Poisoning**: Verified user writes to `/workspaces/ditjenpas_utama/agendas/bad$id..with..spaces`.
8. **Resource Exhaustion (Oversized String)**: Verified user creates an agenda with a 5000-character `title` (limit 300).
9. **Array Overflow**: Verified user creates a holiday duty with 35 officers (limit 30) or an agenda with 20 documents (limit 15).
10. **Immutable Field Tampering**: Verified user updates an agenda attempting to change `ownerId`, `workspaceId`, or `createdAt`.
11. **Timestamp Forgery**: Verified user creates an agenda with a forged past client `createdAt` instead of `request.time`.
12. **Terminal State Bypass**: Non-admin verified user attempts to update an agenda whose existing `status` is `'Dibatalkan'` or a journal whose existing `outcome` is `'Selesai Dilaporkan'`.
