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
  app/         assemblage : mise en page, aperçu, barre d'outils, panneau de réglages, raccourcis
               (features/ contient aussi overlay/ pour l'incrustation et transform/ pour la
               manipulation directe dans l'aperçu)
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

Ajouts demandés par l'utilisateur (20/10/2026), hors cahier des charges initial :
15. **Voix off** : enregistrer sa voix au micro pendant la lecture (doublage), ajoutée sur une piste audio.
16. **Figer l'image** d'une vidéo de la piste principale (image fixe insérée au curseur).
17. **Aimant de la piste principale** activable/désactivable (espaces libres entre les rushs).
18. **Sous-titres : qualité au choix** « Rapide » (whisper-base) ou « Précis » (whisper-small).
19. **Filtres de couleur** par clip vidéo ou photo : N&B, Sépia, Pop, Film délavé (vignette et grain),
    intensité réglable.
20. **Transitions à la mode** : flash blanc, balayage flou (whip pan), détourage + balayage (la personne
    reste devant pendant que le décor défile vers le clip suivant).
21. **Supprimer l'arrière-plan** d'une vidéo ou d'une photo (détourage des personnes, sur l'appareil).
22. **Logo de l'utilisateur** : icône de l'app (fond couleur d'accent), écran d'ouverture, aperçu vide,
    motif de fond discret (logo + chevrons) derrière l'aperçu et « Mes projets », filigrane des vidéos
    (coin au choix, désactivable). Pas de logo dans la barre du haut (choix de l'utilisateur : trop chargé).

**Exclus** : effets spéciaux (hors filtres, transitions et détourage ci-dessus), comptes, cloud, modèles, IA générative.

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
- **Export** : rendu image par image avec le même moteur canvas que l'aperçu. Encodage par
  l'appareil (WebCodecs via `mediabunny` : `CanvasSource` H.264 12 Mb/s, son AAC 192 kb/s par
  `AudioBufferSource` si l'appareil sait l'encoder, sinon ajouté par FFmpeg) ; à défaut d'encodeur
  vidéo, FFmpeg.wasm **par segments courts** (images JPEG, mémoire bornée). Images des vidéos
  décodées dans l'ordre par `CanvasSink.canvasesAtTimestamps` (une file par clip, réduites à la
  taille de l'export) au lieu de repositionner un lecteur à chaque image ; lecteur repositionné
  seulement si le navigateur ne sait pas décoder la vidéo. Son d'une vidéo : seule la piste son est
  recopiée dans un petit M4A avant décodage (`extractAudio`) — décoder le fichier entier échouait
  sur iPhone (export muet) ; un son illisible est signalé à la fin de l'export. Replis automatiques,
  du plus rapide au plus sûr : appareil (vidéo + son AAC), appareil (vidéo) + son par FFmpeg, tout FFmpeg ;
  une vidéo qui ne se décode pas image par image passe au lecteur repositionné. Si tout échoue, le
  message d'erreur donne la raison de chaque méthode.
- **Fichiers de FFmpeg.wasm** (core + wasm) servis localement depuis le projet, pas depuis un
  CDN (compatibilité COEP et fonctionnement hors ligne de la PWA).
- **Médias** : en mémoire (object URLs, `store/mediaRegistry.ts`) et enregistrés sur l'appareil à l'import.
- **Sauvegarde** (`store/persistence.ts`, IndexedDB « montage-video » : `projects`, `media` indexé par
  projet) pilotée par `features/projects/session.ts` : projet enregistré 800 ms après chaque
  modification et quand l'app passe en arrière-plan ; le dernier projet se rouvre au lancement ;
  `core/migrate.ts` complète les projets enregistrés par une version plus ancienne (à tenir à jour
  à chaque nouveau champ du modèle). Fichiers non référencés supprimés à l'ouverture d'un projet.
  `navigator.storage.persist()` demandé au démarrage.
- **Pistes** (`Project.tracks`, de la plus basse à la plus haute) : `main` (clips accolés depuis 0,
  un trim décale la suite), puis pistes libres `overlay`, `text`, `sticker`, `audio` (clips placés
  librement, sans chevauchement). Une piste libre vide est supprimée. Déposer sur une place prise
  crée une nouvelle piste au-dessus (`moveClip`, `placeClip`).
- **Clips** : union `MediaClip | TextClip | StickerClip`. Tout élément visuel a un `Transform`
  (centre x/y en fraction du cadre, échelle, rotation en degrés, opacité), base des keyframes (étape 3).
- **Keyframes** (`core/keyframes.ts`) : liste triée sur chaque clip, instants relatifs au début du
  clip, interpolation linéaire ou douce vers la suivante. Avec des keyframes, toute modification du
  placement au curseur modifie ou crée la keyframe du curseur (`setTransformAt`). Couper ajoute une
  keyframe de chaque côté de la coupe ; un trim garde les keyframes en place sur la timeline.
- **Transitions** (`core/transition.ts`) : portées par le clip principal qui sort ; les deux clips se
  chevauchent de la durée (max. moitié du plus court, 2 s). `core/composition.ts` calcule les couches
  visibles et les médias audibles (fondu croisé du son). Deux lecteurs par vidéo (« slot ») pour
  une transition entre deux morceaux d'une même vidéo. Flou par réduction/agrandissement
  (`ctx.filter` absent de Safari iPhone).
- **Filtres** (`MediaClip.filter`, `core/filters.ts`) : chaque filtre est une liste d'opérations par modes de
  fusion (`saturation`, `color`, `soft-light`, `lighten`, vignette, grain) appliquées par `engine/render.ts`
  sur un canvas à part, à la résolution de l'écran ou de l'export (`ctx.filter` absent de Safari iPhone).
  Grain pseudo-aléatoire fixe, décalé à chaque image : identique dans l'aperçu et à l'export.
- **Flash blanc et balayage flou** : `LayerEffect.flash` (voile blanc sur tout le cadre, maximal au milieu,
  où l'on passe au clip suivant) et `LayerEffect.motionBlur` (8 copies décalées et moyennées, mouvement
  en `easeInOutCubic`).
- **Détourage** (`MediaClip.removeBackground`, transition `cutout`, `engine/segmentation.ts`) : MediaPipe
  `@mediapipe/tasks-vision` (Apache 2.0), modèle « selfie segmenter » float16 (250 Ko,
  `src/assets/models/`, téléchargé depuis Google), processeur seulement, dans `segmentation.worker.ts`
  (variante `vision_wasm_module_internal` pour un worker module). Image réduite à 256 px avant l'envoi,
  masque adouci (seuil 0,3–0,7) puis agrandi. Aperçu : `LiveMasks` utilise le dernier masque reçu pendant
  que le suivant se calcule (~40 ms) ; export : masque exact calculé avant chaque image (`FrameSource`).
  Tout est pré-mis en cache (hors ligne). Couche `cutout` non dessinée tant que le masque manque.
- **Filigrane** (`Project.watermark` : coin ou `null`, `core/watermark.ts`) : logo à 14 % du petit côté du cadre,
  marge 5 %, opacité 85 %, dessiné par `drawFrame` au-dessus de tout (aperçu et export identiques).
  En haut à gauche par défaut (hors des boutons et légendes de TikTok et Reels). Réglé dans la
  fenêtre d'export (`features/watermark/`). Absent tant que le projet est vide.
- **Motif de fond** (`app/brandPattern.ts`) : tuile de 240 px calculée au démarrage à partir du logo (logo
  à 20 % d'opacité en quinconce avec des doubles chevrons couleur d'accent à 18 %), variable CSS
  `--brand-pattern`, classe `.bg-brand-pattern` sur le fond de toute l'app, la timeline et « Mes projets »
  (sur téléphone, l'aperçu cache presque toute sa zone). Cartes posées dessus à fond blanc.
- **Version affichée** en bas de « Mes projets » (`__APP_VERSION__` : date de build, heure de Paris, et
  commit publié) pour savoir si une mise à jour est bien arrivée sur l'appareil.
- **Vitesse** (`MediaClip.speed`, 0,5/1/1,5/2) : `sourceTimeAt = inPoint + (t - start) × vitesse` ;
  changer la vitesse garde le passage de la source et adapte la durée (`setClipSpeed`,
  `changeClipSpeed` qui déplace le clip si une piste libre déborde). Aperçu : `playbackRate`
  (hauteur conservée par le navigateur). Export : son passé par `atempo` de FFmpeg (`stretchAudio`).
- **Format** (`Project.format` 9:16 / 1:1 / 16:9, `FORMATS`) : dimensions 1080p déduites du format ;
  positions relatives au cadre. Cadrage par clip `fit` : `contain` (Ajuster) ou `cover` (Remplir).
- **Sous-titres** (`features/subtitles/`) : son du projet mixé (`mixProjectAudio`) puis rééchantillonné
  en mono 16 kHz, transcrit dans `whisper.worker.ts` par transformers.js avec
  WebAssembly, au choix « Rapide » = `onnx-community/whisper-base` encodeur fp32 + décodeur q8
  (136 Mo ; l'encodeur q8 dégradait fortement le français) ou « Précis » = `whisper-small` q8
  (250 Mo), téléchargés depuis Hugging Face au premier usage puis gardés dans « transformers-cache ».
  Les variantes WebGPU pèsent > 200 Mo pour la seule base : écartées pour le téléphone. Passages
  inventés par Whisper (crédits de sous-titrage, répétitions) filtrés dans `core/subtitles.ts`. Le moteur ONNX Runtime (`ort-wasm-simd-threaded`) est servi
  par l'app (pas de CDN), exclu du pré-cache PWA. Découpage en segments courts (≤ 5 mots, ≤ 2,5 s,
  coupure aux fins de phrase et virgules) dans `core/subtitles.ts` ; sous-titres = `TextClip` avec
  `subtitle: true` sur une piste texte dédiée, remplacés à chaque régénération.
- **Fluidité de lecture** : pendant la lecture, le temps est diffusé à chaque image par
  `store/playbackClock.ts` (curseur de la timeline et compteur mis à jour directement dans le DOM) ;
  le store ne reçoit le temps qu'à l'arrêt (rien n'est recalculé par React pendant la lecture).
  Canvas de l'aperçu limité à une densité de 2 ; éléments vidéo/audio attachés à la page dans un
  conteneur invisible (Safari iPhone décode mal les vidéos hors de la page) ; les vidéos secondaires
  rattrapent leur écart en douceur (vitesse ±8 % dès 80 ms d'écart, `core/sync.ts`) ; repositionnement
  seulement au-delà de 1 s d'écart, au plus une fois toutes les 1,5 s par lecteur. Pendant la lecture,
  l'aperçu est redessiné à chaque nouvelle image de la vidéo maître (`requestVideoFrameCallback`), sinon
  à 30 images/s ; tous les lecteurs du projet sont créés à l'arrêt (`mediaPlayers`), jamais en lecture ; horloge rapprochée en douceur du média maître ; textes et emojis
  recopiés depuis un cache d'images (`SpriteCache`, aperçu seulement : l'export les dessine
  directement). Deux morceaux successifs d'une même vidéo alternent entre deux lecteurs
  (`clipSlot`) : le suivant est prêt avant la coupe.
- **Copies allégées pour l'aperçu** (`core/previewCopy.ts`, `features/previewCopy/`) : toute vidéo
  de plus de 1280 px (grand côté) ou de plus de 30 images/s est convertie en arrière-plan
  (`previewCopy.worker.ts`, bibliothèque `mediabunny` sur WebCodecs, matériel de l'appareil) en
  MP4 H.264 720p 30 images/s, une image clé toutes les 0,5 s, son recopié sans réencodage (pas de
  copie si le son serait perdu). Copie gardée dans `MediaSource.preview` et dans le champ
  `preview` du fichier enregistré (créée une seule fois). L'aperçu bascule sur la copie à l'arrêt
  de la lecture ; l'export, figer l'image et les sous-titres utilisent toujours l'original.
  Progression affichée à droite du bouton Lecture. Après un export réussi, les copies du projet sont
  supprimées (mémoire et appareil, conversions en cours abandonnées : `removeMediaPreviews`) et
  l'aperçu repasse sur les originaux ; elles sont recréées à la réouverture du projet. Sans WebCodecs (iOS < 16.4) : original, et
  message invitant à mettre à jour.
- **Modèle Whisper gardé chargé** : le worker reste ouvert entre deux transcriptions et le modèle se
  prépare dès l'ouverture de la fenêtre « Sous-titres » (`prepareTranscriber`, `useModelStore`).
  Sur iPhone en `http://` (réseau local), Safari n'a pas de Cache API : le modèle est retéléchargé à
  chaque session ; en `https://` (version en ligne), il est gardé.
- **Édition dans la piste** (`features/timeline/InlineTextEditor.tsx`) : 2ᵉ appui (ou double-clic)
  sur un texte sélectionné ; Entrée valide et passe au texte suivant de la piste, Échap annule.
- **Aimant** (`Track.magnetic`, piste principale) : `isFreeTrack` et `normalizeTrack` en dépendent ;
  sans aimant, la piste principale se comporte comme une piste libre (dépôt refusé s'il n'y a pas
  de place, pas de nouvelle piste principale) et les transitions ne s'appliquent qu'entre clips qui
  se chevauchent (`effectiveOverlap`) : leurs boutons sont masqués.
- **Figer l'image** (`core/freeze.ts`, `features/freeze/`) : image capturée en JPEG à la taille de la
  vidéo (`captureVideoFrame`), insérée au curseur (2 s) en coupant la vidéo ; la suite est décalée.
- **Voix off** (`features/voiceover/`) : MediaRecorder sur le micro, converti en WAV à l'arrêt,
  placé sur une piste audio à l'instant réel du début de l'enregistrement ; la lecture démarre dans
  le geste (Safari), son de l'aperçu coupé par défaut (`setPreviewMuted`). Session audio de l'iPhone en
  `play-and-record` pendant l'enregistrement (`engine/audioSession.ts`) : en `playback` (réglage de l'aperçu
  pour le mode silencieux), l'iPhone refuse ou coupe le micro. Enregistrement muet détecté et signalé. Micro disponible
  seulement en https ou localhost.
- **Installation et hors ligne** (`features/install/`, `features/subtitles/ModelDownloads.tsx`,
  section « Application » en bas de « Mes projets ») : bouton d'installation (`beforeinstallprompt`
  sur Chrome/Edge/Android, étapes « Sur l'écran d'accueil » sur iPhone), état hors ligne (service
  worker actif), téléchargement à l'avance des modèles de sous-titres (`isModelDownloaded` vérifie
  le cache « transformers-cache »). Le navigateur intégré de l'app Claude bloque le micro : tester la
  voix off dans Chrome, Edge ou Safari.
- **Glisser-déposer** : souris = glisser direct ; doigt = appui long (400 ms) pour ne pas gêner le
  défilement. Aimantation (10 px écran) sur bords des clips, curseur et 0.
- **Polices** : Montserrat 800, Bebas Neue, Pacifico via `@fontsource` (servies localement).
- **Audio** : volumes 0–200 % (piste × clip) et fondus ; aperçu via Web Audio API (un `GainNode`
  par élément média, contexte créé dans le geste de lecture), export via automation de gain
  dans `OfflineAudioContext`.
- **Aperçu** : un élément `<video>`/`<audio>` par média ; le premier média en cours sert d'horloge
  maître ; dessin via `engine/render.ts`, partagé avec l'export.
- **Interface** : la barre d'outils met les outils du clip sélectionné en tête ; les réglages
  s'ouvrent à la demande en feuille sur téléphone (« Réglages ») et à droite sur grand écran.
  Les curseurs et champs regroupent leurs modifications en une étape d'annulation (`ui/controls.tsx`).
- **Export FFmpeg (secours)** : FFmpeg.wasm *mono-thread* (`@ffmpeg/core`), chargé seulement s'il sert
  (pas d'encodeur de l'appareil, son à accélérer avec `atempo`, ou son AAC à ajouter), x264 `superfast`
  CRF 20, segments de 90 images, AAC 192 kb/s. Images encodées en JPEG via `toDataURL` (synchrone) : `toBlob` /
  `convertToBlob` sont différés jusqu'à 1–3 s par image dans certains navigateurs.
- **PWA** : `vite-plugin-pwa` (Workbox, `generateSW`), mise à jour proposée à l'utilisateur
  (`app/UpdatePrompt.tsx`), tout est pré-mis en cache (FFmpeg compris) pour fonctionner hors ligne.
  Icônes (`public/icon-*.png`, `apple-touch-icon.png`) tirées du logo de l'utilisateur (`src/assets/logo.png`,
  fond transparent) sur fond couleur d'accent #4f46e5 ; version « maskable » avec logo réduit (zone sûre).
- **Publication** : GitHub Pages via `.github/workflows/deploy.yml` à chaque envoi sur `main`
  (tests puis build avec `BASE_PATH=/nom-du-depot/`). GitHub Pages ne permet pas les en-têtes
  COOP/COEP : l'app n'en dépend pas (FFmpeg mono-thread, export vérifié sans isolation).
- **Dossier** : le projet vit dans « Doga prod », qui contient aussi des documents personnels
  (`facture/`) : ils sont exclus par `.gitignore` et ne doivent jamais être versionnés ni publiés.
- **Vite `server.fs.allow`** inclut le chemin réel du projet (`realpathSync.native`) : sans cela, un
  dossier virtualisé ou lié empêche de servir le worker de FFmpeg (erreur 403).
