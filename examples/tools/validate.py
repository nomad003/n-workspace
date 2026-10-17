#!/usr/bin/env python3
"""v9 validator for BOTH repos. Usage:
  validate.py --data <dir with data/*.yaml> [--topics <dir with topics.yaml + topic-logs/>] [--life <n-life-data root>] [--kb <n-knowledge-base root>] [--json report.json]
Checks: (1) structured YAML vs schemas/*.schema.json, (2) cross-references (identity/account/plan/parent/oauth ids),
(3) markdown frontmatter in both repos vs the unified frontmatter schema + per-repo rules, id uniqueness,
(4) links: kb:// / life:// URIs and [[wikilinks]] resolve; KB must never link into life (boundary error),
(5) topics: topics.yaml vs schema, xrefs (accounts/tasks/plans), every topic-logs/*.jsonl line vs schema + kind rules + metric types,
status snapshot == last status entry, open issues, staleness. Prints counts only, never field values (private data)."""
import os, re, sys, json, yaml, argparse, collections
H = os.path.dirname(os.path.abspath(__file__)); SCHS = [os.path.join(H, "..", "schemas")]
ap = argparse.ArgumentParser(); ap.add_argument("--data"); ap.add_argument("--life"); ap.add_argument("--kb"); ap.add_argument("--json"); ap.add_argument("--topics"); A = ap.parse_args()
S = {f[:-12]: json.load(open(os.path.join(d, f))) for d in SCHS if os.path.isdir(d) for f in sorted(os.listdir(d)) if f.endswith(".schema.json")}
R = collections.OrderedDict(); err = collections.defaultdict(collections.Counter)
TY = {"string": str, "integer": int, "number": (int, float), "boolean": bool, "array": list, "object": dict, "null": type(None)}
def check(v, s, path, bucket, root=None):
    root = root or s
    if "$ref" in s: s = root["$defs"][s["$ref"].split("/")[-1]]
    if "enum" in s and v not in s["enum"]: err[bucket][f"{path}: not in enum"] += 1; return
    t = s.get("type")
    if t:
        ts = t if isinstance(t, list) else [t]
        if not any(isinstance(v, TY[x]) and not (x in ("integer", "number") and isinstance(v, bool)) for x in ts):
            err[bucket][f"{path}: type {type(v).__name__} ≠ {'|'.join(ts)}"] += 1; return
    if isinstance(v, str) and "pattern" in s and not re.search(s["pattern"], v): err[bucket][f"{path}: pattern"] += 1
    if isinstance(v, dict):
        if s.get("additionalProperties") is False:
            for k in v:
                if k not in s.get("properties", {}): err[bucket][f"{path}.{k}: unknown key"] += 1
        for k in s.get("required", []):
            if k not in v: err[bucket][f"{path}.{k}: missing"] += 1
        for k, ss in s.get("properties", {}).items():
            if k in v: check(v[k], ss, f"{path}.{k}", bucket, root)
    if isinstance(v, list) and "items" in s:
        for x in v: check(x, s["items"], f"{path}[]", bucket, root)
def load(p):
    try: return yaml.safe_load(open(p, encoding="utf-8"))
    except Exception as e: err["yaml"][f"{os.path.basename(p)}: parse error"] += 1; return None
