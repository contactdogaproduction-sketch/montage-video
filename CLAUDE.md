# CLAUDE.md — Éditeur vidéo court format (inspiré de CapCut)

Application web de montage de vidéos courtes pour les réseaux sociaux (Reels, TikTok, Shorts).
**Interface entièrement en français.** Aucune fonctionnalité en dehors du périmètre ci-dessous.

## Stack imposée (ne pas changer sans accord explicite de l'utilisateur)
- Vite + React + TypeScript en mode `strict`
- Zustand pour l'état du projet, avec historique undo/redo
- Tailwind CSS pour le style
- Aperçu rendu sur `<canvas>` (composition des pistes en temps réel)
- FFmpeg.wasm pour l'export MP4 ; en-têtes COOP/COEP configurés dans Vite (dev et preview)
- Sous-titres : transcription locale dans le navigateur avec transformers.js (Whisper), aucun service payant
- IndexedDB pour la sauvegarde automatique des projets et des médias
- PWA installable sur téléphone
- 100 % côté navigateur : aucun serveur, aucun compte, aucun cloud
- Tests : Vitest

## Architecture
```
src/
  core/        modèle de données (Project, Track, Clip, Keyframe) et fonctions pures
  store/       store Zustand + undo/redo
  engine/      moteur de rendu canvas (aperçu) et moteur d'export FFmpeg
  features/    un dossier par fonctionnalité :
               import, timeline, cut, text, stickers, audio, transitions,
               keyframes, subtitles, speed, format, export
  ui/          composants d'interface partagés
  app/         assemblage : mise en page, aperçu, barre de lecture, raccourcis clavier
```
Règles d'architecture :
- `core/` : fonctions pures, sans React, sans DOM, sans Zustand. Entrée → sortie, aucun effet de bord.
- `store/` appelle `core/` ; les composants appellent le store, jamais `core/` pour modifier l'état.
- `engine/` lit l'état du projet et ne le modifie jamais.
- Chaque fonctionnalité est isolée dans `features/<nom>/` (composants, hooks, actions propres).
  Ajouter une fonctionnalité ne doit pas obliger à modifier les autres.
- Les fichiers médias (Blob/File) ne sont jamais dans l'historique undo/redo : le projet ne
  référence les médias que par identifiant.
- Unité de temps dans le modèle : millisecondes (nombres entiers).

## Périmètre fonctionnel (complet)
1. **Import** : vidéos, photos, fichiers audio depuis l'appareil.
2. **Timeline multi-pistes** : une piste vidéo principale, des pistes superposées
   (incrustation vidéo/image), des pistes texte, stickers et audio. Zoom de la timeline,
   curseur de lecture déplaçable, aimantation entre clips.
3. **Découpe** : split au curseur, trim début/fin, supprimer, dupliquer.
4. **Réorganisation** : glisser-déposer sur une piste et entre pistes.
5. **Transitions** entre deux clips : fondu, fondu au noir, glissement, zoom, flou. Durée réglable.
6. **Keyframes** sur tout élément (vidéo, image, texte, sticker) : position, échelle, rotation,
   opacité. Interpolation linéaire ou douce (ease-in-out).
7. **Texte** : position, taille, couleur, contour, début/fin, 3 polices maximum,
   animations d'entrée/sortie (apparition, glissement, zoom).
8. **Stickers** : bibliothèque d'emojis intégrée + import de PNG transparents.
   Position, taille, rotation, durée, animables par keyframes.
9. **Sous-titres automatiques** : transcription locale, découpage en segments courts,
   modifiables à la main, style Reels (gros, contour noir, centré bas).
10. **Audio** : plusieurs pistes, volume par piste et par clip vidéo, fondu d'entrée/sortie,
    découpe comme un clip.
11. **Vitesse** : 0,5x / 1x / 1,5x / 2x par clip.
12. **Format** : 9:16 (défaut), 1:1, 16:9, avec recadrage du clip dans le cadre.
13. **Aperçu temps réel** synchronisé avec la timeline.
14. **Export MP4** 1080p 30 fps, avec barre de progression et possibilité d'annuler.

**Exclus** : filtres de couleur, effets spéciaux, comptes, cloud, modèles, IA générative.

