"""Bundle the web app into one self-contained page for hosts that only allow
inline CSS/JS (e.g. a claude.ai Artifact). Data files stay separate and are
fetched by relative URL.

    python scripts/build_artifact.py   ->  dist/artifact/index.html
"""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
OUT = ROOT / "dist" / "artifact" / "index.html"
MODULES = ["util.js", "data.js", "charts.js", "views.js", "app.js"]
VIEWS = ["overview", "games", "game", "decision", "decisionsList", "teams", "team", "coaches", "coach",
         "lab", "bindLab", "methodology", "notFound"]


def bundle() -> str:
    parts = []
    for name in MODULES:
        src = (WEB / "js" / name).read_text()
        src = re.sub(r'^import[\s\S]*?from\s+"[^"]+";[ \t]*\n', "", src, flags=re.M)
        src = re.sub(r"^export (?=(?:async )?function|const|let)", "", src, flags=re.M)
        assert "import(" not in src and not re.search(r"^\s*(import|export)\b", src, re.M), name
        parts.append(f"// ---- {name} ----\n{src}")
        if name == "views.js":
            parts.append(f"const V = {{ {', '.join(VIEWS)} }};")
    js = "\n".join(parts)
    names = re.findall(r"^(?:const|let|function|async function)\s+(\w+)", js, re.M)
    dupes = [n for n, k in Counter(names).items() if k > 1]
    assert not dupes, f"top-level name clash: {dupes}"
    return "(() => {\n\"use strict\";\n" + js + "\n})();"


def main() -> None:
    html = (WEB / "index.html").read_text()
    head = html[html.index("<head>") + 6: html.index("</head>")]
    body = html[html.index("<body>") + 6: html.index("</body>")]
    keep = [l for l in head.splitlines()
            if re.search(r"<title>|name=\"description\"|fonts\.googleapis|fonts\.gstatic|rel=\"icon\"", l)]
    body = re.sub(r'\s*<script type="module" src="js/app.js"></script>', "", body)
    css = (WEB / "css" / "app.css").read_text()
    page = "\n".join([
        '<meta charset="utf-8">',
        *[l.strip() for l in keep if "<title>" in l],
        '<meta name="claude:viewport-fit-sides" content="cover">',
        *[l.strip() for l in keep if "<title>" not in l],
        f"<style>\n{css}\n</style>",
        body.strip(),
        f"<script>\n{bundle()}\n</script>",
    ])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
