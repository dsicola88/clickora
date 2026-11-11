#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path("/Users/dpa/Documents/Clickora/frontend")
SRC = ROOT / "scripts" / "patch-dpilot-i18n.py"
MSG = ROOT / "src" / "i18n" / "messages"

ns = {"__file__": str(SRC)}
exec(SRC.read_text(), ns)
EN, PT = ns["EN"], ns["PT"]
ES = json.loads((ROOT / "scripts" / "dpilot_es.json").read_text())

REPLACEMENTS = [
    ("projectos", "projetos"),
    ("Projectos", "Projetos"),
    ("projecto", "projeto"),
    ("Projecto", "Projeto"),
    ("actualizadas", "atualizadas"),
    ("actualizada", "atualizada"),
    ("actualizados", "atualizados"),
    ("actualizado", "atualizado"),
    ("Actualizar", "Atualizar"),
    ("actualizar", "atualizar"),
    ("seleccionem", "selecionem"),
    ("Selecciona", "Selecione"),
    ("selecciona", "selecione"),
    ("Seleccione", "Selecione"),
    ("seleccione", "selecione"),
    ("Ficheiro", "Arquivo"),
    ("ficheiro", "arquivo"),
    ("Ligações", "Conexões"),
    ("ligações", "conexões"),
    ("Ligação", "Conexão"),
    ("ligação", "conexão"),
    ("utilizadores", "usuários"),
    ("utilizador", "usuário"),
    ("Reactivar", "Reativar"),
    ("reactivar", "reativar"),
    ("Activar", "Ativar"),
    ("activar", "ativar"),
    ("Activo", "Ativo"),
    ("activo", "ativo"),
    ("A carregar", "Carregando"),
    ("a carregar", "carregando"),
    ("A guardar", "Salvando"),
    ("a guardar", "salvando"),
    ("A analisar", "Analisando"),
    ("a analisar", "analisando"),
    ("A gerar", "Gerando"),
    ("a gerar", "gerando"),
    ("A actualizar", "Atualizando"),
    ("a actualizar", "atualizando"),
    ("A verificar", "Verificando"),
    ("a verificar", "verificando"),
    ("Guardar", "Salvar"),
    ("guardar", "salvar"),
    ("Gravados", "Salvos"),
    ("gravados", "salvos"),
    ("Gravadas", "Salvas"),
    ("gravadas", "salvas"),
    ("Gravado", "Salvo"),
    ("gravado", "salvo"),
    ("Gravada", "Salva"),
    ("gravada", "salva"),
    ("Gravar", "Salvar"),
    ("gravar", "salvar"),
    ("registos", "registros"),
    ("Registo", "Registro"),
    ("Equipa", "Equipe"),
    ("acedem", "acessam"),
    ("protecção", "proteção"),
    ("Objectivo", "Objetivo"),
    ("objectivo", "objetivo"),
    ("de facto", "de fato"),
    ("Exacta", "Exata"),
    ("exacta", "exata"),
    ("Secções", "Seções"),
    ("secções", "seções"),
    ("secção", "seção"),
    ("acções", "ações"),
    ("acção", "ação"),
    ("Actual:", "Atual:"),
    ("Actual", "Atual"),
]
WORD = [
    (re.compile(r"\bLigado\b"), "Conectado"),
    (re.compile(r"\bligado\b"), "conectado"),
    (re.compile(r"\bLigada\b"), "Conectada"),
    (re.compile(r"\bligada\b"), "conectada"),
    (re.compile(r"\bLigar\b"), "Conectar"),
    (re.compile(r"\bligar\b"), "conectar"),
    (re.compile(r"\bAbre\b"), "Abra"),
    (re.compile(r"\bedita\b"), "edite"),
    (re.compile(r"\bEdita\b"), "Edite"),
    (re.compile(r"\bIndica\b"), "Informe"),
    (re.compile(r"\bUsa\b"), "Use"),
    (re.compile(r"\bLiga\b"), "Conecte"),
]

PTBR = {}
for k, v in PT.items():
    s = v
    for a, b in REPLACEMENTS:
        s = s.replace(a, b)
    for rx, b in WORD:
        s = rx.sub(b, s)
    PTBR[k] = s

PTBR.update({
    "optimizer.usdInvalid": "USD: número positivo ou vazio para herdar do projeto.",
    "optimizer.usdPlaceholder": "Vazio = projeto",
    "optimizer.clicksPlaceholder": "Vazio = projeto",
    "keyword.needAccountAfter": "e conecte o projeto.",
    "hub.connectAccount": "Conectar conta",
    "common.fileTooLarge": "Arquivo grande demais",
    "subtitle": "Criar e gerenciar campanhas pagas.",
})

assert set(EN) == set(PT) == set(PTBR) == set(ES), (
    set(EN) ^ set(ES),
    set(EN) ^ set(PTBR),
)


def unflatten(flat: dict) -> dict:
    root: dict = {}
    for key, value in flat.items():
        cur = root
        parts = key.split(".")
        for part in parts[:-1]:
            nxt = cur.setdefault(part, {})
            if not isinstance(nxt, dict):
                raise SystemExit(f"collision at {key}")
            cur = nxt
        cur[parts[-1]] = value
    return root


def emit(obj: dict, indent: int, quote_keys: bool) -> str:
    lines = []
    for k, v in obj.items():
        key = k if (not quote_keys and k.isidentifier()) else json.dumps(k, ensure_ascii=False)
        pad = "  " * indent
        if isinstance(v, dict):
            lines.append(f"{pad}{key}: {{")
            lines.append(emit(v, indent + 1, quote_keys))
            lines.append(f"{pad}}},")
        else:
            lines.append(f"{pad}{key}: {json.dumps(v, ensure_ascii=False)},")
    return "\n".join(lines)


def block(tree: dict, quote_keys: bool) -> str:
    key = '"dpilot"' if quote_keys else "dpilot"
    return f"    {key}: {{\n" + emit(tree, 3, quote_keys) + "\n    },"


def splice(path: Path, quote_keys: bool, flat: dict) -> None:
    text = path.read_text()
    start = text.find('    "dpilot":' if quote_keys else "    dpilot:")
    if start < 0:
        raise SystemExit(f"dpilot block missing in {path}")
    # find matching close at indent 4
    i = text.find("{", start)
    depth = 0
    end = None
    for j in range(i, len(text)):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                end = j + 1
                break
    if end is None:
        raise SystemExit(f"unclosed dpilot in {path}")
    if text[end:end + 1] == ",":
        end += 1
    new = block(unflatten(flat), quote_keys)
    path.write_text(text[:start] + new + text[end:])
    print(path.name, "ok", len(flat))


splice(MSG / "en.ts", False, EN)
splice(MSG / "pt.ts", True, PT)
splice(MSG / "pt-BR.ts", True, PTBR)
splice(MSG / "es.ts", True, ES)
print("PTBR sample optimizer", PTBR["optimizer.usdInvalid"])
print("PTBR sample ceiling", PTBR["guardrails.ceiling.save"], PTBR["guardrails.ceiling.current"])
print("PTBR sample hub", PTBR["hub.connectAccount"], PTBR["hub.connectionsTitle"])
