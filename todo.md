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

## Bug: Drill-Down contas de setor sem detalhamento
- [x] Para contas de setor (Energia Elétrica, Consultorias, Frota, etc.) o drill-down mostra apenas composição por origem sem opção de ver distribuição por setor
- [x] Criar procedure detalhePorConta no importFluxo_router (distribuição por setor)
- [x] Adicionar botão "Ver distribuição por Setor" no nível 1 (para contas sem classificação de equipamento)
- [x] Implementar Nível 2 alternativo: tabela com setores, valores, percentuais e indicador de rateio
- [x] Atualizar breadcrumb para mostrar "Setores" em vez de "Equipamentos" quando aplicável
- [x] 128 testes passando

## Bug: Drill-Down Nível 2 - Subcontas e Outras Desp. Setores
- [x] Contas de setor do Fluxo (Desp. Administrativas, Consultorias, etc.): mostrar subcontas individuais com valores no Nível 2 (como Energia Elétrica faz)
- [x] Outras Despesas de Setores (Import Equip.): adicionar drill-down para subsetores (ALMOXARIFADO, OUTROS SERVIÇOS, etc.) com valores

## Drill-Down Nível 3 - Outras Despesas de Setores (Subsetor → Tags → Itens)
- [x] Criar procedure backend para listar itens detalhados por tag de Outras Desp. Setores
- [x] Adicionar clique no subsetor (Nível 2) para abrir Nível 3 com tags individuais e valores
- [x] Adicionar clique na tag (Nível 3) para abrir Nível 4 com lista de itens detalhados (produto, data, valor)
- [x] Atualizar breadcrumb para navegação completa: Conta > Subsetores > Tags > Itens

## Lançamento Manual de Salários
- [x] Criar nova conta "Sal. Diretoria" no banco de dados
- [x] Criar procedure backend para lançamento manual de salários (CRUD)
- [x] Criar procedure para listar lançamentos de salários existentes por período
- [x] Criar formulário frontend para lançar salários: selecionar conta, valor, destino (equipamento ou setor)
- [x] Regras de alocação: Sal.Oper. → equipamentos; Sal.Adm./Diretoria/Pró-Labore/Encargos → setores; Sal. Diretoria → setores
- [x] Listar lançamentos existentes com opção de editar/excluir

## Melhoria Formulário de Salários
- [x] Substituir Select de equipamento por Combobox com busca por digitação
- [x] Substituir Select de setor por Combobox com busca por digitação
- [x] Garantir que o período está claramente selecionável no formulário de lançamento

## Integração Salários na Apuração de Custo
- [x] Incluir Sal.Oper. nos custos por equipamento (relatório sintético e analítico)
- [x] Incluir Sal.Adm./Encargos e Sal.Diretoria nos custos por setor (relatório sintético e analítico)
- [x] Garantir que os salários apareçam como linha separada na composição de custo
- [x] Verificar drill-down: clicar na conta de salário deve mostrar a lista de lançamentos

## Integração Salários no Relatório Analítico (custoSetorRas)
- [x] Incluir Sal.Oper. no campo salOperEncOper dos equipamentos no relatório analítico
- [x] Incluir Sal.Adm./Encargos e Sal.Diretoria como despesas específicas nos setores no relatório analítico
- [x] Verificar que os valores aparecem corretamente na tela CustoSetorAnalitico

## Card Produção por Equipamento - Detalhe por Setor
- [x] Modificar backend para retornar produção por equipamento discriminada por setor
- [x] Atualizar frontend do card para exibir produção por setor dentro de cada equipamento
- [x] Garantir que o total por equipamento continua visível com o detalhamento por setor

## Card Horas Trabalhadas por Setor
- [x] Criar procedure backend para horas trabalhadas por setor (agrupando por setor e equipamento)
- [x] Criar card frontend "Horas Trabalhadas por Setor" posicionado após card "Km Rodado"
- [x] Mostrar horas totais por setor e detalhamento por equipamento dentro de cada setor
- [x] Implementar no Dashboard web e mobile

## Lançamento Manual de Impostos (Passo 5)
- [x] Criar router backend com CRUD para lançamentos de impostos (usa tabela lancamento_custo existente com obs [Impostos Manual])
- [x] Criar página frontend para lançamento manual de impostos (formulário com período, valor, descrição da composição)
- [x] Integrar impostos manuais na Apuração de Custo (automático - mesma tabela lancamento_custo, conta ID 2)
- [x] Adicionar menu de navegação para a nova página (Apropriação de Custo → Lançamento de Impostos)

## Rateio de Despesas por Setor nos Equipamentos (Passo 3 - MEM)
- [x] Analisar metodologia MEM da planilha de custos para entender o rateio existente
- [x] Verificar equipamentos com parte diária lançada em abril/26 (54 equips, 1124 partes)
- [x] Propor modelo de rateio baseado em horas trabalhadas por setor (aprovado pelo usuário)
- [x] Mapear setores do sistema para os 12 setores MEM (aprovado)
- [x] Definir regra para equipamentos com setor único (100% ao setor vinculado)
- [x] Definir BALANÇA INTEGRADORA PRIMÁRIO → BRITAGEM PRIMÁRIA
- [x] Criar router backend rateioMem_router.ts com cálculo on-the-fly
- [x] Implementar lógica de distribuição de horas por setor (proporcional à produção)
- [x] Implementar agregação de despesas por equipamento (item_despesa_importado + lancamento_salario)
- [x] Implementar mapeamento de equipamentoTag → equipamentoId para itens importados
- [x] Criar procedure para retornar rateio consolidado por setor MEM
- [x] Criar procedure para retornar rateio detalhado por equipamento dentro de cada setor
- [x] Implementar frontend (tela de visualização do rateio MEM)
- [x] Integrar rateio na Apuração de Custo e relatório analítico (implementado via fallback MEM)

