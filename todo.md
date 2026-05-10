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

## Skeleton Loading nos Cards do Dashboard
- [ ] Criar componente CardSkeleton reutilizável com variantes (simples, tabela, gráfico)
- [ ] Aplicar skeleton nos cards do dashboard desktop (Home.tsx): Custos, Combustível, Produção Caminhões, Produção Último Dia, Motoristas, Setor, Serviço, Equipamento, Vendas, Perfuração, Balanças
- [ ] Aplicar skeleton nos cards do dashboard mobile (MobileDashboard.tsx)

## Melhorias Sprint Atual
- [ ] Manutenção: remover filtro pré-definido de mês (manter campos de filtro, apenas sem valor inicial)
- [ ] Manutenção: limitar listagem a 30 registros mais recentes por padrão
- [ ] Revisões Preventivas: adicionar coluna "Hor/Km Atual" com valor do campo Hora/Km Final da última parte diária de cada equipamento
- [ ] Backend: criar query para buscar último Hora/Km Final por equipamento na procedure de revisões preventivas

## Card Horas Trabalhadas
- [x] Backend: procedure horasTrabalhadas agregando Hora/Km Trabalhados por equipamento no período
- [x] Desktop: card Horas Trabalhadas após Produção por Equipamento em Home.tsx
- [x] Mobile: card Horas Trabalhadas após Produção por Equipamento em MobileDashboard.tsx
- [x] Export PDF/Excel com colunas Equipamento e Horas/Km Trabalhados

## Card Km Rodado
- [ ] Backend: procedure kmRodado filtrando apenas grupo CAMINHÕES DA ENTREGA DE MATERIAL
- [ ] Desktop: card Km Rodado após Horas Trabalhadas em Home.tsx
- [ ] Mobile: card Km Rodado após Horas Trabalhadas em MobileDashboard.tsx
- [ ] Export PDF/Excel com colunas Equipamento e Km Rodado

## Resumo de Vendas por Produto (Granulometria)
- [x] Backend: procedure vendasResumoPorProduto (quantidade, valor total, preço médio por produto no período)
- [x] Frontend: card "Vendas por Produto (Granulometria)" no módulo de Vendas (Vendas.tsx) com filtro de período
- [ ] Frontend: card "Vendas por Produto" no dashboard desktop (Home.tsx)
- [ ] Frontend: card "Vendas por Produto" no dashboard mobile (MobileDashboard.tsx)
- [ ] Export PDF/Excel do card Vendas por Produto

## Módulo de Custos — Fase 2 (Lançamentos e Relatórios)
- [x] Backend: tabela lancamento_custo no schema e migração aplicada
- [x] Backend: router lancamentoCusto (CRUD de lançamentos por período)
- [x] Frontend: tela LancamentoCusto (/lancamento-custo) — planilha de contas e valores por período
- [x] Frontend: tela ApuracaoCusto (/apuracao-custo) — relatório de custo por tonelada por classificação
- [x] Frontend: tela ImportacaoCusto (/importacao-custo) — importação direta da planilha CUSTOSOLAR (.xlsx)
- [x] Backend: rota REST /api/importacao-custo com leitura da aba MEMGERAL e mapeamento automático de contas
- [x] Menu lateral e página de Cadastros atualizados com novos itens de Custos
- [x] Testar importação com planilha real de março/26 e validar mapeamento de contas (16/16 mapeados com 100%)
- [x] Criar contas novas no banco: 'Frota/Man.Pat./Seg./Out.' e 'Comissão de Vendas'
- [x] Implementar tabela de aliases no importador para mapear nomes diferentes entre planilha e sistema
- [ ] Importar planilhas de janeiro/26 e fevereiro/26 após validar modelo com março/26

## Apuração de Custo — Reestruturação (Mai/2026)

- [x] Backend: buscar produção do módulo Produção (soma das quantidades do período) para usar como base do Custo/t (Produção)
- [x] Backend: separar contas em dois grupos — Custo Variável (divisor=produção, ÷ produção) e Despesa Variável (divisor=vendas, ÷ vendas)
- [x] Backend: calcular Custo Médio = Custo/t (Produção) + Custo/t (Vendas)
- [x] Frontend: exibir card "Custo Médio" na Apuração de Custo
- [x] Frontend: exibir subtotais corretos por grupo (total R$, total ÷ base, % de cada conta)
- [ ] LEMBRETE: Para Abril/26 em diante, produção virá do card "Produção Método Caminhões" (link a fazer)
- [ ] Despesas Indiretas: cadastro, divisões e soma ao Custo Médio → "Custo Médio Com Despesas Indiretas" (fase futura)

## Despesas Indiretas — Fase 1 (Mai/2026)

- [x] Criar conta "Despesas Indiretas" no banco de produção (divisor=produção, classificação=despesa_variavel)
- [x] Lançar valor R$ 69.714,82 para março/2026 na conta Despesas Indiretas
- [x] Usar classificação "despesa_variavel" com divisor=producao para identificar Despesas Indiretas (sem alterar enum)
- [x] Atualizar Apuração de Custo: exibir grupo Despesas Indiretas com custo/t (÷ produção)
- [x] Calcular e exibir "Custo Médio com Despesas Indiretas" = Custo Médio + Custo/t Despesas Indiretas
- [ ] Atualizar importador CUSTOSOLAR para ler célula L31 da aba RSDESMB e mapear para "Despesas Indiretas"

