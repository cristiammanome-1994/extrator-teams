# Extrator Teams — app web (backend + frontend)

Data: 2026-09-21
Status: desenho aprovado em conversa; aguardando revisão do spec escrito.

## Objetivo

Um app web local, no padrão do projeto **Click Up (PMO Master)**, que envolve o
script `teams_chat_export.py` existente. Ele permite disparar exportações de
chats do Microsoft Teams pelo navegador, acompanhar o progresso, guardar as
mensagens num banco SQLite e lê-las, filtrá-las e analisá-las.

Escopo escolhido: **painel de exportação + leitor de conversas**. Fora do
escopo: exportação XLSX das conversas, comparação incremental entre
exportações, agendamento, acesso pela rede da equipe.

## Decisões já tomadas

| Tema | Decisão |
|---|---|
| Arquitetura | Next.js fullstack (API routes como backend). O script Python roda como **processo filho**. |
| Stack | Igual à do Click Up: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind 4, shadcn/ui (`base-nova`), Recharts, TanStack Table, `node:sqlite`, Vitest, Playwright. Versões fixadas no `package.json` copiando as do Click Up. |
| Localização | `extrator_teams/app/`. Script, `.venv`, `teams_profile/` e `exports/` continuam na raiz. |
| Acesso | Só local, `127.0.0.1`, porta **51794**, com **login por senha única** e cookie assinado, reaproveitado do Click Up. |
| Docker | Não. O Edge precisa de tela para o login do Teams, então o app roda na máquina do usuário. |
| Navegador do script | Microsoft Edge (`channel="msedge"`). O Chromium baixado pelo Playwright trava no carregamento do Teams novo. |

Antes de escrever qualquer código no `app/`, ler os guias em
`app/node_modules/next/dist/docs/`: o `AGENTS.md` do Click Up avisa que o Next 16
tem mudanças de API em relação ao que se conhece.

## Mudança no script Python

Novo flag `--json-out CAMINHO` em `teams_chat_export.py`. Sem o flag, nada muda.
Com ele, além do `.txt`, o script grava:

```json
{
  "grupo": "nome digitado",
  "exportado_em": "2026-09-21T09:23:00",
  "mensagens": [
    { "autor": "Nome", "data_hora_original": "terça-feira, 8 de setembro de 2026 11:09", "texto": "..." }
  ]
}
```

- A montagem do JSON fica numa função pura `build_json(group_name, records)`, com teste `unittest`.
- A data **não** é interpretada no Python. O `data_hora_original` segue o texto do Teams e a interpretação é feita uma vez só, no TypeScript, e vale tanto para o JSON quanto para a importação de `.txt` antigos.
- Autor nulo (mensagem sem cabeçalho de autor no início da conversa) vira `"(desconhecido)"`.

## Dados (`app/data/extrator.db`, `node:sqlite`)

- **`grupos`**: `id`, `nome` (único), `ultima_exportacao_em`.
- **`exportacoes`**: `id`, `grupo_id`, `status` (`em_andamento`, `concluida`, `erro`, `cancelada`), `etapa`, `iniciada_em`, `finalizada_em`, `total_mensagens`, `arquivo_txt`, `arquivo_json`, `erro_msg`, `log_tail` (últimas 50 linhas da saída).
- **`mensagens`**: `id`, `grupo_id`, `exportacao_id`, `autor`, `data_hora` (ISO local sem fuso, `YYYY-MM-DDTHH:MM`, pode ser nula), `data_hora_original`, `texto`.
  - Chave única: `(grupo_id, autor, data_hora_original, texto)`, equivalente à que o script usa para deduplicar. Usa o texto original e não `data_hora` porque `NULL` não deduplica em SQLite.
  - Reexportar o mesmo grupo mescla (`INSERT OR IGNORE`).
- Migrações e esquema adaptados de `lib/db/esquema.ts` e `migracoes.ts` do Click Up.

## Backend (route handlers)

| Rota | Função |
|---|---|
| `POST /api/auth/login` | Login por senha única (copiado do Click Up). |
| `POST /api/exportacoes` | Valida o nome do grupo, cria a execução e dispara o Python. **409** se já houver uma em andamento. |
| `GET /api/exportacoes` | Histórico de execuções. |
| `GET /api/exportacoes/[id]` | Status e progresso (etapa, contador, log). |
| `POST /api/exportacoes/[id]/cancelar` | Encerra a árvore de processos. |
| `GET /api/exportacoes/[id]/download` | Entrega o `.txt`; o caminho vem do banco, nunca do cliente. |
| `GET /api/grupos` | Grupos com contagem de mensagens. |
| `GET /api/mensagens` | Filtros: grupo, autor, período, texto; paginação. |
| `GET /api/analise` | KPIs e séries do grupo/período. |
| `POST /api/importar` | Importa um `.txt` antigo (só `.txt`, até 20 MB, processado em memória). |

### Execução do script