## Rateio MEM - Melhorias (Passo 3 continuação)
- [x] Resolver 9 tags sem correspondência no mapeamento de despesas
- [x] Definir setor padrão para equipamentos sem rateio (fallback via setorId do cadastro)
- [x] Integrar resultado do rateio MEM na Apuração de Custo (custoSetor.relatorio fallback)
- [x] Integrar resultado do rateio MEM no Relatório Analítico (custoSetorRas.relatorioAnalitico fallback)
- [x] Refatorar lógica de cálculo em módulo compartilhado (rateioMem_calc.ts)

## Reorganização do Menu Apropriação de Custo
- [x] Separar processos legados (março/26 para trás) dos processos atuais (abril/26 em diante)
- [x] Agrupar/renomear Import. Despesas Equip. → Despesas de Equipamentos
- [x] Agrupar/renomear Import. Fluxo Realizado → Fluxo Realizado
- [x] Agrupar/renomear Lançamento de Salários → Salários Operacionais
- [x] Separar/renomear Lançamento de Impostos → Impostos e Tributos
- [x] Remover Lançamento de Custos do menu (manter dados no backend)
- [x] Manter Importação de Planilha como método legado claramente identificado
- [x] Atualizar títulos das páginas para consistência com o menu
- [x] Atualizar referências no código (mensagens de erro, links)

## Bug: Vendas não aparecem na Apuração de Custo (abril/26)
- [x] Investigar por que Apuração de Custo mostra "Vendas: — t" quando há 93.271 t importadas no módulo Vendas
- [x] Corrigir integração para que vendas do PDF importado alimentem a Apuração de Custo (fallback via resumoVendasERP)

## Bug: 39 erros de "duplicate key" na Apuração de Custo
- [x] Identificar componentes com chaves React duplicadas (key='0') - causa: convertRateioMemToSintetico gerava id:0 para todos
- [x] Corrigir usando IDs virtuais incrementais (900000+)

## Passo 4 - Indicador de Custo/Tonelada por subsetor no Rateio MEM
- [x] Buscar dados de produção do período (parte_diaria_itens tem quantidade por setor)
- [x] Calcular toneladas produzidas por subsetor MEM
- [x] Adicionar coluna "Custo/t" na tabela de subsetores da página RateioMem.tsx
- [x] Criar procedure producaoPorSubsetor no rateioMem_router.ts

## Passo 5 - Validação de Fechamento de Período
- [x] Criar router validacaoFechamento_router.ts com procedure verificar
- [x] Checklist verifica: despesas equip., fluxo realizado, salários, impostos, vendas, produção
- [x] Dialog com status visual (✓ completo / ✗ pendente) e barra de progresso
- [x] Integrar no botão Fechar do PeriodoCusto.tsx (checklist antes de confirmar)
- [ ] Verificar se cada item tem dados para o período selecionado
- [ ] Adicionar rota e menu para acesso à validação

## Passo 6 - Rateio MSET (despesas de setores)
- [x] Analisar estrutura de despesas de setores no banco (fluxo realizado, lancamento_custo)
- [x] Implementar lógica de rateio MSET (energia, explosivos, administrativas por setor)
- [x] Criar módulo rateioMset_calc.ts com cálculo on-the-fly
- [x] Integrar MSET no fallback do relatório sintético (custoSetor_router.ts)
- [x] Integrar MSET no fallback do relatório analítico (custoSetorRas_router.ts)
- [x] Integrar MSET no drill-down despesasPorDescricao (custoSetorRas_router.ts)

## Renomeação de Contas de Custo
- [x] Renomear "Sal.Adm./Diretoria/Pró-Lab./Almox./Ofic./Serv./Aux./Encargos" para "Sal.Adm./Almox./Ofic./Serv.Aux./Encargos" (banco + código)
- [x] Renomear "Sal. Diretoria" para "Sal. Diretoria/Pró-Labore" (banco + código)

## Exclusão de Equipamentos dos Cálculos de Custo
- [x] Adicionar campo excluidoCusto (sim/não) na tabela equipamentos no schema
- [x] Criar procedure toggleExcluidoCusto no backend (routers.ts)
- [x] Adicionar UI de exclusão na tela Itens Detalhados (botão Ban/RotateCcw com dialog de confirmação)
- [x] Filtrar equipamentos excluídos no cálculo do Rateio MEM (rateioMem_calc.ts - 5 pontos)
- [x] Filtrar equipamentos excluídos no relatório sintético (via calcularRateioMem no custoSetor_router.ts)
- [x] Filtrar equipamentos excluídos no relatório analítico (via calcularRateioMem no custoSetorRas_router.ts)
- [x] Filtrar equipamentos excluídos nas procedures de itensDespesa_router.ts (4 procedures)
- [x] Filtrar equipamentos excluídos na importação de despesas (importDespesas_router.ts)
- [x] Mostrar indicador visual (badge vermelho "Excluído" + texto riscado + fundo vermelho)
- [x] Permitir reincluir equipamento previamente excluído (toggle bidirecional)

## Correção: Exclusão de Equipamentos sem Vínculo
- [x] Criar tabela equipamento_excluido_tag para armazenar tags excluídas sem vínculo no cadastro
- [x] Ajustar procedure toggleExcluidoCusto para aceitar exclusão por tag (sem equipamentoSistemaId)
- [x] Filtrar tags excluídas no rateioMem_calc.ts (tagsExcluidasSet)
- [x] Filtrar tags excluídas no itensDespesa_router.ts (5 procedures)
- [x] Atualizar UI para permitir exclusão de qualquer equipamento na lista (remover validação de vínculo)

