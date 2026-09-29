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

## 2026-09-29 — Extração real de "Projetos | Tecnologia" confirma que o scraper não trunca mais (fecha a pendência de validação do Ciclo 4)

**Branch:** `main` · **Commits:** `sem commit ainda` (confirmação, sem mudança de código)
**Arquivos:** nenhum alterado; evidência em `app/exports/exportacao_24.json` e
`app/exports/exportacao_24.txt` (dados sensíveis, não versionados)

**O quê.** O usuário rodou, pelo próprio painel web em produção (porta 51794,
`app/.env.local` e `app/data/` reais), uma nova extração do grupo "Projetos |
Tecnologia" pelo formulário de Nova exportação. É a mesma validação que
faltava desde a entrada "Ciclo 4 (fallback via Graph API) adiado" de
2026-09-26, que registrava que nenhuma sessão de IA tinha conseguido rodar a
extração — a folga do scraper (`56af216`) não tinha sido confirmada por
execução real, nem se tinha checado a data da mensagem mais antiga no arquivo
exportado.

**Por quê.** Fechar, com execução de verdade e não só relato do usuário, se o
aumento de tolerância do scraper (`max_iterations` 400→800, `stagnant_limit`
4→8, `scroll_wait_ms` 700→1500, commit `56af216`) resolveu o truncamento do
histórico que motivava reabrir o Ciclo 4 (fallback via Graph API).

**Como.** O usuário logou no painel pelo próprio navegador (Brave, sessão
dele; a IA não viu nem digitou a senha), preencheu "Projetos | Tecnologia" e
clicou Exportar. Acompanhamento feito de fora da sessão autenticada: processo
do Windows (`python.exe` rodando `teams_chat_export.py` com
`--json-out`/`--output`) e a pasta `exports/`, sem ler conteúdo de mensagem.
Exportação nº 24 no histórico, iniciada 08:55:34, arquivos gravados 09:13
(~17,5 min). Metadados extraídos de `exportacao_24.json` com um script
pontual (contagem de mensagens e datas brutas primeira/última, sem autor nem
texto): grupo "Projetos | Tecnologia", 5.316 mensagens, primeira mensagem em
14 de julho de 2022, última "Hoje às 08:52" (29/09/2026). Cabeçalho do `.txt`
confere: "Total de mensagens: 5316".

**Impacto.** Nenhuma mudança de código; é confirmação. A mensagem mais antiga
(14/07/2022) está muito além do antigo limite de 11/02/2025 que travava o
scraper, então a tolerância maior resolveu o truncamento. Fecha de vez o
gatilho de reabertura do Ciclo 4 por truncamento do scraper. O outro gatilho
("se quiserem extrair sem abrir o navegador") continua de pé, mas é decisão
de produto, não bug.

**Pendências.** Nenhuma nova; nenhuma pendência residual sobre o scraper
truncar histórico. Verificação: metadados conferidos (contagem batendo entre
cabeçalho do `.txt` e o JSON; datas plausíveis); conteúdo das mensagens não
foi aberto (dado sensível).

---

## 2026-09-29 — Auditoria de segurança: os 2 itens 🟠 "baratos" implementados; 2 ficam adiados de propósito

**Branch:** `main` · **Commits:** `sem commit ainda`
**Arquivos:** [app/package.json](app/package.json),
[app/README.md](app/README.md),
[app/src/components/exportacoes/formulario-exportacao.tsx](app/src/components/exportacoes/formulario-exportacao.tsx),
[app/src/components/exportacoes/importar-txt.tsx](app/src/components/exportacoes/importar-txt.tsx),
[app/src/components/conversas/conversas-view.tsx](app/src/components/conversas/conversas-view.tsx),
[app/src/lib/parametros.ts](app/src/lib/parametros.ts),
[app/src/lib/importacao.ts](app/src/lib/importacao.ts),
[app/src/lib/importacao.test.ts](app/src/lib/importacao.test.ts),
[app/src/lib/changelog.ts](app/src/lib/changelog.ts)

**O quê.** Dos 4 itens 🟠 adiados na auditoria de segurança de 18 itens
(2026-09-27), o usuário pediu o planejamento dos restantes e escolheu "só os
baratos": (1) a dependência transitiva `uuid` vulnerável, vinda de `exceljs`,
fixada por `overrides` no [package.json](app/package.json)
(`"uuid": "^11.1.1"`) em vez de trocar de biblioteca de planilha; (2)
`maxLength` no frontend nos três campos de texto livre que já tinham teto no
backend: nome do grupo (exportar e importar) e busca no texto de Conversas
(nova constante `TAMANHO_MAXIMO_FILTRO_TEXTO=200` em
[parametros.ts](app/src/lib/parametros.ts), substituindo dois `200` crus
escritos direto em `lerFiltros`).