- `child_process.spawn` com **lista de argumentos e sem shell**: o nome do grupo nunca é interpretado como comando.
- Validação do nome: não vazio, até 200 caracteres, sem caracteres de controle.
- Caminhos por variável: `TEAMS_PYTHON` (padrão `../.venv/Scripts/python.exe`) e `TEAMS_SCRIPT` (padrão `../teams_chat_export.py`). Se o Python do venv não existir, a API devolve mensagem clara com o comando de setup.
- Ambiente do filho: `PYTHONUNBUFFERED=1` e `PYTHONIOENCODING=utf-8`.
- Comando efetivo: `python teams_chat_export.py "<grupo>" --json-out <exports/...json>`.
- Os processos vivos ficam num `Map` em `globalThis`, para sobreviver ao hot reload em desenvolvimento.

### Progresso

Um parser puro converte as linhas de saída em etapas:

| Linha do script | Etapa |
|---|---|
| `Uma janela do navegador foi aberta` | aguardando login |
| `Login detectado` | login concluído |
| `Procurando o grupo/chat` | procurando grupo |
| `Abrindo: "..."` | grupo aberto (o texto entre aspas é guardado) |
| `Lendo o histórico` | lendo histórico |
| `... N mensagens únicas encontradas` | atualiza o contador |
| `Total de mensagens únicas capturadas: N` | contador final |
| `Pronto! Arquivo salvo em: ...` | salvando/concluindo |

Linhas desconhecidas só entram no `log_tail`.

### Término, erro e concorrência

- Saída 0 e `.json` presente: importa em **uma transação**, marca `concluida`, preenche `total_mensagens`.
- Saída diferente de 0: `erro`, com as últimas linhas na tela. Se só a importação falhar, os arquivos são mantidos e o erro diz isso.
- **Timeout** total de 30 min (configurável). O script já tem o seu próprio limite de 10 min de espera de login.
- **Cancelar/timeout:** `taskkill /T /F` na árvore de processos, para não sobrar um Edge segurando o `teams_profile`.
- Ao subir o servidor, execuções `em_andamento` de uma sessão anterior viram `erro: interrompida`.
- **Lock** de exportação única (adaptado de `lockSincronizacao`), porque o `teams_profile` só aceita um Edge.

### Parser do `.txt` legado

Formato produzido pelo script: cabeçalho (`Histórico do chat: X`, `Exportado em`, `Total de mensagens: N`, linha de `=`), depois blocos `[<data do Teams>] <autor>:` seguidos do texto, separados por linha em branco.

- Um cabeçalho de mensagem é reconhecido por regex (`^\[[^\]]+, \d{1,2} de \w+ de \d{4} \d{1,2}:\d{2}\] .+:$`), porque o texto pode conter linhas em branco.
- O `Total de mensagens: N` do cabeçalho é comparado com o número de blocos lidos; divergência gera aviso, não falha.

## Frontend

Navegação (`app-shell` adaptado): **Exportações**, **Conversas**, **Análise**, tema claro/escuro, sair. Todas as telas exigem sessão, exceto `/login`.

- **`/` Exportações:** formulário (nome do grupo + Exportar) com aviso de que uma janela do Edge vai abrir para o login do Teams; card da execução ativa (etapa, contador, Cancelar; polling de 2 s enquanto `em_andamento`); tabela do histórico (grupo, status, início, duração, mensagens, download); botão **Importar .txt**.
- **`/conversas`:** seletor de grupo; filtros de autor, período e texto; tabela TanStack paginada com data/hora, autor e texto expansível (`whitespace-pre-wrap`).
- **`/analise`:** cards (total de mensagens, autores, período, média por dia); gráfico Recharts de mensagens por dia; ranking de autores; filtros de grupo e período.
- **Limitações mostradas na tela:** sufixo "N reação." colado ao texto; mensagens idênticas do mesmo autor no mesmo minuto colapsam numa só; data ISO vazia quando o texto de data não é interpretável.

### Componentes (reutilizar, depois adaptar, e só criar o que não existe)

- **Como estão:** `components/ui/*`, `theme-toggle`, `error-state`, `empty-state`, `dashboard-skeleton`.
- **Adaptados:** `app-shell` (itens de navegação), `status-badge` (novos status), `kpi-cards`, `useRecursoRemoto`, `lib/auth/*` e `proxy.ts`.
- **Modelo para a tabela de conversas:** `tasks-explorer-table`.
- **Novos:** formulário de exportação, card de progresso, filtros de conversa, diálogo de importação.
- **Não reaproveitados:** Docker e tudo que é específico do ClickUp (API, normalização, KPIs de tarefa, domínio Comercial).

## Regras puras em `app/src/lib/` (todas com Vitest)

- `dataPt`: interpreta `"terça-feira, 8 de setembro de 2026 11:09"` para ISO local (mesmos nomes de mês do script, com e sem acento em "março").
- `parseTxt`: `.txt` legado para lista de mensagens.
- `parseProgresso`: linha de saída para etapa/contador.
- `validarGrupo`: regras do nome do grupo.
- `kpis`: mensagens por autor e por dia, período coberto, média por dia.