## Bug: Exclusão de equipamentos não propaga para Apuração de Custo
- [x] Problema: tags na planilha (ex: "PERFURATRIZ HIDR. 01") diferem do codigoTag no cadastro (ex: "FOX 8-20")
- [x] Correção: no rateioMem_calc.ts, resolver IDs de equipamentos via tagToIdMap para tags excluídas
- [x] Correção: procedure toggleExcluidoCusto agora também marca equipamento cadastrado via correspondências
- [x] Sincronizar banco: equipamento id=48 (PERFURATRIZ HIDR. 01) marcado como excluído

## Bug DEFINITIVO: Exclusão de equipamentos não propaga para Apuração de Custo
- [x] Causa raiz: lancamentoCusto_router.ts → listByPeriodo retornava TODOS os lançamentos sem filtro de exclusão
- [x] A Apuração de Custo lê dados de lancamento_custo (snapshots persistidos na importação), não recalcula via rateioMem_calc.ts
- [x] Solução: filtro dinâmico em listByPeriodo — extrai tag do campo observacoes ([Import] TAG - DESC | ...) e verifica contra equipamentos excluídos
- [x] Implementado buildTagsExcluidasFromIds() que mapeia IDs excluídos → tags via CORRESPONDENCIAS_FORCADAS e CORRESPONDENCIAS_APROVADAS
- [x] Filtro também aplicado em resumoPorClassificacao e subsetoresOutrasDesp
- [x] Validação: R$ 95.279,30 de redução confirmada (soma exata dos 5 equipamentos excluídos)

## Itens Detalhados - Bloco de Despesas Específicas de Setores
- [x] Criar procedure backend para listar despesas de setores (listarDespesasSetores + listarItensSetor)
- [x] Implementar lógica de exclusão/reinclusão de despesas de setores (reutiliza equipamento_excluido_tag)
- [x] Adicionar bloco visual separado na tela Itens Detalhados com as despesas de setores
- [x] Garantir que exclusão de despesas de setores propague para Apuração de Custo (já propagava via rateioMem_calc.ts)
- [x] Separar equipamentos e setores: remover tags de setores da lista de equipamentos (evitar duplicação)
- [x] Expansão inline dos itens de cada setor com tabela detalhada
- [x] Busca/filtro por setor e banner de setores excluídos

## Revisão de Correspondências Equipamento → Setor
- [x] Criar procedure backend listarCorrespondenciasSetor (210 equipamentos com setor, origem, tags planilha, grupo)
- [x] Criar procedure backend alterarSetorEquipamento (atualiza setorId no cadastro)
- [x] Criar tela de revisão com lista completa + estatísticas (65 cadastro, 91 grupo, 3 inferido, 51 indefinido)
- [x] Permitir edição inline do setor destino via dropdown (21 setores disponíveis)
- [x] Propagação automática para cálculos de custo (rateioMem_calc.ts usa setorId como fonte primária)
- [x] Persistência no banco de dados (campo setorId na tabela equipamento)

## Correção: Divergência Apuração de Custo vs Avaliação Global
- [x] Investigar causa raiz (Apuração: R$ 2.771.022,26 vs Avaliação Global: R$ 2.317.060,30)
- [x] Corrigir: Avaliação Global agora usa lancamentoCusto.listByPeriodo (mesma fonte da Apuração de Custo)
- [x] Ambas as telas agora mostram R$ 2.771.022,26 como total de despesas para Abril/2026

## Unificação: Custo por Setor deve incluir TODAS as despesas
- [x] Verificar equipamentos sem rateio (sem horas) e forçar alocação pelo setor do cadastro
- [x] Incluir despesas de setores (TAGS_OUTRAS_DESP_SETOR) no relatório Custo por Setor (etapa 4 no rateioMset_calc.ts)
- [x] Incluir despesas indiretas no relatório Custo por Setor (etapa 5 no rateioMset_calc.ts)
- [x] Adicionar DIRETORIA e PRÓ-LABORE ao mapeamento SETOR_PARA_SUBSETOR_MSET
- [x] Implementar reconciliação automática com lancamento_custo no custoSetor_router.ts
- [x] Total do Custo por Setor agora confere com Apuração de Custo (R$ 2.771.022,26)
- [x] Diferença não-alocável (R$ 148.264,14) aparece como "NÃO ALOCADOS" em SERVIÇOS AUXILIARES

## Investigação: Eliminar R$ 148.264 "NÃO ALOCADOS"
- [x] Identificar quais tags/despesas compõem os R$ 148.264
  - Tag "EXPLOSIVOS" (R$ 137.709,83): mapeada para equipId 58 que não existe no cadastro
  - Tag "DRAGA D´ÁGUA A DIESE" (R$ 10.554,38): variante truncada sem correspondência
- [x] Criar correspondências faltantes para alocar ao setor correto
  - EXPLOSIVOS → movido para TAGS_OUTRAS_DESP_SETOR com setor DESMONTE PRIMÁRIO
  - DRAGA D´ÁGUA A DIESE → correspondência adicionada para equipId 120006
- [x] Testar que NÃO ALOCADOS foi eliminado (gap reduzido de R$ 148.264,14 para R$ 0,07)

## Investigado: Equipamentos alocados no subsetor errado no Relatório Analítico
- [x] Investigar por que 944C (setor CARGA E TRANSPORTE DE PEDRA DA MINA) aparece em OUTROS SERVIÇOS
  - Causa: itens da PD lançados com setor 15 (OUTROS SERVIÇOS AUXILIARES) com quantidade 0
  - Decisão: rateio da PD deve prevalecer sobre setor do cadastro (equipamento pode trabalhar em vários setores)
  - Não é bug, comportamento correto