**Por quê.** `npm audit` reportava 2 avisos moderados por causa de `uuid`
(GHSA-w5hq-g745-h8pq, sobre o argumento opcional `buf` de `uuidv4()`); a
correção registrada na auditoria original (trocar `exceljs`) era um breaking
change desnecessário — grep em `node_modules/exceljs/lib` confirmou que
`exceljs@4.4.0` só chama `uuidv4()` sem argumento nenhum, então o
override basta e não muda a versão do `exceljs`. O `maxLength` fecha a
diferença entre o que a tela deixa digitar e o que o backend de fato aceita.

**Como.** Ao revisar o `maxLength` do campo de import, apareceu um achado
real (não cosmético) da `natasha`: o backend do import
([importacao.ts](app/src/lib/importacao.ts), `importarTxt`) nunca tinha o
teto de verdade — só fazia `trim()`, sem chamar `validarGrupo` (que só a
exportação usava, via `orquestrador.ts`). O `maxLength=200` da tela prometia
um limite que o import não impunha. Duas opções de correção: cortar em
silêncio (como o frontend já fazia) ou recusar com erro. A `maria-hill`
apontou que cortar em silêncio pode fundir dois grupos diferentes que só
divergissem depois do caractere 200, porque `obterOuCriarGrupo` casa por
igualdade exata de nome — e que o import também nunca checava caractere de
controle (TAB/NUL) no nome, diferente da exportação. Perguntado
explicitamente, o usuário escolheu **recusar**, não cortar. `importarTxt`
passou a chamar `validarGrupo()` (mesma função da exportação) sobre o nome
resolvido (informado ou lido do cabeçalho) e lançar `ErroImportacao` com o
motivo dela; isso fecha de graça a checagem de caractere de controle também.
O placeholder do campo de nome do grupo no import foi ajustado (achado da
`natasha`) porque ficou defasado: preencher esse campo agora também é o
jeito de contornar um cabeçalho com nome inválido/comprido, não só um
cabeçalho ausente. Nota sobre o override adicionada em
[README.md](app/README.md) (seção Desenvolvimento) porque `package.json` é
JSON puro e não aceita comentário — sem isso uma limpeza futura de
"overrides não usados" apagaria a linha sem saber que fecha um item da
auditoria.

**Impacto.** Visível para quem usa: importar um `.txt` com nome de grupo
comprido demais ou com caractere de controle agora dá erro claro em vez de
aceitar cortado; os três campos de texto mostram o limite ao digitar.
`npm audit` foi de 2 avisos moderados para 0. Entrada nova em
[changelog.ts](app/src/lib/changelog.ts) (categoria correção, 2026-09-29):
"Nome do grupo comprido demais é recusado, não cortado". Sem alteração em
`app/src/lib/auth/`, `app/src/proxy.ts` nem no `spawn` do orquestrador.
Verificação: `tsc` e lint limpos; 35 arquivos / 348 testes passando (1 skip
antigo por plataforma); `npm audit` = 0 vulnerabilidades.

**Pendências.** Os outros 2 itens 🟠 da auditoria de 2026-09-27 continuam
adiados de propósito (decisão do usuário, não esquecimento): (a) revogação
seletiva de sessão exigiria uma tabela `sessoes` no SQLite (id, criada_em,
expira_em, revogada_em) e o cookie carregando esse id, com `sessaoEhValida`
passando a consultar o banco a cada requisição em vez de só validar a
assinatura HMAC — é a primeira peça de um sistema multiusuário que o app não
tem por design; reabrir só se o app ganhar múltiplos usuários; (b) rate
limit genérico fora do login exigiria extrair o mecanismo de
`app/src/lib/auth/limiteTentativas.ts` (hoje só por origem, só para login)
para algo reusável por rota; hoje as demais rotas já têm proteção própria
parcial (índice único serializando exportação, teto de tamanho de upload,
tudo atrás de sessão); reabrir só se o app deixar de rodar exclusivamente em
127.0.0.1.

---

## 2026-09-28 — Conversas (CSV/Excel) ganha o mesmo recorte no nome e 404 sem mensagens que a Análise

**Branch:** `main` · **Commits:** `sem commit ainda`
**Arquivos:** [app/src/lib/formatacao.ts](app/src/lib/formatacao.ts),
[app/src/lib/nomeArquivo.ts](app/src/lib/nomeArquivo.ts),
[app/src/app/api/mensagens/exportar/route.ts](app/src/app/api/mensagens/exportar/route.ts),
[app/src/app/api/analise/exportar/route.ts](app/src/app/api/analise/exportar/route.ts),
[app/src/lib/changelog.ts](app/src/lib/changelog.ts)

