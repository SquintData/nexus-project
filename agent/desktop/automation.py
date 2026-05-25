"""Desktop automation: open apps and URLs on Windows.

App resolution uses `allowed_apps` whitelist from config.json. Values can be:
- bare exe ("notepad.exe", "code.cmd")
- absolute path
- URI scheme ("spotify:", "steam://open/main", "discord://")
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import urllib.parse
import urllib.request
import webbrowser


def open_app(target: str) -> tuple[bool, str]:
    """Launch resolved target. Target comes from allowed_apps map."""
    if not target:
        return False, "Alvo vazio"
    # URI scheme (spotify:, steam://, discord://, etc.)
    if "://" in target or target.endswith(":"):
        try:
            os.startfile(target)  # type: ignore[attr-defined]
            return True, f"Abrindo {target}"
        except Exception as e:
            return False, f"Falha URI {target}: {e}"
    # PATH-resolvable command
    if shutil.which(target):
        try:
            subprocess.Popen([target], shell=False)
            return True, f"Abrindo {target}"
        except Exception as e:
            return False, f"Falha: {e}"
    # Try Windows `start` shell (Start Menu / file assoc)
    try:
        subprocess.Popen(["cmd", "/c", "start", "", target], shell=False)
        return True, f"Tentando {target} via Start"
    except Exception as e:
        return False, f"Não localizei {target}: {e}"


def open_url(url: str) -> tuple[bool, str]:
    if not url:
        return False, "URL vazia"
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        webbrowser.open(url, new=2)
        return True, f"Abrindo {url}"
    except Exception as e:
        return False, f"Falha URL: {e}"


def play_music(query: str) -> tuple[bool, str]:
    """Search YouTube, open first result. Falls back to search results page."""
    if not query:
        return False, "Sem termo de busca"
    try:
        safe = urllib.parse.quote(query)
        search_url = f"https://www.youtube.com/results?search_query={safe}"
        try:
            with urllib.request.urlopen(search_url, timeout=4) as r:
                html = r.read().decode(errors="ignore")
            video_ids = re.findall(r"watch\?v=(\S{11})", html)
            if video_ids:
                target = f"https://www.youtube.com/watch?v={video_ids[0]}"
                webbrowser.open(target)
                return True, f"Tocando: {query}"
        except Exception:
            pass
        webbrowser.open(search_url)
        return True, f"Buscando no YouTube: {query}"
    except Exception as e:
        return False, f"Falha play_music: {e}"


def run_routine(actions: list[dict]) -> list[str]:
    """Routine actions schema: {'type': 'app'|'url', 'target': '...'}."""
    results = []
    for a in actions:
        kind = a.get("type")
        target = a.get("target", "")
        if kind == "app":
            ok, msg = open_app(target)
        elif kind == "url":
            ok, msg = open_url(target)
        else:
            ok, msg = False, f"Ação desconhecida: {kind}"
        results.append(msg)
    return results
