# Exportador de chat do Microsoft Teams

Ferramenta para copiar o histórico de um grupo/chat do Teams (autor, data/hora
e texto de cada mensagem) para um arquivo `.txt`, sem precisar selecionar e
copiar mensagem por mensagem.

## Instalação (uma única vez)

Abra o terminal na pasta onde salvou os arquivos (`teams_chat_export.py`,
`requirements.txt`) e rode:

```
pip install -r requirements.txt
playwright install chromium
```

Se preferir usar o Claude Code, pode simplesmente abrir esta pasta nele e
pedir para ele rodar esses dois comandos por você.

## Como usar

```
python teams_chat_export.py "Nome do grupo, exatamente como aparece no Teams"
```

Exemplo:

```
python teams_chat_export.py "Projetos | CAPAG - Etapa 4 - SaaS"
```

Na primeira vez, uma janela do navegador vai abrir para você fazer login no
Teams normalmente (usuário, senha, MFA). O script espera você terminar e
continua sozinho. Da segunda vez em diante, ele já entra logado (a sessão
fica salva na pasta `teams_profile`, ao lado do script), a não ser que essa
sessão expire.

Ao final, o histórico completo é salvo em `exports/<nome_do_grupo>_<data>.txt`.

## Opções

- `--profile-dir CAMINHO` — muda onde a sessão logada fica salva (padrão:
  `./teams_profile`).
- `--output CAMINHO` — muda o nome/local do arquivo de saída.
- `--headless` — roda sem abrir a janela do navegador (só funciona se você já
  tiver logado antes com esse mesmo `--profile-dir`).

## O que o script NÃO faz

- Não guarda nem pede sua senha em nenhum momento — quem loga é você, na
  janela do navegador.
- Não funciona para grupos/canais que você não consegue ver dentro do
  próprio Teams (ele usa a sua sessão, com as suas permissões).

## Limitações conhecidas

- O nome do grupo precisa aparecer nas sugestões de busca do próprio Teams
  (a mesma caixa que abre com `Ctrl+Alt+G` dentro do Teams). Se o nome for
  parecido com o de uma reunião, o script tenta preferir o chat/grupo de
  verdade — mas vale conferir a mensagem impressa no terminal ("Abrindo:
  ...") para confirmar que abriu o certo.
- Mensagens com reações (👍 ❤️ etc.) podem sair com um textinho extra no
  final, tipo "1 Curtir reação." — é a contagem da reação que o próprio
  Teams embute junto ao texto da mensagem na página.
- Se sua organização usa políticas de segurança mais restritas (Conditional
  Access), a sessão salva pode expirar com mais frequência e pedir login de
  novo.
