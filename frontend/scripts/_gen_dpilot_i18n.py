#!/usr/bin/env python3
"""Expand pages.dpilot in en/pt/pt-BR/es. Removed after the catalogs are written."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_GLOB = "_dpilot_rows_*.json"

BR_RULES = [
    ("A guardar…", "Salvando…"),
    ("Guardar ", "Salvar "),
    ("Guardar", "Salvar"),
    ("guardados", "salvos"),
    ("guardado", "salvo"),
    ("A carregar", "Carregando"),
    ("A redirecionar…", "Redirecionando…"),
    ("A desligar…", "Desconectando…"),
    ("A apagar…", "Apagando…"),
    ("A arquivar…", "Arquivando…"),
    ("A gerar", "Gerando"),
    ("A enviar…", "Enviando…"),
    ("A analisar", "Analisando"),
    ("A actualizar…", "Atualizando…"),
    ("A verificar", "Verificando"),
    ("A aceder", "Acessando"),
    ("A ler ", "Lendo "),
    ("A detectar", "Detectando"),
    ("A procurar", "Procurando"),
    ("A processar…", "Processando…"),
    ("A aplicar…", "Aplicando…"),
    ("A mostrar", "Mostrando"),
    ("Não ligado", "Não conectado"),
    ("não ligado", "não conectado"),
    ("Não ligada", "Não conectada"),
    ("não ligada", "não conectada"),
    ("Ligações", "Conexões"),
    ("ligações", "conexões"),
    ("Ligação", "Conexão"),
    ("ligação", "conexão"),
    ("Ligada", "Conectada"),
    ("ligada", "conectada"),
    ("Ligado", "Conectado"),
    ("ligado", "conectado"),
    ("Desligar", "Desconectar"),
    ("ficheiros", "arquivos"),
    ("Ficheiro", "Arquivo"),
    ("ficheiro", "arquivo"),
    ("utilizadores", "usuários"),
    ("Utilizadores", "Usuários"),
    ("utilizador", "usuário"),
    ("Utilizador", "Usuário"),
    ("projecto", "projeto"),
    ("Projecto", "Projeto"),
    ("equipa", "equipe"),
    ("Equipa", "Equipe"),
    ("acções", "ações"),
    ("Acções", "Ações"),
    ("acção", "ação"),
    ("Acção", "Ação"),
    ("secções", "seções"),
    ("Secções", "Seções"),
    ("secção", "seção"),
    ("Secção", "Seção"),
    ("actualiz", "atualiz"),
    ("Actualiz", "Atualiz"),
    ("actual", "atual"),
    ("Actual", "Atual"),
    ("facto", "fato"),
    ("contactos", "contatos"),
    ("contacto", "contato"),
    ("Contacto", "Contato"),
    ("registada", "registrada"),
    ("registado", "registrado"),
    ("registados", "registrados"),
    ("registo", "registro"),
    ("Registo", "Registro"),
    ("telemóvel", "celular"),
    ("optimiz", "otimiz"),
    ("Optimiz", "Otimiz"),
    ("seleccionad", "selecionad"),
    ("Seleccione", "Selecione"),
    ("seleccione", "selecione"),
    ("Selecciona", "Selecione"),
    ("selecciona", "selecione"),
    ("Seleccionar", "Selecionar"),
    ("gerir", "gerenciar"),
    ("Gerir", "Gerenciar"),
    ("facturação", "faturamento"),
    ("Facturação", "Faturamento"),
    ("ecrã", "tela"),
    ("de facto", "de fato"),
    ("queres", "você quer"),
    ("Cola o URL", "Cole a URL"),
    ("confirma e edita o que quiseres", "confirme e edite o que quiser"),
    ("Indica ", "Indique "),
    ("vês ", "você vê "),
    ("Activar", "Ativar"),
    ("activar", "ativar"),
    ("activa", "ativa"),
    ("desactivada", "desativada"),
    ("desactivado", "desativado"),
    ("desactiva", "desativa"),
]


def to_br(pt: str) -> str:
    out = pt
    for a, b in BR_RULES:
        out = out.replace(a, b)
    return out


def nest(flat: dict[str, str]) -> dict:
    root: dict = {}
    for path, value in flat.items():
        cur = root
        parts = path.split(".")
        for p in parts[:-1]:
            nxt = cur.get(p)
            if nxt is None:
                nxt = {}
                cur[p] = nxt
            elif not isinstance(nxt, dict):
                raise SystemExit(f"path collision at {path}")
            cur = nxt
        if parts[-1] in cur:
            raise SystemExit(f"duplicate leaf {path}")
        cur[parts[-1]] = value
    return root


def emit(obj: dict, indent: int) -> str:
    pad = " " * indent
    lines = ["{"]
    for k, v in obj.items():
        if isinstance(v, dict):
            lines.append(f"{pad}{json.dumps(k, ensure_ascii=False)}: {emit(v, indent + 2)},")
        else:
            lines.append(
                f"{pad}{json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)},"
            )
    lines.append(" " * (indent - 2) + "}")
    return "\n".join(lines)


def main() -> None:
    rows = []
    for path in sorted(Path(__file__).parent.glob(DATA_GLOB)):
        rows.extend(json.loads(path.read_text()))
    keys = [r["k"] for r in rows]
    dup = [k for k, n in Counter(keys).items() if n > 1]
    if dup:
        raise SystemExit(f"duplicate keys: {dup}")
    en = {r["k"]: r["en"] for r in rows}
    pt = {r["k"]: r["pt"] for r in rows}
    es = {r["k"]: r["es"] for r in rows}
    br = {r["k"]: r["br"] if r.get("br") else to_br(r["pt"]) for r in rows}
    blocks = {
        "en": "    dpilot: " + emit(nest(en), 6) + ",",
        "pt": '    "dpilot": ' + emit(nest(pt), 6) + ",",
        "pt-BR": '    "dpilot": ' + emit(nest(br), 6) + ",",
        "es": '    "dpilot": ' + emit(nest(es), 6) + ",",
    }
    files = {
        "en": ROOT / "frontend/src/i18n/messages/en.ts",
        "pt": ROOT / "frontend/src/i18n/messages/pt.ts",
        "pt-BR": ROOT / "frontend/src/i18n/messages/pt-BR.ts",
        "es": ROOT / "frontend/src/i18n/messages/es.ts",
    }
    old = {
        "en": '    dpilot: {\n      title: "dPilot",\n      subtitle: "Create and manage paid campaigns.",\n    },',
        "pt": '    "dpilot": {\n      "title": "dPilot",\n      "subtitle": "Criar e gerir campanhas pagas."\n    },',
        "pt-BR": '    "dpilot": {\n      "title": "dPilot",\n      "subtitle": "Criar e gerir campanhas pagas."\n    },',
        "es": '    "dpilot": {\n      "title": "dPilot",\n      "subtitle": "Crear y gestionar campañas de pago."\n    },',
    }
    for loc, path in files.items():
        text = path.read_text()
        if old[loc] not in text:
            raise SystemExit(f"anchor missing in {path}")
        path.write_text(text.replace(old[loc], blocks[loc], 1))
    print("keys", len(en))


if __name__ == "__main__":
    main()