## Custo Sintético por Setor (Mai/2026)

- [x] Analisar planilha RSSET e mapear estrutura de setores e contas
- [x] Verificar setores cadastrados no banco e correspondências com RSSET
- [x] Criar tabela custo_setor no schema com campos: id, periodoCustoId, grupoNome, subsetorNome, custoFixo, custoVariavel, totalCusto, despesaFixa, despesaVariavel, totalDespesa, totalGeral, custoTon, percentualTotal, ordemExibicao, userId
- [x] Criar backend: router custoSetorRouter com procedures listarPorPeriodo, upsert, deletarPorPeriodo, relatorio
- [x] Criar importador para ler dados da aba RSSET da planilha CUSTOSOLAR (server/importacaoCustoSetor.ts)
- [x] Criar página frontend "Custo Sintético por Setor" (client/src/pages/CustoSetor.tsx)
- [x] Adicionar ao menu lateral (DashboardLayout.tsx) e registrar rota /custo-setor no App.tsx
- [x] Popular dados de março/2026 no banco (12 subsetores: DESMONTE DE ROCHA, CARGA E TRANSPORTE, BRITAGEM, EXPEDIÇÃO, SERVIÇOS AUXILIARES, ADMINISTRAÇÃO)

## Custo por Setor — Gráfico de Rosca (Mai/2026)

- [x] Instalar/verificar Recharts no projeto (já disponível: recharts ^2.15.2)
- [x] Adicionar gráfico de rosca (donut chart) na página CustoSetor.tsx mostrando distribuição percentual por grupo, com legenda lateral detalhada, tooltip customizado e percentual nas fatias

## Módulo Apropriação de Custo — Reorganização e Gráficos (Mai/2026)

- [x] Reorganizar menu lateral: criar grupo colápsável "Apropriação de Custo" com 4 subitens (Lançamento de Custos, Apuração de Custo, Custo por Setor, Importação de Planilha)
- [x] Adicionar 3 gráficos de rosca na Apuração de Custo: Distribuição por Plano de Contas, Custo Médio (R$/t) e C.M. c/ Despesas Indiretas (R$/t)
- [x] Adicionar exportação PDF/Excel/WhatsApp na página Apuração de Custo
- [x] Adicionar exportação PDF/Excel/WhatsApp na página Custo por Setor
- [x] Corrigir warning de React key prop no DashboardLayout.tsx (React.Fragment com key)

## Gráficos de Rosca — Modal Expandido (Mai/2026)

- [x] Criar componente DonutChartModal reutilizável com: modal tela cheia, clique em fatia para destacar (renderActiveShape + opacidade dos demais), painel de detalhes lateral, botão X para fechar
- [x] Integrar modal expandido no gráfico de Custo por Setor (CustoSetor.tsx) — botão Maximize2 no canto superior direito do card
- [x] Integrar modal expandido nos 3 gráficos da Apuração de Custo (ApuracaoCusto.tsx)

## Custo por Setor — Tabela Resumo Consolidada (Mai/2026)

- [x] Adicionar tabela resumo com todos os subsetores juntos (Nome, Total Custo, Total Geral, R$/t, %) entre o gráfico de rosca e os cards de grupo — ponto colorido do grupo, rodapé Total dos Desembolsos em fundo escuro

## Exportação com Cabeçalho de Relatório (Mai/2026)

- [ ] Criar funções exportToExcelRelatorio e exportToPdfRelatorio com cabeçalho (empresa, período, data)
- [ ] Integrar exportação Excel/PDF com cabeçalho na página Apuração de Custo (plano de contas + KPIs)
- [ ] Integrar exportação Excel/PDF com cabeçalho na página Custo por Setor (tabela resumo + grupos)

## Exportação com Relatório Completo (Excel/PDF)

- [x] Criar funções exportRelatorioToExcel e exportRelatorioToPDF em export-utils.ts com cabeçalho completo (logo, empresa, título, período, data, KPIs em linha horizontal, tabela multi-seção colorida, rodapé com página)
- [x] Integrar exportação Excel/PDF/WhatsApp na Apuração de Custo com seções: Custo Variável, Despesa Variável, Despesas Indiretas, Totais
- [x] Integrar exportação Excel/PDF/WhatsApp no Custo por Setor com seções por grupo (DESMONTE, CARGA, BRITAGEM, EXPEDIÇÃO, SERVIÇOS, ADMINISTRAÇÃO)

## Relatório Analítico por Setor (RAS)
- [x] Criar tabelas custo_setor_equipamento e custo_setor_despesa no schema
- [x] Aplicar migração do banco (pnpm db:push)
- [x] Criar importador das abas RAS01-RAS12 e MSET da planilha CUSTOSOLAR
- [x] Corrigir mapeamento de colunas por setor (cada setor usa coluna diferente para valores rateados)
- [x] Popular dados de março/2026 com valores corretos validados contra aba RSSET
- [x] Criar router tRPC custoSetorRas com procedures getGrupos e getEquipamentos
- [x] Criar página CustoSetorAnalitico.tsx com visualização detalhada por grupo/subsetor/equipamento
- [x] Registrar rota /custo-setor-analitico no App.tsx
- [x] Adicionar item "Relatório Analítico" no menu lateral (DashboardLayout)

