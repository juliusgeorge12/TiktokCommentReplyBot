import { Knex } from 'knex';
import db from '../db/knex';

export interface BaseEntity {
  id?: number;
  created_at?: Date;
  updated_at?: Date | null;
  deleted_at?: Date | null;
}

export type Where<T> = Partial<Record<keyof T, any>>;

export interface PaginateOptions<T> {
  page?: number;
  limit?: number;
  where?: Where<T>;
  orderBy?: { column: keyof T | string; direction?: 'asc' | 'desc' };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export abstract class BaseModel<T extends BaseEntity> {
  static tableName: string;
  static idColumn:string = 'id';
  static softDelete = false;
  static timestamps = true;

  static qb(this: any): Knex.QueryBuilder {
    return db(this.tableName);
  }

  // ---------- Read ----------

  static async findAll<T extends BaseEntity>(this: any): Promise<T[]> {
    const qb = this.qb().select('*');
    if (this.softDelete) qb.whereNull('deleted_at');
    return qb;
  }

  static async findById<T extends BaseEntity>(this: any, id: any): Promise<T | undefined> {
    if (!this.idColumn) throw new Error(`${this.name} is missing static idColumn`);
    const qb = this.qb().where(this.idColumn, id).first();
    if (this.softDelete) qb.whereNull('deleted_at');
    return qb;
  }

  static async findOne<T extends BaseEntity>(this: any, where: Where<T> = {}): Promise<T | undefined> {
    const qb = this.qb().where(where).first();
    if (this.softDelete) qb.whereNull('deleted_at');
    return qb;
  }

  static async where<T extends BaseEntity>(this: any, where: Where<T>): Promise<T[]> {
    const qb = this.qb().where(where);
    if (this.softDelete) qb.whereNull('deleted_at');
    return qb;
  }

  static async paginate<T extends BaseEntity>(
    this: any,
    opts: PaginateOptions<T> = {}
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 10);
    const offset = (page - 1) * limit;

    let base = this.qb();
    if (opts.where) base = base.where(opts.where);
    if (this.softDelete) base = base.whereNull('deleted_at');

    const [{ count }] = await base.clone().count({ count: '*' });
    const total = Number(count);

    if (opts.orderBy) {
      base = base.orderBy(opts.orderBy.column as string, opts.orderBy.direction ?? 'asc');
    }

    const data = await base.offset(offset).limit(limit);
    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ---------- Write ----------

  static async create<T extends BaseEntity>(
    this: any,
    payload: Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
    trx?: Knex.Transaction
  ): Promise<number[]> {
    const now = new Date();
    const row: any = { ...payload };
    if (this.timestamps) {
      row.created_at = now;
      row.updated_at = now;
    }
    const query = (trx ?? db)(this.tableName).insert(row);
    return query;
  }

  static async bulkCreate<T extends BaseEntity>(
    this: any,
    payloads: Array<Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>,
    trx?: Knex.Transaction
  ): Promise<number[]> {
    const now = new Date();
    const rows = payloads.map((p) =>
      this.timestamps ? { ...p, created_at: now, updated_at: now } : p
    );
    return (trx ?? db)(this.tableName).insert(rows);
  }

  static async updateById<T extends BaseEntity>(
    this: any,
    id: any,
    payload: Partial<Omit<T, 'id' | 'created_at'>>,
    trx?: Knex.Transaction
  ): Promise<number> {
    const row: any = { ...payload };
    if (this.timestamps) row.updated_at = new Date();
    const qb = (trx ?? db)(this.tableName).where(this.idColumn, id).update(row);
    if (this.softDelete) qb.whereNull('deleted_at');
    return qb;
  }

  static async deleteById<T extends BaseEntity>(
    this: any,
    id: any,
    trx?: Knex.Transaction
  ): Promise<number> {
    if (this.softDelete) {
      return this.softDeleteById(id, trx);
    }
    return (trx ?? db)(this.tableName).where(this.idColumn, id).del();
  }

  static async softDeleteById<T extends BaseEntity>(
    this: any,
    id: any,
    trx?: Knex.Transaction
  ): Promise<number> {
    if (!this.softDelete) {
      throw new Error(`softDelete is disabled on ${this.tableName}`);
    }
    return (trx ?? db)(this.tableName)
      .where(this.idColumn, id)
      .update({ deleted_at: new Date(), updated_at: new Date() });
  }

  // ---------- Transactions ----------

  static async withTransaction<TRes>(
    fn: (trx: Knex.Transaction) => Promise<TRes>
  ): Promise<TRes> {
    return db.transaction(async (trx) => fn(trx));
  }

  // ---------- firstOrCreate ----------

  static async firstOrCreate<T extends BaseEntity>(
    this: any,
    payload: Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> = {} as any,
    trx?: Knex.Transaction
  ): Promise<T> {
    
    let record = await this.findOne();
    if (record) return record;

    const ids = await this.create(payload, trx);
    const id = Array.isArray(ids) ? ids[0] : ids;
    return this.findById(id);
  }
  static async count<T extends BaseEntity>(this: any, where: Where<T> = {}): Promise<number> {
    let qb = this.qb().count({ count: '*' });
    if (Object.keys(where).length) qb = qb.where(where);
    if (this.softDelete) qb = qb.whereNull('deleted_at');
    const [{ count }] = await qb;
    return Number(count);
  }
}