## Interface
- Thème clair : fond blanc ou gris très clair, beaucoup d'espace, **une seule couleur d'accent**
  pour les actions principales, icônes toujours accompagnées d'un libellé.
- Mobile d'abord, utilisable à une main : aperçu en haut, barre d'outils au milieu,
  timeline en bas. Doit aussi être confortable sur ordinateur.
- Les réglages avancés (keyframes, réglages fins) n'apparaissent que lorsqu'un élément est sélectionné.
- Undo/redo accessibles en permanence.
- Raccourcis clavier (ordinateur) : `Espace` = lecture/pause, `S` = couper, `Suppr` = supprimer,
  `Ctrl+Z` = annuler, `Ctrl+Maj+Z` = rétablir.

## Règles de travail
- Travail par étapes. À la fin de chaque étape :
  - `npm run dev` se lance sans erreur ;
  - `npm run build` passe (dont la vérification TypeScript stricte) ;
  - `npm test` (Vitest) passe ;
  - fournir la liste exacte des tests manuels à effectuer ;
  - **attendre la validation de l'utilisateur avant l'étape suivante**.
- Tests Vitest obligatoires pour la logique de `core/` (découpe, trim, keyframes, calcul des durées).
- Aucune fonctionnalité à moitié faite : pas de bouton inactif, pas de `TODO` dans le code livré.
- Si un choix technique bloque : l'expliquer en deux lignes et proposer une solution.
  Ne jamais contourner en silence.
- Un commit git à la fin de chaque étape **validée** par l'utilisateur.

## Étapes
0. CLAUDE.md + plan détaillé de l'étape 1 (aucun code applicatif).
1. Socle : projet, modèle de données, store + undo/redo, import, timeline une piste,
   split/trim/suppression, aperçu canvas, export MP4.
2. Multi-pistes, glisser-déposer entre pistes, texte, stickers, audio multi-pistes.
3. Transitions et keyframes.
4. Sous-titres automatiques, vitesse, formats, PWA, sauvegarde automatique.
5. Finitions : performance sur téléphone, accessibilité, nettoyage.

## Commandes
- `npm run dev` : serveur de développement (en-têtes COOP/COEP actifs)
- `npm run dev:phone` : idem, accessible depuis un téléphone du même réseau (adresse « Network » affichée)
- `npm run build` : vérification TypeScript (app + config Vite) puis build de production
- `npm test` : tests Vitest
- `npm run preview` : sert le build (en-têtes COOP/COEP actifs)

## Choix techniques retenus
- **Undo/redo** : historique maison dans `store/` (pile passé/futur de snapshots immuables du
  `Project`), sans dépendance supplémentaire. Les actions continues (glisser, trim à la souris)
  sont regroupées en une seule entrée d'historique.
- **Export** : rendu image par image avec le même moteur canvas que l'aperçu, encodage
  H.264 par FFmpeg.wasm **par segments courts** (mémoire bornée sur téléphone), puis
  concaténation et multiplexage avec la piste audio mixée via `OfflineAudioContext`.
- **Fichiers de FFmpeg.wasm** (core + wasm) servis localement depuis le projet, pas depuis un
  CDN (compatibilité COEP et fonctionnement hors ligne de la PWA).
- **Médias** en étape 1 : conservés en mémoire (object URLs) ; persistance IndexedDB en étape 4.
  L'import audio arrive à l'étape 2 avec les pistes audio (pas de média importé inutilisable).
- **Piste principale** : clips toujours accolés depuis 0 (`normalizeTrack`) ; un trim décale la suite.
- **Aperçu** : un `<video>` par média (porte aussi le son), la vidéo active sert d'horloge maître
  pendant la lecture ; dessin via `engine/render.ts`, partagé avec l'export.
- **Export** : FFmpeg.wasm *mono-thread* (`@ffmpeg/core`), x264 `superfast` CRF 20, segments de
  90 images, AAC 192 kb/s. Images encodées en JPEG via `toDataURL` (synchrone) : `toBlob` /
  `convertToBlob` sont différés jusqu'à 1–3 s par image dans certains navigateurs.
- **Vite `server.fs.allow`** inclut le chemin réel du projet (`realpathSync.native`) : sans cela, un
  dossier virtualisé ou lié empêche de servir le worker de FFmpeg (erreur 403).
