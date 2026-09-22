# Extrator Teams — app web

Painel local para exportar, ler e analisar conversas do Microsoft Teams. Ele
envolve o `teams_chat_export.py` (na pasta acima): o backend dispara o script,
acompanha o progresso e guarda as mensagens num banco SQLite.

- **Exportações:** informe o nome do grupo e clique em Exportar. Uma janela do
  Edge abre para o login do Teams (você faz o login; o app nunca vê a senha).
  Também importa `.txt` antigos.
- **Conversas:** leia as mensagens de um grupo, filtre por autor e período,
  busque no texto.
- **Análise:** total de mensagens, autores, média por dia, gráfico por dia e
  ranking de autores.

## Requisitos

Windows com Node 24+, Python 3 e Microsoft Edge. O app roda só na sua máquina
(`127.0.0.1:51794`), porque o Edge precisa de tela para o login do Teams.

## Como usar

Na raiz do projeto (a pasta acima):

    scripts\setup.ps1        # uma vez: venv Python, dependências e app\.env.local
    # abra app\.env.local e troque EXTRATOR_SENHA
    iniciar.bat              # ou: scripts\start.ps1

Abra http://127.0.0.1:51794 e entre com a senha. Para parar: `scripts\stop.ps1`.
Depois de mudar o código, `scripts\start.ps1 -Rebuild`.

## Configuração (`app/.env.local`, veja `.env.example`)

| Variável | Para quê |
|---|---|
| `EXTRATOR_SENHA` | Senha única de acesso. Sem ela nenhum login é aceito. |
| `EXTRATOR_SEGREDO_SESSAO` | Segredo do cookie de sessão (opcional). |
| `TEAMS_PYTHON`, `TEAMS_SCRIPT` | Python do venv e script. Vazio = `../.venv` e `../teams_chat_export.py`. |
| `EXTRATOR_TIMEOUT_MIN` | Tempo máximo de uma exportação (padrão 30). |
| `EXTRATOR_DB` | Caminho do SQLite (padrão `app/data/extrator.db`). |
| `EXTRATOR_EXPORTS_DIR` | Pasta das exportações `.json`/`.txt` (padrão `<raiz do projeto>/exports`). Serve para apontar a verificação em servidor real (`npm run verificar:api`) para uma pasta descartável, sem tocar em `exports/`. |

## Desenvolvimento

    npm run dev          # servidor de desenvolvimento na 51794
    npm test             # Vitest (regras puras, banco em memória, orquestrador com script falso)
    npm run test:e2e     # Playwright no Edge; pare o `npm run dev` antes
    npm run lint
    npm run build && npm run verificar:api   # verificação de aceite num `next start` real (porta 51795), banco e pasta de exportações temporários

Regras de negócio ficam em `src/lib/` sem I/O quando possível (parsers, KPIs,
datas). O orquestrador (`src/lib/exportacao/`) é testado com um script Node
falso que imita a saída do Python, sem abrir o Teams. O teste real com o Teams
é manual: exige o seu login.

`npm run verificar:api` sobe um `next start` de produção de verdade (porta
51795, livre da 51794 do app), com senha, banco e pasta de exportações
temporários, e confere por HTTP real: autenticação de todas as rotas, origem,
limites reais de upload, travessia de caminho no download (inclusive
junction), importação idempotente, concorrência, cancelamento, timeout, morte
de processos órfãos e reconciliação após queda do servidor. Nunca toca em
`exports/` nem em `app/data/`. Código de saída: **0** só se tudo passou; **1**
se algum check falhou; **2** se algum check não pôde ser provado (por exemplo,
uma consulta de processos do Windows falhou) e foi reportado como SKIP — nesse
caso a execução não conta como aprovada.

### Notas de segurança

- Toda rota de API exige sessão (cookie assinado), exceto o login.
- Requisições que alteram estado (POST/PUT/PATCH/DELETE) exigem que o cabeçalho
  `Origin`, quando presente, bata com o `Host` da requisição — senão o
  servidor devolve 403 `ORIGEM_INVALIDA`. Chamar a API de outra origem/porta
  que não seja o próprio navegador do app recebe esse 403.

## Limitações conhecidas

- O sufixo "N reação." pode vir colado ao texto de mensagens com reação.
- Mensagens idênticas do mesmo autor no mesmo minuto colapsam numa só (é a
  chave de deduplicação do script).
- Se a data de uma mensagem não puder ser interpretada, ela aparece com o texto
  original do Teams e fica fora dos gráficos por dia.
- Uma exportação por vez: o `teams_profile` só aceita um Edge.
- Se o processo do servidor Next for encerrado à força no meio de uma
  exportação, o processo filho (Python/Edge) pode continuar rodando e
  segurando o `teams_profile` até ser fechado manualmente — a próxima
  exportação falha até você fechar esse Edge; ao subir de novo, o app marca a
  execução como "Interrompida".
- Sair das telas Conversas/Análise no meio de uma exportação não atualiza a
  lista de grupos delas sozinho quando essa exportação termina — recarregue a
  página para ver o grupo novo.
- O app exige mesma origem em requisições que alteram estado (veja "Notas de
  segurança" acima): chamar a API por outra origem/ferramenta que não o
  próprio navegador recebe 403 a não ser que `Origin`/`Host` batam.
