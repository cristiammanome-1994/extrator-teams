#!/usr/bin/env python3
"""
teams_chat_export.py
---------------------
Exporta o histórico de um chat/grupo do Microsoft Teams (autor, data/hora e
texto de cada mensagem) para um arquivo .txt, usando o Teams pela web.

COMO FUNCIONA
- Na primeira execução, abre uma janela do navegador (visível) e pede para
  você fazer login manualmente no Teams. Depois disso, a sessão fica salva
  numa pasta local (--profile-dir, padrão "./teams_profile") e as próximas
  execuções já entram logadas, sem pedir senha de novo (até a sessão expirar
  ou você sair da conta).
- Ele NUNCA pede nem guarda seu usuário/senha em lugar nenhum. Quem faz login
  é você, na janela do navegador.
- Depois de logado, ele usa o atalho do próprio Teams (Ctrl+Alt+G, "ir para
  um chat ou canal"), digita o nome do grupo que você passou, escolhe o
  resultado mais provável e abre a conversa.
- Em seguida, rola a conversa inteira para cima (carregando o histórico aos
  poucos, como o Teams faz) e lê a estrutura da página para pegar autor,
  data/hora e texto de cada mensagem — não depende de "selecionar e copiar"
  manualmente (que no Teams perde o nome e o horário).
- Ao final, gera um arquivo .txt em ./exports com o histórico completo,
  ordenado do mais antigo para o mais recente.

REQUISITOS (rodar uma vez):
    pip install playwright
    playwright install chromium

USO:
    python teams_chat_export.py "Nome do grupo ou pessoa"

    # opções:
    python teams_chat_export.py "Nome do grupo" --profile-dir ./teams_profile --output ./exports/meu_arquivo.txt

OBSERVAÇÕES E LIMITAÇÕES CONHECIDAS
- O nome do grupo precisa aparecer nas sugestões do Teams quando você digita
  (mesma caixa que abre com Ctrl+Alt+G dentro do próprio Teams). Se o Teams
  sugerir uma reunião com nome parecido, o script tenta preferir o chat/grupo
  de verdade, mas vale conferir o print/console no fim.
- Mensagens com reações (curtir, coração etc.) podem vir com um textinho a
  mais no final, tipo "1 Curtir reação." — é a contagem da reação que o
  próprio Teams embute junto ao texto na página. Não é removido
  automaticamente para não arriscar cortar texto real sem querer.
- Se a sua organização usa políticas de segurança que bloqueiam sessões de
  navegador "não gerenciadas" (Conditional Access), pode ser necessário
  logar novamente de tempos em tempos.
"""

import argparse
import datetime
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Faltando dependência. Rode primeiro:\n    pip install playwright\n    playwright install chromium")
    sys.exit(1)


MONTHS_PT = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
    "outubro": 10, "novembro": 11, "dezembro": 12,
}

EXTRACT_JS = """
() => {
    const items = document.querySelectorAll('.fui-unstable-ChatItem');
    const out = [];
    let lastAuthor = null;
    items.forEach(el => {
        const authorEl = el.querySelector('[data-tid="message-author-name"]');
        const author = authorEl ? authorEl.textContent.trim() : lastAuthor;
        if (authorEl) lastAuthor = author;
        const timeEl = el.querySelector('time');
        const timeTitle = timeEl ? timeEl.getAttribute('title') : null;
        const msgEl = el.querySelector('[data-tid="chat-pane-message"]');
        let text = null;
        if (msgEl) {
            const clone = msgEl.cloneNode(true);
            clone.querySelectorAll('[data-tid="quoted-reply-card"]').forEach(n => n.remove());
            text = clone.textContent.replace(/\\s+\\n/g, '\\n').trim();
        }
        if (!timeTitle || !text) return;
        out.push({author, timeTitle, text});
    });
    return out;
}
"""


def parse_pt_datetime(title):
    """Converte 'terça-feira, 8 de setembro de 2026 11:09' em datetime."""
    m = re.search(r",\s*(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\s+(\d{1,2}):(\d{2})", title)
    if not m:
        return None
    day, monthname, year, hh, mm = m.groups()
    mon = MONTHS_PT.get(monthname.lower())
    if not mon:
        return None
    return datetime.datetime(int(year), mon, int(day), int(hh), int(mm))


def sanitize_filename(name):
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = nfkd.encode("ascii", "ignore").decode("ascii")
    safe = re.sub(r"[^a-zA-Z0-9]+", "_", ascii_name).strip("_")
    return safe or "chat_teams"


def wait_for_login(page, timeout_seconds=600):
    print("\n>> Uma janela do navegador foi aberta.")
    print(">> Faça login na sua conta do Microsoft Teams nela (usuário, senha, MFA se pedir).")
    print(">> Este script vai continuar sozinho assim que detectar que você entrou.\n")
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        url = page.url
        if "login.microsoftonline.com" not in url and "login.live.com" not in url:
            # esperar a interface do Teams realmente carregar
            try:
                page.wait_for_selector('[data-tid="AUTOSUGGEST_INPUT"], [data-tid="app-layout-area--nav"]', timeout=5000)
                print(">> Login detectado, continuando...\n")
                return True
            except Exception:
                pass
        time.sleep(2)
    print(">> Tempo esgotado esperando o login. Rode o script de novo.")
    return False