**O quê.** Estendida à exportação de Conversas (CSV/Excel) a mesma pendência
decidida pelo usuário ("faz o recorte no Conversas também"): recorte (autor,
período e agora também busca no texto) no nome do arquivo, e 404
`SEM_MENSAGENS` para recorte vazio — mesmo tratamento que a Análise já tinha
desde 2026-09-26. `partesDoRecorte` ganhou o parâmetro `texto` (formatado
como `busca: "..."`, por último, só quando presente). Nova função
`recorteParaArquivo` em `nomeArquivo.ts` corta autor e texto em 30 caracteres
cada (`LIMITE_TRECHO_NO_NOME`) antes de formatar, para nenhum dos dois
sozinho engolir o teto de 80 do slug do recorte. A rota da Análise foi
refatorada para usar esse `recorteParaArquivo` compartilhado em vez do
`LIMITE_AUTOR_NO_NOME` que só existia ali.

**Por quê.** Fecha a pendência registrada em 2026-09-26 e repetida na
entrada anterior (2026-09-28, confirmação do PDF): "decidir se a exportação
de Conversas ganha o mesmo recorte no nome do arquivo e 404 para 0
mensagens que a Análise já tem".

**Como.** Compartilhar `recorteParaArquivo`/`partesDoRecorte` entre as duas
rotas em vez de duplicar a lógica de corte. Achado da `natasha`, tratado: o
refactor da rota da Análise fez `texto` (parâmetro `q`, que `lerFiltros` já
aceitava e `montarWhere` já usava para filtrar os KPIs, comportamento
anterior a este diff) passar a aparecer no nome do Excel da Análise também
— a Análise não tem UI de busca, mas a URL aceita `q=` do mesmo jeito.
Decisão: manter esse comportamento (o nome do arquivo passa a dizer a
verdade sobre o filtro já aplicado aos dados, em vez de escondê-lo),
documentado no comentário de `partesDoRecorte` (que deixou de dizer
"Recorte da Análise" e virou "Recorte de um filtro", citando `busca`) e
coberto por teste novo. Outro achado da `natasha`, tratado: faltava teste de
busca comprida (>30 caracteres) combinada com período pela rota de
Conversas (só havia teste unitário isolado de `recorteParaArquivo`).
Achados descartados/sem ação da `natasha`: `conversas-view.tsx` não
precisava de ajuste (`total===0` já reflete todos os filtros porque
`/api/mensagens` e `/api/mensagens/exportar` usam o mesmo `montarWhere`); a
frase do changelog mantida como está, por ficar tecnicamente correta com a
decisão tomada acima.

**Impacto.** Visível para quem usa: nome dos arquivos de Conversas mudou
(passa a incluir autor/período/busca); a rota de exportação de Conversas
agora recusa com 404 `SEM_MENSAGENS` quando o recorte não tem mensagem, em
vez de gerar arquivo só com cabeçalhos. Entrada nova em
[changelog.ts](app/src/lib/changelog.ts) (melhoria, 2026-09-28).

**Verificação.** `tsc` e lint limpos; 35 arquivos / 346 testes passando (1
skip antigo por plataforma). Revisão `maria-hill`: segue — achado aceito
como decisão de produto (não vulnerabilidade): o termo de busca passa a
constar no nome do arquivo baixado, visível na pasta Downloads e no
histórico do navegador (já acontecia com o autor antes; o termo é limitado
a 30 caracteres e passa por slug). Revisão `natasha`: 5 achados, tratados
conforme descrito em "Como".

**Pendências.** Nenhuma nova relacionada a este item — fecha a pendência
"decidir se Conversas ganha o mesmo recorte/404 que a Análise" (ver linha
abaixo, atualizada). Seguem só os itens 🟠 da auditoria de segurança de 18
itens (`uuid` via `exceljs`, tokens sem revogação seletiva, rate limit fora
do login, validação frontend sem `maxLength`), aceitos e adiados sem prazo,
e agora também o achado da `maria-hill` sobre o termo de busca no nome do
arquivo (risco aceito, sem ação).

## 2026-09-28 — Confirmado pelo usuário: PDF da Análise sai correto na impressão real

**Branch:** `main` · **Commits:** `sem commit ainda`
**Arquivos:** nenhum (confirmação, sem mudança de código)

**O quê.** O usuário confirmou, com print da pré-visualização real de
impressão do navegador (grupo "Projetos | ClickUp & Controladoria", 7.567
mensagens, 411 dias), que o PDF da Análise sai correto: os cartões, o gráfico
"Mensagens por hora do dia" com as 24 horas completas (pico 11h-12h visível,
rótulos legíveis), o gráfico "Mensagens por dia da semana", o gráfico
"Mensagens por dia" e a lista de Autores aparecem certos na folha, ocupando a
largura esperada, sem cortar.

