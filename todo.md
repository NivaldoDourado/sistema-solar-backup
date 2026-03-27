# Sistema SOLAR - PEDREIRA SOLAR - TODO

## Banco de Dados
- [ ] Migrar schema completo (drizzle/schema.ts) com todas as tabelas
- [ ] Migrar relações (drizzle/relations.ts)
- [ ] Aplicar migrações (pnpm db:push)

## Backend - Servidor
- [ ] Migrar sistema de autenticação local (bcrypt + perfis)
- [ ] Migrar server/db.ts com todas as queries
- [ ] Migrar server/permissions.ts
- [ ] Migrar server/auth_router.ts
- [ ] Migrar server/routers.ts (todos os routers tRPC)
- [ ] Migrar server/usuarios_router.ts
- [ ] Migrar server/permissoes_router.ts
- [ ] Migrar server/vendas_router.ts
- [ ] Migrar server/tempos_descarga_router.ts
- [ ] Migrar shared/const.ts e shared/types.ts

## Frontend - Componentes
- [ ] Migrar DashboardLayout personalizado com sidebar
- [ ] Migrar client/src/const.ts
- [ ] Migrar client/src/hooks/usePermissions.ts
- [ ] Migrar client/src/lib/export-utils.ts
- [ ] Migrar NotificationBell component

## Frontend - Páginas
- [ ] Migrar Login.tsx
- [ ] Migrar Home.tsx (Dashboard com KPIs)
- [ ] Migrar ParteDiaria.tsx
- [ ] Migrar Abastecimento.tsx
- [ ] Migrar Producao.tsx
- [ ] Migrar Custos.tsx
- [ ] Migrar Manutencao.tsx
- [ ] Migrar MedicaoPilhas.tsx
- [ ] Migrar PecasDesgaste.tsx
- [ ] Migrar Vendas.tsx
- [ ] Migrar Clientes.tsx
- [ ] Migrar Equipamentos.tsx
- [ ] Migrar Cadastros.tsx
- [ ] Migrar Usuarios.tsx
- [ ] Migrar Permissoes.tsx
- [ ] Migrar MeuPerfil.tsx
- [ ] Migrar TrocarSenha.tsx
- [ ] Migrar páginas auxiliares (Setores, Servicos, Produtos, Unidades, etc.)
- [ ] Migrar App.tsx com todas as rotas

## Personalização PEDREIRA SOLAR
- [ ] Atualizar nome da empresa para "PEDREIRA SOLAR"
- [ ] Atualizar cores e tema visual
- [ ] Criar script de criação de admin (create_admin.mjs)
- [ ] Criar repositório GitHub privado

## Testes
- [ ] Migrar testes existentes do repositório base
- [ ] Validar sistema completo
