"""
Génère la table des anciennes adresses WordPress -> nouvelles pages :
  seo/legacy-map.json          (détail : adresse, titre, date, cible, redirection)
  src/seo/legacy-routes.json   (version compacte utilisée par l'application)

À relancer après chaque publication de contenus venant de WordPress (brouillons publiés, nouvelles pages…),
puis relancer `npm run build`.

Usage (depuis la racine du dépôt) :
  python seo/tools/build_legacy_map.py --dump "P:/chemin/db.sql" [--comparison chemin/comparaison_systematique.csv]

Le dump est la sauvegarde SQL de WordPress (décompressée). Le CSV de comparaison est facultatif : il sert de
repli quand le slug Sanity diffère du slug WordPress. Le dataset Sanity est interrogé en lecture publique.
"""
import argparse, collections, csv, html, json, os, re, urllib.parse, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument('--dump', required=True)
ap.add_argument('--comparison', default='')
ap.add_argument('--project', default='g5s39v35')
ap.add_argument('--dataset', default='production')
args = ap.parse_args()

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SITE = 'https://hugues-absil.com'

# ---------------- lecture du dump SQL ----------------
def parse_values(s, i):
    n = len(s); rows = []
    while i < n:
        while i < n and s[i] in ' ,\n\r': i += 1
        if i >= n or s[i] == ';': break
        i += 1; row = []
        while True:
            c = s[i]
            if c == "'":
                i += 1; buf = []
                while True:
                    c = s[i]
                    if c == '\\':
                        buf.append({'n': '\n', 'r': '\r', 't': '\t', '0': '\0'}.get(s[i + 1], s[i + 1])); i += 2
                    elif c == "'":
                        if s[i + 1] == "'": buf.append("'"); i += 2
                        else: i += 1; break
                    else: buf.append(c); i += 1
                row.append(''.join(buf))
            else:
                j = i
                while s[j] not in ',)': j += 1
                t = s[i:j]; row.append(None if t == 'NULL' else t); i = j
            if s[i] == ',': i += 1
            elif s[i] == ')': i += 1; break
        rows.append(row)
    return rows

tables = collections.defaultdict(list)
with open(args.dump, encoding='utf-8', errors='replace') as f:
    for line in f:
        m = re.match(r'INSERT INTO `(\w+)` VALUES ', line)
        if m and m.group(1) in ('wp_posts', 'wp_terms', 'wp_term_taxonomy'):
            tables[m.group(1)] += parse_values(line, m.end())

P = ['ID', 'author', 'date', 'date_gmt', 'content', 'title', 'excerpt', 'status', 'cs', 'ps', 'pw', 'name', 'to_ping', 'pinged',
     'mod', 'mod_gmt', 'cf', 'parent', 'guid', 'menu_order', 'type', 'mime', 'cc']
posts = [dict(zip(P, r)) for r in tables['wp_posts']]
byid = {p['ID']: p for p in posts}


def chain(p):
    out, q = [], p
    while q and q['parent'] not in ('0', None, '') and q['parent'] in byid:
        q = byid[q['parent']]
        out.append(q['name'])
    return out


# ---------------- documents Sanity publiés ----------------
def q(g):
    u = f'https://{args.project}.api.sanity.io/v2024-01-01/data/query/{args.dataset}?query=' + urllib.parse.quote(g)
    return json.load(urllib.request.urlopen(u, timeout=300))['result']


docs = q('*[_type in ["resource","exhibition","pressArticle","advice"] && !(_id in path("drafts.**")) && defined(slug.current)]'
         '{_id,_type,"slug":slug.current,title}')
by_slug = collections.defaultdict(list)
by_id = {}
for d in docs:
    by_slug[d['slug']].append(d)
    by_id[d['_id']] = d

cmp = {}
if args.comparison and os.path.exists(args.comparison):
    cmp = {r['wp_id']: r for r in csv.DictReader(open(args.comparison, encoding='utf-8-sig'), delimiter=';')}