# ---- 1+2: structured data
if A.data:
    D = {}
    for name in ["identities", "account-groups", "accounts", "subscriptions", "plans", "tasks", "sections"]:
        p = os.path.join(A.data, f"{name}.yaml")
        if not os.path.exists(p): err["data"][f"{name}.yaml: file missing"] += 1; continue
        D[name] = load(p); check(D[name], S[name], name, "data")
    try:
        ids = {i.get("id") for i in (D.get("identities") or {}).get("identities", [])}; acc = {a.get("id") for a in (D.get("accounts") or {}).get("accounts", [])}
        grp = {g.get("id"): {s.get("id") for s in g.get("subcategories", [])} for g in (D.get("account-groups") or {}).get("groups", [])}
        plans = {p.get("id") for p in (D.get("plans") or {}).get("plans", [])}; tasks = {t.get("id") for t in (D.get("tasks") or {}).get("tasks", [])}
        x = err["xref"]
        for a in (D.get("accounts") or {}).get("accounts", []):
            for i in a.get("identity_ids", []): x["accounts.identity_ids → identities"] += i not in ids
            x["accounts.group/subcategory → account-groups"] += a.get("subcategory") not in grp.get(a.get("group"), set())
            for l in a.get("login_via", []): x["accounts.login_via.via (oauth) → accounts"] += bool(l.get("method") == "oauth" and l.get("via") not in acc)
            x["accounts.parent_id → accounts"] += bool(a.get("parent_id") and a["parent_id"] not in acc)
        for s in (D.get("subscriptions") or {}).get("subscriptions", []):
            x["subscriptions.account_id → accounts"] += s.get("account_id") not in acc; x["subscriptions.paid_via → accounts"] += bool(s.get("paid_via") and s["paid_via"] not in acc)
        for i in (D.get("identities") or {}).get("identities", []): x["identities.anchor_account → accounts"] += bool(i.get("anchor_account") and i["anchor_account"] not in acc)
        for p in (D.get("plans") or {}).get("plans", []): x["plans.parent → plans"] += bool(p.get("parent") and p["parent"] not in plans)
        for t in (D.get("tasks") or {}).get("tasks", []):
            x["tasks.plan → plans"] += bool(t.get("plan") and t["plan"] not in plans); x["tasks.parent → tasks"] += bool(t.get("parent") and t["parent"] not in tasks)
        for k in list(x):
            if not x[k]: del x[k]
        q = collections.Counter()  # data-quality gaps (valid but incomplete)
        for a in (D.get("accounts") or {}).get("accounts", []):
            live = a.get("status") != "closed"
            q["accounts: P0/P1 with 2FA not confirmed"] += live and a.get("priority") in ("P0", "P1") and a.get("two_fa") not in ("on", "na")
            q["accounts: no recovery"] += live and not a.get("recovery"); q["accounts: no identity bound"] += live and not a.get("identity_ids")
            q["accounts: login method unknown"] += live and all(l.get("method") == "unknown" for l in a.get("login_via", []))
        for s in (D.get("subscriptions") or {}).get("subscriptions", []):
            q["subscriptions: amount unknown"] += s.get("amount") is None; q["subscriptions: live but no renew_date"] += s.get("status") in ("active", "verify") and not s.get("renew_date")
            q["subscriptions: paid_via unknown"] += not s.get("paid_via")
        for t in (D.get("tasks") or {}).get("tasks", []):
            q["tasks: open without due/due_event/recurrence"] += t.get("status") not in ("done", "canceled") and not (t.get("due") or t.get("due_event") or t.get("recurrence"))
            q["tasks: done without done_at date"] += t.get("status") == "done" and not re.match(r"^\d{4}-\d{2}-\d{2}", str(t.get("done_at") or ""))
            q["tasks: not linked to a plan"] += not t.get("plan")
        R["data_quality"] = {k: v for k, v in q.items() if v}
    except (AttributeError, TypeError, KeyError) as ex:
        R["data_quality"] = "skipped: data is not in v9 shape (see errors.data)"
import datetime
def _stale(last, cadence, today=None):
    days = {"DAILY": 1, "WEEKLY": 7, "MONTHLY": 31, "YEARLY": 366}[re.search(r"FREQ=(\w+)", cadence).group(1)] * int((re.search(r"INTERVAL=(\d+)", cadence) or [0, 1])[1])
    return ((today or datetime.date.today()) - datetime.date.fromisoformat(last)).days > 2 * days