**Por quê.** Fecha por execução (validação do usuário, com evidência visual)
a pendência "confirmar a pré-visualização de impressão do PDF", em aberto
desde a entrada "PDF da Análise saía com os gráficos em branco (e, depois,
estreitos e cortados)" (2026-09-26) desta mesma sessão, repetida nas
entradas seguintes.

**Como.** Sem mudança de código: só a confirmação visual que faltava desde a
correção (CSS de impressão e `data-grade-graficos`, commit `68dfa16`).

**Impacto.** Nenhum (confirmação, sem código).

**Verificação.** Nenhuma nova — só a evidência visual trazida pelo usuário.

**Pendências.** (1) resolvida em 2026-09-28, ver entrada "Conversas
(CSV/Excel) ganha o mesmo recorte no nome e 404 sem mensagens que a
Análise" logo acima. (2) itens 🟠 da auditoria de segurança de 18 itens
(dependência `uuid` via `exceljs`, tokens sem revogação seletiva, rate
limit ausente fora do login, validação frontend sem `maxLength`), aceitos e
adiados sem prazo.

## 2026-09-27 — Documentação do GitHub atualizada e README.md criado na raiz

**Branch:** `main` · **Commits:** `sem commit ainda`
**Arquivos:** [app/README.md](app/README.md), [README.md](README.md)

**O quê.** Usuário perguntou se a documentação do GitHub estava atualizada.
Comparados [app/README.md](app/README.md) e [LEIA-ME_teams_export.md](LEIA-ME_teams_export.md)
contra o código atual. O segundo (script Python) estava em dia, sem mudança.
O primeiro estava desatualizado em 3 pontos, corrigidos: (1) a descrição de
Conversas não citava a exportação CSV/Excel (ciclo 2); (2) a descrição de
Análise ainda dizia "total de mensagens, autores, média por dia, gráfico por
dia e ranking de autores", sem os recursos do ciclo 3 (filtro por autor,
atalhos de período, gráficos por hora e por dia da semana, cartões de horário
de pico e dia mais movimentado, exportação Excel/PDF); (3) "Notas de
segurança" não citava o rate limit do login (10 tentativas/5min, atraso
400ms), a decisão deliberada sobre `Origin` ausente (remete a este diário),
nem os cabeçalhos anti-clickjacking (X-Frame-Options/CSP) da entrada anterior
desta mesma sessão — a descrição de `verificar:api` também passou a citar
esse check.

Criado também [README.md](README.md) na raiz do projeto (não existia): só
havia `LEIA-ME_teams_export.md`, e o GitHub só renderiza automaticamente na
página do repositório um arquivo chamado exatamente "README" (qualquer
extensão) — "LEIA-ME_..." não é reconhecido, logo a página inicial do repo
provavelmente aparecia vazia. O novo arquivo é curto: aponta para
`LEIA-ME_teams_export.md` (linha de comando) e `app/README.md` (painel web),
com um início rápido do painel.

**Por quê.** Pergunta direta do usuário sobre documentação; o problema
estrutural da raiz sem README.md reconhecível pelo GitHub apareceu ao
investigar.

**Como.** Revisão (`natasha`) comparou o diff de documentação contra o código
(`limiteTentativas.ts`, `proxy.ts`, `next.config.ts`, `verificar-api.mjs`,
`analise-view.tsx`, `kpi-cards-analise.tsx`, `periodoAnalise.ts`,
`grafico-por-hora.tsx`, `grafico-por-semana.tsx`, `analise/exportar/route.ts`,
`nomeArquivo.ts`, `conversas-view.tsx`): nenhuma contradição texto↔código,
nenhum link quebrado entre os 3 `.md`, nenhum recurso recente faltando. Um
achado de prosa corrigido: o texto descrevia "gráficos por dia, por autor,
por hora do dia e por dia da semana" como se fossem 4 gráficos da mesma
família, mas "por autor" é o ranking de autores — uma lista, sem recharts,
não um gráfico de barra como os outros três; separado na frase final.
`maria-hill` não foi chamada (documentação, sem rota/auth/download/spawn/proxy
tocado). Descartado: mexer em `docs/superpowers/plans/` e
`docs/superpowers/specs/` (retrato histórico do design de 2026-09-21, não
documentação viva); fazer o README da raiz mais longo (o conteúdo já vive em
`app/README.md` e `LEIA-ME_teams_export.md`, o da raiz é só ponte).

**Impacto.** Visível para quem lê o repositório; a partir de agora a página
inicial no GitHub deve renderizar o novo `README.md`.

**Pendências.** Nenhuma nova. As pendências das entradas anteriores desta
sessão continuam valendo (confirmação do PDF impresso pelo usuário; decisão
sobre recorte/404 em Conversas; itens 🟠 da auditoria de segurança, aceitos e
adiados).

## 2026-09-27 — Auditoria de segurança completa (checklist de 18 itens) e correção de clickjacking

