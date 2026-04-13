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

## Correções
- [x] Corrigir erro "pageSize too_big" no Dashboard (substituir pageSize:9999 por queries de agregação)

## Funcionalidade: Replicar para Equipamentos Agregados (Parte Diária)
- [x] Criar procedure replicarParaAgregados no backend (tRPC router parteDiaria)
- [x] Implementar modal inline com busca, checkbox e seleção múltipla de equipamentos
- [x] Adicionar botão "Replicar" (azul) na tabela de lançamentos da Parte Diária
- [x] Validar que o horímetro é compartilhado (copiado do lançamento original)
- [x] Validação de duplicidade: equipamentos com lançamento existente na mesma data são ignorados

## PWA Mobile - Dashboard para Diretores
- [x] Configurar manifest.json com ícone PEDREIRA SOLAR e tema
- [x] Criar service worker para cache de assets e suporte a push
- [x] Adicionar meta tags mobile no index.html (viewport, apple-mobile-web-app, theme-color)
- [x] Gerar ícones PWA (192x192 e 512x512) e publicar no CDN
- [x] Criar schema de metas (tabelas metas_indicadores e push_subscriptions) no banco
- [x] Criar procedure backend para CRUD de metas e verificação de alertas (routers pwa/metas)
- [x] Criar rota /mobile com layout mobile-first
- [x] Implementar MobileDashboard com os mesmos KPIs do Dashboard web
- [x] Implementar filtros de período (Semana / Mês / Trimestre / Ano) para toque
- [x] Implementar controle de permissões no acesso mobile
- [x] Criar tela de configuração de metas por indicador (MetasAlertas.tsx)
- [x] Implementar sistema de notificações push (Web Push API + VAPID)
- [x] Implementar verificação automática de metas e disparo de alertas ao abrir o app
- [x] Adicionar links no DashboardLayout (Metas e Alertas, App Mobile)

## Correção: Menu Lateral
- [x] Corrigir sumiço dos botões "Usuários" e "Permissões" no menu lateral (regressão após adição dos itens PWA)

## Controle de Permissões - Auditoria e Proteção
- [x] Auditar todos os módulos registrados no ALL_MODULES do backend
- [x] Verificar todos os perfis existentes no banco de dados
- [x] Sincronizar permissões: garantir que todos os módulos existam para todos os perfis no banco
- [x] Proteger tela de Permissões para acesso exclusivo do perfil Consultoria (frontend + backend)
- [x] Testar que outros perfis não conseguem acessar a tela de Permissões

## Parte Diária - Campo Qtd Opcional
- [x] Tornar "Qtd (viagens/ciclos)" opcional no frontend com valor padrão 0
- [x] Ajustar validação Zod no backend para aceitar campo ausente/vazio como 0

## Dashboard - Card Estoque Mínimo de Peças
- [x] Criar procedure tRPC para buscar estoque atual de peças com campo estoqueMinimo
- [x] Implementar card no dashboard após card Combustível com lista de peças e alertas visuais

## Importação de Paradas e Dropdown com Pesquisa
- [x] Extrair dados de paradas_normais e paradas_mecanicas do SQL externo
- [x] Importar registros para tabela Outras Paradas com campo Observação identificando origem
- [x] Implementar campo de pesquisa nos dropdowns de Motivo (Tempo Parado Ligado e Desligado) na Parte Diária

## Importação de Operadores/Motoristas
- [x] Extrair nomes únicos de operador_ou_motorista cruzando com equipamentos para definir função
- [x] Importar para tabela Operadores/Motoristas do sistema SOLAR com campo Função correto

## Parte Diária - Campo Equipamento por Nome
- [x] Ajustar backend para retornar nome do equipamento na lista de seleção
- [x] Substituir dropdown de Equipamento por SearchableSelect exibindo Nome
- [x] Garantir que a exibição na listagem/tabela também mostre o Nome

## Produção Método Caminhões - Separar por Vigência de Pesagem
- [x] Ajustar backend para retornar viagens/peso agrupados por vigência de pesagem por equipamento
- [x] Atualizar frontend do card para exibir uma linha por período de capacidade diferente

## Produção de Perfuração - Filtro por Grupo de Equipamento
- [x] Filtrar producaoPerfuracao para incluir apenas equipamentos dos grupos PERFURATRIZES HIDRAULICAS e PERFURATRIZES PNEUMÁTICAS

## Parte Diária - Balanças Integradoras
- [x] Detectar grupo BALANÇAS INTEGRADORAS no formulário e exibir apenas campos: Data, Equipamento, Turno, Hora/Km Inicial, Hora/Km Final, Observações, Produção Balança
- [x] Calcular automaticamente Produção Balança = Hora/Km Final - Hora/Km Inicial no formulário
- [x] Criar procedure tRPC producaoBalancasIntegradoras com Leitura Inicial, Leitura Final, Produção Balança por equipamento e alerta de divergência
- [x] Criar card Produção Balança no dashboard após card Produção Método Caminhões
- [x] Exibir alerta de divergência quando soma das subtrações ≠ Leitura Final máx - Leitura Inicial mín

## Parte Diária - Correção Validação Balanças Integradoras
- [x] Remover validação de 24h para horímetro quando equipamento for do grupo BALANÇAS INTEGRADORAS (backend e frontend)

