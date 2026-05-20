# Roadmap MCPUI - OpenData, macros et rendu dynamique

Date: 2026-05-21
Statut: brief de sprint / base pour `/goal`
Repos concernes: `mcp-ui`, puis integration hot dans Deposium Solid + MCPs

## Final Decision Summary (etat verrouille - 2026-05-21)

> **Etat final : D1-D10 + R1-R4 sont contraignants.** Les notes anterieures
> "A clarifier", "DECISION REQUISE", "Points a trancher" sont **historiques**
> — conservees pour tracabilite — et ne s'appliquent QUE si elles ne sont
> pas recouvertes par D1-D10 ou R1-R4. En cas de divergence : R1-R4 prime
> sur D1-D10, qui prime sur tout le reste.

Aucun blocage ne subsiste pour le `/goal`. Ordre d'execution arrete :

1. `StreamingUIRenderer` parity (D3 / Gap 1 / Phase 3)
2. `MCPUIStringsProvider` + audit des strings en dur (D2 / R4)
3. `mcp-ui-spec` : contrat `ConnectorDynamicResultV1` + fixtures (R1)
4. `PresentationFeedback` (R3 / Phase 4)
5. Adapters opt-in `mcp-ui-solid/adapters` (D5 / D6 / R1)

Etapes 1-4 sont 100 % internes au repo `mcp-ui` ; l'integration MCPs +
Solid suit l'etape 5.

## Objectif

Faire de MCPUI la couche de rendu generique pour les resultats de connecteurs et de macros semi-automatiques, sans specialiser le coeur sur `data.gouv.fr`.

Le cas pilote reste OpenData / data.gouv.fr: une question comme `immobilier toulouse`, `dpe montpellier`, `pollution lyon`, `emploi nantes`, `ecoles marseille` doit pouvoir produire:

- un resultat principal lisible: table, chart, metric, map, source cards;
- des datasets et ressources connexes;
- des actions de poursuite: comparer, filtrer, charger un dataset, lancer une macro;
- des questions HITL seulement quand elles ajoutent de la valeur;
- du feedback de presentation, separe du feedback de qualite de reponse.

## Constats apres lecture du composant

MCPUI a deja la plupart des briques necessaires. Il faut eviter de recreer des composants qui existent deja.

| Besoin produit | Primitive MCPUI existante | Decision |
|---|---|---|
| Tables immobilier / DPE / resultats API | `UIResourceRenderer` avec `type: "table"`, `DataPreviewSection` dans `ScratchpadPanel` | Reutiliser. Ajouter des presets/adapters, pas un nouveau renderer. |
| Graphiques comparatifs entre villes | `type: "chart"` avec bar/line/doughnut/scatter | Reutiliser. Ajouter conventions de dataset Chart.js par domaine. |
| Cartographie / geojson / zones | `type: "map"`, section scratchpad `map` | Reutiliser pour pollution, DPE geo, equipements publics. |
| Datasets trouves / sources / documents | `link`, `artifact`, `carousel`, `grid` sont des types `UIResourceRenderer`. ATTENTION: `source_card` existe seulement comme section `ScratchpadPanel`, PAS comme type `UIResourceRenderer`. | Reutiliser pour le scratchpad. Pour un `UILayout` de chat: soit composer un `grid`/`carousel` de `link`/`artifact`, soit ajouter un renderer `source_card` a `UIResourceRenderer` (vrai item de scope, pas "reutiliser"). |
| Actions utilisateur | `action-group`, `MCPActionProvider`, `useAction` | Reutiliser pour `load_dataset`, `compare_city`, `run_macro`, `ask_followup`. |
| Choix bloquant dans le chat | `ChatPrompt` (`choice`, `confirm`, `form`) | Reutiliser. Pas de nouveau widget HITL bloquant. |
| Elicitation MCP standard | `ElicitationForm` + `elicitationToPromptConfig()` | Reutiliser pour les tools compatibles MCP `elicitation/create`. |
| Suivi d'un run macro/agent | `ScratchpadPanel`, sections `agent_card`, `stepper`, `split_stepper`, `action`, `data_preview` | Reutiliser comme workspace de macro. Ajouter un adapter macro -> scratchpad. |
| Feedback non bloquant | `FeedbackInline`, section scratchpad `feedback`, telemetry | Reutiliser, mais enrichir le schema de feedback de presentation. |
| Streaming de composants | `StreamingUIRenderer` | A ameliorer: rendu actuel trop simplifie, il ne delegue pas au vrai `UIResourceRenderer`. |

## Principe d'architecture

MCPUI doit rester une bibliotheque de rendu et d'interaction, pas un orchestrateur metier.

Responsabilites:

- MCPs/connecteurs: cherchent les donnees, produisent des payloads structures, exposent les actions possibles.
- Macros YAML / runtime agent: orchestrent plusieurs tools, gerent le plan, l'etat et les questions.
- Deposium Solid: decide quand afficher chat, scratchpad, prompt, feedback, et persiste les logs.
- MCPUI: rend les payloads, expose des primitives d'action/HITL/telemetry, reste agnostique de data.gouv.fr.

## Cible fonctionnelle

### 1. Rendu dynamique par intention

Un resultat connecteur devrait pouvoir emettre un layout riche:

```ts
type ConnectorDynamicResult = {
  connectorId: string
  toolName: string
  query: string
  intent?: string
  primary: UIComponent | UILayout
  supplemental?: UIComponent[]
  actions?: ConnectorAction[]
  followups?: ConnectorFollowup[]
  renderHints?: {
    preferredLayout?: 'table' | 'cards' | 'bar' | 'line' | 'doughnut' | 'map' | 'metric'
    domain?: 'real_estate' | 'dpe' | 'pollution' | 'employment' | 'education' | 'health' | 'generic'
    confidence?: number
  }
}
```

Le coeur MCPUI n'a pas besoin de connaitre ce type dans un premier temps. Le sprint doit fournir des adapters d'exemple qui transforment ce contrat en `UILayout`, `ScratchpadState` et `ChatPromptConfig`.

