import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import {
  CompiledQuery,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type DatabaseConnection,
  type Driver,
  type KyselyDialect,
  type QueryResult,
} from '@finora/core';

/** Serialises access: the plugin has a single native connection per database. */
class Mutex {
  private tail = Promise.resolve();
  lock(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const acquired = this.tail.then(() => release);
    this.tail = this.tail.then(() => next);
    return acquired;
  }
}

const READ_STATEMENT = /^\s*(select|with|pragma|explain)\b/i;

class CapacitorConnection implements DatabaseConnection {
  constructor(private readonly db: SQLiteDBConnection) {}

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const params = [...compiled.parameters];
    if (compiled.query.kind === 'SelectQueryNode' || READ_STATEMENT.test(compiled.sql)) {
      const result = await this.db.query(compiled.sql, params);
      return { rows: (result.values ?? []) as R[] };
    }
    // transaction=false: Kysely issues BEGIN/COMMIT itself
    const result = await this.db.run(compiled.sql, params, false);
    const changes = result.changes?.changes ?? 0;
    const lastId = result.changes?.lastId;
    return {
      rows: [],
      numAffectedRows: BigInt(changes),
      ...(lastId !== undefined && lastId !== null ? { insertId: BigInt(lastId) } : {}),
    };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('Streaming queries are not supported on mobile');
  }
}

class CapacitorDriver implements Driver {
  private readonly mutex = new Mutex();
  private readonly connection: CapacitorConnection;
  private release?: () => void;

  constructor(private readonly db: SQLiteDBConnection) {
    this.connection = new CapacitorConnection(db);
  }

  async init() {}

  async acquireConnection(): Promise<DatabaseConnection> {
    this.release = await this.mutex.lock();
    return this.connection;
  }

  async beginTransaction(connection: DatabaseConnection) {
    await connection.executeQuery(CompiledQuery.raw('BEGIN'));
  }

  async commitTransaction(connection: DatabaseConnection) {
    await connection.executeQuery(CompiledQuery.raw('COMMIT'));
  }

  async rollbackTransaction(connection: DatabaseConnection) {
    await connection.executeQuery(CompiledQuery.raw('ROLLBACK'));
  }

  async releaseConnection() {
    const release = this.release;
    this.release = undefined;
    release?.();
  }

  async destroy() {
    await this.db.close();
  }
}

/** Kysely dialect backed by @capacitor-community/sqlite (SQLCipher on Android/iOS). */
export function capacitorSqliteDialect(db: SQLiteDBConnection): KyselyDialect {
  return {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new CapacitorDriver(db),
    createIntrospector: (kysely) => new SqliteIntrospector(kysely),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  };
}