## Relatório Apuração de Custo - Formato Retrato
- [x] Alterar orientação do PDF de paisagem para retrato
- [x] Reorganizar cards do cabeçalho para caber no formato retrato (grid 3+2)
- [x] Ajustar larguras das colunas da tabela para formato retrato
- [x] Remover quebra de página entre seções (tudo contínuo)
- [x] Diminuir altura das linhas (cellPadding 1.2, fontSize 7) para caber em 1 página
- [x] Testar exportação PDF no novo formato

## Ajustes nos Cards KPIs do Relatório Apuração de Custo
- [x] Renomear "Custo Médio (R$/t)" para "C.M. s/ Despesas Indiretas"
- [x] Inserir novo card "Total Desp. s/ Desp. Indiretas" antes do antigo "Total Geral"
- [x] Renomear "Total Geral (R$)" para "Total Desp. c/ Despesas Indiretas"
- [x] Mover os dois cards de Custo Médio para a direita (posições 5 e 6)
- [x] Atualizar mensagem WhatsApp com novos nomes

## Melhorias na tela Custo por Setor
- [x] Corrigir responsividade (flex-col mobile, overflow-hidden, padding responsivo)
- [x] Substituir cards atuais (Total Geral, Custo Médio, Grupos) pelos 6 KPIs da Apuração de Custo
- [x] PDF já usa exportRelatorioToPDF em formato retrato com compactação (1 página)
- [x] Atualizar buildKpis e mensagem WhatsApp com os 6 KPIs

## Bug: Valores incompletos na tela Custo por Setor
- [x] Investigar por que soma dos subsetores (R$ 1.119.057) ≠ Total Geral (R$ 2.771.022)
  - Causa: coluna "Total Custo" mostra só MEM (equipamentos), "Total Geral" mostra MEM+MSET
  - Não é bug de cálculo, é problema de apresentação (faltava coluna "Total Despesa")
- [x] Adicionar coluna "Total Despesa" na tabela para mostrar a parte MSET
- [x] Adicionar linhas de subtotal por grupo na tabela
- [x] Incluir totais de Total Custo e Total Despesa na linha de rodapé
- [x] Verificar que Total Custo + Total Despesa = Total Geral

## Bug: Total inflado no Relatório Analítico (R$ 3.196.739 vs R$ 2.771.022)
- [x] Investigar por que o total é R$ 3.196.739,38 em vez de R$ 2.771.022,26
  - Causa: Sal.Adm/Dir (R$ 425.717,05) duplicado - adicionado no convertRateioMemToAnalitico E no MSET
- [x] Identificar a duplicidade ou fonte extra de dados
  - convertRateioMemToAnalitico recebia salAdmDir como 2º arg e somava manualmente
  - injetarDespesasMsetNoAnalitico já incluía Sal.Adm/Dir via MSET
- [x] Corrigir para que o total bata com os outros relatórios
  - Removida lógica duplicada: convertRateioMemToAnalitico agora recebe apenas rateio
  - Total correto: R$ 2.771.022,33 (MEM R$ 1.119.057,35 + MSET R$ 1.651.964,98)

## Relatório Analítico - Separador e Destaque nos Totais de Grupo
- [x] Adicionar separador visual (linha/borda) entre os totais de cada grupo
- [x] Destacar linhas de total de grupo em vermelho (texto ou fundo)
- [x] Aplicar tanto na tela quanto no PDF exportado

## Comparativos Históricos - Seletor Multi-período e Tabelas Comparativas
- [x] Seletor de múltiplos períodos para comparação acumulada (ex: dez/25, jan/26, fev/26, mar/26)
- [x] Backend: endpoint para retornar dados acumulados de múltiplos períodos
- [x] Tabela comparativa por Plano de Custo (contas x períodos selecionados)
- [x] Tabela comparativa por Setores (setores x períodos selecionados)
- [ ] Integrar gráficos existentes com os períodos selecionados [futuro]

## Bug (CORRIGIDO): Comparativo Multi-período não carrega dados de abril/26
- [x] Investigar por que abril/26 retorna R$ 0,00 no comparativo
  - Causa: endpoints usavam apenas custo_setor_equipamento/despesa (dados RAS importados), que não existem para abril/26+
- [x] Verificar diferença de inserção de dados (planilha vs lançamentos diretos)
  - Jan-mar: dados em custo_setor_equipamento + custo_setor_despesa (importados via planilha RSSET)
  - Abril+: dados em lancamento_custo + lancamento_salario (lançamentos diretos)
- [x] Corrigir para incluir dados de abril/26+ no comparativo
  - comparativoPlanoCusto: reescrito para usar lancamento_custo + lancamento_salario (fonte unificada)
  - comparativoSetores: fallback com calcularRateioMem + calcularRateioMset para períodos sem RAS

## Bug (CORRIGIDO): Inconsistência de totais no Comparativo Multi-período
- [x] Plano de Custo abril/26: mostra R$ 2.800.111,20 mas deveria ser R$ 2.771.022,33 (diferença R$ 29.088,87)
  - Causa: equipamentos com tags excluídas (R$ 29.088,93) estavam sendo incluídos
  - Correção: subtrair proporcional dos equipamentos excluídos nas contas MEM
- [x] Setores jan-mar/26: não inclui despesas indiretas (total menor que deveria)
  - Causa: usava campo periodo_custo.despesasIndiretas (que era 0 para fev/26)
  - Correção: buscar despesas indiretas do lancamento_custo (conta 'Despesas Indiretas')