A clarifier sur ce contrat:

- `intent` (intention utilisateur parsee) et `renderHints.domain` (categorie de donnees) se recouvrent — desambiguiser ou fusionner.
- `queryHash` (cf. Gap 2): hash de la query brute, de l'intent normalise, ou du tuple connecteur+tool+params? La definition conditionne la reutilisabilite du feedback (deux formulations proches partagent-elles un hash?).
- Aucun champ `schemaVersion`: ce contrat traverse 2 repos deployes independamment (MCPs emetteur, MCPUI consommateur). Sans discriminant de version, vieux MCPs + nouveau MCPUI cassent en silence. Ajouter `schemaVersion`.

### 2. Cas data.gouv.fr a couvrir

Le but n'est pas seulement de choisir entre documents locaux et connecteur. Une fois le connecteur choisi, il faut enrichir le rendu selon la thematique.

| Scenario | Rendu principal | Rendu complementaire | Actions/HITL possibles |
|---|---|---|---|
| `immobilier toulouse` | table prix/m2 ou mutations si API disponible | datasets data.gouv connexes, source cards DVF, metrics medianes | comparer avec une ville, filtrer ancien/neuf, afficher evolution, charger dataset connexe |
| `immobilier montpellier paris` | bar chart + table comparative | cartes datasets par ville, liens ressources | demander periode, ajouter 3e ville, basculer table/chart |
| `dpe montpellier` | table DPE + metrics classes A-G | doughnut par classe, map si geo disponible, datasets ADEME/data.gouv | choisir logement/periode, comparer quartier/ville |
| `pollution lyon` | line/bar chart selon serie temporelle | map stations, table mesures, source cards | choisir polluant, periode, seuil reglementaire |
| `emploi nantes` | metrics taux/volume + table | chart evolution, datasets INSEE/DARES | choisir secteur, age, periode |
| `education marseille` | table etablissements/indicateurs | map, metrics, datasets ministere | filtrer public/prive, niveau, comparer commune |
| `clinicaltrials cancer pancreas` | table essais | cards essais, metrics phases/statuts | filtrer phase, statut, pays, ouvrir essai |
| connecteur vide / partiel / en erreur | etat vide ou carte d'erreur explicite (jamais de disparition silencieuse du rendu) | suggestion de reformulation, datasets connexes si dispo | reessayer, elargir la recherche, basculer sur documents locaux |

Ces scenarios doivent etre des fixtures/examples MCPUI: ils servent a tester les renderers et a guider les prompts/connecteurs, sans hardcoder data.gouv.fr dans la librairie.

### 3. Macros semi-automatiques

Les macros YAML restent une excellente source de verite pour decrire des scenarios reproductibles:

- sequence de tools MCP;
- variables d'entree;
- conditions de branchement;
- questions HITL;
- rendu attendu;
- checks anti-regression.

Mais dans le chat reel, le runtime doit pouvoir gerer SSE, interruptions, erreurs, reprise, scratchpad et action callbacks. La bonne cible n'est donc pas "macros OU agent runtime", mais:

1. YAML macro = plan declaratif testable.
2. Runtime agent/chat = execution conversationnelle.
3. MCPUI = rendu de l'etat macro et des demandes HITL.

Le declenchement `/macros macro-test-1` dans le chat reste pertinent: il doit lancer le runtime avec un `macroId`, pas bypasser la couche chat/SSE.

## Adapters a construire

### A. `macroRunToScratchpadState()`

Convertit un run macro en `ScratchpadState`.

Mapping recommande:

| Etat macro | Section Scratchpad |
|---|---|
| macro metadata / agent actif | `agent_card` |
| etapes sequentielles | `stepper` ou `steps` |
| etapes paralleles | `split_stepper` |
| question utilisateur | `prompt` ou `form` |
| resultats de tool | `data_preview`, `chart`, `map`, `source_card` |
| erreur retryable | `error` + `action` retry |
| decision finale | `verified_text` ou `briefing_diff` selon le cas |

Pas besoin d'un `MacroRunCard` au depart: `agent_card` + `stepper` couvrent deja le besoin.

### B. `macroInterrogationToChatPromptConfig()`

Convertit une question macro/HITL en `ChatPromptConfig` ou `ElicitationEvent`.

Mapping recommande:

| Type macro souhaite | MCPUI actuel |
|---|---|
| choix simple | `ChatPrompt` type `choice` |
| confirmation | `ChatPrompt` type `confirm` |
| texte/date/nombre/select/multiselect | `ChatPrompt` type `form` |
| schema MCP officiel | `ElicitationForm` |
| choix avec confiance/source | `choice` + `metadata` + `optionRenderer` |

Point a clarifier dans le sprint: le host gere l'annulation, les timeouts et la re-entrance. MCPUI sait rendre le prompt, mais ne doit pas devenir gestionnaire global de lifecycle.

### C. `connectorResultToUILayout()`

Adapter generique qui convertit un resultat connecteur en `UILayout`.

Regles de base:

- donnees tabulaires -> `table`;
- comparaison categorical -> `chart` type `bar`;
- serie temporelle -> `chart` type `line`;
- distribution -> `chart` type `doughnut`;
- geographie -> `map`;
- liens/datasets -> `link`, `artifact`, `carousel` ou `grid` (`source_card` n'est PAS un type `UIResourceRenderer`, cf. Constats — ne pas l'emettre dans un `UILayout`);
- actions de suite -> `action-group`.

Ce composant doit accepter des `renderHints`, mais ne doit jamais sacrifier les donnees brutes: si un chart est affiche, garder une table exportable en complement.

### D. `connectorActionsToActionGroup()`

Convertit les actions proposes par un connecteur en `action-group`.

Exemples:

