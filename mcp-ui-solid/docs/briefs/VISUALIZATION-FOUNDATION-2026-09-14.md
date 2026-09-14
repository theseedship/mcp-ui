# Visualisation — premier lot MCPUI

Statut : implémentation locale, non publiée. Le numéro de version n'est pas
modifié dans ce lot ; les changements sont décrits dans `Unreleased`.

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
- La bascule Data est disponible dans le renderer natif ; le chemin QuickChart
  externe conserve son comportement et son autorisation explicite existants.
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

La sélection d'une commune ne filtre pas encore automatiquement le tableau ou
le graphique voisin. Un prochain lot devra définir les identifiants d'entités,
les événements de sélection et l'état partagé géré par l'hôte. La persistance
de `PresentationFeedback`, les échelles communes des petits multiples, une
matrice/heatmap et une frise de preuves restent également à traiter séparément.
