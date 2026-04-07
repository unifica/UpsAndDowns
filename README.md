# Ups & Downs

An interactive digital magic trick that uses real-time AI to detect where you are looking and **secretly manipulate your pupil size** — running entirely in your browser, with no data ever leaving your device.

## What is it?

Ups & Downs is a browser-based Progressive Web App (PWA) that uses your device's camera and real-time AI to track your eye movements and pupil size. The app analyses where you are looking — up or down — and, crucially, **actively engineers changes in your pupil diameter** by manipulating the visual scene around you. Once the AI detects a reliable pupil-size difference it can "reveal" your chosen word, creating the illusion of mind-reading. The effect exploits well-documented physiological and psychological reflexes; the "magic" is really controlled neuroscience.  All processing happens locally in the browser; nothing is uploaded anywhere.

## Features

- **Gaze direction detection** — determines whether you are looking up or down and highlights the corresponding word on screen.
- **Pupil-size tracking** — measures and displays relative pupil diameter in real time, enabling subtle physiological cues to be read during the trick.
- **Real-time eye tracking** — uses MediaPipe FaceMesh (478 facial landmarks, including iris tracking) to detect and follow your eyes at video-frame rate.
- **AI-powered** — runs TensorFlow.js in the browser; no server-side processing required.
- **Visual overlay** — renders glowing eye-contour ellipses and iris-centre dots on a transparent canvas laid over the live camera feed.
- **Progressive Web App** — installable on desktop and mobile; works offline after the first load thanks to a service worker.
- **Privacy-first** — the camera feed is processed locally and never uploaded anywhere.

## Tech stack

