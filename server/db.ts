import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { 
  InsertUser, 
  users,
  equipamentos,
  setores,
  servicos,
  produtos,
  combustiveis,
  unidades,
  gruposDeEquipamentos,
  setorDeCusto,
  tiposDeProdutos
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

// Lazily create the drizzle instance with a connection pool for reliability.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Use a connection pool instead of a single connection for better reliability
      _pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

/** Reset the database connection (useful after ECONNRESET errors) */
export async function resetDbConnection() {
  if (_pool) {
    try {
      _pool.end();
    } catch (e) {
      // ignore
    }
  }
  _db = null;
  _pool = null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    // Removido: lógica que forçava perfil 'diretor' para o owner
    // O perfil do banco de dados agora é sempre respeitado

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error: any) {
    console.error("[Database] Failed to upsert user:", error);
    // If connection was reset, clear the cached connection so it reconnects
    if (error?.cause?.code === 'ECONNRESET' || error?.message?.includes('ECONNRESET')) {
      console.warn("[Database] Connection reset detected, will reconnect on next request");
      await resetDbConnection();
    }
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// CADASTROS BÁSICOS - HELPERS
// ============================================================================

export async function getAllEquipamentos() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(equipamentos);
}

export async function getAllSetores() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(setores);
}

export async function getAllServicos() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(servicos);
}

export async function getAllProdutos() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(produtos);
}

export async function getAllCombustiveis() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(combustiveis);
}

export async function getAllUnidades() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(unidades);
}

export async function getAllGruposDeEquipamentos() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(gruposDeEquipamentos);
}

export async function getAllSetoresDeCusto() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(setorDeCusto);
}

export async function getAllTiposDeProdutos() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tiposDeProdutos);
}
