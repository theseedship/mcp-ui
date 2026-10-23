# Remise MCPUI au pilote Solid 2 — 2026-10-23

Preview locale et PR de revue uniquement. Aucun merge, tag, staging npm,
changement de dist-tag ou déploiement n'est autorisé par cette note.

## Référence à consommer

- Branche : `feat/solid2-preview`, base distante vérifiée
  `c107b89c862505ab51253c0a28505c70a6e39886`.
- Paquet : `@seed-ship/mcp-ui-solid@7.0.0-solid2.0`.
- Ligne Solid 1 conservée : `6.25.1`, checkout et lockfile distincts.
- Artefact final de cette machine :
  `/home/nico/worktrees/mcp-ui-solid2-artifacts/final/seed-ship-mcp-ui-solid-7.0.0-solid2.0.tgz`.
- Le SHA Git source exact, le SHA-256 du tarball et les rapports de qualification
  associés sont dans `source-provenance.json`, à côté du tarball. C'est la
  référence de remise ; les dossiers `qualification-1` à `qualification-4`
  conservent des essais historiques, pas une autorisation de release.

Vérifier cette provenance et le checksum avant installation. Le suffixe de
version seul n'identifie pas les tarballs locaux successifs, jamais publiés.
Ne pas remplacer cette référence par un checkout de branche non épinglé.

## Installation et adaptations du pilote

Uniquement dans la cible Solid 2 isolée, jamais dans l'application Solid 1 :

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

## Suite et retour arrière

Intégrer ensuite ce seul artefact dans le pilote, qualifier son vrai chat et ses
sources, puis seulement un staging isolé. Le workflow stable matche aussi les
tags prerelease et impose `--tag latest` : ne pas pousser `v7.0.0-solid2.0`.
Un éventuel canal npm preview exige une PR distincte et un nouvel accord portant
sur SHA Git, version, tarball, canal et approbation npm mainteneur.

Retour arrière : ancienne application ET ancien lockfile/référence de
déploiement. Ne jamais installer le renderer Solid 1 dans l'arbre réactif 2.
