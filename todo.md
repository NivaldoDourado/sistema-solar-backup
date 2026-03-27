# Sistema SOLAR - PEDREIRA SOLAR - TODO

## Banco de Dados
- [x] Migrar schema completo (drizzle/schema.ts) com todas as tabelas
- [x] Migrar relações (drizzle/relations.ts)
- [x] Aplicar migrações (pnpm db:push)

## Backend - Servidor
- [x] Migrar sistema de autenticação local (bcrypt + perfis)
- [x] Migrar server/db.ts com todas as queries
- [x] Migrar server/permissions.ts
- [x] Migrar server/auth_router.ts
- [x] Migrar server/routers.ts (todos os routers tRPC)
- [x] Migrar server/usuarios_router.ts
- [x] Migrar server/permissoes_router.ts
- [x] Migrar server/vendas_router.ts
- [x] Migrar server/tempos_descarga_router.ts
- [x] Migrar shared/const.ts e shared/types.ts

## Frontend - Componentes
- [x] Migrar DashboardLayout personalizado com sidebar
- [x] Migrar client/src/const.ts
- [x] Migrar client/src/hooks/usePermissions.ts
- [x] Migrar client/src/lib/export-utils.ts
- [x] Migrar NotificationBell component

## Frontend - Páginas
- [x] Migrar Login.tsx
- [x] Migrar Home.tsx (Dashboard com KPIs)
- [x] Migrar ParteDiaria.tsx
- [x] Migrar Abastecimento.tsx
- [x] Migrar Producao.tsx
- [x] Migrar Custos.tsx
- [x] Migrar Manutencao.tsx
- [x] Migrar MedicaoPilhas.tsx
- [x] Migrar PecasDesgaste.tsx
- [x] Migrar Vendas.tsx
- [x] Migrar Clientes.tsx
- [x] Migrar Equipamentos.tsx
- [x] Migrar Cadastros.tsx
- [x] Migrar Usuarios.tsx
- [x] Migrar Permissoes.tsx
- [x] Migrar MeuPerfil.tsx
- [x] Migrar TrocarSenha.tsx
- [x] Migrar páginas auxiliares (Setores, Servicos, Produtos, Unidades, etc.)
- [x] Migrar App.tsx com todas as rotas

## Personalização PEDREIRA SOLAR
- [x] Atualizar nome da empresa para "PEDREIRA SOLAR"
- [x] Atualizar cores e tema visual
- [x] Criar script de criação de admin (create_admin.mjs)
- [x] Criar repositório GitHub privado

## Testes
- [x] Migrar testes existentes do repositório base
- [x] Validar sistema completo (86 testes passando)

## Performance - Paginação e Índices
- [x] Criar 23 índices no banco para todas as tabelas operacionais
- [x] Implementar paginação server-side nos routers tRPC (abastecimento, producao, custos, manutencao, medicaoPilhas)
- [x] Implementar paginação + filtro de período no frontend (Abastecimento)
- [x] Implementar paginação + filtro de período no frontend (Produção)
- [x] Implementar paginação + filtro de período no frontend (Medição de Pilhas)
- [x] Implementar paginação + filtro de período no frontend (Manutenção)
- [x] Implementar paginação + filtro de período no frontend (Custos)
- [x] Implementar paginação + filtro de período no frontend (Dashboard adaptado para queries paginadas)
- [ ] Implementar paginação + filtro de período no frontend (Parte Diária) [futuro]
- [ ] Implementar paginação + filtro de período no frontend (Vendas) [futuro]
- [ ] Implementar paginação + filtro de período no frontend (Equipamentos) [futuro]
- [ ] Implementar paginação + filtro de período no frontend (Peças de Desgaste) [futuro]
