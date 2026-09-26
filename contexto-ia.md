# Contexto IA

Diário de bordo das alterações feitas **com apoio de IA** neste projeto.
Existe para que uma sessão futura (de IA ou de gente) entenda em minutos *o que
mudou, por quê e o que ficou pendente*, sem reconstruir o raciocínio a partir do
`git log`.

## Como este arquivo se relaciona com os outros

| Arquivo | Público | Conteúdo |
|---|---|---|
| `app/src/lib/changelog.ts` | quem usa o app | "Sobre → Changelog" dentro do app |
| `LEIA-ME_teams_export.md` | quem usa o scraper | instalação e uso da linha de comando |
| **`contexto-ia.md`** | próxima sessão de IA | *este arquivo*: intenção, estado atual, o que não foi feito |

Não duplique o changelog. Aqui entra o que ele não guarda: o motivo por trás da
escolha, o que foi tentado e descartado, o que ficou pela metade.

## Regras de escrita

- **Mais recente no topo**, logo abaixo desta seção.
- Uma entrada por alteração coesa (não por arquivo, não por commit isolado).
- Português, direto. Sem adjetivo de marketing. Datas absolutas (`2026-09-26`).
- Caminhos como link relativo: `[proxy.ts](app/src/proxy.ts)`.
- Pendência dita explicitamente; sem pendência, `nenhuma`.
- Nunca copie conteúdo de conversas reais nem valores de `.env.local`.
- Quando o arquivo passar de umas 10 entradas, mover as mais antigas para
  `contexto-ia-arquivo.md` (consultado só por `Grep`, nunca inteiro).

Quem escreve aqui é o agente [`contexto-projeto`](.claude/agents/contexto-projeto.md),
chamado ao fim de cada alteração. Editar à mão também é válido.

---

## 2026-09-26 — Excel da Análise com recorte no nome, 404 para recorte vazio, eixo de horas e teste de EBUSY

**Branch:** `main` · **Commits:** `sem commit ainda`
**Arquivos:** [formatacao.ts](app/src/lib/formatacao.ts), [nomeArquivo.ts](app/src/lib/nomeArquivo.ts), [rota de exportar da Análise](app/src/app/api/analise/exportar/route.ts), [analise-view.tsx](app/src/components/analise/analise-view.tsx), [grafico-por-hora.tsx](app/src/components/analise/grafico-por-hora.tsx), [exportacoes/route.test.ts](app/src/app/api/exportacoes/route.test.ts), [changelog.ts](app/src/lib/changelog.ts)

**O quê.** (1) O Excel da Análise leva o recorte (autor e período) no nome do arquivo, no mesmo formato do PDF. (2) `/api/analise/exportar` com recorte de 0 mensagens responde 404 `SEM_MENSAGENS` em vez de um .xlsx só com cabeçalhos. (3) O gráfico por hora mostra as 24 horas (`interval=0`) e gira os rótulos em -90° quando o gráfico tem menos de 640 px. (4) Endurecimento do `afterEach` de `exportacoes/route.test.ts`. (5) Entrada nova no changelog do app.

**Por quê.** Fecha as pendências (2), (3) e (4) do ciclo 3 e a (3) do ciclo 2 das entradas anteriores. O 404: a tela já desabilita o botão com 0 mensagens, mas quem chamava a rota direto recebia um Excel vazio.

**Como.** Helper novo `partesDoRecorte` em `formatacao.ts`, usado também na referência do PDF; `nomeArquivoExportacao` ganhou o 4º parâmetro `recorte`. O autor entra no nome com no máximo 30 caracteres (`LIMITE_AUTOR_NO_NOME`, na rota), porque o slug do recorte tem teto de 80 e um autor de nome comprido cortava o período (achado da `natasha`, reproduzido com teste; a fixture ganhou uma 4ª mensagem de autora com nome longo). Gráfico: rótulos girados via `onResize` do `ResponsiveContainer`. Medido no navegador: a 736 px rótulo de 21 px e vão de 8,3 px; a 311 px (celular de 375) as 24 horas aparecem giradas e legíveis. O limiar 640 é extrapolação (~4 px de folga), não medido exatamente na transição. Teste de EBUSY: `afterEach` espera o processo filho morrer (`processoVivo`) e `limparTmp` tolera EBUSY/EPERM por ~5 s, só avisando. **Preventivo:** a falha não foi reproduzida (13 rodadas normais, 12 sob carga com 4 processos, 5 suítes completas, todas verdes); a causa (filho ainda segurando arquivo) é hipótese.
Descartado: aviso na tela para o 404 (o botão é `<a download>` sem fetch; a tela já desabilita); truncar o "h" dos rótulos (00h cabe no modo reto); teste unitário do SVG do Recharts (sem valor).

