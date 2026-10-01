/**
 * Canonical (database-agnostic) row serialization + hashing for desktop sync.
 *
 * THIS FILE IS SHARED VERBATIM between the online app and the desktop app.
 * MySQL (online) and SQLite (desktop) return the same Prisma types, so a row
 * serialized here hashes identically on both sides.
 */
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { ROOT_BY_MODEL, CHILD_TO_ROOT, lowerFirst, type RootSpec, type WireAggregate } from './registry';

interface FieldInfo {
  name: string;
  type: string;
  isEnum: boolean;
}

const fieldCache = new Map<string, FieldInfo[]>();

/** Scalar + enum columns of a model, from the generated Prisma DMMF. */
export function scalarFields(model: string): FieldInfo[] {
  const cached = fieldCache.get(model);
  if (cached) return cached;
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
  if (!m) throw new Error(`Unknown model ${model}`);
  const fields = m.fields
    .filter((f) => (f.kind === 'scalar' || f.kind === 'enum') && !f.isList)
    .map((f) => ({ name: f.name, type: f.type, isEnum: f.kind === 'enum' }));
  fieldCache.set(model, fields);
  return fields;
}

function normDecimal(v: unknown): string {
  // Decimal.js normalises trailing zeros: "1.50" -> "1.5"; SQLite REAL 1.5 -> "1.5".
  return new Prisma.Decimal(v as Prisma.Decimal.Value).toString();
}

/** Prisma row -> plain JSON object (Decimal -> string, Date -> ISO string). */
export function serializeRow(model: string, row: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of scalarFields(model)) {
    const v = row[f.name];
    if (v === undefined) continue;
    if (v === null) out[f.name] = null;
    else if (f.type === 'DateTime') out[f.name] = (v instanceof Date ? v : new Date(v)).toISOString();
    else if (f.type === 'Decimal') out[f.name] = normDecimal(v);
    else if (f.type === 'BigInt') out[f.name] = String(v);
    else if (f.type === 'Int') out[f.name] = Number(v);
    else if (f.type === 'Boolean') out[f.name] = Boolean(v);
    else if (f.type === 'Bytes') out[f.name] = Buffer.from(v).toString('base64');
    else out[f.name] = v;
  }
  return out;
}

/** Plain JSON -> Prisma create/update input (only known scalar columns are kept). */
export function deserializeRow(model: string, data: Record<string, unknown>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of scalarFields(model)) {
    if (!(f.name in data)) continue;
    const v = data[f.name];
    if (v === null || v === undefined) out[f.name] = null;
    else if (f.type === 'DateTime') out[f.name] = new Date(String(v));
    else if (f.type === 'Decimal') out[f.name] = String(v);
    else if (f.type === 'BigInt') out[f.name] = BigInt(String(v));
    else if (f.type === 'Int') out[f.name] = Math.trunc(Number(v));
    else if (f.type === 'Boolean') out[f.name] = v === true || v === 1 || v === '1' || v === 'true';
    else if (f.type === 'Bytes') out[f.name] = Buffer.from(String(v), 'base64');
    else out[f.name] = String(v);
  }
  return out;
}

function stableStringify(obj: Record<string, unknown>, exclude: Set<string>): string {
  const keys = Object.keys(obj).filter((k) => !exclude.has(k)).sort();
  return JSON.stringify(keys.map((k) => [k, obj[k] ?? null]));
}

const ALWAYS_EXCLUDED = ['updatedAt'];