def open_chat(page, group_name, timeout_seconds=30):
    page.keyboard.press("Control+Alt+G")
    input_box = page.wait_for_selector('[data-tid="AUTOSUGGEST_INPUT"]', timeout=timeout_seconds * 1000)
    input_box.fill("")
    input_box.type(group_name, delay=30)
    try:
        page.wait_for_selector('[role="option"]', timeout=10000)
    except Exception:
        pass
    page.wait_for_timeout(900)

    options = page.query_selector_all('[role="option"]')
    if not options:
        shot = Path("./debug_busca.png").resolve()
        page.screenshot(path=str(shot))
        print(f">> Nenhuma sugestão encontrada. Screenshot salvo em: {shot}")
        raise RuntimeError(f'Nenhum resultado encontrado para "{group_name}" no Teams.')

    target = None
    lowered = group_name.strip().lower()
    # 1ª tentativa: opção cujo texto começa com o nome pedido e não é uma reunião
    for opt in options:
        text = (opt.text_content() or "").strip().lower()
        tid = opt.get_attribute("data-tid") or ""
        if text.startswith(lowered) and "meeting_" not in tid:
            target = opt
            break
    # 2ª tentativa: qualquer opção que não seja reunião
    if target is None:
        for opt in options:
            tid = opt.get_attribute("data-tid") or ""
            if "meeting_" not in tid:
                target = opt
                break
    # 3ª tentativa: a primeira opção, seja lá o que for
    if target is None:
        target = options[0]

    chosen_text = (target.text_content() or "").strip()
    print(f'>> Abrindo: "{chosen_text}"')
    target.click()
    page.wait_for_selector('[data-tid="message-pane-list-viewport"]', timeout=timeout_seconds * 1000)
    page.wait_for_timeout(1000)


def scrape_history(page, max_iterations=400, stagnant_limit=4, scroll_wait_ms=700):
    seen = {}

    def merge_current():
        for item in page.evaluate(EXTRACT_JS):
            key = (item["author"], item["timeTitle"], item["text"])
            seen[key] = item

    merge_current()
    prev_height = page.evaluate(
        'document.querySelector(\'[data-tid="message-pane-list-viewport"]\').scrollHeight'
    )
    stagnant = 0
    iterations = 0
    while stagnant < stagnant_limit and iterations < max_iterations:
        page.evaluate(
            'document.querySelector(\'[data-tid="message-pane-list-viewport"]\').scrollTop = 0'
        )
        page.wait_for_timeout(scroll_wait_ms)
        merge_current()
        new_height = page.evaluate(
            'document.querySelector(\'[data-tid="message-pane-list-viewport"]\').scrollHeight'
        )
        scroll_top = page.evaluate(
            'document.querySelector(\'[data-tid="message-pane-list-viewport"]\').scrollTop'
        )
        if new_height == prev_height and scroll_top == 0:
            stagnant += 1
        else:
            stagnant = 0
        prev_height = new_height
        iterations += 1
        if iterations % 10 == 0:
            print(f"   ... {len(seen)} mensagens únicas encontradas até agora (iteração {iterations})")

    return list(seen.values())


def build_txt(group_name, records):
    def sort_key(r):
        dt = parse_pt_datetime(r["timeTitle"])
        return (dt is None, dt)

    records_sorted = sorted(records, key=sort_key)

    lines = []
    lines.append(f"Histórico do chat: {group_name}")
    lines.append(f"Exportado em: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}")
    lines.append(f"Total de mensagens: {len(records_sorted)}")
    lines.append("=" * 60)
    lines.append("")
    for r in records_sorted:
        lines.append(f"[{r['timeTitle']}] {r['author']}:")
        lines.append(r["text"])
        lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Exporta o histórico de um chat do Microsoft Teams para .txt")
    parser.add_argument("group_name", help='Nome do grupo/chat, exatamente como aparece no Teams (ex: "Projetos | CAPAG - Etapa 4 - SaaS")')
    parser.add_argument("--profile-dir", default="./teams_profile", help="Pasta onde a sessão do navegador fica salva (padrão: ./teams_profile)")
    parser.add_argument("--output", default=None, help="Caminho do arquivo .txt de saída (padrão: ./exports/<nome_do_grupo>_<data>.txt)")
    parser.add_argument("--headless", action="store_true", help="Rodar sem mostrar a janela do navegador (só funciona se a sessão já estiver logada)")
    args = parser.parse_args()

    profile_dir = Path(args.profile_dir).expanduser().resolve()
    profile_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=args.headless,
            channel="msedge",
            viewport={"width": 1280, "height": 900},
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto("https://teams.microsoft.com", wait_until="domcontentloaded")

        if not wait_for_login(page):
            context.close()
            sys.exit(1)

        print(f'>> Procurando o grupo/chat "{args.group_name}"...')
        open_chat(page, args.group_name)

        print(">> Lendo o histórico da conversa (isso pode levar alguns minutos em grupos grandes)...")
        records = scrape_history(page)
        print(f">> Total de mensagens únicas capturadas: {len(records)}")

        txt = build_txt(args.group_name, records)

        if args.output:
            out_path = Path(args.output).expanduser().resolve()
        else:
            out_dir = Path("./exports").resolve()
            out_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
            out_path = out_dir / f"{sanitize_filename(args.group_name)}_{stamp}.txt"

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(txt, encoding="utf-8")
        print(f">> Pronto! Arquivo salvo em: {out_path}")

        context.close()


if __name__ == "__main__":
    main()