**Branch:** `main` · **Commits:** `sem commit ainda`
**Arquivos:** [next.config.ts](app/next.config.ts), [verificar-api.mjs](app/scripts/verificar-api.mjs)

**O quê.** Auditoria de segurança de ponta a ponta do projeto (env exposta,
validação front/back, SQL injection, autenticação, IDOR, senha no banco,
força bruta, bloqueio durante envio, CSRF, upload, revelação de informação,
dependências, tokens, rate limit, dados sensíveis, SSRF, cookies), feita só
lendo código — sem alterar nada até o achado do item CSRF/clickjacking.
Nenhum item fechou como crítico ou alto confirmado.

Resultado por status:
- 🟢 **não encontrado**: env exposta; validação backend; SQL injection (tudo
  parametrizado via `db.prepare`); autenticação; senha no banco; força bruta
  (10 tentativas / 5 min + atraso fixo de 400 ms); bloqueio durante envio
  (índice único no SQLite); upload (extensão, tamanho e `Content-Length`
  checados); SSRF (nenhuma rota aceita URL de usuário).
- ⚪ **não aplicável**: IDOR (app de senha única, sem conceito de
  usuário/dono de recurso, por design); dados sensíveis (o próprio produto é
  repositório de conversas, protegido pela sessão).
- 🟠 **risco/parcial, sem virar tarefa imediata**: validação frontend (sem
  `maxLength` no HTML, mas o backend refaz tudo); revelação de informação (a
  última linha do stderr do script Python pode vazar num erro, só para quem
  já tem sessão); dependências (`npm audit` achou `uuid < 11.1.1` moderado
  via `exceljs`; correção exige breaking change, adiada); tokens (sem
  revogação seletiva de sessão, só trocar a senha); rate limit (só o login
  tem; as demais rotas não, aceito por serem seriadas ou de baixo custo);
  cookies (`Secure` depende do protocolo, correto para uso local em
  `127.0.0.1`).

Corrigido nesta sessão (item CSRF/clickjacking, os 2 pontos acionáveis):
(a) **decisão, não código** — o [proxy](app/src/proxy.ts) (`origemInvalida`)
aceita `POST`/`PUT`/`PATCH`/`DELETE` sem cabeçalho `Origin`; isso é
deliberado e já coberto por teste (`app/src/proxy.test.ts`, "POST sem Origin
passa (curl, servidor a servidor)"; `scripts/verificar-api.mjs` também espera
400 `GRUPO_INVALIDO` e não 403 nesse caso). Perguntado ao usuário se fechava
essa janela (rejeitar `Origin` ausente) ou mantinha: escolheu **manter como
está** — risco residual baixo (exige navegador que não manda `Origin` em
requisição cross-site) contra quebrar o suporte a curl/script que dois testes
garantem hoje. Não virou decision record formal (`get_why` não achou nenhuma
para este arquivo), só este registro.
(b) **implementado** — cabeçalho anti-clickjacking. [next.config.ts](app/next.config.ts)
ganhou `async headers()` retornando, para `/:path*`, `X-Frame-Options: DENY`
e `Content-Security-Policy: frame-ancestors 'none'`. Motivo: nenhum uso de
`<iframe>` no app (grep vazio), logo nada deveria poder embuti-lo.

**Por quê.** Pedido explícito de auditoria de segurança; o único item com
correção acionável e de baixo custo foi o cabeçalho de embedding ausente.

**Como.** TDD: acrescentado o check "SEG-1" em
[verificar-api.mjs](app/scripts/verificar-api.mjs) antes da mudança,
confirmado FAIL contra servidor real (porta 51795, dados sintéticos; 16
PASS / 1 FAIL / 1 SKIP); depois do `next.config.ts`, rebuild e nova rodada:
17 PASS / 0 FAIL / 1 SKIP (o skip é pré-existente, `DL-1[NUL]`, não
relacionado). Descartado: testar `headers()` em vitest — só é aplicado pelo
servidor completo do Next, não pelas rotas importadas direto nos testes
unitários; isso ficou documentado em comentário no próprio `next.config.ts`.
`maria-hill`: segue (sem rota nova; CSP não afeta script/estilo, só
embedding; proxy/auth/download/spawn intactos; não reavaliou a decisão do
`Origin`, só confirmou que o diff não mexeu nisso); sugeriu reforçar o SEG-1
com `GET /` sem cookie (o redirect do proxy). `natasha`: 2 achados, ambos
tratados — (1) a nota do SEG-1 só imprimia metade da evidência (só `/login`,
não `/api/grupos`), quebrando o padrão das outras notas da fase A (ORIG-1,
UP-1, DL-1, CONC-1, que juntam tudo numa nota só); (2) observação (não é
falha): não há teste vitest para `headers()` do Next — já confessado no
comentário do arquivo —, então o SEG-1 é a única rede de proteção para esse
comportamento; se `verificar:api` sair do fluxo de release, uma regressão
nos headers não seria pega pela régua padrão (`tsc` + lint + vitest). SEG-1
hoje confere os 3 casos (login público, redirect do proxy em `/`, API
autenticada) numa nota só.

