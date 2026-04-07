# Ups & Downs

An interactive digital magic trick that uses real-time AI to detect where you are looking and measure your pupil size — running entirely in your browser, with no data ever leaving your device.

## What is it?

Ups & Downs is a browser-based Progressive Web App (PWA) that uses your device's camera and real-time AI to track your eye movements and pupil size. The app analyses where you are looking — up or down — and monitors changes in pupil dilation as part of an interactive magic trick experience. All processing happens locally in the browser; nothing is uploaded anywhere.

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

## How the trick works — pupil-dilation techniques

The app actively manipulates the visual scene to **cause** the pupil to dilate when the user looks at UP and to constrict when they look at DOWN.  Once the AI detects a reliable difference in iris size, it can reveal the chosen word — the "mind reading" is really controlled physiology.

Four complementary techniques are applied simultaneously whenever the gaze direction is determined:

| # | Technique | Mechanism |
|---|---|---|
| 1 | **Screen luminance overlay** | A radial-gradient overlay dims the entire scene to near-black (UP) or floods it with a white spotlight (DOWN), directly driving the **pupillary light reflex**. |
| 2 | **Background luminance gradient** | The page background is a static top-to-bottom gradient — near-black at the top where UP lives, progressively lighter toward the bottom where DOWN lives.  This creates a passive, always-on luminance bias with no gaze signal required. |
| 3 | **Color temperature of the active word** | UP glows warm amber (#ffcc77 + orange halos); DOWN glows cool blue (#aaddff + blue halos).  Long-wavelength warm light is processed differently by the ipRGC melanopsin pathway, contributing to a relatively lower constriction drive compared with short-wavelength blue light. |
| 4 | **Luminance flash on transition** | When the gaze direction changes, a brief dark burst (UP) or bright burst (DOWN) is animated via the Web Animations API, rapidly driving the light reflex before the steady-state overlay settles. |

## Browser support

Any modern browser with WebGL and `getUserMedia` support works. Chrome / Edge on desktop and Android give the best performance.

## License

See [LICENSE](LICENSE) for details.