## Segurança

- Todas as rotas exigem sessão, exceto o login (barreira por exceção, como o `ROTAS_PUBLICAS` do Click Up).
- Servidor escuta apenas em `127.0.0.1`.
- Download por id de execução; upload restrito a `.txt` de até 20 MB.
- O app nunca lê, pede ou guarda credenciais do Teams; o login é feito pelo usuário na janela do Edge.
- Variáveis: `EXTRATOR_SENHA` (obrigatória: sem ela nenhum login é aceito), `EXTRATOR_SEGREDO_SESSAO` (opcional), `TEAMS_PYTHON`, `TEAMS_SCRIPT`, `EXTRATOR_PORTA` (padrão 51794), `EXTRATOR_TIMEOUT_MIN` (padrão 30).
- `.gitignore` cobre `teams_profile/`, `.venv/`, `exports/`, `chat_teams_*.txt`, `app/data/`, `.env*`.

## Testes

- **Vitest, funções puras**, com fixtures reais (trechos dos exports): `dataPt`, `parseTxt`, `parseProgresso`, `validarGrupo`, `kpis`, sessão (adaptando os testes de auth do Click Up).
- **Orquestrador com script Python falso** (imprime as linhas `>>` e grava um `.json`): sucesso, erro, cancelamento, timeout e 409 de execução simultânea, sem abrir o Teams.
- **Playwright de smoke:** login e abertura de cada item da navegação.
- **Python:** `unittest` de `build_json`.
- **Validação com dado real:** importar o `.txt` do CAPAG deve resultar em **1527 mensagens**, igual à exportação. É o teste que prova que o parser não perde nada.
- **Teste real com o Teams:** manual, feito pelo usuário (exige o login dele).

## Entrega

- `setup.ps1`: cria o `.venv` se faltar, instala `pip`, o navegador do Playwright e `npm install` no `app/`. `start.ps1` e `.bat` sobem o app; `stop.ps1` derruba. Adaptados dos scripts do Click Up.
- `app/.env.example` com as variáveis acima.
- `app/README.md` e um ponteiro no `LEIA-ME_teams_export.md`.

## Ordem de construção

1. Flag `--json-out` no script, com teste.
2. Esqueleto do app, login e shell de navegação.
3. Banco, parsers e importador (validado com o CAPAG de 1527 mensagens).
4. Orquestrador e API de exportação.
5. Telas: Exportações, Conversas e Análise.
6. Smoke tests, scripts de setup/start e README.

## Ajustes definidos no plano de implementação

Decididos ao detalhar o plano; valem no lugar do texto acima onde divergirem.

- **Versão do Next:** `next` e `eslint-config-next` ficaram fixados em
  **16.3.5** (não 16.3.2), por causa de dois avisos de RCE que o `npm audit`
  encontrou na 16.3.2; a 16.3.5 já traz a correção.
- **Lock de exportação única:** em vez de portar `lockSincronizacao`, a checagem é atômica no banco (`BEGIN IMMEDIATE` + existência de linha `em_andamento`). Mesmo comportamento, sem depender de variável de módulo.
- **Tabela de conversas:** `Table` do shadcn com paginação no servidor, sem TanStack (filtro e paginação já são do backend).
- **Importar `.txt`:** cartão na tela Exportações, não um modal.
- **Porta:** fixa (51794) nos scripts; `EXTRATOR_PORTA` foi removida.
- **Selects:** `<select>` nativo estilizado, sem o Select do base-ui.
- **Upload:** `experimental.proxyClientMaxBodySize = "21mb"` no `next.config.ts`, porque o proxy de sessão faz o Next bufferizar o corpo e cortar em 10 MB por padrão.
- **Setup:** o script usa o Edge instalado (`channel="msedge"`); `scripts\setup.ps1` não baixa o Chromium.
- **Origem:** o proxy de sessão também recusa (403 `ORIGEM_INVALIDA`) requisições que alteram estado cujo cabeçalho `Origin` não bata com o `Host`, além de exigir o cookie de sessão.
- **Pasta de exportações configurável:** `EXTRATOR_EXPORTS_DIR` (opcional; padrão `<raiz do projeto>/exports`) permite apontar a pasta de exportações para outro lugar, usada pela verificação de aceite em servidor real (`npm run verificar:api`) para nunca tocar na pasta `exports/` de verdade.
- **Verificação de aceite em servidor real:** `app/scripts/verificar-api.mjs` (`npm run verificar:api`) sobe um `next start` de produção numa porta dedicada (51795) com banco e pasta de exportações temporários, e confere por HTTP real autenticação, origem, limites de upload, travessia de caminho no download, importação idempotente, concorrência, cancelamento, timeout, morte de processos órfãos e reconciliação após queda do servidor. Sai com 0 (tudo passou), 1 (algum check falhou) ou 2 (algum check não pôde ser provado, reportado como SKIP).