export function hashAggregate(agg: WireAggregate): string {
  if (!agg.data) return 'deleted';
  const spec = ROOT_BY_MODEL[agg.model];
  const exclude = new Set([...ALWAYS_EXCLUDED, ...(spec?.localOnlyFields || []), ...(spec?.userRefFields || [])]);
  const h = createHash('sha256');
  h.update(agg.model + '|' + stableStringify(agg.data, exclude));
  for (const c of spec?.children || []) {
    const rows = [...(agg.children?.[c.relation] || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    h.update('|' + c.relation + ':');
    for (const r of rows) h.update(stableStringify(r, new Set(ALWAYS_EXCLUDED)) + ';');
  }
  return h.digest('hex');
}

/** Prisma `include` object that loads every owned child of a root. */
export function childInclude(spec: RootSpec): Record<string, true> | undefined {
  if (!spec.children?.length) return undefined;
  return Object.fromEntries(spec.children.map((c) => [c.relation, true]));
}

/** Build wire aggregates from Prisma rows loaded with `childInclude(spec)`. */
export function toAggregate(spec: RootSpec, row: Record<string, any>): WireAggregate {
  const agg: WireAggregate = { model: spec.model, id: row.id, data: serializeRow(spec.model, row) };
  if (spec.children?.length) {
    agg.children = {};
    for (const c of spec.children) {
      const v = row[c.relation];
      const list = v == null ? [] : Array.isArray(v) ? v : [v];
      agg.children[c.relation] = list.map((r: any) => serializeRow(c.model, r));
    }
  }
  agg.hash = hashAggregate(agg);
  return agg;
}

/** Loads full aggregates for the given root ids (missing ids are returned as deletes). */
export async function loadAggregates(client: any, model: string, ids: string[]): Promise<WireAggregate[]> {
  const spec = ROOT_BY_MODEL[model];
  if (!spec) throw new Error(`Model ${model} is not syncable`);
  const out: WireAggregate[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const rows: any[] = await client[lowerFirst(model)].findMany({
      where: { id: { in: chunk } },
      include: childInclude(spec),
    });
    const found = new Map(rows.map((r) => [r.id, r]));
    for (const id of chunk) {
      const r = found.get(id);
      out.push(r ? toAggregate(spec, r) : { model, id, data: null, hash: 'deleted' });
    }
  }
  return out;
}

/** Bucket key used by hash reconciliation (first two hex chars of the uuid). */
export function bucketOf(id: string): string {
  return id.replace(/-/g, '').slice(0, 2).toLowerCase();
}

export function bucketHashes(entries: { id: string; hash: string }[]): Record<string, string> {
  const groups = new Map<string, { id: string; hash: string }[]>();
  for (const e of entries) {
    const b = bucketOf(e.id);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b)!.push(e);
  }
  const out: Record<string, string> = {};
  for (const [b, list] of groups) {
    list.sort((a, c) => a.id.localeCompare(c.id));
    out[b] = createHash('sha256').update(list.map((e) => `${e.id}:${e.hash}`).join(',')).digest('hex');
  }
  return out;
}

/** Relation field name on `model` whose FK column is `fkField`. */
export function relationForFk(model: string, fkField: string): string {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
  const rel = m?.fields.find((f) => f.kind === 'object' && (f.relationFromFields || []).includes(fkField));
  if (!rel) throw new Error(`No relation on ${model} for ${fkField}`);
  return rel.name;
}

/** Prisma `where` selecting every row of a root model owned by `companyId`. */
export function companyWhere(model: string, companyId: string): Record<string, any> {
  const spec = ROOT_BY_MODEL[model];
  if (!spec) throw new Error(`Model ${model} is not syncable`);
  if (spec.owner.kind === 'self') return { id: companyId };
  if (spec.owner.kind === 'company') return { companyId };
  return { [relationForFk(model, spec.owner.field)]: companyWhere(spec.owner.model, companyId) };
}

/** Resolve which company a (deserialized) root row belongs to, by reading parents through `client`. */
export async function resolveCompanyId(client: any, model: string, data: Record<string, any>): Promise<string | null> {
  const spec = ROOT_BY_MODEL[model];
  if (!spec) return null;
  if (spec.owner.kind === 'self') return data.id ?? null;
  if (spec.owner.kind === 'company') return data.companyId ?? null;
  const parentId = data[spec.owner.field];
  if (!parentId) return null;
  const parent = await client[lowerFirst(spec.owner.model)].findUnique({ where: { id: parentId } });
  if (!parent) return null;
  return resolveCompanyId(client, spec.owner.model, parent);
}

export { CHILD_TO_ROOT };