| Library | Purpose |
|---|---|
| [TensorFlow.js](https://www.tensorflow.org/js) | In-browser machine-learning runtime |
| [MediaPipe Face Mesh](https://google.github.io/mediapipe/solutions/face_mesh) | 478-point facial landmark model with iris tracking |
| [@tensorflow-models/face-landmarks-detection](https://github.com/tensorflow/tfjs-models/tree/master/face-landmarks-detection) | High-level detector API |

## Getting started

Because the app loads models from a CDN and registers a service worker, it needs to be served over HTTP (not opened directly as a file).

1. Clone the repository:
   ```bash
   git clone https://github.com/unifica/UpsAndDowns.git
   cd UpsAndDowns
   ```

2. Serve the directory with any static HTTP server, for example:
   ```bash
   npx serve .
   ```

3. Open the printed URL in a Chromium-based browser (Chrome, Edge) for best WebGL performance. Firefox works too.

4. Click **Start**, allow camera access, and the AI model will begin tracking your eyes.

## Usage

1. Open the app and click **Start**.
2. Grant camera permission when prompted.
3. The app loads the AI model (a one-time download cached by the service worker) and begins tracking.
4. The overlay highlights your eye contours and irises in real time.
5. Click **Stop** to end the session and release the camera.

## Psychological background

The trick is grounded in several converging bodies of research on how the human pupil responds to light, cognitive state, and emotional arousal.

### 1 — The pupillary light reflex (PLR)

The pupil's most powerful driver is ambient luminance.  Bright light causes the iris sphincter muscle to contract (miosis/constriction); dim light releases that tone so the iris dilator muscle widens the aperture (mydriasis/dilation).  The reflex arc runs through the **Edinger–Westphal nucleus** of the midbrain and produces measurable changes within 200–300 ms of a luminance change, with full steady-state settling over roughly 1–3 seconds [1, 2].

### 2 — Intrinsically photosensitive retinal ganglion cells (ipRGCs) and the melanopsin pathway

Beyond the classical rod/cone pathway, a small subset of retinal ganglion cells (~1 % in humans) contain the photopigment **melanopsin** and are intrinsically sensitive to light, peaking around 480 nm (blue–cyan) [3].  These ipRGCs project directly to the olivary pretectal nucleus — the gateway of the PLR — and to the suprachiasmatic nucleus (circadian clock) [4].  Because ipRGC sensitivity peaks in the blue portion of the spectrum, **short-wavelength blue light drives stronger and more sustained pupil constriction** than equivalent-energy long-wavelength red/amber light [5].  Ups & Downs exploits this by colouring DOWN in cool blue and UP in warm amber.

### 3 — Cognitive and emotional pupil dilation (psychosensory reflex)

Pupils are not controlled solely by light.  They also dilate in response to:

- **Cognitive load** — Kahneman & Beatty's classic studies showed that pupil diameter increases monotonically with working-memory demand, even in constant illumination [6, 7].  The effect, now called the *task-evoked pupillary response* (TEPR), is mediated by central noradrenergic arousal signals from the locus coeruleus [8].
- **Emotional arousal** — Hess & Polt (1960, 1964) demonstrated dilation to emotionally engaging images and mental effort [9, 10].  Later work linked this to the autonomic sympathetic branch (norepinephrine-driven iris dilator) operating in parallel with parasympathetic withdrawal from the Edinger–Westphal nucleus.
- **Interest and attentional engagement** — sustained attention to a stimulus, whether pleasant or aversive, reliably widens the pupil relative to passive viewing [11].

While Ups & Downs primarily manipulates the PLR through luminance control, these cognitive effects add a secondary signal: concentrating on the chosen word and anticipating the reveal naturally introduces mild arousal-driven dilation, reinforcing the intended measurement direction.

### 4 — Orienting reflex and the dark-flash technique

When any novel or salient event occurs — including a sudden darkening of the visual field — the **orienting response** (OR) described by Sokolov produces an immediate, reflexive pupil dilation [12].  The app uses a brief luminance flash on each gaze-direction transition to exploit this reflex, rapidly shifting pupil size before the sustained overlay takes over.

### 5 — Why the effect is reliable enough to detect with a webcam

At normal reading distances, MediaPipe FaceMesh resolves the iris diameter to roughly ±1–2 pixels on a typical webcam frame.  Even a modest luminance change (~50 cd/m² delta on a standard monitor) produces a pupil-diameter change of ~0.5–1.0 mm [2], which corresponds to several pixels in the iris-landmark projection and is well above the noise floor of the tracker.  The four combined techniques (luminance overlay, background gradient, colour temperature, and transition flash) together produce a larger and faster pupil-size difference than any single technique alone, making detection robust enough to work under everyday webcam conditions.

## How the trick works — pupil-dilation techniques

The app actively manipulates the visual scene to **cause** the pupil to dilate when the user looks at UP and to constrict when they look at DOWN.  Once the AI detects a reliable difference in iris size, it can reveal the chosen word — the "mind reading" is really controlled physiology.

Four complementary techniques are applied simultaneously whenever the gaze direction is determined:

| # | Technique | Mechanism |
|---|---|---|
| 1 | **Screen luminance overlay** | A radial-gradient overlay dims the entire scene to near-black (UP) or floods it with a white spotlight (DOWN), directly driving the **pupillary light reflex**. |
| 2 | **Background luminance gradient** | The page background is a static top-to-bottom gradient — near-black at the top where UP lives, progressively lighter toward the bottom where DOWN lives.  This creates a passive, always-on luminance bias with no gaze signal required. |
| 3 | **Color temperature of the active word** | UP glows warm amber (#ffcc77 + orange halos); DOWN glows cool blue (#aaddff + blue halos).  Long-wavelength warm light is processed differently by the ipRGC melanopsin pathway, contributing to a relatively lower constriction drive compared with short-wavelength blue light. |
| 4 | **Luminance flash on transition** | When the gaze direction changes, a brief dark burst (UP) or bright burst (DOWN) is animated via the Web Animations API, rapidly driving the light reflex before the steady-state overlay settles. |

## References

[1] Loewenfeld, I. E. (1993). *The Pupil: Anatomy, Physiology, and Clinical Applications*. Iowa State University Press.

[2] Winn, B., Whitaker, D., Elliott, D. B., & Phillips, N. J. (1994). Factors affecting light-adapted pupil size in normal human subjects. *Investigative Ophthalmology & Visual Science*, 35(3), 1132–1137.

[3] Berson, D. M., Dunn, F. A., & Takao, M. (2002). Phototransduction by retinal ganglion cells that set the circadian clock. *Science*, 295(5557), 1070–1073. https://doi.org/10.1126/science.1067262

[4] Hattar, S., Liao, H.-W., Takao, M., Berson, D. M., & Yau, K.-W. (2002). Melanopsin-containing retinal ganglion cells: architecture, projections, and intrinsic photosensitivity. *Science*, 295(5557), 1065–1070. https://doi.org/10.1126/science.1069609

[5] McDougal, D. H., & Gamlin, P. D. (2010). The influence of intrinsically-photosensitive retinal ganglion cells on the spectral sensitivity and response dynamics of the human pupillary light reflex. *Vision Research*, 50(1), 72–87. https://doi.org/10.1016/j.visres.2009.10.021

[6] Kahneman, D., & Beatty, J. (1966). Pupil diameter and load on memory. *Science*, 154(3756), 1583–1585. https://doi.org/10.1126/science.154.3756.1583

[7] Beatty, J. (1982). Task-evoked pupillary responses, processing load, and the structure of processing resources. *Psychological Bulletin*, 91(2), 276–292. https://doi.org/10.1037/0033-2909.91.2.276

[8] Aston-Jones, G., & Cohen, J. D. (2005). An integrative theory of locus coeruleus–norepinephrine function: adaptive gain and optimal performance. *Annual Review of Neuroscience*, 28, 403–450. https://doi.org/10.1146/annurev.neuro.28.061604.135709

[9] Hess, E. H., & Polt, J. M. (1960). Pupil size as related to interest value of visual stimuli. *Science*, 132(3423), 349–350. https://doi.org/10.1126/science.132.3423.349

[10] Hess, E. H., & Polt, J. M. (1964). Pupil size in relation to mental activity during simple problem-solving. *Science*, 143(3611), 1190–1192. https://doi.org/10.1126/science.143.3611.1190

[11] Bradley, M. M., Miccoli, L., Escrig, M. A., & Lang, P. J. (2008). The pupil as a measure of emotional arousal and autonomic activation. *Psychophysiology*, 45(4), 602–607. https://doi.org/10.1111/j.1469-8986.2008.00654.x

[12] Sokolov, E. N. (1963). *Perception and the Conditioned Reflex*. Pergamon Press.

## Browser support

Any modern browser with WebGL and `getUserMedia` support works. Chrome / Edge on desktop and Android give the best performance.

## License

See [LICENSE](LICENSE) for details.

