# Visualisation — premier lot MCPUI

Statut : release préparée pour `mcp-ui-solid` 6.18.0 et `mcp-ui-spec` 5.6.0,
non publiée. Solid déclare la dépendance minimale Spec `^5.6.0`.

La publication existante est déclenchée par un tag `v*.*.*` ou manuellement,
après validation et fusion. Un simple bump de version ne la déclenche pas.
Le mode manuel `check_auth_only: true` du workflow « Publish to npm » vérifie
uniquement `npm whoami`, sans installer le projet ni publier. Il confirme
l'authentification du token, pas son droit d'écriture sur chaque package.

## Périmètre livré

| Besoin | API / comportement |
| --- | --- |
| Comparaison | `createComparisonLayout({ id, chart, table, metrics?, summary?, metadata? })` |
| Géographie | `createGeographyLayout({ id, map, table, metrics?, summary?, metadata? })` |
| Preuves | `createEvidenceLayout({ id, summary, table, sources?, metadata? })` |
| Chat / mobile | Les grilles en lecture seule s'empilent sous 640px de largeur du conteneur |
| Inspection d'un graphique | Bascule Chart / Data du renderer natif Chart.js, sans service externe |
| Génération par agent | Catalogue chart/table/graph aligné avec les champs du contrat |

Les trois fonctions sont exportées par `@seed-ship/mcp-ui-solid/adapters`.
Elles retournent un `UILayout` utilisable par `UIResourceRenderer`. Aucun nouveau
type de composant n'est ajouté aux 20 renderers existants.

Les positions d'entrée sont facultatives : la composition les remplace, en
gardant les identifiants de composants. Les identifiants doivent être uniques
et respecter le format MCPUI (minuscules, chiffres, tirets). Les fonctions
rejettent les mauvais types de composants ; elles ne remplacent pas la
validation complète des paramètres à la frontière de réception. Les paramètres
sont partagés en lecture seule avec les entrées, sans duplication des données.

Ordre de lecture : contexte éventuel, métriques éventuelles, vue principale,
tableau ; pour les preuves, synthèse, tableau puis liens de sources. L'ordre
des lignes/séries/sources est conservé. Le producteur reste responsable des
agrégations, du classement et de la cohérence entre graphique et tableau.

La carte conserve le fond OpenStreetMap et le moteur existant. Ce lot
n'introduit ni géocodage, ni migration du moteur cartographique.

## Intégration MCPs

1. Utiliser les descriptions de registre à jour si elles alimentent les prompts.
2. Choisir explicitement une composition selon la question et produire les
   composants correspondants. Le choix n'est pas une heuristique automatique
   dans `connectorResultToUILayout` et `renderHints` reste indicatif.
3. Fournir les unités dans les libellés, les dates pertinentes et les sources
   réelles. Ne pas générer de confiance ou de provenance pour compléter la vue.
4. Pour les preuves, fournir les `citationMap` du tableau et des composants
   `link` pour les sources. MCPUI les conserve sans certifier leur véracité.
5. Les recettes sont optionnelles : les anciens payloads continuent à suivre
   leur chemin de rendu habituel.

## Intégration SolidStart

- Appeler la recette choisie, puis transmettre le layout au renderer habituel.
- La largeur du conteneur est observée après montage ; le rendu initial reste
  stable sans accès aux API navigateur côté serveur. Sans `ResizeObserver`,
  une mesure initiale et les événements de redimensionnement fenêtre servent
  de repli. Les coordonnées du mode drag/resize ne sont pas réécrites.
- Traduire les nouveaux libellés via `MCPUIStringsProvider` si nécessaire.
  Les nouvelles clés restent facultatives dans `MCPUIStrings` : les anciens
  dictionnaires bénéficient des valeurs anglaises par défaut.
- La bascule Data est disponible dans le renderer natif ; le chemin QuickChart
  externe conserve son comportement et son autorisation explicite existants.
- La vue Data conserve toutes les valeurs dans une zone défilante bornée.
  Les classes personnalisées des graphiques et tableaux sont appliquées.
- La validation du renderer rejette les rayons de bulles invalides et les
  paramètres de pagination négatifs ou non entiers. Une page initiale trop
  élevée est ramenée à la dernière page disponible, y compris après réduction
  du nombre de lignes.
- Les axes temporels Chart.js nécessitent toujours un adaptateur de dates
  compatible installé et enregistré par l'hôte.
- Tester les trois compositions avec le thème, la largeur de chat, les sources
  et les gros volumes réels de l'application avant de conclure à une validation
  end-to-end de SolidStart.

## Vérification locale

- `pnpm build`, `pnpm typecheck`, `pnpm lint` à la racine.
- `pnpm test` dans chacun des trois packages.
- Tests dédiés de parité du catalogue et des types, recettes, grilles adaptatives
  et bascule native avec données catégorielles, x/y et rayons de bulles.
- Smoke Chromium dans une page locale isolée : canvas Chart.js réel, bascule
  au clavier, rayon de bulle conservé, passage 1280px → 420px → 1280px,
  absence de débordement horizontal et d'erreur JavaScript.

Le smoke utilise un habillage CSS minimal ; il valide le fonctionnement du
renderer, pas le thème complet ni l'intégration live de SolidStart.

## Suite, hors de ce lot

La pagination serveur présente une incohérence préexistante : le schéma de
`pagination.currentPage` exige une valeur à partir de 1, alors que le renderer
l'interprète comme un index à partir de 0. Ce lot ne change pas cette convention
à la volée. Les intégrations doivent tester explicitement leur pagination
serveur ; son alignement contrat/runtime nécessite un correctif dédié. Les
nouveaux contrôles de pagination locale ne résolvent pas cette incohérence.

La sélection d'une commune ne filtre pas encore automatiquement le tableau ou
le graphique voisin. Un prochain lot devra définir les identifiants d'entités,
les événements de sélection et l'état partagé géré par l'hôte. La persistance
de `PresentationFeedback`, les échelles communes des petits multiples, une
matrice/heatmap et une frise de preuves restent également à traiter séparément.
