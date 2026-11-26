/**
 * Security Rules Verification Specification for SUBAG TU PIM & PROTOKOL DITJENPAS.
 * Verifies the "Dirty Dozen" adversarial payloads against firestore.rules.
 *
 * Run with Firebase Emulator Suite & @firebase/rules-unit-testing when testing locally.
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Read',
    path: '/users/user-a/agendas/agenda-1',
    operation: 'get',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    path: '/users/user-a/agendas/agenda-1',
    operation: 'create',
    auth: { uid: 'user-a', email: 'regbimpaslpbrebes@gmail.com', email_verified: false },
    payload: { id: 'agenda-1', ownerId: 'user-a', title: 'Spoofed' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 3,
    name: 'Cross-User PII Read (Holiday Duty Phones)',
    path: '/users/user-a/holidayDuties/duty-1',
    operation: 'get',
    auth: { uid: 'user-b', email: 'other@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Cross-User List Scraping',
    path: '/users/user-a/agendas',
    operation: 'list',
    auth: { uid: 'user-b', email: 'other@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Identity Spoofing on Create',
    path: '/users/user-a/agendas/agenda-1',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: { id: 'agenda-1', ownerId: 'user-b', title: 'Spoofed Owner' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'Shadow / Ghost Field Injection',
    path: '/users/user-a/agendas/agenda-1',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: { id: 'agenda-1', ownerId: 'user-a', title: 'Test', isVerified: true, role: 'admin' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 7,
    name: 'ID Poisoning',
    path: '/users/user-a/agendas/bad$id..invalid',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: { id: 'bad$id..invalid', ownerId: 'user-a', title: 'Poisoned ID' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 8,
    name: 'Oversized Title String',
    path: '/users/user-a/agendas/agenda-1',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: { id: 'agenda-1', ownerId: 'user-a', title: 'A'.repeat(301) },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'Array Overflow (>30 officers)',
    path: '/users/user-a/holidayDuties/duty-1',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: {
      id: 'duty-1',
      ownerId: 'user-a',
      officers: Array.from({ length: 31 }, (_, i) => ({ id: `o-${i}`, name: 'N', role: 'R', phone: '' }))
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Immutable Field Tampering (createdAt / ownerId)',
    path: '/users/user-a/agendas/agenda-1',
    operation: 'update',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: { ownerId: 'user-b', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Client Timestamp Forgery',
    path: '/users/user-a/journals/j-1',
    operation: 'create',
    auth: { uid: 'user-a', email: 'a@example.com', email_verified: true },
    payload: { id: 'j-1', ownerId: 'user-a', createdAt: '1999-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Terminal State Bypass (Non-Admin Editing Dibatalkan Agenda)',
    path: '/users/user-a/agendas/agenda-cancelled',
    operation: 'update',
    auth: { uid: 'user-a', email: 'nonadmin@example.com', email_verified: true },
    payload: { status: 'Terjadwal' },
    expected: 'PERMISSION_DENIED'
  }
];