## Ordenação Decrescente em Apropriação de Custo
- [x] Apuração de Custo: ordenar grupos, subgrupos e equipamentos por valor decrescente
- [x] Custo por Setor: ordenar setores e equipamentos por valor decrescente
- [x] Relatório Analítico: ordenar grupos, subsetores, equipamentos e despesas específicas por valor decrescente
- [x] Backend: ajustar queries/lógica de agrupamento para respeitar ordem decrescente

## Cards Apuração de Custo
- [x] Adicionar card "Gastos sem Despesas Indiretas" (cor azul como Custo/t Produção) antes do card Custo Total
- [x] Renomear "Custo Total" para "Gastos com Despesas Indiretas" (cor laranja como C.M. c/ Desp. Indiretas)

## Bug: Totalizadores incorretos no Relatório Analítico
- [x] Diagnosticar por que Total Geral (R$ 4.467.084,24) e Serviços Auxiliares (R$ 2.180.535,60) estão inflados
- [x] Corrigir leitura da aba MSET (parser usava seção detalhada incorreta; corrigido para usar seção resumida RATEIO POR SETOR)
- [x] Validar que todos os totais batem com a planilha RSSET

## Relatório Analítico — Detalhe de Equipamento em Linhas
- [x] Substituir os pequenos cards do detalhe do equipamento por linhas de tabela (Sal.Oper., Combustível, Lubrificantes, Peças Desgaste, Peças Repos., Outras Desp., Horas Trabalhadas)

## Bug: Unidade de Produção DESMONTE PRIMÁRIO
- [x] Corrigir unidade de produção dos equipamentos do DESMONTE PRIMÁRIO de "ton" para "metro perf." (UPDATE direto no banco)

## Importação de Produções das Abas RAS (Mai/2026)
- [x] Analisar estrutura das abas RAS01-RAS12 para localizar dados de produção por equipamento
- [x] Identificar 10 equipamentos com producaoTotal > 0 nos seus setores principais
- [x] Criar script update-ras-producao.mjs para atualizar producaoTotal e unidadeProducao no banco
- [x] Executar importação: 10 equipamentos atualizados, 0 não encontrados
- [x] Verificar exibição na interface (BRITADOR JC1200-01: 80.109,99 ton; PERFURATRIZ WOLF FOX: 3.788 metro perf.)

## Correção de Importação de Produções com Fórmulas (Mai/2026)
- [x] Diagnosticar que células com fórmulas tinham valor calculado em .v mas sheet_to_json retornava null
- [x] Identificar que para caminhões a produção está na coluna do setor (colIdx) e não na coluna E
- [x] Corrigir script para usar MAX(colE, colSetor) acessando diretamente a propriedade .v das células
- [x] Reimportar: 33 equipamentos atualizados (vs 10 anteriores), 0 não encontrados
- [x] Verificar CAMINHÃO IXE-1F44 exibindo 13.220,2 ton no PEDRA PARA BRITADOR

## Documentação e Base de Conhecimento (Mai/2026)
- [x] Criar KNOWLEDGE_BASE.md com toda a lógica de importação, estrutura da planilha CUSTOSOLAR e roadmap
- [x] Documentar estrutura de blocos de equipamentos nas abas RAS (14 linhas, colunas E e colIdx)
- [x] Documentar lição crítica: células com fórmulas requerem acesso direto à propriedade .v
- [x] Documentar regra MAX(colE, colSetor) para captura de produção de caminhões
- [x] Documentar roadmap: Fase 2 (DataGold relatórios), Fase 3 (API DataGold)
- [x] Documentar estratégia de reutilização em outros dois sistemas com mesma planilha

## Próximos Passos Planejados
- [ ] Importar planilha de Janeiro/2026 (mesma estrutura, alterar PERIODO_MES=1 e PERIODO_ANO=2026)
- [x] Importar planilha de Fevereiro/2026 (mesma estrutura, alterar PERIODO_MES=2 e PERIODO_ANO=2026)
- [ ] Corrigir unidade da PERFURATRIZ HIDRÁULICA WOLF FOX 8-20 para "metro perf." (UPDATE direto ou correção na planilha fonte)
- [ ] Mapear relatórios do ERP DataGold que correspondem às abas RAS (para Abr/2026 em diante)
- [ ] Desenvolver parser para formato de exportação do DataGold
- [ ] Adicionar botão "Importar Relatório DataGold" na tela de Importação de Planilha
- [ ] Avaliar protocolo de integração direta com API DataGold (REST/SOAP/DB direto/Webhook)

## Drill-down: Links de Navegação nas Telas Sintéticas (Mai/2026)
- [x] Mapear todos os pontos de drill-down em Apuração de Custo e Custo por Setor
- [x] Adicionar suporte a filtros (conta e subsetor) na URL do Relatório Analítico via query params
- [x] Implementar leitura dos filtros no Relatório Analítico e aplicar ao carregar a página
- [x] Adicionar links clicáveis nas linhas de conta (Peças de Reposição, Combustível, etc.) em Apuração de Custo
- [x] Adicionar links clicáveis nos subsetores do Resumo Consolidado por Subsetor em Custo por Setor
- [x] Garantir ordenação decrescente por valor total em todas as listagens do Relatório Analítico

## Drill-down Reverso — Navegação Bidirecional (Mai/2026)
- [x] Adicionar link de retorno no banner de filtro ativo do Relatório Analítico: ?conta= → "Voltar para Apuração de Custo", ?subsetor= → "Voltar para Custo por Setor"