```json
{
  "type": "action-group",
  "params": {
    "title": "Continuer l'analyse",
    "actions": [
      {
        "label": "Comparer avec Paris",
        "action": "tool-call",
        "toolName": "datagouv.search",
        "params": { "query": "immobilier paris" }
      },
      {
        "label": "Lancer la macro DVF",
        "action": "tool-call",
        "toolName": "macros.run",
        "params": { "macroId": "opendata.dvf_city_compare", "city": "Toulouse" }
      }
    ]
  }
}
```

Le host fournit le `MCPActionProvider.executor`. MCPUI ne doit pas appeler directement le backend.

## Gaps MCPUI reels

### Gap 1 - Parite du streaming

`StreamingUIRenderer` valide les composants streamés mais utilise aujourd'hui un renderer inline simplifie: type, titre, metric basique. Il ne rend pas les tables/charts/maps avec la meme fidelite que `UIResourceRenderer`.

Verifie dans le code: le flux SSE livre des composants COMPLETS un par un (`UIComponent[]`), pas de rows/datasets partiels. La delegation `StreamingComponentRenderer -> UIResourceRenderer` est donc directe — pas besoin de bufferiser un composant incomplet. Seul reste a soigner: le swap skeleton -> composant reel ne doit pas changer la hauteur du conteneur (sinon cascade de reflow / scroll-reset, cf. bug "sidebar scroll reset" Deposium).

Action roadmap:

- remplacer `StreamingComponentRenderer` par une delegation a `UIResourceRenderer` pour chaque composant recu;
- conserver progress/skeleton/animation dans `StreamingUIRenderer`;
- partager `errorMode`, telemetry et validation avec le rendu statique;
- ajouter un test de parite: le meme `UIComponent` table/chart/map doit avoir le meme rendu fonctionnel en statique et en streaming.

### Gap 2 - Feedback de presentation plus riche

`FeedbackInline` est volontairement simple: thumbs up/down, non bloquant, persistence cote consumer. Pour les connecteurs, on a besoin de qualifier le probleme de presentation:

- `too_raw`
- `wrong_columns`
- `wrong_chart`
- `missing_dataset_context`
- `bad_grouping`
- `wrong_unit`
- `prefer_table`
- `prefer_chart`
- `prefer_map`

Action roadmap:

- ne pas remplacer `FeedbackInline`;
- ajouter un wrapper/example `PresentationFeedback` compose de `FeedbackInline` + `ChatPrompt`/`form` optionnel;
- standardiser le payload emis au host:

```ts
type ConnectorRenderFeedback = {
  connectorId: string
  toolName: string
  renderKind?: string
  layoutType?: string
  queryHash?: string
  feedbackValue: 'readable' | 'too_raw' | 'wrong_columns' | 'wrong_chart' | 'missing_context'
  preferredLayout?: 'table' | 'cards' | 'bar' | 'line' | 'doughnut' | 'map' | 'metric'
  missingFields?: string[]
  selectedColumns?: string[]
  wrongUnit?: string
  wrongGrouping?: string
  comment?: string
}
```

MCPUI expose l'evenement ou callback. Le host persiste dans sa table dediee.

### Gap 3 - Debug renderer selection

Le `AGENT-RENDERING-GUIDE.md` est tres utile, mais il manque un mode debug oriente integration connecteur.

Action roadmap:

- ajouter un exemple ou un helper affichant: `component.type`, renderer choisi, validation errors, fallback utilise, action callbacks attaches;
- exposer ces infos via telemetry ou debug overlay existant quand possible;
- documenter comment diagnostiquer: composant absent, params invalides, action non branchee, prompt jamais resolu.

### Gap 4 - Presets de domaine sans couplage metier

On veut aider data.gouv.fr, mais sans polluer MCPUI.

Action roadmap:

- creer des examples/fixtures `opendata-real-estate`, `opendata-dpe`, `opendata-pollution`, `opendata-employment`, `clinicaltrials`;
- fournir des `renderHints` et adapters demo;
- garder les vrais appels API hors MCPUI.

## Non-regressions attendues