# ---- 5: topics (data/topics.yaml + data/topic-logs/<id>.jsonl)
TD = A.topics or A.data
if TD and os.path.exists(os.path.join(TD, "topics.yaml")):
    TP = load(os.path.join(TD, "topics.yaml")) or {}; check(TP, S["topics"], "topics", "topics")
    D = locals().get("D") or {}
    acc = {a.get("id") for a in (D.get("accounts") or {}).get("accounts", [])}
    pl = (D.get("plans") or {}); plans = {p.get("id") for p in pl.get("plans", [])} | {r.get("id") for r in pl.get("reviews", [])}
    tasks = {t.get("id") for t in (D.get("tasks") or {}).get("tasks", [])}
    x, lg, q, st = err["topics:xref"], err["topics:logs"], collections.Counter(), collections.Counter()
    LD = os.path.join(TD, "topic-logs"); seen = set()
    for t in TP.get("topics", []) or []:
        tid = t.get("id"); seen.add(tid); S_ = t.get("status") or {}; tr = t.get("tracking") or {"metrics": [], "goals": []}
        st["topics"] += 1; st[f"lifecycle:{S_.get('lifecycle')}"] += 1
        M = {m.get("id"): m for m in tr.get("metrics", [])}; G = {g.get("id") for g in tr.get("goals", [])}
        if len(M) != len(tr.get("metrics", [])): x["tracking.metrics: duplicate id"] += 1
        if D:
            for a in t.get("accounts", []): x["accounts → accounts.yaml"] += a not in acc
            for i in (t.get("links") or {}).get("tasks", []): x["links.tasks → tasks"] += i not in tasks
            for i in (t.get("links") or {}).get("plans", []): x["links.plans → plans/reviews"] += i not in plans
        for g in tr.get("goals", []):
            x["goals.metric → metrics"] += bool(g.get("metric") and g["metric"] not in M)
            if D: x["goals.task → tasks"] += bool(g.get("task") and g["task"] not in tasks)
            q["goals: no deadline"] += not g.get("deadline"); q["goals: no measurable target"] += not g.get("target")
        for m in M.values(): x["metric type=enum without values"] += m.get("type") == "enum" and not m.get("values")
        q["topics: no narrative page"] += not t.get("narrative"); q["topics: no why"] += not t.get("why")
        q["topics: active without started date"] += S_.get("lifecycle") == "active" and not t.get("started")
        q["topics: no stage"] += not S_.get("stage"); q["topics: no health"] += not S_.get("health")
        q["topics: no current summary"] += not S_.get("summary"); q["topics: active without next steps"] += S_.get("lifecycle") == "active" and not S_.get("next")
        p = os.path.join(LD, f"{tid}.jsonl")
        if not os.path.exists(p): x["topic without topic-logs/<id>.jsonl"] += 1; continue
        last, n, cur, issues = "", 0, {}, {}
        for line in open(p, encoding="utf-8"):
            if not line.strip(): continue
            try: e = json.loads(line)
            except Exception: lg["jsonl: line is not valid JSON"] += 1; continue
            n += 1; check(e, S["topic-log"], "log", "topics:logs"); k = e.get("kind"); st[f"entries:{k}"] += 1
            d = str(e.get("date", ""))
            if d < last: lg["dates not ascending (append-only order)"] += 1
            last = max(last, d)
            if k == "status" and not any(f in e for f in ("stage", "lifecycle", "health")): lg["kind=status without stage/lifecycle/health"] += 1
            if "health" in e and e.get("by", "user") != "user": lg["health set by an agent (user-only policy)"] += 1
            if k == "metric" and not e.get("values"): lg["kind=metric without values"] += 1
            if k == "resource" and not e.get("ref"): lg["kind=resource without ref"] += 1
            if e.get("values") and not M: lg["values on a topic without tracking.metrics"] += 1
            for kk, v in (e.get("values") or {}).items():
                m = M.get(kk)
                if not m: lg["values: key not a metric of the topic"] += 1; continue
                ty = m.get("type"); ok = v is None or {"number": isinstance(v, (int, float)) and not isinstance(v, bool), "bool": isinstance(v, bool), "text": isinstance(v, str), "enum": v in (m.get("values") or [])}.get(ty, True)
                if not ok: lg[f"values: wrong type for metric type={ty}"] += 1
            if e.get("goal") and e["goal"] not in G: lg["goal → tracking.goals of the topic"] += 1
            for f in ("stage", "lifecycle", "health"):
                if f in e: cur[f] = e[f]
            if k == "issue": issues[f"{d}#{e.get('title')}"] = 1
            if e.get("resolves"):
                if e["resolves"] in issues: issues.pop(e["resolves"])
                else: lg["resolves → unknown issue (<date>#<title>)"] += 1
        st["log entries"] += n; q["topics: no log entries yet"] += n == 0; q["topics: open issues"] += len(issues)
        for f in ("stage", "lifecycle", "health"):  # snapshot must agree with the last status entry that set the field
            if f in cur and cur[f] != S_.get(f): q[f"status.{f} snapshot behind log (log wins)"] += 1
        cad = tr.get("cadence")
        q["topics: active, last entry older than 2 cadence periods"] += bool(n and S_.get("lifecycle") == "active" and cad and _stale(last, cad))
    if os.path.isdir(LD):
        for f in os.listdir(LD):
            if f.endswith(".jsonl") and f[:-6] not in seen: x["topic-logs/<id>.jsonl without topic"] += 1
    for k in list(x):
        if not x[k]: del x[k]
    R["topics"] = {**dict(st), "data_quality": {k: v for k, v in q.items() if v}}