- [x] Alinhar ambas tabelas para incluir despesas indiretas em todos os períodos
  - Totais agora batem: Plano ≈ Setores (diferença de centavos por arredondamento)

## Correção: EXPLOSIVOS-DETONA classificado na conta errada
- [x] Investigar como o item EXPLOSIVOS-DETONA está cadastrado (equipamento vs despesa específica)
  - Era tratado como equipamento do grupo EXTRAÇÃO JAZIDA, despesas iam para Peças de Reposição
- [x] Corrigir correspondência para que vá para conta "Explosivos e Acessórios" em vez de "Peças de Reposição"
  - Criado TAGS_CONTA_EXPLOSIVOS no importDespesas_correspondencias.ts
  - Adicionado tratamento na importação (preview + confirmação) para conta 6
  - rateioMem_calc.ts: exclui EXPLOSIVOS do rateio de equipamentos
  - rateioMset_calc.ts: inclui EXPLOSIVOS como "Explosivos e Acessórios" no DESMONTE PRIMÁRIO
  - Dados de abril/26 corrigidos no banco (lancamento_custo movido para conta 6)
- [x] Verificar se a correção afeta os totais dos relatórios corretamente
  - Totais batem: Plano de Custo e Setores ambos R$ 2.771.022 para abril/26

## PDF Apuração de Custo - Gráficos Donut nas páginas 2 e 3
- [x] 2ª página: Gráfico "Distribuição por Plano de Contas" (donut, sem legenda, rótulos com nome/valor/R$/t/%)
- [x] 3ª página: Gráfico "Distribuição por Subsetor" (donut, sem legenda, rótulos com nome/valor/R$/t/%)
- [x] Dados ordenados por valor decrescente

## PDF Donut - Rótulos de percentual nas fatias maiores
- [x] Adicionar rótulos de percentual diretamente sobre as fatias > 8% do donut no PDF

## Bug: Explosivos (DETONA) aparecendo na tela de detalhamento por equipamento
- [x] Excluir explosivos (DETONA) da lista de equipamentos da conta "Peças de Reposição / Itens de Consumo" no detalhamento por equipamento
- [x] Corrigir o total da tela de detalhamento (deve ser R$ 247.219,95, não R$ 397.203,80)
- [x] Não afetar a tela de Custo Variável que está correta

## Drill-down na conta Explosivos e Acessórios
- [x] Criar endpoint para listar itens de explosivos por período
- [x] Implementar drill-down no frontend para a conta Explosivos e Acessórios
- [x] Exibir itens detalhados com data, descrição, quantidade e valor (ordem decrescente)

## Melhorias nos diálogos de drill-down
- [x] Aumentar largura dos diálogos para evitar corte de texto
- [x] Corrigir posição do botão X de fechar
- [x] Melhorar barras de rolagem e exibição de conteúdo
- [x] Garantir que textos longos não sejam cortados

## Exportação Excel/PDF nos diálogos de drill-down
- [x] Adicionar botões de exportação Excel e PDF em todas as telas de drill-down
- [x] Cabeçalho padrão: GEM, Solar Pedreira, título, período, data/hora
- [x] Logomarca Dourado Gestão no cabeçalho

## Reduzir logomarca Dourado Gestão nos relatórios
- [x] Reduzir logomarca para ~60% do tamanho atual em todos os relatórios existentes

## Botão de Impressão ao lado dos botões de exportação
- [x] Investigar todos os locais com botões de exportação
- [x] Criar função de impressão com cabeçalho padronizado (GEM, empresa, período)
- [x] Adicionar botão de impressão em todos os locais com exportação

## Excluir contas específicas da apuração de custo (Solução Completa)
- [x] Investigar como lançamentos do Fluxo Realizado são importados e onde a conta 7047 aparece
- [x] Criar tabela `contaExcluidaFluxo` no banco de dados
- [x] Criar endpoints tRPC: listar, adicionar, remover contas excluídas
- [x] Integrar exclusões dinâmicas com importação do Fluxo Realizado
- [x] Criar interface de gerenciamento de contas excluídas no frontend
- [x] Testar fluxo completo: 146 testes passando, exclusões dinâmicas integradas com parsePlanilhaFluxo

## Drill-Down no Relatório Analítico por Setor
- [x] Analisar estrutura atual do Relatório Analítico e backend de itens detalhados
- [x] Criar/atualizar endpoints backend para buscar itens detalhados por conta/equipamento/setor
- [x] Implementar drill-down clicável nas contas de equipamentos (Peças, Combustível, Lubrificantes, etc.)
- [x] Implementar drill-down clicável nas despesas específicas de setor
- [x] Adicionar botões de exportação Excel/PDF e impressão em cada nível de drill-down
- [x] Garantir ordenação decrescente por valor em todos os níveis analíticos
- [x] Testar navegação completa: 154 testes passando, drill-down verificado visualmente

## Bugs no Drill-Down do Relatório Analítico
- [x] Corrigir erro "DialogContent requires DialogTitle" (adicionado VisuallyHidden DialogTitle + aria-describedby)
- [x] Corrigir itens não carregando para 944C - Peças de Reposição (normalização de espaços na tag do equipamento no backend)

## Drill-Down Combustível no Relatório Analítico
- [x] Analisar endpoints existentes de consumo de combustível e abastecimentos
- [x] Criar/atualizar endpoint backend para buscar abastecimentos por equipamento e período
- [x] Implementar drill-down de Combustível no CustoSetorAnalitico.tsx com abastecimentos individuais
- [x] Incluir dados de consumo (litros, média Lt/Hr, R$/Hr) no drill-down de combustível
- [x] Adicionar botões de exportação/impressão no drill-down de combustível
- [x] Testar drill-down de combustível para diferentes equipamentos (944C: 21 abast., PC300: 6 abast.)