## Drill-down por Grupo — Terceiro Nível (Mai/2026)
- [x] Custo por Setor: tornar cards de grupo clicáveis com link ?grupo= para o Relatório Analítico
- [x] Relatório Analítico: suporte a filtro ?grupo= (mostrar apenas subsetores do grupo filtrado)
- [x] Relatório Analítico: retorno reverso no banner quando ?grupo= → "← Custo por Setor"

## Destaque Visual de Coluna Filtrada (Mai/2026)
- [x] Relatório Analítico: realçar cabeçalho e células da coluna correspondente a ?conta= com fundo amarelo

## Detalhamento de Despesas Específicas do Setor (Mai/2026)
- [x] Investigar contas de despesas específicas no banco (tabela custo_setor ou similar)
- [x] Backend: retornar despesas por conta no relatorioAnalitico
- [x] Frontend: substituir card genérico por tabela de contas com linhas (Energia, Explosivos, etc.)

## Correção: Importação de Despesas Específicas por Conta (Mai/2026)
- [x] Inspecionar como o script import-ras.mjs lê as despesas específicas na planilha RAS
- [x] Corrigir para gravar cada conta individualmente (Energia, Explosivos e Acessórios, etc.)
- [x] Reimportar os dados e verificar na interface

## Produção na Apuração de Custo (Mai/2026)
- [x] Backend: calcular produção total do período (soma dos equipamentos com produção > 0)
- [x] Frontend: exibir produção total na barra de status antes das vendas

## Produção e Vendas no Custo por Setor (Mai/2026)
- [x] Frontend: exibir produção e total de vendas no cabeçalho do Custo por Setor

## Documentação Completa e Importação Fevereiro/2026 (Mai/2026)
- [ ] Revisar e atualizar KNOWLEDGE_BASE.md com todo o aprendizado acumulado
- [x] Importar planilha de Fevereiro/2026
- [x] Verificar dados de Fevereiro na interface

## Despesas Indiretas Fevereiro/2026 (Mai/2026)
- [x] Inspecionar aba RSDESMB da planilha de Fevereiro/2026 e localizar valor de Despesas Indiretas
- [x] Lançar Despesas Indiretas no banco para o período 2/2026
- [x] Verificar exibição na Apuração de Custo (Custo Médio c/ Despesas Indiretas)

## Bug: Drill-down não propaga período selecionado (Mai/2026)
- [x] Corrigir links de conta em ApuracaoCusto.tsx para incluir &periodo=X na URL do Relatório Analítico
- [x] Corrigir links de subsetor/grupo em CustoSetor.tsx para incluir &periodo=X na URL do Relatório Analítico
- [x] Verificar que CustoSetorAnalitico.tsx lê o parâmetro periodo da URL e o aplica ao seletor de período

## Bug: Relatório Analítico acumula valores de múltiplos períodos (Mai/2026)
- [x] Investigar query relatorioAnalitico no servidor para identificar filtro de período faltando
- [x] Corrigir a query para filtrar corretamente por periodoCustoId
- [x] Verificar que os totais de Fevereiro/2026 estão corretos após a correção

## Reimportação Fevereiro/2026 com MEM+MSET (Mai/2026)
- [x] Entender estrutura das abas MEM, MSET e MEMGERAL como memória de cálculo principal
- [x] Reescrever importador para usar MEM (equipamentos por setor) e MSET (despesas setoriais)
- [x] Corrigir mapeamento MSET para incluir OUTROS SERVIÇOS e REFEITÓRIO E LIMPEZA
- [x] Verificar que todos os 12 setores batem com MEMGERAL (Total R$ 2.189.100,63 ✅)

## Atualização do Importador Web para lógica MEM+MSET (Mai/2026)
- [x] Ler código atual do importador web (server/importacaoCustoSetorRas.ts e client/ImportacaoCusto.tsx)
- [x] Reescrever parsing MEM (equipamentos por setor via colunas 11-22) no servidor (já implementado em importacaoCustoSetorRas.ts)
- [x] Reescrever parsing MSET (despesas setoriais com mapeamento completo de 12 setores) no servidor (já implementado)
- [x] Manter parsing MEMGERAL para validação de totais (já implementado em importacaoCusto.ts)
- [x] Importador web já executa Etapa 1 (MEMGERAL) + Etapa 2 (MEM+MSET) automaticamente em sequência
- [x] Testar importador web com planilha real de Março/2026: 16 contas mapeadas + 73 equipamentos + 23 despesas setoriais
- [x] Importar Março/2026 completo (MEMGERAL + MEM+MSET + Despesas Indiretas R$ 69.714,82)

## Despesas Indiretas Janeiro/2026 (Mai/2026)
- [x] Lançar Despesas Indiretas R$ 319.788,47 para o período 1/2026 (ID=30002)
- [x] Verificar exibição na Apuração de Custo: Gastos c/ DI = R$ 2.744.031,34 | C.M. c/ DI = R$ 28,71 ✅

## Bug: Gráficos Custo Médio e C.M. c/ Desp. Indiretas (Mai/2026)
- [x] Corrigir campo "Valor" no tooltip dos gráficos de Custo Médio (R$/t) — agora exibe valor financeiro total (R$) e custo/t separados
- [x] Corrigir campo "Valor" no tooltip do gráfico C.M. c/ Despesas Indiretas — corrigido