**Impacto.** Interno, infraestrutura de segurança, sem UI visível. Efeito
colateral: o `npm run build` feito para esta verificação também deixa o
build de `.next` do usuário atualizado com todas as correções desta sessão
de trabalho anteriores (Excel/404/gráfico por hora, PDF em branco e PDF
estreito) — falta só `npm start` de novo para servir o build atual, sem
precisar rodar `npm run build` de novo.

**Verificação.** `tsc` e lint limpos; vitest 35 arquivos / 336 testes
passando (1 skip antigo por plataforma, sem mudança); `verificar-api.mjs`
(servidor real, dados sintéticos, build de produção) com 17 PASS / 0 FAIL /
1 SKIP.

**Pendências.** (a) RESOLVIDA em 2026-09-28 — ver a entrada "Confirmado pelo
usuário: PDF da Análise sai correto na impressão real" (era: confirmar a
pré-visualização de impressão do PDF corrigido, pendência de entrada
anterior, "PDF da Análise saía com os gráficos em branco"); (b) decidir se a
exportação de Conversas (CSV/Excel)
ganha o mesmo recorte no nome e 404 para 0 mensagens que a Análise já tem
(pendência de sessão anterior); (c) itens 🟠 da auditoria ficam registrados
como aceitos/adiados, sem prazo: dependência `uuid` via `exceljs`, tokens
sem revogação seletiva, rate limit ausente fora do login, validação
frontend sem `maxLength` — reabrir só se o contexto do produto mudar (por
exemplo, se o app deixar de rodar só em `127.0.0.1`).

## 2026-09-26 — PDF da Análise saía com os gráficos em branco (e, depois, estreitos e cortados)

**Branch:** `main` · **Commits:** `sem commit ainda` (base publicada: `43ebf2e`)
**Arquivos:** [globals.css](app/src/app/globals.css), [globals.print.test.ts](app/src/app/globals.print.test.ts), [changelog.ts](app/src/lib/changelog.ts), [analise-view.tsx](app/src/components/analise/analise-view.tsx), [botao-pdf.tsx](app/src/components/shared/botao-pdf.tsx)

**O quê.** Na pré-visualização de impressão da Análise, os 3 gráficos Recharts (por dia, por hora, por dia da semana) saíam vazios. Cartões e lista de Autores (HTML puro), cabeçalho e nome do arquivo (`Analise-<grupo>-<data>`) saíam corretos. Agora os gráficos aparecem.

**Por quê.** A regra "rede de segurança" criada no ciclo 2 em `@media print` (`svg, .recharts-wrapper, .recharts-surface { max-width: 100% !important }`) colapsava o `.recharts-wrapper` a 0 px na impressão (o SVG seguia com 666 px). No ciclo 2 o diálogo de impressão não foi exercitado; quem revelou foi o print do usuário.

**Como.** Removida a regra `max-width`, com comentário no lugar. Teste novo `globals.print.test.ts`: lê o CSS sem comentários, acha o bloco `@media print` real (início de linha + contagem de chaves) e falha se `svg`/`.recharts-*` tiverem `max-width` ou `max-inline-size`. Provado por mutação: falha com a regra antiga e com `max-inline-size` reinserida; passa no CSS atual. Entrada de correção no changelog do app.
Reprodução/prova: Playwright/Chromium com `emulateMedia print` na largura A4 (794 px), repetindo a sequência do `BotaoPdf` (atributos no body, `data-preparando-impressao` no html, resize, 2 rAF): wrapper 0 px antes, 666 px depois; screenshot com os 4 gráficos completos (24 horas do gráfico por hora). Instância isolada (porta 51795, senha gerada, banco temporário, 80 mensagens fictícias, já encerrada). Não havia rasterizador de PDF (`pdftoppm`) na máquina: o PDF de `page.pdf()` não foi visto como imagem, só a mídia de impressão emulada.
Troca consciente: com Ctrl+P direto (sem o `BotaoPdf`) o atributo `data-preparando-impressao` não existe e nada limita o desenho ao A4. Aceito: gráfico um pouco largo é melhor que em branco. O comentário no CSS registra isso.
Descartado: teste de layout em Chromium na suíte (pesado; teste de texto + prova manual bastam por ora).
Aprendido: o servidor do usuário na porta 51794 era um `next start` com build de 22/09 (a tela mostrava a versão antiga); o build foi refeito e reiniciado por ele.

