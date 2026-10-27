# MCP UI → Deposium Solid 2 : handoff de préparation, 2026-10-27

## Décision et périmètre

Le mainteneur a explicitement repris la préparation du portage MCP UI pour
accompagner le chantier Solid 2 de Deposium. Reprise limitée au code, aux tests
et à ce handoff : pas de modification de Deposium, de main, de merge de #34,
de dispatch, de tag, de staging/publication npm ni de déploiement.

Source : `feat/solid2-preview`, [PR #34](https://github.com/theseedship/mcp-ui/pull/34),
toujours en brouillon. Main stable intégré :
`dad219a3e637c78f833fcc1d00e16f8c8beec1c0` (#40 Zod 4 et #41 fast-uri).
Le vieux tuple source/CI/archive `96715b9` reste historique, pas une preuve
de qualification de ce nouveau delta. Consulter les checks du **HEAD exact**
de #34, puis les rapports contenus dans son nouvel artefact CI.

## Cible actualisée : RC.19

**Cible de préparation demandée : RC.19.** Les cinq packages ont été publiés
ensemble le 2026-10-27. Le pilote Deposium consulté est encore RC.18 : il doit
passer la cohorte entière à RC.19 avant de consommer ce nouveau renderer.
Un downgrade RC.16 ne constitue pas un correctif établi du Combobox.
Pas de mélange de cohortes ni d'alias Solid 1 → 2.

| Élément | Cible commune revue |
| --- | --- |
| `solid-js`, `@solidjs/web`, `@solidjs/signals` | `2.0.0-rc.19` |
| `@solidjs/compiler`, `@solidjs/babel-plugin` | `2.0.0-rc.19` |
| `@solidjs/vite-plugin` | `3.0.0-next.51` |
| Vite | `8.3.5` |
| Virtualisation MCP UI | `@tanstack/virtual-core@3.13.18`, pas l'adaptateur Solid 1 |
| Contrat de validation | Spec `6.0.0`, vrai Zod `4.6.6` |

Le renderer RC.19 résout son propre couple Seroval/seroval-plugins 1.7.0,
sans override du workspace. Le pilote consulté force 1.7.2 : cet écart doit
être qualifié dans son lockfile, pas copié ou annulé implicitement ici.

Les [notes RC.19 des signaux](https://github.com/solidjs/solid/releases/tag/%40solidjs/signals%402.0.0-rc.19)
et [du renderer](https://github.com/solidjs/solid/releases/tag/%40solidjs/web%402.0.0-rc.19)
décrivent notamment des corrections d'hydratation, d'événements délégués et de
focus pendant les déplacements de listes. Les types publics web restent
inchangés ; `onSettled`, effets, memos et stores utilisés ici sont conservés.
RC.19 ajoute `onFlush`, sans en faire un remplacement de `onSettled` : il est
sans effet côté serveur et ne doit pas être appelé dans une computation possédée.
Ces changements ne prouvent pas que le Combobox Deposium fonctionne.

**Écart à qualifier côté application :** le manifeste npm de
[`@kobalte/core@2.0.0-alpha.4`](https://registry.npmjs.org/@kobalte%2fcore/2.0.0-alpha.4)
déclare des peers **exacts RC.16** pour core/web. Le plugin next.51 déclare
`^2.0.0-rc.16`, qui accepte RC.19 ; ces deux contraintes ne sont pas équivalentes.
Une tolérance pnpm ciblée n'est pas une preuve de compatibilité Kobalte.
Le pilote doit conserver son repro réel et qualifier sélection/clear, options
vivantes, clavier, focus, Escape, ARIA et cleanup, sans masquer les diagnostics.
MCP UI ne dépend pas de Kobalte et ne corrige pas son engine à sa place.

Si l'équipe veut comparer RC.16, utiliser **une cible et un lockfile distincts**,
en changeant ensemble core/web/signals/compiler/Babel. Rejouer le même repro et
les mêmes tests navigateur ; ne pas présenter le changement de RC comme un fix
avant ces observations. Aucun support RC.16 de ce renderer n'est revendiqué.

## Ce qui est déjà porté côté MCP UI

- APIs DOM/JSX/Portal/SSR sur `@solidjs/web`, core/contextes/stores sur `solid-js`.
- Effets compute/apply, ownership/disposal et stores draft ; lectures impératives
  synchronisées aux frontières observables, pas de flush généralisé dans l'hôte.
- Chargeurs optionnels paresseux ; instances Chart.js, Leaflet, G6, KaTeX,
  highlight.js et virtualisation core, portails et thèmes conservés.
- Entrées publiques root/components/hooks/types/validation/adapters/plugins,
  condition source `solid`, distributions browser et server séparées, types ESM/CJS.
- Contrats MCP, noms de composants, citations, callbacks et politique de
  sanitization conservés ; Zod 4 change ses types/messages natifs, pas les
  formes JSON ni les codes applicatifs qualifiés par les régressions de #40.

Le delta courant reporte les corrections Spec 6 / Zod 4.6.6, les déclarations
complètes et le résolveur fast-uri corrigé du CLI. Le harnais utilise un vrai
Spec 6 empaqueté, y compris pour les dépendances transitives du renderer.

## Qualification : lire les niveaux de preuve séparément

Validation locale RC.19 : installation frozen pnpm 8.15.0, **69 garde-fous Node**,
build browser/server/déclarations, trois typechecks, **2 447 tests Vitest réussis
et un skip préexistant**, lint sans erreur (424 avertissements existants).
Les audits complets et production du 2026-10-27 sortent 0, aucune advisory
dans le feed consulté. Cela ne vaut pas audit de toutes les applications hôtes.
Exécution sérialisée sous cgroup : pic mémoire observé 1.3 GiB, aucun swap.
La qualification navigateur/tarballs du **nouveau HEAD** reste celle de sa CI,
à vérifier séparément ; les résultats historiques ne la remplacent pas.

- Nouveau garde-fou offline de cohorte RC/runtime/compiler/plugin, d'absence de
  virtualiseur Solid 1 et d'ownership du couple Seroval par le renderer.
- Régressions observées rouges avant correction : ancien Spec 5 par défaut,
  absence d'override vers le tarball Spec demandé et diagnostic
  `EFFECT_RELAY_TEAR` non rejeté. `EFFECT_WRITES_OWN_SOURCE` est aussi rejeté.
- La CI reconstruit les packages et teste les profils **full/optional-absent**
  avec SSR/hydratation dev/production, navigateur compilé et moteurs réels.
  La baseline Solid 1 est isolée sur `dad219a`, avec son propre lockfile.
- Le CLI empaqueté garde sa preuve ESM/CJS : résolveur direct corrigé même si
  une ancienne copie est délibérément conservée sous Ajv dans le contrôle.
- Les anciens comptes de tests/audit ne sont pas transposables au nouveau HEAD.
  Une CI verte et son archive/checksum restent requis avant intégration réelle.

Les commandes locales lourdes passent par le verrou/les limites du chantier
Solid 2 partagé : 4 GiB maximum, zéro swap, une charge à la fois. Si le verrou
est occupé par Deposium, ne pas lancer une deuxième charge ni arrêter son unité.
La CI GitHub est la qualification complète ; un contrôle statique ou mock ne
prouve ni le vrai chat Deposium, ni ses services, auth, SQL/RLS ou Workers/WASM.

## À transmettre à l'agent du repo Solid

1. Aligner le pilote isolé sur toute la cohorte RC.19 ; ne pas installer le package stable npm
   `@seed-ship/mcp-ui-solid@7.0.0` dans son arbre Solid 2 : il est **Solid 1**.
2. Lire ce handoff puis les nouveaux résultats source → CI → tarballs de #34.
   Ne pas utiliser un ancien `.tgz` ou son checksum comme nouveau candidat.
3. Reprendre les imports MCP UI publics, les providers/bus/capabilities/scratchpad
   et le pont KaTeX. Conserver les IDs de composants, groupes parent, exclusions
   `data-mcp-ui-action` et métadonnées de citations du routage ChatUIIsland.
4. Porter les effets propres à l'hôte : ne pas garder un `onMount(async ...)`
   hérité de Solid 1 ; respecter les frontières synchrones d'observation et cleanup.
5. Conserver le scan Tailwind des sources publiées et inclure les moteurs CJS
   réellement installés dans l'optimisation Vite, comme dans le consommateur
   du harnais. Fournir explicitement KaTeX et les autres peers voulus.
6. Qualifier le vrai chat/streaming, annulation/démontage, tables/citations,
   cartes/graphes, thèmes et SSR/hydratation sur le lockfile de l'application.
   Ce n'est pas remplacé par la qualification synthétique de la bibliothèque.

## Version et promotion : candidate 8.x, aucun upload autorisé

La politique de versions est maintenant explicite : la ligne stable `7.x`, y
compris les futures `7.1.x`, reste Solid 1 et conserve le canal npm `latest`.
La ligne `8.x` porte le runtime Solid 2 et reste opt-in sur le tag npm `solid2`.
Le manifeste source préparé annonce `8.0.0-solid2.0`; cette chaîne de version
ne prouve ni la qualification ni l'autorisation de publier. Il faut qualifier
le HEAD exact et son archive; l'ancienne archive 7.x ne peut pas qualifier 8.x.
La migration du host Deposium continue; l'installation attend l'accord de son
équipe applicative.

Le tuple antérieur `7.0.0-solid2.0` et son archive/checksum sont des preuves
historiques pour l'ancien source/CI seulement. Ils ne doivent jamais être
présentés comme qualification du nouveau `8.0.0-solid2.0`. Il faut une nouvelle
CI réussie sur le HEAD exact, puis qualifier son archive exacte. Les résultats
et checksums de l'ancien tuple restent distincts de cette preuve.

Le workflow de preview actuellement sur main reste figé sur l'ancienne identité,
RC.18 et le fixture Spec 5.7.0 : **ne pas le dispatcher pour ce delta**. Une PR
d'infrastructure distincte, basée sur stable main, doit d'abord être examinée
et fusionnée avec la politique RC.19 / Spec 6 / CLI 5.0.2 et le validateur
correspondant avant tout usage du nouveau workflow. Cette fusion d'infrastructure
ne fusionne pas le runtime PR #34 et n'autorise aucun dispatch ni upload.

Aucun dispatch, tag, merge de #34, staging, publication npm ou installation dans
l'application n'est autorisé dans cette tranche. Plus tard, review-only et
staging demanderont leurs validations et approbations séparées; une publication
éventuelle resterait une approbation npm manuelle. Ne jamais utiliser le workflow
stable, un tag `v…` ni `latest` pour la preview Solid 2.