**Verificação.** `tsc` e lint limpos; 34 arquivos / 330 testes, 1 skip antigo por plataforma. Navegador (servidor isolado na porta 51795, senha gerada, banco temporário, 80 mensagens fictícias, já encerrado): 24 rótulos retos a 1700 px e girados a 375 px; `curl` na rota real: nome com recorte e 404 `SEM_MENSAGENS`. `maria-hill` = SEGUE (sem injeção de cabeçalho/caminho, sem rota nova, `proxy.ts`/auth intactos). `natasha`, 4 achados: frase do changelog prometia aviso que o `<a download>` não mostra (reescrita); autor comprido cortava o período (corrigido); Conversas ([mensagens/exportar/route.ts](app/src/app/api/mensagens/exportar/route.ts)) não acompanhou, **não alterado** por estar fora do pedido; comentário do limiar 640 dizia estimativa (agora traz a medição). Repowise reindexado (`repowise update` em `app/`): índice em `4b25be3`; aviso benigno "deleted-file prune refused for git_metadata" (134 caminhos), afeta só metadados de git.

**Impacto.** Visível: nome do Excel da Análise e gráfico por hora. A rota ganhou o código de erro `SEM_MENSAGENS` (só quem chama direto vê o 404).

**Pendências.** (a) Usuário ver o PDF impresso da Análise no diálogo de impressão. (b) Usuário rodar a extração do grupo "Projetos | Tecnologia" logado no Teams e conferir a data da mensagem mais antiga do arquivo (valida o scraper e fecha o gatilho do ciclo 4). (c) Decidir se Conversas (CSV/Excel) também ganha recorte no nome e 404 para 0 mensagens. (d) Monitorar se o EBUSY volta; se voltar, capturar o caminho no erro para achar a causa. (e) Medir a memória do XLSX com grupo grande (herdada). (f) Limiar 640 do gráfico não medido exatamente na largura de transição.

## 2026-09-26 — Ciclo 4 (fallback via Graph API) adiado; extração passa de 11/02/2025

**Branch:** `main` · **Commits:** `sem commit ainda`
**Arquivos:** [contexto-ia.md](contexto-ia.md) (a nota só altera o diário)

**O quê.** Decisão de **não** implementar agora o fallback de coleta via Microsoft Graph API, último dos 4 ciclos de aproveitamento dos outros projetos (a origem seria o projeto teams-chat-exporter, com MSAL, paginação, retry em 429 e filtro por período). Estado registrado: ciclos 1, 2 e 3 commitados (`b6b591b`, `136845e`, `e3f2957`) e enviados ao GitHub; origin/main = `e3f2957`.

**Por quê.** O fallback existia porque o scraper (`teams_chat_export.py`, `scrape_history`) parava em 11/02/2025 no grupo "Projetos | Tecnologia", apesar de o chat ser mais antigo. O commit `56af216` aumentou a tolerância (`max_iterations` 400→800, `stagnant_limit` 4→8, `scroll_wait_ms` 700→1500) e o usuário confirmou que a extração agora passa dessa data. **Essa validação é informada pelo usuário:** nenhuma sessão de IA conseguiu rodar a extração (o Teams pediu login e o script expirou esperando; o login é feito por pessoa). Não foi confirmada por execução da IA, nem se checou a data da mensagem mais antiga no arquivo exportado.

