# Solid 2 MCPUI — mise en pause et procédure de reprise

Document commencé le 2026-10-23, décision de pause du mainteneur le 2026-10-24
(Europe/Paris). Cette page est la référence de reprise ; les anciens guides
d'installation ci-dessous sont conditionnels, pas une consigne de continuer.

## Décision et conservation

- Migration Solid 2 suspendue, sans date de reprise : le chantier côté Deposium
  doit d'abord être suffisamment avancé. Aucun travail de migration automatique.
- Conserver la branche distante `feat/solid2-preview` et la
  [PR #34](https://github.com/theseedship/mcp-ui/pull/34), ouverte en brouillon.
  Ne pas fusionner/fermer cette PR, supprimer la branche, rebaser ou forcer son
  historique dans le cadre de cette pause.
- Ni tag, dispatch (même review-only), staging/publication npm, changement de
  dist-tag, configuration de secret/environnement, intégration applicative ou
  déploiement ne sont autorisés pendant la pause. Aucun réveil ou suivi périodique
  n'est planifié. Un nouveau go humain est nécessaire avant la reprise.
- Solid 1 reste une ligne distincte : dernière référence npm vérifiée le
  2026-10-23, `6.25.1`. Cette note n'autorise aucune modification de `main`,
  des applications Deposium, des MCPs ou de GeoAI.
- Le checkout local dédié est `/home/nico/worktrees/mcp-ui-solid2-preview`.
  La branche GitHub est la référence portable ; les chemins locaux ci-dessous
  sont des copies sur cette machine, pas une sauvegarde hors machine garantie.

## Dernier état fonctionnel qualifié — historique à revalider

- Source : `96715b9746b259d26219b24a503e92a7106275a4`, avec le correctif
  Quickchart réactif `bbb508b` et le report de sécurité #38.
- Dernier `main` intégré : `725f862ac76170c40ab796a1d4773b0dbb90be27` (#38).
  La baseline Solid 1 indépendante du banc reste `c107b89c862505ab51253c0a28505c70a6e39886`.
- Version de travail : `@seed-ship/mcp-ui-solid@7.0.0-solid2.0` ; ce numéro
  seul n'identifie pas les différents tarballs. Pas de bump pour cette pause
  documentaire ; aucun code, manifeste, lockfile ou workflow n'est modifié.
- Workbench gelé : Solid/core/web/signals/compiler/Babel `2.0.0-rc.18`,
  plugin `3.0.0-next.51`, Vite `8.3.5`, Vitest/UI `4.1.12`, jsdom `27.2.0`,
  virtual-core `3.13.18`. Ce sont des références historiques, pas des versions
  recommandées pour une reprise à une date future.
- Local : build browser/SSR/déclarations, types et lint passent ; 143 fichiers
  Vitest, 2 417 tests réussis, un placeholder GraphRenderer ignoré ; 62 tests
  Node de garde-fous/harnais. Lint : 0 erreur, 424 avertissements préexistants.
- [CI 40036418438](https://github.com/theseedship/mcp-ui/actions/runs/40036418438),
  tentative 1, verte sur cette source exacte : preview, baseline Solid 1,
  garde-fous, plus les deux checks Socket. Les vrais tarballs ont été qualifiés
  en profils full/optional-absent, dev/production SSR-hydratation Chromium,
  avec le probe des dix entrées client compilées.
- La review indépendante du report #38 n'a trouvé aucun nouveau P1/P2. Le fil
  Quickchart est résolu ; les anciennes reviews automatiques portent sur
  `9aaa09b`, pas sur `96715b9`. Ce n'est pas une approbation GitHub mainteneur.

Les commits documentaires de pause avancent ensuite le HEAD de #34 : ils ne
deviennent pas la source de l'archive CI ci-dessus. Une éventuelle CI qui tourne
automatiquement au push de documentation n'est ni une reprise du projet ni une
autorisation de publication. À la reprise, vérifier le HEAD réel et produire
une nouvelle chaîne source → CI → archive ; ne pas réutiliser cet ancien tuple.

## Archive de référence préservée

- Artefact GitHub `12537237064`, `solid2-preview-qualification`, 8 206 995 octets.
  Expiration annoncée au contrôle : `2027-01-21T22:53:15Z` ; ne pas dépendre de
  sa présence sur GitHub plusieurs mois plus tard.
- SHA-256 du **ZIP CI**, téléchargé et vérifié contre les métadonnées GitHub :
  `1af0e9cbfbf8c5de7866797e826e9e97ed568dd2903a4c18ca415f7eb40b39f4`.
- Dans ce ZIP : `mcpui-solid2-artifacts/seed-ship-mcp-ui-solid-7.0.0-solid2.0.tgz`.
  SHA-256 du **tarball Solid interne**, extrait sans l'exécuter et vérifié :
  `69eeb717e4082448fad68fc53f04f930da27580b9511acd9182ecf979f24b84d`.
  Ce checksum est différent de celui du ZIP et de l'ancien tarball local Node 24.
- Copie durable locale, hors dépôt :
  `/home/nico/worktrees/mcp-ui-solid2-preserved-20261024-96715b9-02R0SK/`.
  Elle contient le ZIP, le `.tgz` Solid, `artifact-metadata.json`,
  `ci-run-metadata.json`, `source-provenance.json`, le dernier audit pnpm et les
  logs locaux de build/types/lint/tests/garde-fous. Aucun binaire n'est commité.
- Les rapports correspondants restent dans le ZIP :
  `mcpui-solid2-full/qualification-results/2026-10-23T22-56-24.820Z/report.json`,
  `mcpui-solid2-optional-absent/qualification-results/2026-10-23T22-56-54.981Z/report.json`
  et `mcpui-solid2-full/dist-client-probe/2026-10-23T22-57-06.042Z/report.json`.

Cette sauvegarde conserve des preuves et permet l'inspection/reproduction ;
elle n'est pas un candidat de publication après la pause. Le helper offline
de staging n'a pas été exécuté sur cette archive pendant la mise en pause.
Si la copie locale ou les artefacts GitHub disparaissent, le code et le lockfile
restent dans Git : reconstruire et requalifier, sans contourner la politique.

L'ancien dossier `/home/nico/worktrees/mcp-ui-solid2-artifacts/final/`, son
tarball Node 24 de SHA `f4fed9b4…`, son `source-provenance.json` et les essais
`qualification-1` à `qualification-4` sont historiques. Ils ne remplacent pas
le couple source/CI/archives `96715b9` ci-dessus.

## Sécurité et limites non levées

Le dernier `pnpm audit` de la preview signale un HIGH Zod
`GHSA-mrhx-c7xc-m3w5` et sort avec le code 1. Zod `3.25.76` reste en place :
sa vraie migration change des objets/types publics et nécessite une décision
de compatibilité/version séparée ; un import `/v3` ne corrige pas ce problème.

Le rescan GitHub après #38 a aussi ouvert quatre alertes `fast-uri` (#103–106,
deux modérées/deux faibles), via `ajv@8.18.0` → `fast-uri@3.1.8` dans le CLI.
Elles n'étaient pas remontées par le feed pnpm utilisé à ce contrôle. GitHub
listait huit occurrences au total, dont quatre pour le même advisory Zod.
Les feeds et les comptes ne sont pas équivalents. Rien n'est déclaré « clean » ;
réconcilier les audits, alertes et versions publiées à la reprise. Les overrides
du workspace ne mettent pas à jour les lockfiles des applications clientes.

Le vrai chat Deposium, son backend/auth et les adaptateurs déployés restent
non qualifiés. Les limites détaillées du banc sont conservées plus bas.

## Checklist de reprise — seulement après un nouveau go

1. Confirmer la disponibilité du pilote Solid 2 côté Deposium et le périmètre
   autorisé. Relire cette note, le workbench, les instructions agents et la
   politique de publication réellement présente sur `main`. Ne pas assimiler
   une reprise de revue à une autorisation d'installer, publier ou déployer.
2. Utiliser un checkout/worktree dédié et propre ; préserver les autres WIP.
   Faire `git fetch origin main feat/solid2-preview`, vérifier le HEAD distant,
   l'état ouvert/brouillon de #34 et les changements intervenus sur `main`.
   Relire les nouveaux commentaires. Ne pas forcer la branche ni supprimer les
   anciennes preuves pour repartir ; synchroniser de façon revue si nécessaire.
3. Réévaluer toute la chaîne Solid/runtime/web/compiler/plugin/Vite avec le
   pilote réel. Les RC.18 sont gelées, pas garanties encore pertinentes. Toute
   évolution de version/PR/canal exige une mise à jour revue de la politique,
   actuellement limitée à #34, sa branche, `7.0.0-solid2.0` et `solid2`.
   Ne pas mélanger les runtimes, aliaser Solid 1 vers 2 ou remplacer le lockfile
   par un update global non revu. Requalifier aussi les peers optionnels.
4. Réauditer les dépendances complètes et production, ainsi que Dependabot.
   Traiter ou faire arbitrer explicitement Zod et `fast-uri` ; les preuves de
   sécurité d'octobre ne couvrent pas les nouveaux advisories. Ne pas masquer
   une incompatibilité majeure par un override ou un simple changement de numéro.
5. Rejouer les commandes du [workbench](./SOLID2-PREVIEW.md#reproduction-and-clean-package-gates) et la vraie matrice tarball
   full/optional-absent en dev/production SSR-hydratation et client compilé.
   Les tests statiques/mocks ne suffisent pas. Obtenir une CI complète verte,
   tentative 1, liée au HEAD réellement retenu ; conserver les nouveaux rapports,
   archive et checksums. Les anciens résultats ne se transfèrent pas au nouveau SHA.
6. Relire les nouveaux résultats et obtenir les approbations GitHub requises.
   Marquer #34 prête uniquement lorsque la pause est explicitement levée ; la
   garder ouverte, sans fusion du runtime dans `main` juste pour publier.
7. Un dispatch review-only depuis `main` reste une décision humaine séparée.
   Vérifier source/CI/artefact et les bytes avec le helper de la politique revue.
   Un staging demande encore un accord exact SHA/version/tarball/canal, un
   environnement `npm-solid2-preview` à reviewers et une approbation npm 2FA.
   Vérifier auparavant les versions publiques et stages déjà en attente ; ne
   pas doubler un stage ou bumper une version pour contourner un échec.
8. Le pilote réel et toute installation/déploiement Deposium constituent une
   étape distincte autorisée séparément, avec lockfile et rollback propres.
   N'utiliser ni workflow stable ni tag `v7…` ; `latest` doit rester stable.

## Installation et adaptations du pilote — référence conditionnelle

Après reprise et nouvelle qualification, uniquement dans la cible Solid 2
isolée autorisée, jamais dans l'application Solid 1. La commande historique
suivante illustre les pins RC.18, à réévaluer ensemble avant exécution :

```sh
pnpm add /absolute/path/seed-ship-mcp-ui-solid-7.0.0-solid2.0.tgz \
  solid-js@2.0.0-rc.18 @solidjs/web@2.0.0-rc.18
```

Conserver le lockfile de cette cible. Épingler le compilateur/Babel/signals
RC.18 et `@solidjs/vite-plugin@3.0.0-next.51` avec Vite `8.3.5`, Node >=22.12.0.
La qualification locale utilise Node 24.19.0 ; le résultat CI Node 22 est
une preuve distincte. Les versions des peers facultatifs et les commandes
complètes figurent dans le [guide preview](./SOLID2-PREVIEW.md).

1. JSX DOM, Portal, render/hydration et types DOM : `@solidjs/web` ; core,
   contextes, stores et scheduler : `solid-js`. Aucun alias Solid 1 → Solid 2.
2. Utiliser le plugin officiel en mode start/SSR pour le petit hôte. La version
   épinglée fournit un `RequestEvent` au middleware (`event.request`), pas
   directement un `Request` ; ne pas recopier un ancien template beta.
3. Avec la condition source `solid`, inclure dans `optimizeDeps.include` les
   moteurs CommonJS réellement installés, via la syntaxe de dépendance imbriquée.
   Le harnais donne le profil exact ; le profil sans peers reste vide.
4. Porter les cycles de vie propres à Deposium : notamment
   `src/lib/mcp/ServerCapabilitiesInit.tsx` utilise encore `onMount(async ...)`.
   Lancer/annuler l'asynchrone depuis un `onSettled` synchrone ou un effet apply.
   Ne pas dispatcher dans un constructeur de composant/root pur.
5. Réutiliser les imports MCPUI publics actuels : root, validation, KaTeX,
   hooks/providers/bus/capabilities/scratchpad. Les méthodes impératives
   conservent leurs lectures immédiates ; pas de flush généralisé dans l'hôte.
6. Garder le scan Tailwind du `src/**/*.{ts,tsx}` publié. KaTeX reste un peer
   explicite, MathML sans CSS/polices ; la virtualisation utilise le peer
   `@tanstack/virtual-core@3.13.18`, pas l'adaptateur Solid 1.

Les API MCPs, schémas, payloads, références/citations et callbacks n'ont pas
changé. Le routage de ChatUIIsland par capture doit conserver
`data-mcp-ui-component-id`, le groupe parent `role="group"`, l'ordre/les libellés
des actions et l'exclusion des contrôles `data-mcp-ui-action`. Les extensions
inconnues des capabilities et la distinction callbacks SSE/bus restent intactes.

## Preuves et limites

La matrice locale couvre types/build/tests, entrées ESM/CJS/sources, vrai tarball
sans lien workspace, SSR/hydratation Chromium dev et production, sorties client
compilées sans plugin, tables/citations/copie/export/virtualisation, KaTeX,
Chart.js avec zoom/reset, Leaflet avec tuiles synthétiques, G6 dagre, highlight.js,
portails/thèmes/focus et deux cycles de références par moteur. Montages,
listeners et callbacks sont comptés ; deux bus, fragments SSE, erreurs,
annulation, démontage/remontage et callbacks tardifs sont vérifiés.

Le plafond public de table est 100 lignes : 100 lignes virtuelles valides sont
testées, pas un bypass de validation à 1 000 lignes. Aucune API de sélection de
lignes n'existe ; elle n'est pas inventée pour le banc.

Sous la politique `chartZoom="expanded"`, le propre fullscreen du graphique
reconfigure son SDK (IDs observés 0 → 1 → 2). Ce comportement préexistant est
distinct des cycles extérieurs/références sans changement d'options : ceux-ci
conservent strictement l'instance et les nœuds. Ne pas confondre reconstruction
du SDK après changement de configuration et double montage du composant.

Les chargeurs PMTiles/DuckDB sont vérifiés au niveau imports/API/build, pas au
niveau ouverture de données, Worker ou WASM. Les intégrations Mermaid externes,
gestes tactiles réels, autres navigateurs, adaptateurs déployés et le vrai chat
Deposium/backend/auth restent hors de cette preuve synthétique. Aucun compte,
stockage distant ou traitement facturé n'est nécessaire au banc.

## Suite conditionnelle et retour arrière

Pendant la pause : aucune intégration ni publication. Après les gates de
reprise, utiliser seulement le nouvel artefact approuvé dans le pilote autorisé
et qualifier son vrai chat et ses sources. Le canal manuel preview existe depuis
#35, mais n'est pas autorisé par son existence. Le workflow stable matche aussi
les tags prerelease et impose `--tag latest` : ne pas pousser `v7.0.0-solid2.0`.
La [procédure de canal](https://github.com/theseedship/mcp-ui/blob/feat/solid2-preview/.github/SOLID2_PREVIEW_RELEASE.md)
décrit les accords supplémentaires, contrôles et approbation npm mainteneur.

Retour arrière : ancienne application ET ancien lockfile/référence de
déploiement. Ne jamais installer le renderer Solid 1 dans l'arbre réactif 2.