## Gráfico Distribuição por Subsetor (Mai/2026)
- [x] Substituir gráfico "Distribuição por Setor" (macro) pelo "Distribuição por Subsetor" usando dados do Resumo Consolidado por Subsetor
- [x] Usar os 11 subsetores individuais (DESMONTE PRIMÁRIO, DECAPEAMENTO, DESMONTE SECUNDÁRIO, PEDRA PARA BRITADOR, etc.) com cores por grupo

## Gráfico Distribuição por Subsetor — CustoSetor.tsx (Mai/2026)
- [x] Modificar gráfico "Distribuição por Setor" no CustoSetor.tsx para exibir subsetores individuais em vez de grupos macro

## Gráfico Plano de Contas na Apuração de Custo (Mai/2026)
- [x] Adicionar gráfico "Distribuição por Plano de Contas" antes do "Distribuição por Subsetor" com todas as contas (Custo Variável + Despesa Variável + Despesas Indiretas) em um único gráfico

## Links Analíticos para Contas Pretas (DESPSET) — Apuração de Custo (Mai/2026)
- [x] Analisar como os dados DESPSET estão armazenados no banco (tabela custo_setor_despesa)
- [x] Criar endpoint tRPC `custoSetorRas.despesasPorDescricao` para buscar distribuição por subsetor de uma conta
- [x] Criar modal de drill-down mostrando subsetor → valor da conta com % de participação
- [x] Adicionar links verdes nas contas pretas das 3 tabelas (Custo Variável, Despesa Variável, Despesas Indiretas)
- [x] Mapear nomes MEMGERAL → MSET (Despesas Administrativas, Consultorias Especializadas, Equipamentos de Apoio)
- [x] Remover contas sem dados DESPSET do conjunto (RH-ADM, Livre)

## Mapeamentos DESPSET Adicionais (Mai/2026)
- [x] Adicionar "Outras Despesas de Setor" → "Outras Desp.Setor/Proc." no mapeamento MEMGERAL→MSET

## Mapeamento RH-ADM DESPSET (Mai/2026)
- [x] Adicionar "RH - ADM / Salários não Operacionais" → "Sal.Adm./Diretoria/Pró-Labore/Encargos" no mapeamento MEMGERAL→MSET (todos os subsetores, inclusive valor zero)

## Mapeamento Impostos DESPSET (Mai/2026)
- [x] Adicionar "Impostos, CEFEM e Outras Taxas" → "Imp., Trib., Taxas e CEFEM" no mapeamento MEMGERAL→MSET (servidor e frontend)

## Auditoria de Permissões - Novos Módulos (Mai/2026)
- [x] Auditar todos os módulos do frontend vs ALL_MODULES no backend
- [x] Adicionar módulos faltantes: periodoCusto, lancamentoCusto, apuracaoCusto, custoSetor, custoSetorAnalitico, importacaoCusto, destinatariosWhatsapp, metasAlertas, rotinas
- [x] Atualizar tela de Permissões com grupo "Custos" e grupo "Administração" separados
- [x] Sincronizar permissões padrão no backend para todos os perfis × todos os módulos novos

## Renomeação de Conta (Mai/2026)
- [x] Renomear "Sal.Adm./Diretoria/Pró-Labore/Encargos" → "Sal.Adm./Diretoria/Pró-Lab./Almox./Ofic./Serv./Aux./Encargos" no banco e nos aliases

## Exibição Condicional de Conta no Analítico (Mai/2026)
- [x] No relatório analítico por setor: exibir "Sal.Adm./Diretoria/Pró-Labore/Encargos" em ADMINISTRAÇÃO e "Salários com Encargos" nos demais setores

## Importação de Resumo de Vendas (Mai/2026)
- [x] Auditar schema e router de Vendas existentes
- [x] Atualizar schema do banco com tabela resumo_vendas_produto (produto, grupo, marca, valor, quantidade, vlMedio, periodo)
- [x] Implementar parser de PDF do Resumo de Vendas no servidor (server/importacaoVendas.ts)
- [x] Criar router de importação de vendas (POST /api/importacao-vendas)
- [x] Adicionar procedures tRPC: resumoVendasPeriodos, resumoVendasPorPeriodo, resumoVendasDeletar
- [x] Atualizar tela de Vendas com botão "Importar PDF", seletor de período e tabela de exibição

## Integração Resumo de Vendas × Apuração de Custo (Mai/2026)
- [x] Adicionar procedure tRPC resumoVendasParaPeriodoCusto (busca receita pelo período do custo)
- [x] Adicionar painel comparativo Receita × Custo × Margem Bruta na tela de Apuração de Custo
- [x] Exibir detalhamento de receita por produto no painel (tabela expansível com botão "Ver produtos")

## Card Vendas no Dashboard (Mai/2026)
- [x] Simplificar card de Vendas: exibir apenas Qtd Total (toneladas) e Valor Total, sem conversão m³→toneladas
- [x] Usar dados do Resumo de Vendas ERP (tabela resumo_vendas_produto) para o período selecionado

