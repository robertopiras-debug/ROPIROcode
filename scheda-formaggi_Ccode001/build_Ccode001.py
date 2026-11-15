#!/usr/bin/env python3
"""Assembla l'app mono-pagina a partire da src/ e dati/.

Uso:  python3 build_Ccode001.py
Esce: scheda-degustazione-formaggi_Ccode001.html (un solo file, apribile anche offline).
"""
import json
from pathlib import Path

QUI = Path(__file__).resolve().parent
SUFF = "_Ccode001"
DATI = ["vocabolari", "glossario", "abbinamenti", "mappa-italia", "atlante"]


def leggi(p):
    return (QUI / p).read_text(encoding="utf-8")


def main():
    blocchi = []
    for nome in DATI:
        dati = json.loads(leggi(f"dati/{nome}{SUFF}.json"))  # fallisce qui se il JSON è rotto
        testo = json.dumps(dati, ensure_ascii=False, separators=(",", ":"))
        testo = testo.replace("</", "<\\/")  # un "</script>" nei dati non deve chiudere il blocco
        blocchi.append(f'<script type="application/json" id="d-{nome}">{testo}</script>')

    html = leggi(f"src/index{SUFF}.html")
    for segnaposto, contenuto in (
        ("/*__CSS__*/", leggi(f"src/stile{SUFF}.css").rstrip("\n")),
        ("<!--__DATI__-->", "\n".join(blocchi)),
        ("/*__JS__*/", leggi(f"src/app{SUFF}.js").rstrip("\n")),
    ):
        if html.count(segnaposto) != 1:
            raise SystemExit(f"Segnaposto {segnaposto} assente o ripetuto nel modello")
        html = html.replace(segnaposto, contenuto)

    uscita = QUI / f"scheda-degustazione-formaggi{SUFF}.html"
    uscita.write_text(html, encoding="utf-8")
    print(f"Creato {uscita.name} ({len(html.encode('utf-8')) // 1024} KB)")


if __name__ == "__main__":
    main()