**Como.** O Graph foi avaliado e adiado. Custo: autenticação MSAL com possível aprovação de admin do tenant para o consentimento (Chat.Read etc.), um segundo caminho de coleta para manter ao lado do scraper, e um contrato novo entre ele e o app (que hoje só entende o JSON do scraper: flags `--json-out`/`--output`, `parseProgresso`, importação). Sem ganho enquanto o scraper atende.

**Impacto.** interno, sem efeito visível.

**Pendências.** Gatilho para reabrir o ciclo 4: só se o scraper voltar a truncar o histórico em chats muito longos, ou se quiserem extrair sem abrir o navegador. Isso é mudança arquitetural: começar por levantamento e perguntas antes de código. Se reabrirem, conferir também a data da mensagem mais antiga do arquivo exportado do grupo "Projetos | Tecnologia" para confirmar a validação por execução. Pendências herdadas do ciclo 3 continuam valendo (PDF impresso com gráficos novos não visto; eixo de horas com `interval=1`; Excel da Análise sem recorte no nome do arquivo; teste flutuante `exportacoes/route.test.ts` com EBUSY no Windows).

## 2026-09-26 — Análise: filtro por autor, atalhos de período e gráficos por hora e dia da semana

**Branch:** `main` · **Commits:** `e3f2957`
**Arquivos:** [kpis.ts](app/src/lib/kpis.ts), [periodoAnalise.ts](app/src/lib/periodoAnalise.ts), [formatacao.ts](app/src/lib/formatacao.ts), [rota de análise](app/src/app/api/analise/route.ts), [eixo.ts](app/src/components/charts/eixo.ts), [grafico-por-hora.tsx](app/src/components/analise/grafico-por-hora.tsx), [grafico-por-semana.tsx](app/src/components/analise/grafico-por-semana.tsx), [grafico-por-dia.tsx](app/src/components/analise/grafico-por-dia.tsx), [kpi-cards-analise.tsx](app/src/components/analise/kpi-cards-analise.tsx), [analise-view.tsx](app/src/components/analise/analise-view.tsx), [changelog.ts](app/src/lib/changelog.ts)

**O quê.** Na tela Análise: filtro por autor; atalhos de período (Tudo, Últimos 7/30/90 dias) com o ativo destacado; contador de filtros ativos e botão Limpar; gráficos novos "por hora do dia" e "por dia da semana"; cartões "Horário de pico" e "Dia mais movimentado". O Excel e o PDF da Análise passam a respeitar o recorte (grupo, período e autor).

**Por quê.** A Análise só filtrava por período e mostrava por dia e por autor. Ciclo 3 de 4 do aproveitamento dos outros projetos.

**Como.** Os atalhos são relativos à **última mensagem do grupo**, não a hoje: um chat com histórico antigo ficaria vazio em "últimos 30 dias". "7 dias" = 6 dias antes + o último. Autor e atalhos aplicam na hora; as datas só em "Aplicar período". A resposta de `/api/analise` ganhou `autores` (do grupo inteiro), senão escolher um autor esconderia os outros da lista. Hora e dia da semana vêm do horário que o Teams mostrou, sem conversão de fuso. Hora inválida (data sem hora, `T25:00`) não cai em nenhuma hora, para não inflar a meia-noite (achado da `natasha`, com teste). `rotuloHora` estava duplicado e foi para `formatacao.ts`.
Do Click Up veio só o estilo de eixo (`EIXO`, `TICK`, `PROPS_TOOLTIP`, que segue o tema) e a ideia do gráfico de horários. Descartados de propósito: filters-bar (amarrada à hierarquia do ClickUp), StatCard com ícone e gráfico de evolução em linha (YAGNI).