## Frete do Período no Card Receita vs. Custo (Mai/2026)
- [x] Adicionar coluna fretePeriodo na tabela periodo_custo e migrar banco
- [x] Adicionar campo fretePeriodo no procedure tRPC upsert do periodoCusto
- [x] Refazer cálculos: Receita dos Produtos = Receita Bruta − Frete; Margem = Receita dos Produtos − Custo Total
- [x] Card Receita vs. Custo exibe 4 KPIs: Receita Bruta, Frete do Período, Receita dos Produtos, Margem Bruta
- [x] Adicionar campo Frete do Período no formulário de Períodos de Custo (com coluna na tabela de histórico)

## Painel de Avaliação Global (Mai/2026)
- [x] Criar tabela avaliacao_global no schema (faturamento, frete, custos, investimentos, diferenças de caixa)
- [x] Migrar banco com pnpm db:push
- [x] Criar procedures tRPC: upsert, getByPeriodo, delete
- [x] Implementar tela AvaliacaoGlobal.tsx com formulário de entrada e cálculos automáticos
- [x] Registrar rota /avaliacao-global no App.tsx e menu lateral (submenu Custos)
- [x] Integrar Frete do painel de Avaliação Global ao card Receita vs. Custo (substituir fretePeriodo da tabela periodo_custo)
- [x] Remover campo Frete do Período do formulário de Períodos de Custo (migrar para Avaliação Global)

## Módulo Comparativos Históricos (Mai/2026)
- [x] Criar procedure tRPC comparativos.historico consolidando dados mensais de custos, produção, vendas, faturamento, frete e margem
- [x] Criar procedure tRPC comparativos.evolucaoCustoSetor com custo por setor ao longo dos meses
- [x] Criar procedure tRPC comparativos.evolucaoCombustivel com litros e custo de combustível por mês
- [x] Implementar página ComparativosHistoricos.tsx com gráficos de linha, barras e tabela resumo
- [x] Registrar rota /comparativos-historicos no App.tsx e menu lateral (submenu Custos)
- [x] Salvar checkpoint

## Correção Bug Crítico - Filtros de Data no Comparativos Históricos (Mai/2026)
- [x] Diagnosticar causa raiz: Drizzle ORM gera GROUP BY com referência qualificada de tabela (`tabela`.`campo`) que TiDB rejeita em queries com funções de agregação
- [x] Corrigir WHERE: substituir gte/lte com sql template por sql.raw() para valores literais de data
- [x] Corrigir GROUP BY: substituir sql`YEAR(${campo})` por sql.raw("YEAR(`campo`)") sem qualificação de tabela
- [x] Corrigir ORDER BY: mesmo padrão do GROUP BY no evolucaoCombustivel
- [x] Testar todas as 6 queries do comparativos_router via script direto (todas passam)
- [x] Validar no navegador: todas as 6 abas dos Comparativos Históricos carregam sem erros

## Exportação Excel - Tabela Resumo dos Comparativos Históricos (Mai/2026)
- [x] Adicionar botão "Exportar Excel" na aba Tabela Resumo
- [x] Gerar arquivo .xlsx com cabeçalho padronizado (empresa, período) e dados da tabela

## Exportação PDF - Tabela Resumo dos Comparativos Históricos (Mai/2026)
- [x] Adicionar botão "Exportar PDF" na aba Tabela Resumo (ao lado do botão Excel existente)
- [x] Gerar arquivo PDF com cabeçalho padronizado, seguindo padrão do Custo por Setor

## Exportação Excel/PDF/WhatsApp - Avaliação Global e Comparativos Históricos (Mai/2026)
- [x] Avaliação Global: Adicionar botões Excel, PDF e WhatsApp
- [x] Comparativos Históricos: Adicionar botão WhatsApp (Excel e PDF já existem)

## Etapa 1: Produção Automática na Avaliação Global (Mai/2026)
- [x] Backend: criar procedure que busca produção do "Produção Método Caminhões" para um mês/ano
- [x] Avaliação Global: para abril/26+, preencher produção automaticamente (campo automático, não editável)
- [x] Avaliação Global: para março/26 e anteriores, manter comportamento atual (valor manual importado)

## Etapa 2: Página Simulação de Custos (Mai/2026)
- [x] Backend: procedure que calcula projeção de custos baseada em dados parciais do mês corrente
- [x] Backend: lógica de média corrigida dos últimos 3 meses por setor
- [x] Backend: projeção proporcional (dias transcorridos / dias totais) com ajuste pela média histórica
- [x] Frontend: criar página dedicada "Simulação de Custos" com visão completa da projeção
- [x] Frontend: exibir produção acumulada, gastos parciais, projeção por setor e custo unitário projetado
- [x] Frontend: alertas de desvio comparando projeção com meses anteriores
- [x] Adicionar rota e link no menu lateral

## Meta de Custo por Tonelada na Simulação de Custos (Mai/2026)
- [x] Schema: criar tabela metaCustoTonelada no banco (valor, criadoPor, criadoEm)
- [x] Backend: procedures para salvar e buscar meta de custo/t
- [x] Frontend: campo editável para definir meta de custo/t na página Simulação
- [x] Frontend: alerta visual quando projeção ultrapassar a meta definida

