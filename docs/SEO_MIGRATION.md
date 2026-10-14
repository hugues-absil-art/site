# Référencement : migration WordPress → ce site

Objectif : **conserver (et améliorer) le référencement Google** de hugues-absil.com lors du passage de WordPress à ce site.

## Principe : garder les mêmes adresses

Google a indexé les pages à leurs adresses WordPress (`/wordpress/<nom>/`, `/wordpress/<parent>/<enfant>/` pour
17 pages). GitHub Pages ne sait pas faire de redirection serveur 301, que Google recommande pour un changement
d'adresse. Plutôt que de subir cette limite, **le nouveau site sert chaque page migrée à son adresse d'origine** :
pas de changement d'adresse, donc pas de redirection à faire pour ces pages (Google : *« redirect only when needed »*).

| Cas | Traitement |
|---|---|
| Page WordPress avec équivalent publié dans Sanity | Servie **à la même adresse**, balise canonique vers elle-même |
| Même page à l'adresse « nouveau site » (`/critiques/…`) | Existe aussi, balise canonique vers l'adresse d'origine |
| Doublons (deux pages WordPress → un document) | Une adresse canonique, l'autre redirige (meta refresh 0 s) |
| Pages de structure (galerie, biographie, contact…) | Redirection (meta refresh 0 s) vers la section équivalente |
| Catégories WordPress (`/wordpress/category/…`, avec pagination) | Redirection vers la liste équivalente |
| Étiquettes WordPress (`/wordpress/tag/…`, ~250) | **Volontairement non redirigées** (404) : les envoyer en masse vers l'accueil serait traité comme un *soft 404* |
| Pièces jointes WordPress (~2 800 pages image) | Non redirigées (404), pas de valeur propre |

Une redirection `meta refresh` à 0 seconde est traitée par Google comme une redirection permanente (documentation
Google « Redirects and Google Search »). Le serveur reste en 200 : c'est la meilleure option sans serveur dédié.
**Conserver ces pages de redirection au moins 1 an.**

## Ce que fait le build

`npm run build` = `tsc -b` + `vite build` + `scripts/seo/build.mjs`. Ce dernier lit Sanity et écrit dans `dist/` :

- **une page HTML statique par document** (statut 200, texte complet, `<title>` et description uniques, canonique,
  Open Graph, JSON-LD `Article` / `ExhibitionEvent`) : sans cela, toutes les adresses profondes renvoient un 404
  et partagent le même titre, et Google ne les indexe pas ;
- les **pages de catégories** (listes de liens, pour l'exploration) ;
- les **doublons** (même titre, contenu équivalent) pointent vers leur page principale par canonique, hors sitemap ;
- les **pages quasi vides** sans ancienne adresse sont en `noindex` ;
- `sitemap.xml` (adresses canoniques uniquement, avec `lastmod` et images), `google_sitemap.xml.gz` (**ancien
  emplacement, mis à jour**), `robots.txt` (sitemap déclaré, `/studio` interdit), `404.html` en `noindex`.

L'application charge ensuite normalement par-dessus (les balises sont aussi mises à jour côté navigateur par
`src/lib/seo.ts`, de façon cohérente). Les anciennes adresses sont résolues par `src/seo/legacy-routes.json`.

`.github/workflows/deploy.yml` **contrôle toutes les 4 heures** si le contenu publié dans Sanity a changé et ne
reconstruit le site que dans ce cas : le job `check` compare la version du contenu (nombre de documents + date de
dernière modification, requête publique à Sanity) à celle écrite dans `build-info.json` du site déjà en ligne. Un push
sur `main` ou un lancement manuel reconstruit toujours. Une page publiée dans Sanity reçoit ainsi sa page statique et
entre dans le sitemap en moins de 4 heures. Pour une publication immédiate : lancer « Run workflow » dans l'onglet Actions
(une publication instantanée automatique est possible avec un webhook Sanity, qui demande un jeton GitHub).

## Mettre à jour la table des anciennes adresses

La table est générée à partir de la sauvegarde SQL de WordPress et des documents Sanity publiés :

```bash
python seo/tools/build_legacy_map.py --dump chemin/db.sql --comparison chemin/comparaison_systematique.csv
npm run build
```