**Verificação.** `tsc` e lint limpos; 34 arquivos / 321 testes passando. Numa rodada, `exportacoes/route.test.ts` falhou no `afterEach` por EBUSY ao apagar a pasta temporária (`rmSync`, Windows) e passou na seguinte; arquivo não tocado, flutuação pré-existente. No navegador (servidor isolado, senha gerada, banco temporário, dados fictícios de 01/12/2024 a 11/02/2025, já encerrado): "Últimos 30 dias" terminou em 11/02/2025 (13/01–11/02); autor reduziu 167→22 mensagens mantendo os 3 autores na lista; Limpar voltou a 167; tema escuro legível. **Não foi visto** o PDF impresso com os gráficos novos.
Revisão: `natasha`, 5 achados, todos tratados (texto/título do Excel agora diz "recorte atual (grupo, período e autor)"; validação da hora; entrada no changelog; `rotuloHora` extraído; detalhe do cartão de pico diz "somando os dias do filtro"). `maria-hill` não foi necessária: sem rota nova (só o campo `autores`; o filtro por autor já existia em `lerFiltros`).

**Impacto.** Visível para quem usa. A resposta de `/api/analise` ganhou o campo `autores`. Com autor filtrado, a aba "Por autor" do Excel tem 1 linha.

**Pendências.** (1) Ver o PDF impresso com os gráficos novos. (2) O eixo de horas usa `interval=1` e mostra só horas pares; pico numa hora ímpar só aparece no tooltip. (3) O Excel da Análise não traz o recorte escrito nem no nome do arquivo (o PDF traz na referência). (4) Ajustar à parte o teste flutuante `exportacoes/route.test.ts` (EBUSY no Windows). (5) Ciclo 4 (fallback via Graph API) adiado, ver a entrada "Ciclo 4 (fallback via Graph API) adiado". (6) Commitado como `e3f2957` e enviado ao GitHub (origin/main = `e3f2957`).

## 2026-09-26 — Exportar CSV/Excel e PDF (Conversas e Análise)

**Branch:** `main` · **Commits:** `136845e`
**Arquivos:** [exportar.ts](app/src/lib/exportar.ts), [nomeArquivo.ts](app/src/lib/nomeArquivo.ts), [impressao.ts](app/src/lib/impressao.ts), [rota de mensagens](app/src/app/api/mensagens/exportar/route.ts), [rota de análise](app/src/app/api/analise/exportar/route.ts), [api.ts](app/src/lib/api.ts), [repositorio.ts](app/src/lib/db/repositorio.ts), [link-exportar.tsx](app/src/components/shared/link-exportar.tsx), [botao-pdf.tsx](app/src/components/shared/botao-pdf.tsx), [globals.css](app/src/app/globals.css) (`@media print` no fim), [changelog.ts](app/src/lib/changelog.ts), [package.json](app/package.json) (`exceljs`)

**O quê.** Conversas ganhou botões CSV e Excel no rodapé, que baixam **todas** as mensagens do filtro aplicado, não só a página exibida. Análise ganhou Excel (2 abas: Por autor, Por dia) e botão PDF (impressão do navegador). Botões ficam desabilitados sem dados.

**Por quê.** Até então só dava para ler na tela ou exportar `.txt`/`.json`. Conversas é paginada (50 por página), então exportar no navegador pegaria só uma página. Ciclo 2 de 4 do aproveitamento dos outros projetos.

**Como.** Exportação no servidor, por rotas GET que usam os mesmos filtros de `lerFiltros`; os botões são links `<a download>` simples. Isso muda o design inicial (dropdown + Blob no navegador), descartado: o `dropdown-menu` de ui não existe aqui e seria peso sem ganho. Análise sem CSV (são duas tabelas); Conversas sem PDF (paginada). CSV com BOM e `;`; XLSX via `exceljs` em import dinâmico. `nomeArquivo.ts` (`slugArquivo`, `sufixoData`, `nomeArquivoExportacao`) é compartilhado entre export e PDF. `repositorio.ts` ganhou `todasMensagens`, com SELECT/ORDEM compartilhados com `consultarMensagens` e o helper `paraMensagem`.
Injeção de fórmula: o CSV prefixa apóstrofo em texto que começa com `=`, `+`, `-`, `@`, tab ou CR (texto do Teams é dado de terceiro; o Click Up original não fazia isso); no XLSX a string vira texto, não fórmula (testado). PDF por `window.print()` com CSS de impressão em vez de jsPDF: texto vetorial e sem ~1 MB no bundle. O CSS de impressão esconde só `[data-sem-impressao]` (marcado no form da Análise), não todo `<form>`.