## Tela de Upload de Despesas de Equipamentos (Mai/2026)
- [x] Backend: parser da planilha .xls (extrair equipamentos, despesas, valores)
- [x] Backend: regras de classificação automática (Lubrificantes, Peças de Desgaste, Peças de Reposição, Outras Despesas)
- [x] Backend: correspondência de equipamentos da planilha com equipamentos cadastrados no sistema
- [x] Backend: procedure de importação com seleção de equipamentos a incluir/excluir
- [x] Frontend: tela de upload com drag-and-drop
- [x] Frontend: pré-visualização dos equipamentos encontrados na planilha com status de correspondência
- [x] Frontend: seleção de quais equipamentos importar (checkbox com exclusão dos não-pedreira)
- [x] Frontend: resumo da classificação automática por equipamento antes de confirmar importação
- [ ] Persistir despesas importadas na tabela lancamentoCusto com classificação correta (pendente: testar confirmação)

## Passo 1: Testar Confirmação de Importação (Mai/2026)
- [x] Testar botão "Confirmar Importação" com planilha de abril/26
- [x] Verificar gravação correta no banco (tabela lancamentoCusto) - 216 lançamentos, R$ 898.584,15
- [ ] Verificar se despesas aparecem no Custo por Setor de abril/26 (pendente revisão)

## Passo 2: Cadastrar Equipamentos Sem Correspondência (Mai/2026)
- [x] Identificar todos os equipamentos da planilha sem correspondência no sistema (80 identificados)
- [ ] Cadastrar equipamentos faltantes no sistema (pendente revisão do usuário)
- [ ] Verificar que a correspondência funciona após cadastro

## Refinamento da Importação de Despesas (Mai/2026)
- [x] Gerar lista de correspondências para revisão do usuário
- [ ] Ajustar schema lancamentoCusto: adicionar campos descrição item, código, quantidade, observações/OS
- [ ] Refinar parser para extrair cada item individual (não apenas totais por equipamento)
- [x] Cadastrar equipamentos faltantes no sistema (TC01-TC20, veículos, etc.)
- [x] Implementar regras de setores para centros de custo genéricos (ALMOXARIFADO, OFICINA, etc.)
- [x] Corrigir correspondências incorretas (BRITADOR CS440, CAMINHÃO AU5073, etc.)
- [x] Criar tela de revisão de correspondências para validação do usuário
- [x] Excluir: CD MURIBECA, ENSACADEIRA SOLOMIN, TOA1F53, CD SERRA DO MACHADO, OBRAS
- [x] HZH3J61 → CAMINHÃO PIPA HZH 3961 (correspondência manual)
- [x] Lançar centros de custo genéricos como "Outras Despesas de Setor" nos setores corretos

## Correções de Interface (Mai/2026)
- [x] Adicionar link "Revisão Correspondências" no menu lateral (submenu Apropriação de Custo)
- [x] Limpar cache do Vite (erro antigo de use-toast já corrigido no código)
- [x] Cadastrar 62 novos equipamentos aprovados na revisão (TC01-TC20, veículos, britadores móveis, etc.)
- [x] Limpar 216 lançamentos de teste do período Abril/2026
- [x] Atualizar importador com correspondências validadas (mapa definitivo)
- [x] Criar importDespesas_correspondencias.ts com regras de mapeamento
- [x] Atualizar encontrarCorrespondencia() para priorizar correspondências validadas
- [x] Adicionar lógica para lançar itens de setor na conta "Outras Despesas de Setores"
- [x] Adicionar correção de valor da TRANSPORTADORA (R$ 596,89)
- [x] Testes unitários passando (102 testes, 10 arquivos)

## Correções de Correspondências - Revisão 2 (Mai/2026)
- [x] MATERIAL EPI → Outras Desp. Setor no setor "OFICINA" (já estava correto)
- [x] NVH6212 e NVJ7902 → Remover grupo "FROTA" dos GRUPOS_EXCLUIR_DEFAULT (são caminhões internos)
- [x] OBRA ALMOXARIFADO → Mover de TAGS_NAO_LANCAR para TAGS_OUTRAS_DESP_SETOR setor "ALMOXARIFADO"
- [x] OUTROS → Confirmar como Outras Desp. Setor no setor "OUTROS SERVIÇOS" (já estava correto)
- [x] PRANCHA 3 EIXOS → Cadastrar equipamento (ID 120064) e remover de TAGS_EXCLUIR
- [x] Remover PRANCHA 3 EIXOS e OBRA ALMOXARIFADO de EQUIPAMENTOS_EXCLUIR_KEYWORDS
- [x] Testes passando (102 testes, 10 arquivos)

## Importação de Combustível (Mai/2026)
- [x] Remover filtro que ignora combustível no parser de despesas
- [x] Adicionar classificação "combustivel" (Óleo Diesel, Gasolina, Álcool)
- [x] Criar/verificar conta de custo "Combustível" no banco (já existia ID 14)
- [x] Atualizar confirmarImportacao para lançar despesas de combustível
- [x] Atualizar frontend para exibir classificação Combustível nos cards

## Correções de Correspondências v3 (Mai/2026)
- [x] Cadastrar equipamento LIDER BALANÇA (ID 120067) e remover BALANÇA da exclusão
- [x] MATERIAL EPI → Outras Desp. Setor / OUTROS SERVIÇOS (corrigido)
- [x] OBRA ALMOXARIFADO → Outras Desp. Setor / ALMOXARIFADO (já estava correto)
- [x] OUTROS → Outras Desp. Setor / OUTROS SERVIÇOS (já estava correto)
- [x] TORNEARIA → Outras Desp. Setor / OUTROS SERVIÇOS (adicionado)
- [x] Atualizar deveExcluirEquipamento() para não excluir itens com correspondência forçada ou desp. setor