## Exportação PDF e Impressão nos Comparativos Históricos
- [x] Substituir botões "Excel" isolados por DashboardExportMenu com Excel, PDF e impressão
- [x] Garantir cabeçalho padronizado (empresa, período) nos relatórios exportados
- [x] Testar exportação PDF e impressão em ambas as tabelas (Plano de Custo e Setores) - 154 testes passando

## Controle de Acesso: Lançamentos e Legado restritos ao perfil Consultoria
- [x] Filtrar blocos "Lançamentos" e "Legado" na sidebar para exibir apenas para perfil Consultoria (requireConsultoria flag)
- [x] Proteger rotas frontend com ProtectedRoute requireRole="consultoria" (redireciona com toast)
- [x] Testar - 154 testes passando, TypeScript 0 erros

## Bug: Drill-down não carrega itens para DESMONTE DE ROCHA e PEDRA PARA BRITADOR
- [x] Investigar causa raiz: comparar tags no relatório analítico vs tags em item_despesa_importado
- [x] Corrigir normalização de tags no backend (listarItensDetalhados e consumoPorEquipamento)
- [x] Testar drill-down para todos os setores - 160 testes passando

## Meta de Custo por Tonelada - Análise de Requisitos para Atingir Meta
- [x] Backend: procedure analiseMeta com cálculos de 3 cenários (produção, custo, equilibrado)
- [x] Frontend: card expansível com 3 cenários e tabela detalhada de contas
- [x] Incluir produção necessária, vendas necessárias e valor máximo por conta
- [x] Métodos matemáticos: média ponderada 3 meses + raiz quadrada para equilíbrio
- [x] Testar e validar - 166 testes passando, 0 erros TypeScript

## Card Produção de Perfuração - Detalhamento por Equipamento
- [x] Backend: retornar produção por equipamento (nome, furos, metros, percentual)
- [x] Frontend web: listar equipamentos com produção e % no card
- [x] Frontend mobile: listar equipamentos com produção e % no card mobile
- [x] Atualizar exportação Excel/WhatsApp com dados por equipamento
- [x] Testar e validar - 166 testes passando, 0 erros TypeScript

## Produção de Perfuração - Excluir MARTELOS PERFURATRIZES HIDRÁULICAS
- [x] Ajustar filtro para excluir grupo MARTELOS, mantendo apenas PERFURATRIZES HIDRAULICAS e PNEUMÁTICAS

## Simulação de Custos - Exportação Excel, PDF, WhatsApp e Impressão
- [x] Implementar botão de exportação Excel com dados completos da simulação
- [x] Implementar botão de exportação PDF com layout formatado
- [x] Implementar botão de envio WhatsApp com resumo da simulação
- [x] Implementar botão de impressão da tela
- [x] Testar e validar - 166 testes passando, 0 erros TypeScript

## Bug: Histórico Recente na Simulação de Custos com dados faltantes
- [x] Produção mostrando "0 t" e Custo/t mostrando "—" para todos os meses
- [x] Custo mostrando R$ 0,00 para abril/2026
- [x] Corrigido: produção usa quantidadeVendida como fallback, depois Método Caminhões; custo usa lancamento_custo quando custo_setor vazio

## Bug: Custo Total Projetado e Custo/t inflados na Simulação de Custos
- [x] Custo Total Projetado mostrando R$ 4.4M - corrigido dupla contagem por nomes de grupos diferentes entre meses
- [x] Custo/t mostrando R$ 61,56 - corrigido, agora usa média do custo total mensal
- [x] Causa raiz: abril usava lancamento_custo com nomes "CUSTO VARIÁVEL/FIXO" vs fev/mar com nomes de setores

## Bug: Histórico Recente usa fontes diferentes da Apuração de Custo
- [x] Abril: custo agora inclui lancamento_custo + lancamento_salario (igual Apuração)
- [x] Fev/Mar: produção agora usa tabela producao (legado) via CORTE_ANO/CORTE_MES
- [x] Corrigido: mesma lógica de getProducaoDoModulo + listByPeriodo - 166 testes passando

## Dashboard Personalizado por Perfil (Opção 2)
- [x] Criar tabela dashboard_cards_config no schema
- [x] Criar router backend dashboardConfig (getByRole, save, resetToDefault, myConfig)
- [x] Criar tela admin para Consultoria configurar cards visíveis por perfil
- [x] Integrar filtro de cards no Dashboard web (Home.tsx)
- [x] Integrar filtro de cards no Dashboard mobile (MobileDashboard.tsx)
- [x] Adicionar link no menu lateral (DashboardLayout)
- [x] Testes vitest