## Parte Diária - Balanças Integradoras: Desativar Todas as Validações
- [x] Remover validação de "pelo menos um serviço" para balanças integradoras
- [x] Ocultar card "Trocas de Peças de Desgaste" para balanças integradoras
- [x] Verificar e remover demais validações não aplicáveis (turno, capacidade, etc.)

## Tela de Login - Logomarca Solar Pedreira
- [x] Fazer upload da logomarca Solar Pedreira para CDN
- [x] Inserir logomarca ao lado da Dourado Gestão na tela de login

## Login - Eliminar tela intermediária branca
- [x] Remover tela branca "Faça login para continuar" e ir direto para /login
- [x] Garantir que logoff redireciona para /login (não para tela branca)

## Tela de Login - Alteração de Textos
- [x] Alterar "Sistema SOLAR" para "GEM - Sistema de Gestão Estratégica em Mineração" na tela de login
- [x] Alterar "DOURADO GESTÃO EM MINERAÇÃO" para "SOLAR PEDREIRA" (sem negrito) na tela de login
- [x] Garantir que as alterações funcionem no mobile também

## Auditoria de Segurança - Permissões
- [x] Corrigir fallback do hook usePermissions (somente leitura em vez de acesso total durante carregamento)
- [x] Auditar todos os módulos e identificar os sem controle de permissão nos botões criar/editar/excluir
- [x] Corrigir módulos sem controle de permissão identificados

## Dashboard Mobile - Sincronização de Cards
- [x] Auditar cards do dashboard web vs mobile
- [x] Adicionar cards faltantes no MobileDashboard.tsx

## Dashboard - Modificações Solicitadas (Abril 2026)
- [x] Desabilitar card "Produção (m³)" no mobile (KPI verde)
- [x] Desabilitar card "Manutenções" no mobile (KPI roxo)
- [x] Filtrar "Produção dos Motoristas" pelo grupo CAMINHÕES INTERNOS (backend + web + mobile)
- [x] Filtrar "Produção por Equipamento" pelo grupo CAMINHÕES INTERNOS (backend + web + mobile)
- [x] Implementar exportação Excel/PDF/WhatsApp para todos os cards do dashboard web
- [x] Implementar exportação Excel/PDF/WhatsApp para todos os cards do dashboard mobile
- [x] Atualizar CARDS_DISPONIVEIS em Destinatários WhatsApp com todos os novos cards

## Dashboard Web - Botão de Envio Consolidado WhatsApp
- [x] Criar modal de envio com seleção de destinatários cadastrados e cards a enviar
- [x] Adicionar botão "Relatório WhatsApp" no topo do dashboard web
- [x] Montar mensagem consolidada com dados de todos os cards selecionados por destinatário

## WhatsAppReportModal - Correções
- [x] Corrigir erro "button cannot contain nested button" nos checkboxes/botão Nenhum
- [x] Enriquecer mensagem WhatsApp com detalhes completos de todos os cards (viagens, serviços, etc.)

## Card Produção Método Caminhões - Alinhamento
- [x] Corrigir alinhamento vertical das colunas Viagens, Peso (t), Produção (t) e % no web e mobile

## Card Produção Método Caminhões - Nome dos Caminhões Mobile
- [x] Mostrar nome completo dos caminhões no mobile (sem truncar)

## Sistema de Checklist de Rotinas Diárias
- [x] Schema DB: tabelas rotinas e statusRotinaDiario
- [x] Procedures tRPC: CRUD rotinas + marcar/consultar status diário
- [x] Tela de administração de rotinas (consultoria/admin)
- [x] Card "Status dos Lançamentos" no dashboard web (substituindo Equipamentos Ativos)
- [x] Card "Status dos Lançamentos" no dashboard mobile (substituindo Equipamentos Ativos)
- [x] Controle de permissão: somente perfil Usuário edita status
- [x] Adicionar rota /rotinas no App.tsx

## Módulo Manutenção - Data Fim e Reorganização de Layout
- [x] Backend: atualizar procedures create/update para aceitar dataFim como data independente de dataInicio
- [x] Frontend: renomear campo "Data" para "Data Início" e adicionar campo "Data Fim" no formulário
- [x] Frontend: reorganizar layout do formulário (Data Início + Hora Início na mesma linha, Data Fim + Hora Fim na mesma linha)
- [x] Frontend: calcular horas paradas automaticamente a partir de Data Início + Hora Início e Data Fim + Hora Fim (suportando múltiplos dias)
- [x] Frontend: atualizar tabela de listagem com colunas Data Início, Hora Início, Data Fim, Hora Fim
- [x] Frontend: atualizar handleEdit para popular dataFim separada de dataInicio

## Correção PWA - Erro de Sessão Expirada (Android/iOS)
- [x] Investigar service worker e estratégia de cache atual
- [x] Atualizar service worker para network-first nas chamadas de API (não servir cache stale)
- [x] Implementar interceptor global de erro 401/sessão expirada com redirect automático para login
- [x] Adicionar listener de visibilitychange para verificar sessão ao reabrir o app
- [x] ErrorBoundary inteligente: detectar sessão expirada e redirecionar automaticamente (sem mostrar stack trace)
- [x] Service worker v5: interceptar respostas 401 da API e notificar o app via postMessage SESSION_EXPIRED
