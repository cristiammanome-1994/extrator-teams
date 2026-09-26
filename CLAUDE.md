# Extrator Teams

Exporta chats do Microsoft Teams. Duas partes:

- `teams_chat_export.py` (raiz): scraper Playwright/Edge, sessão salva em `teams_profile/`.
- `app/`: painel Next.js + TypeScript que dispara o scraper e analisa o resultado.
  Veja `app/AGENTS.md`: o Next.js desta versão tem quebras, leia
  `app/node_modules/next/dist/docs/` antes de usar API do framework.

Python do projeto: `.venv/Scripts/python.exe` (o Python global não tem Playwright).

Régua de verificação:

```bash
cd app && npx tsc --noEmit && npm run lint && npm test
.venv/Scripts/python.exe -m unittest discover -s tests   # da raiz
```

Dado sensível, nunca em commit nem em log: `exports/`, `teams_profile/` (sessão
logada do Teams), `chat_teams_*.txt`, `app/data/`, `.env.local`.

# Publicar no git

Quando o pedido for **"dar git", "subir", "commitar", "push", "sobe isso"** ou
equivalente, chame o subagente `heimdall`. Ele traz o remoto antes de publicar,
compara os dois lados e só sobe quando não há conflito, parando e explicando
quando há. Não publique direto sem ele.

# Componente novo na interface

Antes de criar qualquer componente de tela, chame o subagente `forge`. Ele lê o
projeto primeiro e responde na ordem **reutilizar > adaptar > criar**.

# Antes de commitar

Duas conferências, nesta ordem:

1. **`maria-hill`**: obrigatória quando o diff toca `app/src/lib/auth/`,
   `app/src/proxy.ts`, a rota de login, download/upload de arquivos, o `spawn`
   do scraper, ou introduz rota nova.
2. **`natasha`**: revisora de diff. Procura o que compila e passa nos testes e
   mesmo assim está errado: texto que contradiz o código, contrato Python↔app
   que mudou de um lado só, dois nomes para a mesma coisa.

# Diário de contexto

Ao **terminar** uma alteração (código, configuração ou documentação), depois de
aplicada e verificada e antes de encerrar o turno, chame o subagente
`contexto-projeto` para registrá-la em [`contexto-ia.md`](contexto-ia.md).

Passe a ele: o que mudou, por que, o que foi descartado e o que ficou pendente.
Não escreva no `contexto-ia.md` diretamente: o agente é o dono do formato. No
início de uma sessão longa, leia o `contexto-ia.md`.