À relancer **après avoir publié des brouillons** issus de WordPress (une adresse WordPress dont la page n'est pas
publiée n'a aucune destination). `seo/adresses-sans-page.json` liste les adresses encore sans page.

## Bascule du domaine : check-list

1. Publier les brouillons qui ont une page WordPress, relancer la table et le build.
2. Dans le workflow : `GITHUB_PAGES: 'false'` (le site est servi à la racine) ; Pages → domaine personnalisé
   `hugues-absil.com` ; DNS (IONOS) : 4 enregistrements A GitHub + CNAME `www` → `hugues-absil-art.github.io`
   (GitHub redirige `www` vers le domaine nu). Ne pas toucher aux enregistrements e-mail (MX…).
3. HTTPS activé (Enforce HTTPS).
4. **Google Search Console** : propriété `hugues-absil.com` (domaine) ; **soumettre `https://hugues-absil.com/sitemap.xml`** ;
   si l'ancien `google_sitemap.xml.gz` y est déclaré, le laisser (il est mis à jour) puis le retirer une fois le nouveau
   traité. Pas de « changement d'adresse » : le domaine ne change pas.
5. Inspecter 5 à 10 adresses importantes avec l'outil d'inspection d'URL (rendu, canonique retenue, indexation).
6. Surveiller 4 à 8 semaines : rapport « Pages », erreurs 404, performances ; le trafic peut fluctuer.
7. Ne pas résilier WordPress avant que Search Console confirme l'indexation des nouvelles pages.


## Ce que montre la Search Console (export du 14/10/2026, 16 mois, recherche Web)

| Constat | Conséquence |
|---|---|
| 380 clics, ~8 900 impressions ; **98 % des requêtes contiennent « absil » ou « hugues »** (« hugues absil » : 180 clics, position 1,2) | Le référencement actuel est celui de la **marque**, pas des articles |
| **79 % des clics** viennent de l'accueil ; **16 %** de 16 documents PDF/Word dans `/wordpress/wp-content/uploads/` ; **3 %** des pages d'articles (aquarelle-humide : 7 clics, liste-des-expositions : 3) ; 136 images : 1 clic | Priorités : l'accueil, les documents, puis le reste |
| Toutes les URL indexées sont en **`http://`** | La propriété Search Console est en http ; créer une propriété **Domaine** (enregistrement DNS TXT chez IONOS) pour voir http/https/www ensemble |
| 23 pages indexées sur ~130 connues ; 11 « explorées, non indexées » | Marge de progression : pages complètes, titres uniques, canoniques (fait) |

Décisions qui en découlent :
- **Accueil** : même adresse (`/`), même début de titre (« Hugues Absil »), description ajoutée (WordPress n'en avait pas), H1,
  biographie, œuvres par série (texte alternatif : technique, dimensions, année), expositions récentes et données
  structurées (`Person`, `VisualArtwork`) dans le HTML statique : ~840 mots lisibles sans JavaScript (WordPress : ~820).
- **Documents** : les 16 documents vus par Google et les 3 documents liés depuis les pages (**97 Mo**) sont copiés dans
  `public/wordpress/wp-content/uploads/…`, donc servis **à la même adresse**. Ils ne peuvent pas être redirigés (GitHub Pages).
- **Images** : pas ré-hébergées à l'identique (1 clic en 16 mois). Les liens du texte vers d'anciens fichiers image
  (`/wp-content/uploads/*.jpg`) sont retirés (le texte reste) ; les images affichées viennent du CDN Sanity.
- **Galeries WordPress** : sans trafic mesurable ; elles redirigent vers l'accueil, qui contient maintenant la galerie en HTML.


### Vérification sur les adresses que Google connaît déjà (export Search Console)

Sur les 172 adresses du rapport « Pages » : l'accueil, les 16 documents et toutes les pages d'articles sont servis ;
18 anciennes adresses d'archives (étiquettes, mois, pagination du blog) redirigent vers l'article ou la liste la plus
pertinente ; seules les 136 images (1 clic) et 1 étiquette (36 affichages) n'ont pas de destination.
Règle pour les étiquettes WordPress : une étiquette qui ne contient qu'un article redirige vers cet article ; les autres ne
sont pas redirigées (sauf `PRIORITY_TAGS` dans `seo/tools/build_legacy_map.py`, qui regroupe celles que Google affiche).
La page `/wordpress/tag/morgenthau-plan/` (624 affichages) renvoie vers l'article sur l'exposition de Kiefer.

### Performance

Le Studio (5 Mo) est chargé à la demande (`React.lazy`) : le fichier principal du site public passe de 6,5 Mo à 1,4 Mo.

## Limites connues et améliorations possibles

- Pas de vrai 301 (limite de GitHub Pages). Pour en obtenir, héberger le site sur un service qui les permet
  (Netlify, Cloudflare Pages…) : le script de table peut produire un fichier `_redirects`.
- Les images WordPress disparaissent avec WordPress (trafic image mesuré : négligeable). Les nouvelles images ont des textes alternatifs descriptifs.
- Les pages de galerie WordPress (personnages, paysages…) n'ont pas d'équivalent individuel : elles redirigent vers
  l'accueil (section galerie). Créer de vraies pages par série améliorerait le référencement des œuvres.
- Titres : les titres actuels de Sanity sont utilisés (certains diffèrent de WordPress).