1. Une table existante continue a trier/exporter/paginer apres passage par `connectorResultToUILayout()`.
2. Un chart comparatif entre deux villes conserve la table source en complement (repliee par defaut — ne pas doubler la hauteur du rendu dans une bulle de chat).
3. Une reponse streaming avec table/chart/map rend les vrais composants, pas une carte generique.
4. Un `action-group` declenche `MCPActionProvider.executor` avec `toolName`, `params`, `macroId` et `spaceIds` conserves.
5. Une question HITL schema MCP passe par `ElicitationForm` et renvoie un payload `accept` conforme.
6. Une question choix simple passe par `ChatPrompt` type `choice`, avec metadata conservee.
7. Le feedback de presentation est non bloquant: echec de persistence ne casse pas le rendu.
8. Les examples data.gouv.fr restent des fixtures: aucune dependance runtime dure a data.gouv.fr dans MCPUI.
9. Les composants `ScratchpadPanel`, `ChatPrompt`, `UIResourceRenderer` restent utilisables independamment.
10. Les tests couvrent au moins immobilier, DPE, pollution et clinicaltrials.
11. Un resultat connecteur vide, partiel ou en erreur rend un etat explicite (etat vide / carte d'erreur), jamais une disparition silencieuse du rendu.

## Plan de sprint propose

### Phase 0 - Documentation et fixtures

- Ajouter ce brief et des examples JSON de layouts OpenData.
- Ajouter une page courte: "Connector rendering cookbook".
- Documenter le mapping macro -> scratchpad -> prompt.

Livrable: examples sans changement fonctionnel majeur.

### Phase 1 - Adapters generiques

- Ajouter des helpers generiques si acceptables dans MCPUI:
  - `connectorResultToUILayout()`
  - `connectorActionsToActionGroup()`
  - `macroRunToScratchpadState()`
  - `macroInterrogationToChatPromptConfig()`
- Sinon les placer dans un package/example host pour ne pas charger le coeur.

Livrable: un connecteur peut emettre un resultat structure et obtenir table/chart/source/action sans logique UI custom.

### Phase 2 - Chat/HITL/macros

- Brancher `/macros <id>` sur le runtime chat avec `macroId`.
- Rendre l'etat dans `ScratchpadPanel`.
- Rendre les questions via `ChatPrompt` ou `ElicitationForm`.
- Declencher les outils via `MCPActionProvider`.

Livrable: une macro OpenData peut chercher, demander une precision, afficher une table/chart, puis proposer une action suivante.

### Phase 3 - Streaming parity

- Refactor `StreamingUIRenderer` pour deleguer le rendu de chaque composant a `UIResourceRenderer`.
- Garder progress/skeleton/metadata.
- Ajouter tests de parite.

Livrable: plus de regression visuelle entre reponse statique et SSE.

### Phase 4 - Feedback et observabilite

- Ajouter un wrapper de feedback de presentation.
- Standardiser le payload feedback.
- Relier callbacks/telemetry au host.
- Ajouter un debug mode pour comprendre pourquoi tel renderer a ete choisi.

Livrable: le HITL peut aussi corriger la mise en forme, pas seulement la qualite de reponse.

## Points a trancher pendant le `/goal`

1. Les adapters doivent-ils vivre dans MCPUI core, dans `examples`, ou dans Deposium Solid?
2. Est-ce que `StreamingUIRenderer` peut importer `UIResourceRenderer` sans cycle ni bundle cost excessif?
3. Faut-il creer un type `macro_run` dans `ScratchpadSection`, ou rester sur `agent_card` + `stepper`?
4. Le feedback de presentation doit-il etre un composant exporte ou un cookbook de composition?
5. Les macros YAML doivent-elles emettre directement `UILayout`, ou seulement un contrat metier transforme par le host?
6. Le feedback de presentation FERME-t-il la boucle (re-render immediat dans le layout choisi) ou se contente-t-il de logger pour ameliorer les prompts futurs? Le livrable Phase 4 dit "corriger la mise en forme" — si c'est seulement logger, reformuler le livrable (logger != corriger).
7. Precedence de `preferredLayout` (present a 3 endroits): figer la chaine heuristique `connectorResultToUILayout()` (plancher) < `renderHints.preferredLayout` (connecteur) < feedback utilisateur persiste.
8. Schema de feedback: l'enum prose de Gap 2 (9 valeurs) et le type `ConnectorRenderFeedback.feedbackValue` (5 valeurs differentes) divergent, et melent verdict (`readable`/`too_raw`) et probleme precis (`wrong_columns`). Choisir un enum canonique unique, ou separer `verdict` + `problem[]`. Et: `FeedbackInlineContext` est deja extensible (`[key: string]: unknown`, porte deja `intent`/`confidenceBand`/`tags`) — rouler dessus plutot que creer un type parallele?
9. i18n: aucune plomberie locale dans les renderers — les labels sont des strings brutes dans les payloads. Fork a trancher: les labels d'action sont fournis (localises) par le connecteur, qui doit alors recevoir la locale utilisateur? Ou MCPUI fournit des cles? Le cahier des charges co-membres impose EN/FR sur tout nouveau libelle.
10. Macro scratchpad vs prompt HITL: dans Deposium les panneaux ephemeres au-dessus du chat input (HITL `chat_prompt`, suggestion chips, scratchpad) sont mutuellement exclusifs via `chat-motion.ts`. Ou vit le scratchpad d'une macro pendant qu'elle pose une question HITL? Reste-t-il visible? A specifier sinon collision avec la regle d'exclusion existante.
11. `/macros <id>`: le parsing de la slash-command de chat input appartient a Deposium Solid (host, "decide quand afficher le chat"), pas a MCPUI. Confirmer et assigner le repo en Phase 2.

## Recommandation

Pour le sprint, commencer par un chemin minimal et robuste:

1. ne pas ajouter de nouveaux renderers metier;
2. creer des fixtures OpenData et macros;
3. ajouter les adapters generiques;
4. corriger la parite `StreamingUIRenderer` -> `UIResourceRenderer`;
5. brancher feedback de presentation via callbacks host.

Cela maximise la reutilisation de MCPUI existant et evite que data.gouv.fr devienne une dependance implicite du package.

---

## Reponses agent MCPUI - clarifications architecture (2026-05-21)

> Ajoute par l'agent MCPUI a la demande de l'equipe. Repond aux 3 points
> qui touchent l'architecture du repo `mcp-ui` lui-meme (pas seulement le
> brief produit). Verifications faites sur le code reel a la date ci-dessus
> (`mcp-ui-solid@6.5.0`). Les arbitrages encore ouverts sont marques
> **DECISION REQUISE** avec une valeur par defaut si pas de reponse.

### Q1 (point 6) - Boucle de feedback : re-render ou log seul ?

**Verifie dans le code** (`src/components/FeedbackInline.tsx`) :
`FeedbackInline` est un callback fire-and-forget pur. Il capture la note,
appelle `onSubmit(rating, context)`, bascule en etat "submitted" optimiste.
Aucune capacite de re-render, il ne touche jamais au layout.

**Reponse** :

- Le **mecanisme** de re-render existe deja : les renderers MCPUI sont des
  fonctions pures de leurs props. Si `content` (ou un prop derive de
  `renderHints`) change, Solid re-rend reactivement. Aucune plomberie
  nouvelle necessaire pour "re-render".
- Ce qui manque n'est pas le rendu, c'est le **proprietaire de l'etat**
  "l'utilisateur a choisi `prefer_map` pour ce layout". Cet etat n'existe
  pas dans MCPUI aujourd'hui et n'y a pas sa place.
- **Recommandation** : MCPUI fournit la capacite (reactivite, deja la) mais
  ne possede pas l'etat de feedback. Boucle cible :
  `feedback control -> evenement -> HOST mappe vers nouveau preferredLayout
  -> host re-execute connectorResultToUILayout() -> nouveau content descend
  -> UIResourceRenderer re-rend`. MCPUI reste stateless, coherent avec
  "librairie de rendu, pas orchestrateur".
