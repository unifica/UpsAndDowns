// MediaPipe FaceMesh landmark index ranges for each eye's contour and iris.
// Reference: https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
const LEFT_EYE_INDICES = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
];
const RIGHT_EYE_INDICES = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384,
  398,
];
// Available only when refineLandmarks:true (indices 468–477)
const LEFT_IRIS_INDICES  = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];

// Nose contour (tip, bridge, and nostrils)
const NOSE_INDICES = [
  1, 2, 4, 5, 6, 97, 98, 168, 188, 195, 197, 326, 327, 412,
];

// Mouth outer and inner lip contours
// Upper half (left corner → upper lip → right corner), lower half (right corner → lower lip → left corner)
const MOUTH_OUTER_INDICES = [
  /* upper */ 61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
  /* lower */ 375, 321, 405, 314, 17, 84, 181, 91, 146,
];
const MOUTH_INNER_INDICES = [
  /* upper */ 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,
  /* lower */ 324, 318, 402, 317, 14, 87, 178, 88, 95,
];

const LEFT_EYE_COLOR     = '#6c63ff'; // brand purple
const RIGHT_EYE_COLOR    = '#63e6ff'; // cyan complement
const NOSE_COLOR         = '#ff6363'; // warm red for nose
const MOUTH_COLOR        = '#ffd663'; // amber/gold for mouth
const LANDMARK_DOT_COLOR = '#00ff00'; // bright green for all facial feature points

let detector = null;
let animFrameId = null;

// Gaze smoothing state (reset each session)
let smoothedGazeRatio = 0.5;
const GAZE_SMOOTHING      = 0.15; // EMA factor
const GAZE_THRESHOLD_UP   = 0.40; // ratio below this → looking up
const GAZE_THRESHOLD_DOWN = 0.60; // ratio above this → looking down

// Number of consecutive frames a direction must persist before it is reported.
// This prevents rapid flickering when the gaze ratio hovers near a threshold.
const GAZE_STABLE_FRAMES = 4;

// Gaze indicator bar sizing and positioning constants
const GAZE_INDICATOR_HEIGHT_RATIO  = 0.40; // bar height as a fraction of canvas height
const GAZE_INDICATOR_RIGHT_MARGIN  = 18;   // px from the right edge of the canvas
const NO_FACE_HINT_FONT_SIZE_RATIO = 0.045; // font size as a fraction of canvas height

// ---------------------------------------------------------------------------
// Gaze direction
// ---------------------------------------------------------------------------

// Returns a ratio in [0, 1] where 0 = iris at top of eye (looking up) and
// 1 = iris at bottom of eye (looking down).  Returns null if iris data is
// unavailable (requires refineLandmarks: true, 478 keypoints).
function computeGazeRatio(kp) {
  if (kp.length < 478) return null;

  const results = [];
  for (const [eyeIndices, irisCenterIdx] of [
    [LEFT_EYE_INDICES, 468],
    [RIGHT_EYE_INDICES, 473],
  ]) {
    const validEye = eyeIndices.filter((i) => i < kp.length);
    if (!validEye.length) continue;

    const eyePts    = validEye.map((i) => kp[i]);
    const eyeTop    = Math.min(...eyePts.map((p) => p.y));
    const eyeBottom = Math.max(...eyePts.map((p) => p.y));
    const eyeHeight = eyeBottom - eyeTop;
    if (eyeHeight < 1) continue;

    if (irisCenterIdx >= kp.length) continue;
    const irisCy = kp[irisCenterIdx].y;
    results.push((irisCy - eyeTop) / eyeHeight);
  }

  if (!results.length) return null;
  return results.reduce((a, b) => a + b, 0) / results.length;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export async function loadModel(onStatus) {
  onStatus('Loading AI model…');
  const { SupportedModels, createDetector } = window.faceLandmarksDetection;
  detector = await createDetector(SupportedModels.MediaPipeFaceMesh, {
    runtime: 'mediapipe',
    solutionPath:
      'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619',
    refineLandmarks: true, // enables 478-point model with iris tracking
    maxFaces: 1,
  });
  onStatus('Ready');
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function getBounds(pts) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    rx: (x1 - x0) / 2,
    ry: (y1 - y0) / 2,
  };
}

function drawGlowEllipse(ctx, bounds, color, padding = 4) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(
    bounds.cx,
    bounds.cy,
    Math.max(bounds.rx + padding, 1),
    Math.max(bounds.ry + padding, 1),
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}

