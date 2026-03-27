/**
 * Script para criar o usuário administrador inicial do Sistema SOLAR - PEDREIRA SOLAR
 * Execute com: node create_admin.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
// Carregar variáveis de ambiente
import { config } from 'dotenv';
config();
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}
// Schema inline para evitar problemas de importação
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from 'drizzle-orm/mysql-core';
const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "diretor", "gerente", "consultoria", "coordenador", "usuario", "controle", "operador"]).default("usuario").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  mustChangePassword: mysqlEnum("mustChangePassword", ["sim", "nao"]).default("nao").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
async function createAdmin() {
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);
  const adminEmail = 'admin@solar.com.br';
  const adminPassword = 'Admin@2024';
  const adminOpenId = 'local-admin-solar';
  // Verificar se já existe
  const existing = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (existing.length > 0) {
    console.log('✅ Usuário admin já existe:', adminEmail);
    await connection.end();
    return;
  }
  // Criar hash da senha
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  // Inserir admin
  await db.insert(users).values({
    openId: adminOpenId,
    name: 'Administrador SOLAR',
    email: adminEmail,
    loginMethod: 'local',
    role: 'consultoria',
    passwordHash,
    mustChangePassword: 'nao',
    lastSignedIn: new Date(),
  });
  console.log('✅ Usuário admin criado com sucesso!');
  console.log('   Email:', adminEmail);
  console.log('   Senha:', adminPassword);
  console.log('   Perfil: consultoria');
  console.log('');
  console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
  await connection.end();
}
createAdmin().catch(err => {
  console.error('❌ Erro ao criar admin:', err);
  process.exit(1);
});
