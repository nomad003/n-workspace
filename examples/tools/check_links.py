#!/usr/bin/env python3
"""Check life:// paths, wikilinks, and relative links in this repo.

Prints broken targets and which file points at them. Does not print note bodies.
Exit 1 when something does not resolve.

life:// resolves path first (the file, or the same path plus .md), then a
frontmatter id. A folder link resolves only when that folder has index.md.
kb:// is another repo and is skipped. Angle-bracket destinations such as
[t](<kb://a b>) are not relative paths.
"""
import os, re, sys, collections
from urllib.parse import unquote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OWNERS = {"life", "work", "learn", "content", "accounts", "archive", "plan", "review", "kb", "team"}
ROOT_DIRS = {"data", "schemas", "tools", "templates"}
ROOT_FILES = {"index.md", "AGENTS.md", "README.md", "REORG.md", "team.md", "private-notes.tar.enc"}
SCAN_EXT = {".md", ".html", ".yaml", ".yml", ".jsonl"}
SKIP_DIR = {".git"}

FM_RE = re.compile(r"^---\n(.*?)\n---", re.S)
ID_RE = re.compile(r"(?m)^id:\s*['\"]?([^'\"\n]+)")
WIKI_RE = re.compile(r"!\[\[([^\]\n]+)\]\]|\[\[([^\]\n]+)\]\]")
MD_LINK_RE = re.compile(r"!\[[^\]]*\]\(([^)]+)\)|\[[^\]]*\]\(([^)]+)\)")
HREF_RE = re.compile(r"""(?:href|src)\s*=\s*['"]([^'"]+)['"]""", re.I)
FENCE_RE = re.compile(r"```.*?```", re.S)
CODE_RE = re.compile(r"`[^`\n]*`")


def walk_files():
    out = []
    for dirpath, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIR and not d.startswith(".")]
        for name in files:
            out.append(os.path.relpath(os.path.join(dirpath, name), ROOT))
    return out


def load_ids(files):
    ids = {}
    for rel in files:
        if not rel.endswith(".md"):
            continue
        text = open(os.path.join(ROOT, rel), encoding="utf-8", errors="ignore").read()
        m = FM_RE.match(text)
        if not m:
            continue
        im = ID_RE.search(m.group(1))
        if im:
            ids.setdefault(im.group(1).strip(), []).append(rel)
    return ids


def strip_fence(text):
    return CODE_RE.sub("", FENCE_RE.sub("", text))


def life_targets(text):
    """life:// targets, including [t](<life://a b>) where the path contains spaces.

    A bare "life://" followed by a space is prose, not a link.
    """
    out = []
    stop = set(" \t\r\n)<>\"'`")
    key = "life://"
    i = 0
    while True:
        k = text.find(key, i)
        if k < 0:
            break
        start = k + len(key)
        if k > 0 and text[k - 1] == "<":
            e = text.find(">", start)
            target = text[start:e if e > 0 else len(text)].strip()
            i = (e + 1) if e > 0 else len(text)
        else:
            j = start
            while j < len(text) and text[j] not in stop:
                j += 1
            target = text[start:j]
            i = j if j > start else start + 1
        if target:
            out.append(target)
    return out


def life_ok(target, ids, fileset):
    raw = unquote(target.split("#", 1)[0].split("?", 1)[0].strip())
    if not raw:
        return False
    path = raw.rstrip("/")
    # Path first: the file itself, or the same path with .md.
    if path in fileset or path + ".md" in fileset:
        return True
    # Then frontmatter id (case-insensitive; ids are the stable name).
    if path in ids or path.lower() in {k.lower() for k in ids}:
        return True
    # A folder link resolves only when that folder has an index note.
    return os.path.isfile(os.path.join(ROOT, path, "index.md"))


def wiki_target(body):
    body = body.split("#", 1)[0].strip()
    body = re.split(r"\\?\|", body, maxsplit=1)[0].strip()
    return body


def wiki_ok(src, target, fileset):
    if not target:
        return False
    names = [target]
    root, ext = os.path.splitext(target)
    if ext.lower() not in {".md", ".png", ".svg", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".html"}:
        names.append(target + ".md")
    base = os.path.dirname(src)
    for name in names:
        if name in fileset:
            return True
        rel = os.path.normpath(os.path.join(base, name))
        if rel in fileset:
            return True
    if "/" in target:
        return False
    stem = os.path.splitext(os.path.basename(target))[0]
    return any(os.path.splitext(os.path.basename(f))[0] == stem for f in fileset)


def rel_ok(src, url):
    url = url.strip()
    if len(url) >= 2 and url[0] == "<" and url[-1] == ">":
        url = url[1:-1].strip()
    url = url.split("#", 1)[0].split("?", 1)[0]
    if not url or url.startswith(("/", "http://", "https://", "mailto:", "kb://", "life://", "data:")):
        return True
    path = os.path.normpath(os.path.join(os.path.dirname(src), url))
    return os.path.exists(os.path.join(ROOT, path))


def owners_ok(files):
    bad = []
    for rel in files:
        top = rel.split("/", 1)[0]
        if "/" not in rel:
            if top not in ROOT_FILES:
                bad.append(rel)
        elif top not in OWNERS and top not in ROOT_DIRS:
            bad.append(rel)
    return bad


def main():
    files = walk_files()
    fileset = set(files)
    ids = load_ids(files)
    dup_ids = {k: v for k, v in ids.items() if len(v) > 1}
    broken = collections.defaultdict(list)
    for rel in files:
        ext = os.path.splitext(rel)[1].lower()
        if ext not in SCAN_EXT:
            continue
        text = open(os.path.join(ROOT, rel), encoding="utf-8", errors="ignore").read()
        if ext == ".md":
            text = strip_fence(text)
        for target in life_targets(text):
            if not life_ok(target, ids, fileset):
                broken["life"].append((rel, "life://" + target))
        if ext == ".md":
            for m in WIKI_RE.finditer(text):
                target = wiki_target(m.group(1) or m.group(2))
                if not wiki_ok(rel, target, fileset):
                    broken["wiki"].append((rel, target))
            for m in MD_LINK_RE.finditer(text):
                url = (m.group(1) or m.group(2) or "").strip()
                if not rel_ok(rel, url):
                    broken["relative"].append((rel, url))
    own = owners_ok(files)
    print(f"files {len(files)}  md_ids {len(ids)}  duplicate_ids {len(dup_ids)}")
    for kind in ("life", "wiki", "relative"):
        rows = broken[kind]
        print(f"{kind}_broken {len(rows)}")
        for src, target in rows[:80]:
            print(f"  {src} -> {target}")
    print(f"unowned {len(own)}")
    for rel in own:
        print(f"  {rel}")
    if dup_ids:
        print("duplicate id samples:")
        for k, v in list(dup_ids.items())[:20]:
            print(f"  {k}: {v}")
    sys.exit(1 if broken["life"] or broken["wiki"] or broken["relative"] or own or dup_ids else 0)


if __name__ == "__main__":
    main()