function drawGlowDot(ctx, x, y, color, radius = 3) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Draws a compact vertical gaze-ratio indicator bar on the right edge of the
// canvas.  The moving dot sits at the smoothed ratio position (0 = top,
// 1 = bottom).  Threshold lines mark the up/down zones.
function drawGazeIndicator(ctx, ratio, canvasWidth, canvasHeight) {
  const barH  = Math.round(canvasHeight * GAZE_INDICATOR_HEIGHT_RATIO);
  const barW  = 6;
  const x     = canvasWidth - GAZE_INDICATOR_RIGHT_MARGIN;
  const y     = Math.round((canvasHeight - barH) / 2);

  ctx.save();

  // Track background
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#888';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, barW, barH, 3);
  } else {
    ctx.rect(x, y, barW, barH);
  }
  ctx.fill();

  // Up-zone highlight
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = LEFT_EYE_COLOR;
  const upZoneH = GAZE_THRESHOLD_UP * barH;
  ctx.fillRect(x, y, barW, upZoneH);

  // Down-zone highlight
  ctx.fillStyle = RIGHT_EYE_COLOR;
  const downZoneY = y + GAZE_THRESHOLD_DOWN * barH;
  ctx.fillRect(x, downZoneY, barW, barH - (downZoneY - y));

  // Threshold lines
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = LEFT_EYE_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 2, y + GAZE_THRESHOLD_UP * barH);
  ctx.lineTo(x + barW + 2, y + GAZE_THRESHOLD_UP * barH);
  ctx.stroke();

  ctx.strokeStyle = RIGHT_EYE_COLOR;
  ctx.beginPath();
  ctx.moveTo(x - 2, y + GAZE_THRESHOLD_DOWN * barH);
  ctx.lineTo(x + barW + 2, y + GAZE_THRESHOLD_DOWN * barH);
  ctx.stroke();

  // Moving indicator dot
  const dotY   = y + ratio * barH;
  const dotCol = ratio < GAZE_THRESHOLD_UP   ? LEFT_EYE_COLOR
               : ratio > GAZE_THRESHOLD_DOWN  ? RIGHT_EYE_COLOR
               : '#ffffff';
  ctx.globalAlpha = 1;
  ctx.fillStyle   = dotCol;
  ctx.shadowColor = dotCol;
  ctx.shadowBlur  = 10;
  ctx.beginPath();
  ctx.arc(x + barW / 2, dotY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Overlay rendering
// ---------------------------------------------------------------------------

function drawLandmarkDots(ctx, kp, scale, offsetX, offsetY) {
  ctx.save();
  ctx.fillStyle = LANDMARK_DOT_COLOR;
  ctx.globalAlpha = 0.25;
  for (const point of kp) {
    ctx.beginPath();
    ctx.arc(point.x * scale + offsetX, point.y * scale + offsetY, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderOverlay(ctx, faces, scale, offsetX, offsetY, gazeRatio) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (!faces || faces.length === 0) {
    // Subtle hint that no face is in frame
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(ctx.canvas.height * NO_FACE_HINT_FONT_SIZE_RATIO)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('No face detected', ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.restore();
    return;
  }

  for (const face of faces) {
    const kp = face.keypoints;

    // --- Bright green dots for all detected facial feature positions ---
    drawLandmarkDots(ctx, kp, scale, offsetX, offsetY);

    // --- Eye contour ellipses ---
    for (const [indices, color] of [
      [LEFT_EYE_INDICES, LEFT_EYE_COLOR],
      [RIGHT_EYE_INDICES, RIGHT_EYE_COLOR],
    ]) {
      const valid = indices.filter((i) => i < kp.length);
      if (!valid.length) continue;
      const pts = valid.map((i) => ({
        x: kp[i].x * scale + offsetX,
        y: kp[i].y * scale + offsetY,
      }));
      drawGlowEllipse(ctx, getBounds(pts), color);
    }

    // --- Iris circles + centre dots (refineLandmarks mode, 478 keypoints) ---
    if (kp.length > 468) {
      for (const [indices, color] of [
        [LEFT_IRIS_INDICES, LEFT_EYE_COLOR],
        [RIGHT_IRIS_INDICES, RIGHT_EYE_COLOR],
      ]) {
        const valid = indices.filter((i) => i < kp.length);
        if (!valid.length) continue;
        const pts = valid.map((i) => ({
          x: kp[i].x * scale + offsetX,
          y: kp[i].y * scale + offsetY,
        }));
        // pts[0] is the iris center in MediaPipe's ordering
        drawGlowEllipse(ctx, getBounds(pts), color, 1);
        drawGlowDot(ctx, pts[0].x, pts[0].y, color);
      }
    }

    // --- Nose ellipse ---
    {
      const valid = NOSE_INDICES.filter((i) => i < kp.length);
      if (valid.length) {
        const pts = valid.map((i) => ({
          x: kp[i].x * scale + offsetX,
          y: kp[i].y * scale + offsetY,
        }));
        drawGlowEllipse(ctx, getBounds(pts), NOSE_COLOR);
      }
    }

    // --- Mouth ellipses (outer contour + inner contour) ---
    for (const indices of [MOUTH_OUTER_INDICES, MOUTH_INNER_INDICES]) {
      const valid = indices.filter((i) => i < kp.length);
      if (!valid.length) continue;
      const pts = valid.map((i) => ({
        x: kp[i].x * scale + offsetX,
        y: kp[i].y * scale + offsetY,
      }));
      drawGlowEllipse(ctx, getBounds(pts), MOUTH_COLOR);
    }
  }

  // Draw gaze-ratio indicator bar if a valid ratio is available
  if (gazeRatio !== null && gazeRatio !== undefined) {
    drawGazeIndicator(ctx, gazeRatio, ctx.canvas.width, ctx.canvas.height);
  }
}

// ---------------------------------------------------------------------------
// Public tracking loop
// ---------------------------------------------------------------------------

export function startTracking(video, canvas, onGaze, onGazeRatio) {
  const ctx = canvas.getContext('2d');
  // Reset smoothing and stability state for each new session
  smoothedGazeRatio = 0.5;
  let lastDirection    = 'neutral';
  let pendingDirection = 'neutral';
  let stableFrames     = 0;

  async function loop() {
    if (detector && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      // Keep canvas pixel dimensions in sync with its CSS display size
      const dw = canvas.clientWidth;
      const dh = canvas.clientHeight;
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width  = dw;
        canvas.height = dh;
      }

      try {
        const faces = await detector.estimateFaces(video);
        // Compute the same transform that CSS `object-fit: cover` applies so
        // that landmark coordinates (in video pixels) map exactly onto the
        // canvas pixels that show that part of the frame.
        const cw = canvas.width;
        const ch = canvas.height;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const scale   = Math.max(cw / vw, ch / vh);
        const offsetX = (cw - vw * scale) / 2;
        const offsetY = (ch - vh * scale) / 2;

        // --- Gaze detection ---
        let gazeRatio = null;
        if (faces && faces.length > 0) {
          const raw = computeGazeRatio(faces[0].keypoints);
          if (raw !== null) {
            // Exponential moving average smoothing
            smoothedGazeRatio =
              smoothedGazeRatio + GAZE_SMOOTHING * (raw - smoothedGazeRatio);
            gazeRatio = smoothedGazeRatio;

            // Determine direction from smoothed ratio
            let direction = 'neutral';
            if (smoothedGazeRatio < GAZE_THRESHOLD_UP)   direction = 'up';
            else if (smoothedGazeRatio > GAZE_THRESHOLD_DOWN) direction = 'down';

            // Hysteresis: only commit after GAZE_STABLE_FRAMES consecutive frames
            if (direction === pendingDirection) {
              stableFrames++;
            } else {
              pendingDirection = direction;
              stableFrames     = 1;
            }

            if (stableFrames >= GAZE_STABLE_FRAMES && direction !== lastDirection) {
              lastDirection = direction;
              onGaze(direction);
            }
          }
        } else {
          // No face in frame — reset to neutral
          if (lastDirection !== 'neutral') {
            lastDirection    = 'neutral';
            pendingDirection = 'neutral';
            stableFrames     = 0;
            onGaze('neutral');
          }
        }

        renderOverlay(ctx, faces, scale, offsetX, offsetY, gazeRatio);
        if (onGazeRatio) onGazeRatio(gazeRatio);
      } catch (err) {
        console.warn('Face detection error:', err);
      }
    }
    animFrameId = requestAnimationFrame(loop);
  }

  animFrameId = requestAnimationFrame(loop);
}

export function stopTracking(canvas) {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