# ---- 3+4: markdown in both repos
FM = S["frontmatter"]; RULES = FM["x-repo-rules"]; EX = FM["x-type-extras"]
def scan(root, repo):
    files, ids, stats, links = {}, collections.Counter(), collections.Counter(), []
    for d, ds, fs in os.walk(root):
        ds[:] = [x for x in ds if not x.startswith(".") and x not in ("node_modules",)]
        for f in fs:
            if not f.endswith(".md") or f in ("AGENTS.md", "CLAUDE.md"): continue
            p = os.path.join(d, f); rel = os.path.relpath(p, root); t = open(p, encoding="utf-8", errors="ignore").read(); stats["md"] += 1
            m = re.match(r"^---\n(.*?)\n---", t, re.S); fm = None
            if m:
                try: fm = yaml.safe_load(m.group(1)) or {}
                except Exception: err[f"{repo}:frontmatter"]["yaml parse error"] += 1
            if fm is None: err[f"{repo}:frontmatter"]["no frontmatter"] += 1; files[rel] = {}; continue
            fm = {k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in fm.items()}
            check(fm, FM, "fm", f"{repo}:frontmatter"); files[rel] = fm
            if fm.get("id"): ids[fm["id"]] += 1
            ty = fm.get("type"); ex = EX.get(ty, {})
            for k in ex.get("required", []):
                if k not in fm: err[f"{repo}:frontmatter"][f"type={ty}: missing {k}"] += 1
            if repo == "life" and "maturity" in fm: err[f"{repo}:frontmatter"]["maturity used in life (KB-only)"] += 1
            if repo == "kb" and ty == "note" and "maturity" not in fm: err[f"{repo}:frontmatter"]["note without maturity (recommended)"] += 1
            if fm.get("area") and fm["area"] not in RULES[repo]["areas"]: err[f"{repo}:frontmatter"][f"area '{fm['area']}' not in {repo} area list"] += 1
            if repo == "kb" and ty in ("task", "daily", "log", "review", "account", "subscription"): err["boundary"][f"kb holds life-type '{ty}'"] += 1
            if repo == "life" and fm.get("area") in ("ai-ml", "game-backend", "cs") and ty == "note": err["boundary"][f"life holds knowledge note area={fm['area']}"] += 1
            for w in re.findall(r"\[\[([^\]|#]+)", t): links.append((rel, w.strip()))
            for u in re.findall(r"\b(kb|life)://([^\s)>\]'\"]+)", t): links.append((rel, f"{u[0]}://{u[1]}"))
    for k, n in ids.items():
        if n > 1: err[f"{repo}:frontmatter"]["duplicate id"] += 1
    return files, ids, stats, links
REPOS = {}
for repo, root in (("kb", A.kb), ("life", A.life)):
    if root: REPOS[repo] = scan(root, repo)
names = {r: {os.path.splitext(os.path.basename(f))[0].lower() for f in v[0]} | {f[:-3].lower() for f in v[0]} for r, v in REPOS.items()}
allids = {r: set(v[1]) for r, v in REPOS.items()}
for repo, (files, _, stats, links) in REPOS.items():
    b = collections.Counter()
    for src, l in links:
        if "://" in l:
            r, rest = l.split("://", 1); rest = rest.split("#")[0].rstrip("/").lower()
            if r in names and not (rest in names[r] or rest in allids.get(r, set()) or any(n.startswith(rest) for n in names[r]) or rest.startswith(("data/", "n-knowledge-base/"))): b[f"{r}:// unresolved"] += 1
            if repo == "kb" and r == "life": err["boundary"]["kb note links to life://"] += 1
        else:
            w = l.lower().removesuffix(".md")
            if not any(w in names[r] or w.split("/")[-1] in names[r] for r in names): b["[[wikilink]] unresolved"] += 1
            elif repo == "kb" and "life" in names and not (w in names["kb"] or w.split("/")[-1] in names["kb"]): err["boundary"]["kb [[wikilink]] resolves only in life"] += 1
    for k in ("kb:// unresolved", "life:// unresolved"):
        if b[k]: err["links"][f"{repo}: {k}"] += b[k]
    R[f"{repo}_md"] = {"files": stats["md"], "with_id": sum(1 for f in files.values() if f.get("id")), "links": len(links), **dict(b)}
R["errors"] = {k: dict(v.most_common(30)) for k, v in err.items() if v}
print(json.dumps(R, ensure_ascii=False, indent=1))
if A.json: json.dump(R, open(A.json, "w"), ensure_ascii=False, indent=1)
sys.exit(1 if any(k in R["errors"] for k in ("data", "xref", "yaml", "topics", "topics:xref", "topics:logs", "boundary", "links")) else 0)