**Verificação.** `tsc` e lint limpos; 35 arquivos / 332 testes, 1 skip antigo por plataforma. `natasha`, 5 achados, todos tratados: teste ancorava no `@media print` de um comentário; regex deixava passar `max-inline-size` e era frágil com comentário; comentário prometia que o `BotaoPdf` sempre limita (agora "no fluxo do BotaoPdf" + a troca acima); sem resíduo de "rede de segurança" em `src/`; comentário cita o teste com caminho completo. `maria-hill` não necessária (só CSS, teste e changelog; sem rota/auth/download/spawn).

**Impacto.** Visível: PDF da Análise. Risco conhecido: o Ctrl+P direto não limita a largura (ver troca acima).

**Pendências.** (a) RESOLVIDA em 2026-09-28 — ver a entrada "Confirmado pelo usuário: PDF da Análise sai correto na impressão real" (era: usuário conferir de novo a pré-visualização de impressão após `npm run build` e reiniciar o servidor; ver também o segundo defeito abaixo). (b) RESOLVIDA em 2026-09-28, mesma entrada — o print do usuário mostra os rótulos do gráfico por hora legíveis.

### Segundo defeito (descoberto depois que o usuário imprimiu de novo, após o rebuild)

**Sintoma.** Os gráficos passaram a aparecer, mas estreitos (o por hora ocupava cerca de 1/3 do cartão) e cortados na borda direita (barra das 23h, "Dom").

**Causa.** O `BotaoPdf` estreita a página (`data-preparando-impressao`, `main` de 700 px), mas o Recharts mede ainda na mídia de tela. Lá, as duas grades de gráficos de `analise-view.tsx` usam `lg:` (viewport largo) e ficam em 2 colunas: gráficos medidos em 392/286/286 px. Na impressão o viewport é de ~703 px, a grade cai para 1 coluna e os cartões viram 700 px, mas o Recharts não remede na impressão real.

**Correção.** `data-grade-graficos` nas duas grades. Em `globals.css`, fora do `@media`: `:root[data-preparando-impressao] [data-grade-graficos] { grid-template-columns: minmax(0, 1fr) !important }` e `padding: 0 !important` no `main` do preparo (igual ao `@media print`), para o layout medido ser o da folha. `minmax(0, 1fr)` e não `1fr` (natasha: nome longo esticaria a coluna). Comentários de `globals.css` e `botao-pdf.tsx` agora citam essa dependência (diziam que estreitar a página bastava). A grade dos KPIs não precisa do atributo (sem Recharts).

**Lição sobre a prova.** A prova anterior (Chromium com mídia de impressão emulada) foi generosa demais: o Recharts teve tempo de remedir. A reprodução fiel exige desconectar os `ResizeObserver` depois do preparo (script Playwright que os registra via `addInitScript` e os desconecta após o preparo). Assim: gráficos de 668 px em cartões de 700 px (antes 392/286/286); screenshot com os 4 gráficos completos e as 24 horas.

**Testes.** `globals.print.test.ts` ampliado (6 testes): a regra do preparo existe FORA do `@media print` com `minmax(0, 1fr)`; `padding: 0` no `main` do preparo; `data-grade-graficos` em 2 elementos `<div>` JSX. Limitação: verificação por texto; nada obriga uma futura terceira grade com gráfico a levar o atributo (natasha, achado 2; aceito, o comentário do botão avisa). Aprendido: um one-liner de shell corrompeu o arquivo de teste numa etapa; foi reescrito inteiro.

**natasha (2ª rodada).** 3 achados tratados: comentários desatualizados; teste que não distinguia dentro/fora do `@media` e contava o atributo em qualquer texto; `1fr` puro. Sem `maria-hill` (só CSS, teste, comentário e marcação).

**Verificação.** `tsc` e lint limpos; 35 arquivos / 336 testes, 1 skip antigo. O build atual em `.next` NÃO tem esta correção.

**Impacto (segundo defeito).** Visível (PDF da Análise). Ctrl+P direto (sem o botão) continua sem o preparo, então o gráfico pode ficar estreito ou largo; troca consciente já registrada.

**Pendências (segundo defeito).** RESOLVIDA em 2026-09-28 — ver a entrada "Confirmado pelo usuário: PDF da Análise sai correto na impressão real" (era: usuário conferir a pré-visualização de impressão e a legibilidade dos rótulos do gráfico por hora; entrada no changelog do app já existe, commit `68dfa16`).

## 2026-09-26 — Excel da Análise com recorte no nome, 404 para recorte vazio, eixo de horas e teste de EBUSY

