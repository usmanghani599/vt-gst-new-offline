/**
 * Desktop <-> Online sync registry.
 *
 * THIS FILE IS SHARED VERBATIM between the online app (vtgstnew) and the
 * desktop app (vt-gst-new-offline). Keep both copies identical.
 *
 * Sync works on "aggregate roots". A root row plus its owned children is
 * always transferred and applied as one unit, so nested writes on either side
 * are never half-synced. Roots are listed in dependency (FK) order; deletes
 * are applied in reverse order.
 */

export type OwnerSpec =
  /** Row id IS the company id (Company). */
  | { kind: 'self' }
  /** Row carries a `companyId` column. */
  | { kind: 'company' }
  /** Row belongs to a parent root; company is resolved through it. */
  | { kind: 'via'; field: string; model: string };

export interface ChildSpec {
  /** Relation field name on the root model (as in schema.prisma). */
  relation: string;
  /** Prisma model name of the child. */
  model: string;
  /** FK column on the child pointing at the root id. */
  fk: string;
  /**
   * Deferred children are applied after every root of a batch, because they
   * can reference other roots of the same batch (e.g. document references).
   */
  deferred?: boolean;
}

export interface RootSpec {
  model: string;
  owner: OwnerSpec;
  /**
   * Incremental pull cursor. `null` means the model is small and the full set
   * is sent on every pull (this also propagates deletes immediately).
   */
  cursor: 'updatedAt' | 'createdAt' | null;
  /** 'push' = desktop -> online only (never pulled). */
  direction: 'both' | 'push';
  children?: ChildSpec[];
  /** Fields that legitimately differ per side; excluded from hashing and overridden on apply. */
  localOnlyFields?: string[];
  /** FK fields pointing to users. Users are never synced, so unknown ids are nulled on apply. */
  userRefFields?: string[];
}

export const SYNC_ROOTS: RootSpec[] = [
  { model: 'Company', owner: { kind: 'self' }, cursor: 'updatedAt', direction: 'both', localOnlyFields: ['accountId'] },
  {
    model: 'FinancialYear',
    owner: { kind: 'company' },
    cursor: null,
    direction: 'both',
    children: [{ relation: 'closings', model: 'FinancialYearClosing', fk: 'financialYearId' }],
    localOnlyFields: ['closedByUserId'],
  },
  // Numbering series are device specific. Only legacy (pre-link) series are uploaded.
  { model: 'DocumentSeries', owner: { kind: 'company' }, cursor: null, direction: 'push' },
  { model: 'PartyGroup', owner: { kind: 'company' }, cursor: null, direction: 'both' },
  { model: 'Party', owner: { kind: 'company' }, cursor: 'updatedAt', direction: 'both' },
  { model: 'LoyaltyAccount', owner: { kind: 'via', field: 'partyId', model: 'Party' }, cursor: 'updatedAt', direction: 'both' },
  { model: 'Unit', owner: { kind: 'company' }, cursor: null, direction: 'both' },
  { model: 'ItemCategory', owner: { kind: 'company' }, cursor: null, direction: 'both' },
  { model: 'Item', owner: { kind: 'company' }, cursor: 'updatedAt', direction: 'both' },
  { model: 'BankAccount', owner: { kind: 'company' }, cursor: null, direction: 'both' },
  { model: 'Salesman', owner: { kind: 'company' }, cursor: null, direction: 'both', userRefFields: ['userId'] },
  {
    model: 'Document',
    owner: { kind: 'company' },
    cursor: 'updatedAt',
    direction: 'both',
    userRefFields: ['createdByUserId'],
    children: [
      { relation: 'items', model: 'DocumentItem', fk: 'documentId' },
      { relation: 'taxes', model: 'DocumentTax', fk: 'documentId' },
      { relation: 'transport', model: 'DocumentTransport', fk: 'documentId' },
      { relation: 'exportInfo', model: 'DocumentExport', fk: 'documentId' },
      { relation: 'sourceRefs', model: 'DocumentReference', fk: 'documentId', deferred: true },
    ],
  },
  {
    model: 'Payment',
    owner: { kind: 'company' },
    cursor: 'createdAt',
    direction: 'both',
    userRefFields: ['createdByUserId'],
    children: [{ relation: 'allocations', model: 'PaymentAllocation', fk: 'paymentId' }],
  },
  { model: 'LedgerEntry', owner: { kind: 'company' }, cursor: 'createdAt', direction: 'both' },
  { model: 'StockMovement', owner: { kind: 'company' }, cursor: 'createdAt', direction: 'both' },
  { model: 'SalesmanPointTransaction', owner: { kind: 'via', field: 'salesmanId', model: 'Salesman' }, cursor: 'createdAt', direction: 'both' },
  { model: 'LoyaltyTransaction', owner: { kind: 'via', field: 'loyaltyAccountId', model: 'LoyaltyAccount' }, cursor: 'createdAt', direction: 'both' },
];

/**
 * Global reference data owned by the online platform. Downloaded to the
 * desktop at activation so foreign keys (tax rates, states, system units)
 * carry the same ids on both sides. Never pushed.
 */
export const REFERENCE_MODELS = [
  'Country',
  'State',
  'TaxSystem',
  'TaxType',
  'TaxRate',
  'TaxRateComponent',
  'Feature',
] as const;

export const ROOT_BY_MODEL: Record<string, RootSpec> = Object.fromEntries(SYNC_ROOTS.map((r) => [r.model, r]));

/** child model -> { root, spec } */
export const CHILD_TO_ROOT: Record<string, { root: RootSpec; child: ChildSpec }> = Object.fromEntries(
  SYNC_ROOTS.flatMap((r) => (r.children || []).map((c) => [c.model, { root: r, child: c }]))
);

export function rootOrder(model: string): number {
  return SYNC_ROOTS.findIndex((r) => r.model === model);
}

export function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Shape of one aggregate on the wire. */
export interface WireAggregate {
  model: string;
  id: string;
  /** null => row no longer exists (delete). */
  data: Record<string, unknown> | null;
  children?: Record<string, Record<string, unknown>[]>;
  /** ISO time the change happened on the sending side (push only). */
  changedAt?: string;
  hash?: string;
}

export const SYNC_PROTOCOL_VERSION = 1;