# ---------------- décisions éditoriales ----------------
SPECIAL_SLUG = {  # slug WordPress -> slug Sanity (doublons fusionnés)
    'leonarddevinci-le-geniedudessin': 'leonard-de-vinci-le-genie-du-dessin',
    'vinci': 'leonard-de-vinci-le-genie-du-dessin',
}
REDIRECT_RULES = {  # pages de structure / galerie sans page équivalente -> destination la plus pertinente
    'accueil': '/', 'galerie-2': '/#gallery', 'personnages': '/#gallery', 'paysages': '/#gallery', 'venise': '/#gallery',
    'musiciens': '/#gallery', 'paysages-orphiques': '/#gallery', 'estampe': '/#gallery', 'dessin': '/#gallery',
    'livreartiste': '/#gallery', 'ceramique': '/#gallery', 'biographie-2': '/#biography', 'contact': '/#contact',
    'actualites-artistiques2': '/critiques/oeil-expo', 'histoire-de-lart2': '/enseignement/histoire-art',
    'technique': '/enseignement/technique-picturale', 'stages-de-dessin-peinture': '/enseignement/atelier-stages',
    'epreuves-du-bac-darts-plastiques': '/enseignement/atelier-stages', 'travaux-aout-2012': '/', 'nature': '/#gallery',
    'ecriture-automatique': '/', 'commentaires-des-fleurs': '/',
}
CAT_DEST = {  # catégories WordPress -> page de liste la plus proche. Les étiquettes ne sont volontairement pas redirigées.
    'expos': '/critiques/oeil-expo', 'expoperso': '/#exhibitions', 'a-lire': '/critiques/critiques-livres-d-art',
    'cours': '/enseignement/technique-picturale', 'hist': '/enseignement/histoire-art', 'tech': '/enseignement/technique-picturale',
    'analyse-doeuvres': '/enseignement/histoire-art', 'non-classe': '/', 'mis-en-avant': '/', 'maintenance': '/', 'travaux': '/',
}

# ---------------- table ----------------
entries, unmatched = [], []
for p in posts:
    if p['type'] not in ('post', 'page') or p['status'] != 'publish' or not p['name']:
        continue
    slug = p['name']
    path = '/wordpress/' + '/'.join(list(reversed(chain(p))) + [slug]) + '/' if p['type'] == 'page' else '/wordpress/' + slug + '/'
    target = None
    cand = by_slug.get(SPECIAL_SLUG.get(slug, slug))
    if cand:
        d = cand[0]
        target = {'id': d['_id'], 'type': d['_type'], 'slug': d['slug']}
    else:
        c = cmp.get(p['ID'])
        if c and c.get('public_id'):
            try:
                cov = float(c['public_couverture'].rstrip('%'))
            except Exception:
                cov = 0
            pid = c['public_id'].replace('drafts.', '')
            if cov >= 60 and pid in by_id:
                d = by_id[pid]
                target = {'id': d['_id'], 'type': d['_type'], 'slug': d['slug']}
    e = {'path': path, 'wpId': p['ID'], 'wpSlug': slug, 'wpType': p['type'], 'title': html.unescape(p['title'] or ''),
         'date': p['date'][:10], 'modified': p['mod'][:10], 'target': target}
    if not target:
        if slug in REDIRECT_RULES:
            e['redirect'] = REDIRECT_RULES[slug]
        else:
            unmatched.append(e)
    entries.append(e)

# plusieurs pages WordPress -> un seul document : une adresse canonique, les autres redirigent vers elle
docs_paths = collections.defaultdict(list)
for e in entries:
    if e['target']:
        docs_paths[e['target']['id']].append(e)
for lst in docs_paths.values():
    if len(lst) > 1:
        lst.sort(key=lambda e: (e['wpSlug'] != e['target']['slug'], e['date']))
        for e in lst[1:]:
            e['redirect'] = lst[0]['path']
            e['duplicateOf'] = lst[0]['path']
            e['target'] = None

# archives WordPress (catégories ; les étiquettes sont ignorées)
termslug = {r[0]: (r[1], r[2]) for r in tables['wp_terms']}
archives = []
for r in tables['wp_term_taxonomy']:
    term_id, tax = r[1], r[2]
    count = int(r[5]) if str(r[5]).isdigit() else 0
    name, slug = termslug.get(term_id, ('', ''))
    if tax == 'category' and count > 0 and slug:
        archives.append({'path': f'/wordpress/category/{slug}/', 'tax': tax, 'name': html.unescape(name), 'count': count,
                         'pages': max(1, -(-count // 10)), 'redirect': CAT_DEST.get(slug) or '/'})

routes = {}
for e in entries:
    if e['target']:
        routes[e['path']] = {'t': e['target']['type'], 's': e['target']['slug']}
    elif e.get('redirect'):
        routes[e['path']] = {'r': e['redirect']}

os.makedirs(os.path.join(ROOT, 'seo'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'src', 'seo'), exist_ok=True)
json.dump({'site': SITE, 'entries': entries, 'archives': archives}, open(os.path.join(ROOT, 'seo', 'legacy-map.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
json.dump(routes, open(os.path.join(ROOT, 'src', 'seo', 'legacy-routes.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

n_t = sum(1 for e in entries if e['target'])
print(f"adresses WordPress : {len(entries)} | avec page équivalente : {n_t} | redirections : "
      f"{sum(1 for e in entries if e.get('redirect'))} | sans destination : {len(unmatched)}")
for e in unmatched:
    print('  sans destination :', e['date'], e['path'], '|', e['title'][:50])