**Branch:** `main` · **Commits:** `43ebf2e` (publicado em origin/main)
**Arquivos:** [formatacao.ts](app/src/lib/formatacao.ts), [nomeArquivo.ts](app/src/lib/nomeArquivo.ts), [rota de exportar da Análise](app/src/app/api/analise/exportar/route.ts), [analise-view.tsx](app/src/components/analise/analise-view.tsx), [grafico-por-hora.tsx](app/src/components/analise/grafico-por-hora.tsx), [exportacoes/route.test.ts](app/src/app/api/exportacoes/route.test.ts), [changelog.ts](app/src/lib/changelog.ts)

**O quê.** (1) O Excel da Análise leva o recorte (autor e período) no nome do arquivo, no mesmo formato do PDF. (2) `/api/analise/exportar` com recorte de 0 mensagens responde 404 `SEM_MENSAGENS` em vez de um .xlsx só com cabeçalhos. (3) O gráfico por hora mostra as 24 horas (`interval=0`) e gira os rótulos em -90° quando o gráfico tem menos de 640 px. (4) Endurecimento do `afterEach` de `exportacoes/route.test.ts`. (5) Entrada nova no changelog do app.

**Por quê.** Fecha as pendências (2), (3) e (4) do ciclo 3 e a (3) do ciclo 2 das entradas anteriores. O 404: a tela já desabilita o botão com 0 mensagens, mas quem chamava a rota direto recebia um Excel vazio.

**Como.** Helper novo `partesDoRecorte` em `formatacao.ts`, usado também na referência do PDF; `nomeArquivoExportacao` ganhou o 4º parâmetro `recorte`. O autor entra no nome com no máximo 30 caracteres (`LIMITE_AUTOR_NO_NOME`, na rota), porque o slug do recorte tem teto de 80 e um autor de nome comprido cortava o período (achado da `natasha`, reproduzido com teste; a fixture ganhou uma 4ª mensagem de autora com nome longo). Gráfico: rótulos girados via `onResize` do `ResponsiveContainer`. Medido no navegador: a 736 px rótulo de 21 px e vão de 8,3 px; a 311 px (celular de 375) as 24 horas aparecem giradas e legíveis. O limiar 640 é extrapolação (~4 px de folga), não medido exatamente na transição. Teste de EBUSY: `afterEach` espera o processo filho morrer (`processoVivo`) e `limparTmp` tolera EBUSY/EPERM por ~5 s, só avisando. **Preventivo:** a falha não foi reproduzida (13 rodadas normais, 12 sob carga com 4 processos, 5 suítes completas, todas verdes); a causa (filho ainda segurando arquivo) é hipótese.
Descartado: aviso na tela para o 404 (o botão é `<a download>` sem fetch; a tela já desabilita); truncar o "h" dos rótulos (00h cabe no modo reto); teste unitário do SVG do Recharts (sem valor).

**Verificação.** `tsc` e lint limpos; 34 arquivos / 330 testes, 1 skip antigo por plataforma. Navegador (servidor isolado na porta 51795, senha gerada, banco temporário, 80 mensagens fictícias, já encerrado): 24 rótulos retos a 1700 px e girados a 375 px; `curl` na rota real: nome com recorte e 404 `SEM_MENSAGENS`. `maria-hill` = SEGUE (sem injeção de cabeçalho/caminho, sem rota nova, `proxy.ts`/auth intactos). `natasha`, 4 achados: frase do changelog prometia aviso que o `<a download>` não mostra (reescrita); autor comprido cortava o período (corrigido); Conversas ([mensagens/exportar/route.ts](app/src/app/api/mensagens/exportar/route.ts)) não acompanhou, **não alterado** por estar fora do pedido; comentário do limiar 640 dizia estimativa (agora traz a medição). Repowise reindexado (`repowise update` em `app/`): índice em `4b25be3`; aviso benigno "deleted-file prune refused for git_metadata" (134 caminhos), afeta só metadados de git.

**Impacto.** Visível: nome do Excel da Análise e gráfico por hora. A rota ganhou o código de erro `SEM_MENSAGENS` (só quem chama direto vê o 404).

**Pendências.** (a) RESOLVIDA em 2026-09-28 — ver a entrada "Confirmado pelo usuário: PDF da Análise sai correto na impressão real" (era: o PDF impresso saía com gráficos em branco e depois estreitos/cortados; ver a entrada "PDF da Análise saía com os gráficos em branco"; faltava o usuário conferir a pré-visualização de impressão com o build novo). (b) RESOLVIDA (informado pelo usuário, não por execução da IA): a extração do grupo "Projetos | Tecnologia" passa de 11/02/2025; valida o scraper e fecha o gatilho do ciclo 4. (c) Decidir se Conversas (CSV/Excel) também ganha recorte no nome e 404 para 0 mensagens. (d) Monitorar se o EBUSY volta; se voltar, capturar o caminho no erro para achar a causa. (e) Medir a memória do XLSX com grupo grande (herdada). (f) Limiar 640 do gráfico não medido exatamente na largura de transição.

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