## Simulação de Custos - Importação de Despesas Parciais
- [x] Criar tabela simulacao_despesas_parciais no schema
- [x] Criar tabela simulacao_fluxo_parcial no schema
- [x] Criar router backend para importação parcial (parse + confirmar para ambos os relatórios)
- [x] Integrar dados parciais na lógica de projeção do simulacaoCusto.simular
- [x] Criar UI de importação parcial na página de Simulação de Custos
- [x] Implementar descarte automático ao importar oficialmente (despesas e fluxo)
- [x] Testes vitest
## Bug: Parser de Fluxo não reconhece valores em formato brasileiro (string)
- [x] Corrigido parseFluxo em simulacaoParcial_router.ts: valores como "18.900,00" (string) agora são convertidos para número
- [x] Corrigido parsePlanilhaFluxo em importFluxo_router.ts: mesma correção aplicada ao importador oficial
- [x] Validado localmente: 144 contas parseadas, 52 itens após filtro, R$ 363.690,64 total
- [x] 183 testes passando
## Bug: Projeção de Custo Total muito abaixo da média após importação parcial
- [x] Corrigida lógica de projeção: dados parciais não substituem mais a média histórica completamente
- [x] Nova abordagem: média ponderada (60% histórico + 40% projeção baseada em parciais)
- [x] Proporções dinâmicas: despesas equip ~56%, fluxo admin ~14% do custo total
- [x] Corrigido bug de data inválida no fluxo: 'Maio/2026' → formato ISO correto
- [x] Adicionado mínimo de 5 dias para aceitar dados parciais como válidos
- [x] Validado: projeção com ambos parciais = R$ 2.604.785 (+0.2% vs média R$ 2.598.991)
- [x] 183 testes passando
## Despesas de Equipamentos - Melhorias na Importação
- [x] Modal de detalhamento: ao clicar na classificação (Lub/Rep/Outras/Comb/Desg), abrir modal com lista dos itens individuais
- [x] Reclassificação no modal: permitir mover itens para outra conta (ex: de Lubrificante para Peças de Reposição)
- [x] EXPLOSIVOS direto na conta: alocar despesas de EXPLOSIVOS diretamente em "Explosivos e Acessórios" sem sub-classificação

## Bug: Reclassificação manual no modal não funciona
- [x] Corrigir Select no modal de detalhamento que não salva a reclassificação ao selecionar outra conta
- [x] Garantir que item reclassificado seja contabilizado na conta escolhida pelo usuário

## Melhoria: Regra de classificação de Lubrificantes
- [x] Para ser classificado como "Lubrificante", o item deve conter "óleo/oleo" no nome (exceto "Óleo Diesel" que é combustível)
- [x] Graxa, fluido hidráulico e demais termos continuam como lubrificante normalmente
- [x] Itens que contêm "óleo/oleo" mas não são lubrificantes (ex: "Óleo Diesel") devem ir para Combustível

## Novas Correspondências e Funcionalidade de Mapeamento
- [x] Cadastrar equipamento: PERFURATRIZ PWH5000 02
- [x] Cadastrar equipamento: RDR 1G90 — CARRO RAFAEL
- [x] Cadastrar equipamento: TRANSPORTADOR DE CORREIA TC - 12
- [x] Cadastrar equipamento: TRANSPORTADOR DE CORREIA TC - 13
- [x] Cadastrar equipamento: TRANSPORTADOR DE CORREIA TC - 18
- [x] Correspondência: GEORGE MACHADO -> Outras Despesas de Setor -> ADMINISTRAÇÃO
- [x] Correspondência: PERFURATRIZ 02 -> PERFURATRIZ PWH5000 02
- [x] Correspondência: RDR 1G90 — CARRO RAFAEL -> RDR 1G90 — CARRO RAFAEL
- [x] Correspondência: TC12 — TRANSPORTADOR DE CORREIA TC - 12 -> TRANSPORTADOR DE CORREIA TC - 12
- [x] Correspondência: TC13 — TRANSPORTADOR DE CORREIA TC - 13 -> TRANSPORTADOR DE CORREIA TC - 13
- [x] Correspondência: TC18 — TRANSPORTADOR DE CORREIA TC - 18 -> TRANSPORTADOR DE CORREIA TC - 18
- [x] Correspondência: TNZ8B89 — DONA MARGARIDA -> Outras Despesas de Setor -> ADMINISTRAÇÃO
- [x] Funcionalidade: UI em "Revisão Correspondências" para mapear novos centros de custo desconhecidos

## Reajuste Percentual de Salários de Operadores/Motoristas
- [x] Criar tabela no banco para armazenar percentual de reajuste por período de custo
- [x] Criar procedures tRPC para consultar/definir o percentual de reajuste
- [x] Integrar o reajuste no cálculo de custo: aplicar % sobre salários do mês anterior (somente equipamentos)
- [x] Criar UI para o usuário informar o percentual de reajuste no módulo de Apropriação de Custo
- [x] Garantir que salários de setores (Diretoria, Administração, etc.) NÃO sejam afetados pelo reajuste

## Bug: Importação de Vendas PDF - "spawn pdftotext ENOENT"
- [x] Substituir pdftotext (binário do sistema) por biblioteca Node.js para leitura de PDF
- [x] Extrair período automaticamente do conteúdo do PDF (campo "Período: DD/MM/YYYY a DD/MM/YYYY")
- [x] Remover necessidade de selecionar período manualmente antes de importar

## Impostos via Fluxo Realizado (a partir de maio/26)

- [x] Adicionar Grupo 2185 IMPOSTO ao mapeamento de contas do Fluxo Realizado -> conta "Imp., Trib., Taxas e CEFEM"
- [x] Incluir subgrupos: 2188-CEFEM, 5519-COFINS, 6003-CUSTAS PROCESSOS, 2187-ICMS SOUZA, 2100-ICMS SUBSTITUIÇÃO, 5508-IMPOSTO SIMPLES, 5518-PIS, 2269-TAXA
- [x] Excluir subgrupo 2081-GNRE da importação (adicionar à lista de contas excluídas)

## Bug: IMPOSTO (2185) não contabilizado na Apuração de Custo
- [x] Corrigir contaSistema do grupo 2185-IMPOSTO de "Imp., Trib., Taxas e CEFEM" para "Impostos, CEFEM e Outras Taxas" (nome correto da conta no banco)
- [x] Corrigir registros existentes em lancamento_fluxo com contaSistema errado
- [x] Atualizar lancamento_custo para incluir os R$ 388.253,35 do IMPOSTO (total agora R$ 399.694,47)