- **Consequence Phase 4** : le livrable MCPUI se limite a
  (a) payload/evenement de feedback enrichi ;
  (b) garantir que `connectorResultToUILayout()` est PUR (re-execution
  cheap, sans effet de bord) ;
  (c) optionnel : un exemple `<PresentationFeedback>` montrant le cablage.
  La correction de mise en forme se produit **cote host** (re-execution de
  l'adapter), pas par mutation interne MCPUI. **Reformuler le livrable
  Phase 4** : "permettre au host de corriger la mise en forme", pas
  "MCPUI corrige".

**DECISION REQUISE** : voulez-vous que MCPUI livre EN PLUS un composant
controle stateful (ex. `<ConnectorResultRenderer>`) qui detient le signal
d'override en interne — DX plus simple cote host, mais met de l'etat
connecteur dans MCPUI ? Ou on reste sur adapter pur + etat cote host ?
_Defaut si pas de reponse : adapter pur + etat host (recommande)._

### Q2 (point 9) - i18n

**Verifie dans le code** : zero plomberie de locale dans les renderers.
Aucun prop `locale`, aucun catalogue de messages. Les labels de contenu
(titres, colonnes, labels d'action, questions de prompt) sont des strings
brutes passees dans les payloads — MCPUI les rend tels quels. MAIS MCPUI a
une poignee de strings "chrome" en dur, aujourd'hui un melange FR/EN
incoherent : `FeedbackInline` ("Merci !", "Note, on s'ameliore" — FR) ;
cartes d'erreur de validation + fallback `RenderContext` (EN) ; labels
toolbar `ExpandableWrapper` (Expand / Copy data / Download...).

**Reponse — la question se scinde en deux** :

1. **Labels de CONTENU (payload-driven)** : responsabilite du connecteur.
   Le connecteur recoit la locale utilisateur et emet des labels deja
   localises. => changement de signature cote **connecteur**, AUCUN
   changement cote MCPUI. MCPUI n'a besoin d'aucun prop `locale` pour le
   contenu payload-driven.
2. **Strings "chrome" internes a MCPUI** : seul i18n que MCPUI doit porter.
   Un layer i18n complet (catalogue + prop `locale` filtre dans chaque
   renderer) serait un changement transverse lourd touchant chaque
   signature de renderer — **a eviter**. Solution bornee : un
   `MCPUIStringsProvider` (context leger, sur le modele du telemetry
   context deja en place) portant une map de strings plate, defaut EN, que
   le host remplit en FR. Thread une seule fois, **aucun changement de
   signature de renderer**.

=> Le mandat EN/FR co-membres est respecte sans i18n framework : contenu =
connecteur localise ; chrome = `MCPUIStringsProvider`.

**DECISION REQUISE** :
(a) confirmez le split contenu/chrome ci-dessus ;
(b) le `MCPUIStringsProvider` est-il dans le scope de CE sprint, ou differe ?
Il est additif et non bloquant — peut venir apres. _Sans lui, les strings
chrome restent le melange FR/EN actuel._

### Q3 (Gap 1) - StreamingUIRenderer delegue a UIResourceRenderer

**Verifie dans le code** :

- **Pas de cycle.** `UIResourceRenderer.tsx` n'importe PAS
  `StreamingUIRenderer` (grep = 0 match). L'arete est strictement
  unidirectionnelle.
- `StreamingUIRenderer` importe deja `type { ValidationErrorMode }` depuis
  `./UIResourceRenderer` — import type-only, efface a la compilation.
- Confirme : le flux SSE livre des `UIComponent` COMPLETS un par un
  (`StreamingComponentRenderer` lignes 165-198 est bien un renderer
  simplifie "type + titre + metric basique"). La delegation est triviale
  au niveau logique.
- Le repo a DEJA le pattern exact pour ce besoin : `RenderContext` /
  `RenderProvider` / `useRenderContext` (`src/components/RenderContext.tsx`),
  construits pour casser le cycle `UIResourceRenderer <-> Carousel/Grid`.

=> Le cycle d'import **n'est pas un risque**. Le vrai arbitrage est le
**bundle cost** :

- **Approche A — import valeur direct** `import { UIResourceRenderer }` :
  simple. Mais `UIResourceRenderer.tsx` (~1850 lignes) importe
  statiquement TOUS les renderers (Table, Chart wrapper, Map, Graph, Code,
  Carousel, Gallery, Video, Form, Modal, ActionGroup, Footer, Artifact,
  Grid). Les peer-deps lourdes (chart.js, @antv/g6, leaflet) sont en
  `import()` dynamique => elles ne comptent PAS. Mais la logique de
  dispatch + DOMPurify + marked + les renderers legers sont statiques. Le
  `size-limit` a un budget "Streaming renderer" de **30 KB** qui sautera
  presque surement. Approche A => relever ce budget (estime ~80-120 KB).
- **Approche B — injection via `RenderContext`** : `StreamingUIRenderer`
  consomme `useRenderContext()`, le host l'enveloppe dans un
  `RenderProvider`. Bundle streaming reste mince (zero import statique du
  set de renderers). Inconvenient : `StreamingUIRenderer` ne rend les
  vrais composants QUE monte dans un `RenderProvider` ; en standalone il
  tombe sur le placeholder "cannot be rendered outside UIResourceRenderer".
- **Approche C — hybride** : prop optionnel `renderComponent`, defaut
  `RenderContext`, sinon `import()` paresseux de `UIResourceRenderer`.
  Plus flexible, plus de code.

**Recommandation** : Approche A + montee honnete du budget `size-limit`.
En pratique deposium rend le streaming DANS un chat qui utilise deja
`UIResourceRenderer` — le set de renderers est deja dans le bundle, le cout
marginal reel est quasi nul. Le budget 30 KB est une mesure d'isolation
synthetique, pas le cout reel chez le consommateur.

**DECISION REQUISE** : approuvez-vous Approche A (+ budget `size-limit`
releve, ex. 120 KB, documente au CHANGELOG) ? Si "streaming importable seul
en < 30 KB" est un vrai requirement produit, alors Approche B — mais il
faut accepter que `StreamingUIRenderer` standalone hors `RenderProvider`
ne rende plus rien d'utile. _Defaut si pas de reponse : Approche A._

### Questions transverses supplementaires (agent MCPUI)

Trois points qui touchent aussi l'architecture du repo et meritent une
reponse avant le `/goal` :

- **Q4 — `schemaVersion` obligatoire.** Le brief (§1) propose d'ajouter
  `schemaVersion` au contrat `ConnectorDynamicResult`. Recommandation :
  le rendre **obligatoire des le premier payload**, pas optionnel. Un champ
  de versionnement optionnel n'est jamais rempli par les vieux emetteurs —
  exactement le cas qu'il doit couvrir. Format propose : `schemaVersion: 1`
  (entier, incremente sur breaking change).
- **Q5 — purete de `connectorResultToUILayout()`.** Pour que la boucle Q1
  fonctionne, cet adapter DOIT etre une fonction pure deterministe (memes
  entrees -> meme `UILayout`, zero acces reseau / horloge / random).
  Confirmez que c'est acceptable comme contrainte de design (sinon la
  re-execution sur feedback n'est pas sure).
- **Q6 — emplacement des adapters** (point 1 des "Points a trancher").
  Recommandation agent MCPUI : sous-chemin dedie
  (`@seed-ship/mcp-ui-solid/adapters`) ou package `examples/`, **PAS le
  core**. Raison : les adapters encodent des conventions de mapping
  (table/bar/line par domaine) qui evolueront plus vite que le core et ne
  doivent pas peser sur le bundle des consommateurs qui n'en veulent pas.
  Le core exporte les primitives ; les adapters sont une couche opt-in.

## Decisions apres clarification MCPUI

Cette section verrouille les arbitrages avant lancement du `/goal`. Les points ci-dessous priment sur les questions ouvertes precedentes quand ils les recouvrent.

### D1 - Boucle feedback de presentation

Decision: **adapter pur + etat host**.

MCPUI ne possede pas l'etat utilisateur du type "prefer_map", "prefer_table" ou "wrong_columns". MCPUI fournit la capacite d'interaction et le callback structure. Le host conserve l'etat, persiste le feedback, puis re-execute l'adapter avec les preferences applicables.

Implications:

- `FeedbackInline` reste fire-and-forget.
- Le re-render est declenche par changement de `content` cote host, pas par mutation interne MCPUI.
- `connectorResultToUILayout()` reste pur: memes entrees, meme sortie.
- Le livrable Phase 4 doit etre formule comme: "permettre au host de corriger la presentation", pas "MCPUI corrige la presentation".

Chaine de priorite des layouts:

1. default adapter;
2. `renderHints.preferredLayout` fourni par le connecteur;
3. feedback utilisateur persiste;
4. demande explicite dans le prompt courant.

### D2 - i18n

Decision: **split contenu metier / chrome MCPUI**.

- Les labels metier viennent du connecteur ou de l'adapter, dans la locale utilisateur transmise par le host.
- Les strings de chrome MCPUI passent par un provider leger, sans framework i18n lourd.

Livrable recommande:

```ts
type MCPUIStrings = {
  retry: string
  cancel: string
  confirm: string
  submit: string
  loading: string
  noData: string
  export: string
  validationError: string
  feedbackUseful: string
  feedbackNotUseful: string
}
```

MCPUI expose un `MCPUIStringsProvider` avec defaults. Les renderers lisent ce contexte pour leurs propres libelles uniquement. Les `title`, `columns`, `actions.label`, `source.name` restent fournis par les payloads.

### D3 - StreamingUIRenderer

Decision: **import direct de `UIResourceRenderer` + budget bundle releve**.

Le cycle d'import n'est pas le risque: `UIResourceRenderer` n'importe pas `StreamingUIRenderer`. Le vrai arbitrage est le budget. Pour Deposium, garder deux chemins de rendu est plus risque que relever le budget.

Implications:

- `StreamingComponentRenderer` delegue a `UIResourceRenderer`.
- Le budget size-limit du streaming doit etre ajuste apres mesure, avec une cible initiale realiste autour de `120 KB` au lieu de `30 KB`.
- Ajouter des tests de parite static/streaming sur `table`, `chart`, `map`, `action-group`.
- Conserver progress, skeleton, animation, metadata dans `StreamingUIRenderer`.
- Surveiller les reflows: le swap skeleton -> composant reel doit limiter les changements de hauteur.

### D4 - Versionnement du contrat

Decision: **`schemaVersion` obligatoire des le premier contrat partage**.

Les contrats traversent plusieurs repos deployes independamment. Sans version explicite, un vieux MCPs peut casser un nouveau MCPUI/Solid sans signal clair.

Recommandation:

```ts
type ConnectorDynamicResult = {
  schemaVersion: 'connector-dynamic-result/v1'
  connectorId: string
  toolName: string
  query: string
  // ...
}
```

Un adapter doit refuser ou fallback proprement sur une version inconnue.

### D5 - Purete des adapters

Decision: **adapters purs**.

Les adapters ne font pas de fetch, ne lisent pas le localStorage, ne persistent rien, et n'accedent pas a l'etat global. Ils transforment un contrat d'entree en `UILayout`, `ScratchpadState`, `ChatPromptConfig` ou `ActionGroup`.

Cela permet:

- tests unitaires simples;
- re-render deterministe apres feedback;
- replay de fixtures;
- debugging des regressions de presentation.

### D6 - Emplacement des adapters

Decision: **sous-chemin opt-in, pas core renderer path**.

Option recommandee:

- **fixtures** (JSON, payloads d'exemple) : pres des docs / dans `examples`.
- **adapters** (code + tests, cf. D5) : dans `mcp-ui-solid/adapters` ou
  `examples`, **jamais `docs/briefs`** (du code teste ne vit pas dans un
  dossier de docs — corrige A3).
- Export opt-in type `@seed-ship/mcp-ui-solid/adapters` une fois stabilises.
- Ne pas importer les adapters depuis le chemin principal de `UIResourceRenderer`.

### D7 - Source de verite du contrat connecteur

Decision par defaut: **le contrat metier vit hors MCPUI core**.

MCPUI peut fournir des types d'aide et des adapters, mais la source de verite de `ConnectorDynamicResult` doit rester cote host/MCPs ou package partage. MCPUI ne doit pas devenir proprietaire des semantics data.gouv.fr, clinicaltrials, DVF, DPE, etc.

### D8 - Mode degrade obligatoire

Decision: **jamais de prose seule quand des donnees structurees existent**.

Fallback minimal d'un connecteur:

1. table exportable si lignes structurees;
2. cards/liens sources si datasets uniquement;
3. etat vide explicite si aucun resultat;
4. `action-group` avec au moins reessayer / elargir / reformuler quand applicable.

### D9 - Schema canonique de feedback

Decision: separer verdict, problemes et preference.

```ts
type ConnectorRenderFeedback = {
  connectorId: string
  toolName: string
  queryHash?: string
  renderKind?: string
  layoutType?: string
  verdict: 'readable' | 'not_readable'
  problems?: Array<
    | 'too_raw'
    | 'wrong_columns'
    | 'wrong_chart'
    | 'missing_context'
    | 'wrong_unit'
    | 'bad_grouping'
    | 'missing_dataset_context'
  >
  preferredLayout?: 'table' | 'cards' | 'bar' | 'line' | 'doughnut' | 'map' | 'metric'
  missingFields?: string[]
  selectedColumns?: string[]
  wrongUnit?: string
  wrongGrouping?: string
  comment?: string
}
```

`FeedbackInlineContext` etant deja extensible, MCPUI peut passer ce payload via `context` au lieu d'imposer un composant stateful.

### D10 - Slash commands et runtime macro

Decision: **`/macros <id>` appartient au host chat, pas a MCPUI**.

MCPUI rend l'etat macro et les questions, mais le parsing de la slash-command, le lancement du runtime, le SSE, la persistence et les retries appartiennent a Deposium Solid / runtime macro.

MCPUI recoit ensuite:

- un `ScratchpadState` ou `ScratchpadEvent`;
- des `UIComponent` / `UILayout`;
- des `ChatPromptConfig` ou `ElicitationEvent`;
- des `action-group` branchees sur `MCPActionProvider`.

## Ajustements post-D10

Revue de D1-D10 par l'equipe Solid. D1-D10 est coherent ; les points
ci-dessous corrigent un trou, deux incoherences et trois precisions a
trancher avant le `/goal`.

### A1 - `queryHash` non defini mais devenu porteur (trou bloquant)

D1 (chaine de priorite, etape 3 "feedback utilisateur persiste") et D9
(`queryHash?` optionnel) supposent tous deux une cle stable pour stocker
et retrouver le feedback de presentation. La definition de `queryHash`
n'a jamais ete tranchee. Sans cle definie, **D1 etape 3 n'est pas
implementable**.

Decision a prendre: `queryHash = hash(connectorId + toolName + intent
normalise)` — surtout PAS la query brute (deux formulations proches
doivent partager la cle). Le rendre **requis** des qu'un feedback est
persiste (optionnel sinon).

### A2 - D9 recouple les deux axes de feedback (incoherence avec §Objectif)

L'objectif (point "feedback de presentation, separe du feedback de
qualite de reponse") pose deux axes distincts. D9 dit "MCPUI peut passer
ce payload via `context`" — or `FeedbackInlineContext` est le contexte du
widget de **qualite**. Faire transiter la presentation dans ce contexte
recouple les deux axes.

A clarifier: un seul widget a deux sections, ou deux widgets distincts ?
Si le transport reste partage, ecrire explicitement que la presentation
est une section/un controle distinct — "separe" ne doit pas se reduire a
"des champs differents dans le meme payload".

### A3 - D6 place du code dans un dossier de docs (incoherence avec D5)

D6 propose "fixtures et adapters dans `examples` ou `docs/briefs`". Mais
D5 impose des adapters **purs et testes unitairement**: du code avec
tests ne vit pas dans `docs/briefs`. Separer:

- **fixtures** (JSON, payloads d'exemple): peuvent vivre pres des docs;
- **adapters** (code + tests): `examples/` ou `src/adapters/`, jamais
  `docs/briefs`.

### A4 - D7 encore "decision par defaut" alors qu'il verrouille D4/D5/D9

D4 (schemaVersion), D5 (purete) et D9 (schema feedback) referencent tous
la forme et le versioning du contrat ; le proprietaire du contrat possede
les bumps de version. D7 doit etre **durci avant le `/goal`**.

Recommandation: un **package partage** (pas "MCPs-owned"), pour que
l'emetteur MCPs et les adapters MCPUI importent le meme type
`schemaVersion`'d sans dependance repo-a-repo.

### A5 - D4 a change la reco Q4 sans le signaler

Q4 proposait `schemaVersion: 1` (entier) ; D4 a pose
`'connector-dynamic-result/v1'` (string namespacee). Le choix string est
meilleur (auto-descriptif) — mais a signaler explicitement pour que
l'agent MCPs (emetteur) code la forme string. Preciser aussi le
comportement sur version inconnue: D4 dit "refuser OU fallback" — trancher.

### A6 - Point 10 (collision scratchpad macro / prompt HITL) disparu

La collision scratchpad de macro contre prompt HITL — panneaux ephemeres
mutuellement exclusifs au-dessus du chat input via `chat-motion.ts` cote
Deposium — n'est traitee par aucun D. C'est une affaire host legitime,
mais a **acter comme explicitement deferee au sprint Deposium**, pas a
laisser s'evaporer.

### Mineurs

- `intent` et `renderHints.domain` sont toujours en doublon dans le
  contrat §1 — desambiguiser ou fusionner.
- Le `MCPUIStrings` de D2 omet `expand` / `copyData` / `download`, pourtant
  listes dans l'audit Q2. Marquer le type "non exhaustif, a completer par
  un audit des strings en dur".
- La plomberie de locale host -> MCPs -> connecteur (D2, labels de
  contenu) n'est portee par aucun repo identifie — flaguer comme action
  cross-repo.

## Resolution A2 / A4 / A5 + i18n (2026-05-21)

Cette section verrouille les 3 points encore ouverts apres A1-A6, sur
arbitrage commun equipes MCPUI + MCPs + Solid. Elle prime sur D4, D7 et D9
quand elle les recouvre. Apres cette section, **aucun blocage ne subsiste
pour le `/goal`** : Phase 3 ET Phase 4 sont entierement specifiees.

### R1 - Home du contrat (resout A4 / durcit D7)

Le contrat `ConnectorDynamicResult` vit dans **`mcp-ui-spec`**, pas dans
`mcp-ui-solid` core. C'est un contrat JSON inter-repos, pas un type de
renderer Solid.

Repartition:

- **`mcp-ui-spec`** : type + schema canonique `ConnectorDynamicResultV1`
  (porte `schemaVersion`, cf. R2).
- **`mcp-ui-solid/adapters`** : importe ce type, fournit
  `connectorResultToUILayout()` et les autres adapters (purs, cf. D5).
- **MCPs** : emet du JSON conforme au schema.
- **Solid (host)** : orchestre et persiste, ne redefinit jamais le contrat.

Type canonique consolide (integre `schemaVersion` de R2 + `queryHash` de A1) :

```ts
type ConnectorDynamicResultV1 = {
  schemaVersion: 'connector-dynamic-result/v1'
  connectorId: string
  toolName: string
  query: string
  // Cle stable pour stocker / retrouver le feedback de presentation
  // (cf. D1 chaine de priorite, D9 ConnectorRenderFeedback). Requis
  // UNIQUEMENT des qu'un feedback est persiste, optionnel sinon.
  // Calcul recommande : hash(connectorId + toolName + normalizedIntent)
  // — surtout PAS la query brute, pour que deux formulations proches
  // partagent la meme cle (cf. A1).
  queryHash?: string
  intent?: string
  primary: UIComponent | UILayout
  supplemental?: UIComponent[]
  actions?: ConnectorAction[]
  followups?: ConnectorFollowup[]
  renderHints?: {
    preferredLayout?: 'table' | 'cards' | 'bar' | 'line' | 'doughnut' | 'map' | 'metric'
    domain?: 'real_estate' | 'dpe' | 'pollution' | 'employment' | 'education' | 'health' | 'generic'
    confidence?: number
  }
}
```

Ce bloc est la **forme finale** du contrat — il prime sur le type
`ConnectorDynamicResult` esquisse en §1 (historique).

Demarrage: si `mcp-ui-spec` n'est pas encore consommable par MCPs, MCPUI
peut coder immediatement en posant le contrat dans `mcp-ui-spec` + une
fixture JSON ; l'integration MCPs suit. La creation/verification de
`mcp-ui-spec` est un prerequis explicite — le contrat n'a pas de domicile
sinon.

### R2 - `schemaVersion` inconnu (resout A5 / corrige D4)

Une `schemaVersion` inconnue **ne doit jamais throw dans le chemin de
rendu runtime**. Comportement requis:

- version connue -> adapter normal ;
- version inconnue mais donnees exploitables -> etat degrade explicite
  (table / source cards si possible) + warning discret ;
- version inconnue inexploitable -> empty/error state explicite (cf. D8) ;
- en dev/test -> warning/telemetry fort ;
- jamais de disparition silencieuse.

Le `throw` reste acceptable uniquement dans des helpers stricts de test,
pas sur le chemin runtime. D4 est amende en ce sens.

### R3 - Feedback de presentation : deux widgets distincts (resout A2)

Decision: **deux composants distincts**, pas une extension de
`FeedbackInline`.

- `FeedbackInline` = qualite de la reponse / du message. Inchange.
- `PresentationFeedback` = qualite du rendu / layout. **Nouveau composant
  opt-in**, export distinct.

`PresentationFeedback` peut reutiliser des primitives MCPUI
(`FeedbackInline`, `ChatPrompt`/`form`, telemetry) en interne, mais reste
un composant/export separe — sinon les deux axes se recollent dans l'UX et
dans les logs. Specs:

- callback payload = `ConnectorRenderFeedback` (schema fige en D9) ;
- persistence cote host ;
- re-render cote host (cf. D1 : adapter pur + etat host).

=> `PresentationFeedback` est des lors **entierement specifie** (nom +
payload) : Phase 4 est codable en totalite, pas a moitie.

### R4 - i18n : defauts EN (confirme le micro-point D2)

`MCPUIStringsProvider` porte des **defauts EN**. Retro-compat:

- les props existantes (`positiveAck`, `negativeAck`, labels fournis)
  **priment** toujours ;
- a defaut de provider, les strings chrome basculent FR -> EN (les defauts
  FR en dur actuels de `FeedbackInline` partent dans la map FR du
  provider).

Une lib publiee evite les defauts FR en dur. Deposium passe un
`MCPUIStringsProvider` FR pour son UI.

### Feu vert d'execution

Debloque immediatement, 100 % interne MCPUI:

- **D3** — parite `StreamingUIRenderer` -> `UIResourceRenderer` (Phase 3) ;
- **D2** — `MCPUIStringsProvider` + audit des strings en dur ;
- squelette `mcp-ui-spec` + fixtures `ConnectorDynamicResultV1` ;
- **Phase 4 complete** — `PresentationFeedback` (nom + payload figes ici).

