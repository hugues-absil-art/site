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

## Limites connues et améliorations possibles

- Pas de vrai 301 (limite de GitHub Pages). Pour en obtenir, héberger le site sur un service qui les permet
  (Netlify, Cloudflare Pages…) : le script de table peut produire un fichier `_redirects`.
- Les images WordPress (`/wp-content/uploads/…`) disparaissent avec WordPress : le trafic Google Images associé est
  perdu tant que ces fichiers ne sont pas ré-hébergés (tâche C3 du suivi). Prévoir des noms de fichiers et textes
  alternatifs descriptifs.
- Les pages de galerie WordPress (personnages, paysages…) n'ont pas d'équivalent individuel : elles redirigent vers
  l'accueil (section galerie). Créer de vraies pages par série améliorerait le référencement des œuvres.
- Titres : les titres actuels de Sanity sont utilisés (certains diffèrent de WordPress).