## Correções de Correspondências v4 (Mai/2026)
- [x] OBRA ALMOXARIFADO e OUTROS não devem buscar correspondência com equipamentos (são despesas de setor)
- [x] Exibir na UI "Outras Desp. Setor → [SETOR]" em vez de correspondência parcial com equipamento

## Bug Fix: Espaços duplos no codigoTag da planilha
- [x] Bug: OBRA ALMOXARIFADO mostrava "Correspondência parcial: SALÁRIO DIRETORIA" - causa: planilha tem "OBRA  ALMOXARIFADO" (2 espaços) mas mapa usa "OBRA ALMOXARIFADO" (1 espaço)
- [x] Correção: Normalizar espaços múltiplos com .replace(/\s+/g, " ").trim() no codigoTag extraído
- [x] Correção: Passar codigoTag normalizado para deveExcluirEquipamento (antes passava col0 completo)

## Importação Detalhada de Itens de Despesa (Nível Analítico)
- [x] Criar tabela item_despesa_importado no banco (schema Drizzle) com campos: data, produto, grupoProduto, quantidade, custo, hodometro, classificacao, equipamentoTag, periodoCustoId, centroCusto, intervalo, horaPorLitro, litrosPorHora
- [x] Atualizar parsePlanilhaDespesas para capturar hodômetro, centro de custo, intervalo, hora/litro, litros/hora
- [x] Atualizar confirmarImportacao para gravar itens detalhados na tabela item_despesa_importado
- [x] Criar router tRPC itensDespesa com 6 procedures: listarEquipamentosPorPeriodo, listarClassificacoesPorEquipamento, listarItensDetalhados, temItensDetalhados, resumoPorClassificacao, excluirPorPeriodo
- [x] Criar página frontend ItensDespesa.tsx com drill-down hierárquico: Equipamento → Classificação → Itens
- [x] Adicionar rota /itens-despesa e item no menu lateral (Apropriação de Custo → Itens Detalhados)
- [x] Escrever testes unitários (111 testes passando)

## Cálculo Automático de Consumo de Combustível (lt/hr)
- [x] Analisar dados de combustível importados (horímetro, quantidade, intervalo, litrosPorHora)
- [x] Implementar função calcularConsumoCombustivel com cálculo lt/hr entre abastecimentos
- [x] Criar procedures tRPC: consumoPorEquipamento e rankingConsumo
- [x] Criar aba "Consumo Combustível" na página ItensDespesa com ranking e drill-down por equipamento
- [x] Cards de resumo: total litros, custo, horas trabalhadas, média lt/hr, R$/hr, R$/litro
- [x] Identificação de anomalias de consumo (> 2x ou < 0.3x da média, destacadas em vermelho)
- [x] Escrever 8 testes unitários para calcularConsumoCombustivel (119 testes total passando)

## Passo 1: Importar Planilha Fluxo Realizado (Abril/26+)
- [x] Analisar estrutura da planilha 04 ABRIL FLUXO REALIZADO (hierarquia de contas nível 1/2/3)
- [x] Criar mapa de correspondências: contas a importar com setor destino e conta do sistema (importFluxo_correspondencias.ts)
- [x] Criar mapa de exclusões: contas que não serão importadas (receitas, salários, fretes, investimentos, impostos)
- [x] Criar schema DB lancamento_fluxo com hierarquia completa + rateio
- [x] Implementar parser parsePlanilhaFluxo com detecção de hierarquia (4 níveis)
- [x] Implementar lógica de rateio especial (Energia: 6% Desmonte, 23% Brit.Primária, 71% Brit.Sec/Terc/Quart)
- [x] Criar tela frontend ImportFluxo.tsx com 3 steps (upload, revisão, resultado)
- [x] Registrar rota /import-fluxo e item no menu lateral
- [x] Testes unitários (9 testes, 128 total passando)

## Integração Fluxo Realizado → Apuração de Custo
- [x] Analisar estrutura atual da Apuração de Custo (lancamento_custo, contas, setores)
- [x] Implementar vinculação: ao confirmar importação do Fluxo, criar lançamentos em lancamento_custo com tag [Fluxo]
- [x] Mapear contas do Fluxo para contaCustoId por nome (busca case-insensitive)
- [x] Atualizar Apuração de Custo para agrupar lançamentos da mesma conta (soma Import + Fluxo + manual)
- [x] Atualizar Lançamento de Custos para somar múltiplos lançamentos da mesma conta
- [x] Excluir lançamentos [Fluxo] anteriores ao reimportar (evita duplicação)
- [x] Testes unitários (128 passando)

## Drill-Down nas Telas Sintéticas (Apuração de Custo)
- [x] Nível 1: Ao clicar em uma conta na Apuração, mostrar composição (Fluxo vs Import Despesas vs Manual)
- [x] Nível 2: Para contas de equipamentos, listar equipamentos por valor decrescente
- [x] Nível 3: Ao clicar em equipamento, listar itens individuais por valor decrescente (com horímetro para combustível)
- [x] Criar procedure equipamentosPorClassificacao no backend
- [x] Breadcrumb de navegação entre níveis (Conta › Equipamentos › Itens)
- [x] Ordenação decrescente em todos os níveis
- [x] Todas as 3 tabelas (Custo Variável, Despesa Variável, Despesas Indiretas) com drill-down
- [x] 128 testes passando
