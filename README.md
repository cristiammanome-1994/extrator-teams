# Extrator Teams

Exporta o histórico de um grupo/chat do Microsoft Teams (autor, data/hora e
texto de cada mensagem) e permite ler e analisar essas conversas. Duas partes,
que podem ser usadas juntas ou separadas:

- **Linha de comando** (`teams_chat_export.py`, nesta pasta): gera um `.txt`
  com o histórico. Veja [LEIA-ME_teams_export.md](LEIA-ME_teams_export.md).
- **Painel web** (pasta [`app/`](app/)): dispara o script acima, guarda as
  mensagens num banco local e oferece telas de exportação, leitura e análise
  (filtros, gráficos, exportação em CSV/Excel/PDF). Veja
  [app/README.md](app/README.md).

## Início rápido (painel web)

```
scripts\setup.ps1        # uma vez: venv Python, dependências e app\.env.local
# abra app\.env.local e troque EXTRATOR_SENHA
iniciar.bat
```

Abra `http://127.0.0.1:51794`. Detalhes de configuração, desenvolvimento e
notas de segurança em [app/README.md](app/README.md).

## Só a linha de comando

```
pip install -r requirements.txt
python teams_chat_export.py "Nome do grupo, exatamente como aparece no Teams"
```

Detalhes, opções e limitações em [LEIA-ME_teams_export.md](LEIA-ME_teams_export.md).
