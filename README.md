# Ups & Downs

A digital magic trick powered by AI facial and eye tracking that runs entirely in your browser.

## What is it?

Ups & Downs is a browser-based Progressive Web App (PWA) that uses your device's camera and real-time AI to track your eye movements. The app analyzes where you are looking — up or down — as part of an interactive magic trick experience. No data ever leaves your device; all processing happens locally in the browser.

## Features

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

## Browser support

Any modern browser with WebGL and `getUserMedia` support works. Chrome / Edge on desktop and Android give the best performance.

## License

See [LICENSE](LICENSE) for details.