## Reajuste Salarial para Subcontas de Setor (Sal.Adm./Almox./Ofic./Serv.Aux./Encargos)
- [x] Implementar reajuste percentual para salários de setor (ADMINISTRAÇÃO, OFICINA, OUTROS SERVIÇOS AUXILIARES, ALMOXARIFADO)
- [x] Aplicar percentual de reajuste sobre valores do mês anterior (mesma lógica dos operadores)
- [x] Criar UI para informar o percentual de reajuste de salários de setor
- [x] Integrar com o cálculo de custo: usar valor reajustado no mês em apuração

## Melhoria Relatório Analítico - Separação de Subsetores
- [x] Mover subtotal de cada subsetor para o final da lista (não no início)
- [x] Adicionar separador visual claro entre subsetores

## Fix: Separador visual entre subsetores na exportação PDF/Excel
- [x] Adicionar linha separadora entre subsetores no relatório exportado (PDF/Excel)

## Bug: Reimportação de despesas acumula em vez de substituir
- [x] Ao reimportar despesas de equipamentos, substituir dados anteriores do mesmo período (não acumular)

## Feature: Exclusão de itens específicos na revisão de importação
- [x] Adicionar checkboxes nos itens do modal de revisão para permitir desmarcar itens individuais de uma conta

## Fix: Responsividade do modal de itens na revisão de importação
- [x] Melhorar layout do modal para não precisar rolar excessivamente (mostrar valor visível sem scroll horizontal)

## Fluxo Realizado: Substituição na reimportação
- [x] Implementar delete-before-insert na confirmação de importação do Fluxo Realizado (mesma lógica das despesas de equipamentos) — JÁ EXISTIA no código

## Fluxo Realizado: Exclusão de subcontas individuais na revisão
- [x] Adicionar checkboxes nas subcontas na fase de revisão do Fluxo para permitir desmarcar subcontas específicas
- [x] Subcontas desmarcadas não são importadas (exclusão pontual, não vai para "Contas Excluídas")
- [x] Recalcular totais ao desmarcar subcontas

## Correspondência 3006-DESPESAS INDIRETAS → setor DESPESAS INDIRETAS
- [x] Alterar mapeamento da conta 3006 no importador de Fluxo para setor "DESPESAS INDIRETAS" (remover de ADMINISTRAÇÃO)

## Relatório Ranking de Equipamentos por Gastos
- [x] Criar backend procedure para listar equipamentos com despesas (Lub, Desg, Rep, Outras) em ordem decrescente
- [x] Criar página frontend com drill-down (sintético → analítico por classificação → itens)
- [x] Separadores entre classificações de despesas e subtotais no final de cada
- [x] Exportação Excel com itens detalhados, separadores e subtotais
- [x] Exportação PDF com itens detalhados, separadores e subtotais
- [x] Impressão do relatório
- [x] Envio por WhatsApp
- [x] Registrar rota e adicionar ao menu de navegação no grupo Apuração

## Ranking Equipamentos: Nomes completos via correspondências
- [x] Corrigir TypeScript error em ImportDespesas.tsx (EquipamentoData → EquipamentoPreview)
- [x] Enviar equipamentoSistemaId na importação de despesas (correspondencia.id)
- [x] Resolver nomes completos no Ranking via CORRESPONDENCIAS_APROVADAS/FORCADAS quando equipamentoSistemaId é NULL no banco
- [x] Usar tagToResolvedId para buscar nome completo do equipamento cadastrado (ex: "PÁ CARREGADEIRA LIEBHERR L566 - 01" vs "- 02")

## Ranking Equipamentos: Limitar exportação a 10 primeiros
- [x] Limitar exportação PDF/Excel para apenas os 10 primeiros equipamentos do ranking
- [x] Adicionar nota de destaque no final do relatório informando que demais equipamentos podem ser consultados em "Apuração de Custo" → "Ranking Equipamentos" no sistema GEM

## Comparativo Multi-período: Percentuais de variação e tabela de indicadores
- [x] Mostrar percentual de mudança entre períodos na tabela "Comparativo por Plano de Custo" (verde = redução, vermelho = aumento)
- [x] Mostrar percentual de mudança entre períodos na tabela "Comparativo por Setores" (verde = redução, vermelho = aumento)
- [x] Criar terceira tabela com comparativos de "Custo/t (Produção)", "Custo/t (Vendas)", "C.M. s/ Despesas Indiretas" e "C.M. c/ Desp. Indiretas" com mesma lógica de percentual

## Bug Fix: Comparativo Indicadores - producaoTotal zero para períodos Método Caminhões
- [x] Corrigir comparativoIndicadores para buscar produção via Método Caminhões (parte_diaria_itens) quando producaoTotal do periodo_custo está vazio/zero (a partir de abril/2026)
- [x] Corrigir discrepância nos indicadores do Comparativo Multi-período vs Apuração de Custo: reescrever exclusão para filtrar lancamento_custo individualmente por tag (mesma lógica de listByPeriodo) em vez de usar itemDespesaImportado

## Comparativo Multi-período: Exportação de Indicadores
- [x] Adicionar botão de exportação PDF/Excel na tabela "Comparativo de Indicadores (R$/t)"
- [x] Adicionar botão consolidado na parte superior para exportar as 3 tabelas em um único relatório

## Bug Fix: Reimportação de Despesas não atualiza valores
- [x] Investigar e corrigir reimportação de despesas que não remove lançamentos antigos ao reimportar (valores permanecem iguais mesmo removendo itens da planilha) - Causa: cache tRPC não invalidado após importação