**Verificação.** `tsc` e lint limpos; 33 arquivos / 305 testes passando. Conferido no navegador com servidor isolado (senha gerada, banco temporário, já encerrado): links CSV/Excel baixam com `Content-Disposition` correto, BOM `EF BB BF`, zip `PK`, e o filtro por autor reduz o CSV às mesmas 3 linhas da tabela. **Não foi possível** exercitar o diálogo de impressão/PDF real nem ver o layout impresso.
Revisões: `maria-hill` = segue com ressalva (testes usavam nome de grupo real do Teams; trocado por "Grupo | Exportação"). `natasha` = 5 achados, todos tratados: `paraMensagem` não era usado em `consultarMensagens`; dois sanitizadores de nome divergentes (unificados; o PDF agora mantém a caixa, ex. `Analise-Grupo-Exportacao-2026-09-26`); CSS de impressão escondia todo form; botão Excel/PDF da Análise ativo com período vazio (agora desabilita); changelog sem entrada (adicionada). `heimdall`, `natasha` e `maria-hill` rodaram via subagente genérico, porque os agentes só carregam em sessão nova.

**Impacto.** Visível para quem usa. Nova dependência `exceljs` (só servidor, import dinâmico). Risco aceito e **não medido**: `todasMensagens` carrega o grupo inteiro em memória e o XLSX copia os dados várias vezes; estimativa de pico de centenas de MB para dezenas de milhares de mensagens. App local, um usuário, atrás de sessão.

**Pendências.** (1) Exercitar o PDF real numa impressão. (2) Medir a memória do XLSX com um grupo grande de verdade e decidir se precisa de teto com 413 ou de `ExcelJS.stream.xlsx.WorkbookWriter`. (3) `/api/analise/exportar` com período vazio ainda devolve xlsx só com cabeçalhos (a UI desabilita, a rota não recusa). (4) Ciclo 3 (feito em seguida, ver a entrada acima) e ciclo 4 (fallback via Graph API, por fazer).

## 2026-09-26 — Agentes de revisão e diário de contexto (adaptados do Click Up)

**Branch:** `main` · **Commits:** `b6b591b`
**Arquivos:** [.claude/agents/](.claude/agents/), [CLAUDE.md](CLAUDE.md), [contexto-ia.md](contexto-ia.md)

**O quê.** Cinco agentes do projeto Click Up trazidos para cá e reescritos para
este repositório: `heimdall` (publicar com segurança), `natasha` (revisão de
diff), `forge` (reutilizar antes de criar componente), `maria-hill` (segurança) e
`contexto-projeto` (este diário). O `CLAUDE.md` da raiz diz quando chamar cada um.

**Por quê.** Ciclo 1 de quatro para aproveitar o que os outros projetos já têm
(depois: exportação CSV/XLSX/PDF, filtros e gráficos na Análise, fallback via
Graph API). É só configuração de trabalho e vale para os ciclos seguintes.

**Como.** Não é cópia: os agentes citavam PMO Master, ClickUp, SQLite de tarefas,
`PMO_SENHA` e `CLICKUP_API_TOKEN`. Foram trocados por o que existe aqui:
`EXTRATOR_SENHA`, `proxy.ts` com checagem de `Origin`, `EXTRATOR_EXPORTS_DIR`,
`spawn` do scraper, `exports/` e `teams_profile/` como dado sensível, e a régua
`tsc` + `lint` + `vitest` + `unittest`. Descartados: `wanda` (exclusão em
cascata de tarefas do ClickUp, não se aplica) e o script de arquivamento do
diário (`diarioContexto.mts`, 120 linhas + 290 de teste): com o diário vazio é
peso sem uso; entra se ele crescer.

**Impacto.** interno, sem efeito visível no app.

**Pendências.** Os agentes só valem em uma sessão nova (o Claude Code lê
`.claude/agents/` ao abrir). Ainda não foram exercitados num diff real.
