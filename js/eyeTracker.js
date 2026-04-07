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
// Each group: [center, edge0, edge1, edge2, edge3]
const LEFT_IRIS_INDICES  = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];
// Edge-only indices used for radius computation (center is index 0)
const LEFT_IRIS_EDGE_INDICES  = [469, 470, 471, 472];
const RIGHT_IRIS_EDGE_INDICES = [474, 475, 476, 477];

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
const GAZE_SMOOTHING      = 0.20; // EMA factor – slightly higher for quicker head-level response

// Pupil-size smoothing state (reset each session)
let smoothedPupilSize = null;
const PUPIL_SMOOTHING = 0.15; // EMA factor for iris radius
const GAZE_THRESHOLD_UP   = 0.43; // ratio below this → looking up
const GAZE_THRESHOLD_DOWN = 0.57; // ratio above this → looking down

// Pupil-dilation gaze contribution (reset each session)
// A slow-moving baseline tracks the user's resting pupil size; short-term
// deviations from that baseline carry a directional signal:
//   dilated (iris > baseline) → scene got darker  → user is looking toward UP
//   constricted (iris < baseline) → scene got brighter → user is looking toward DOWN
let pupilBaseline = null;
const PUPIL_BASELINE_SMOOTHING = 0.008; // very slow EMA (~125 frames to 63 %)
const PUPIL_SIGNAL_WEIGHT      = 0.90;  // max contribution to gaze ratio (±) — pupil dilation is the dominant predictor
const PUPIL_SIGNAL_CLAMP       = 0.20;  // relative deviation clamped to ±20 %
const PUPIL_BASELINE_MIN       = 0.001; // minimum plausible baseline value (sanity guard)

// Scaling factor applied to the head-pitch + iris-position combined deviation
// before it is added to the gaze ratio.  Keeping this small (< 0.5) ensures
// the pupil-dilation signal (PUPIL_SIGNAL_WEIGHT) remains the dominant driver.
const GAZE_COMPONENT_SCALE = 0.12;

// ---------------------------------------------------------------------------
// Blink detection (Eye Aspect Ratio)
// ---------------------------------------------------------------------------
// Uses the standard EAR formula: the ratio of the height of the eye opening
// to its width.  During a blink EAR drops sharply.  We skip gaze updates
// for frames where EAR is below the threshold so that the momentary eyelid
// closure isn't misinterpreted as a downward gaze shift.

// Upper-lid and lower-lid landmark pairs used to measure vertical opening.
const LEFT_EYE_VERTICAL_PAIRS  = [[159, 145], [158, 153]]; // (top, bottom)
const RIGHT_EYE_VERTICAL_PAIRS = [[386, 374], [385, 380]];
// Horizontal eye width landmarks
const LEFT_EYE_HORIZONTAL  = [33, 133]; // inner corner, outer corner
const RIGHT_EYE_HORIZONTAL = [362, 263];

const BLINK_EAR_THRESHOLD = 0.18; // below this the eye is considered closed

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function computeEAR(kp, verticalPairs, horizontalPair) {
  let vertSum = 0;
  for (const [topIdx, botIdx] of verticalPairs) {
    vertSum += dist(kp[topIdx], kp[botIdx]);
  }
  const horiz = dist(kp[horizontalPair[0]], kp[horizontalPair[1]]);
  if (horiz < 0.0001) return BLINK_EAR_THRESHOLD + 1; // invalid landmarks — treat as not blinking
  return vertSum / (2 * horiz);
}

function isBlinking(kp) {
  if (kp.length < 478) return false;
  const leftEAR  = computeEAR(kp, LEFT_EYE_VERTICAL_PAIRS, LEFT_EYE_HORIZONTAL);
  const rightEAR = computeEAR(kp, RIGHT_EYE_VERTICAL_PAIRS, RIGHT_EYE_HORIZONTAL);
  const avgEAR   = (leftEAR + rightEAR) / 2;
  return avgEAR < BLINK_EAR_THRESHOLD;
}

// Number of consecutive frames a direction must persist before it is reported.
// This prevents rapid flickering when the gaze ratio hovers near a threshold.
const GAZE_STABLE_FRAMES = 4;

// Number of frames collected at startup to establish the user's neutral gaze
// baseline.  During this window the user is asked to look straight ahead.
const CALIBRATION_FRAMES = 60;

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
function computeVerticalGazeRatio(kp) {
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

// Returns an estimated head-pitch ratio in [0, 1].
// 0 = head tilted up (chin raised), 1 = head tilted down (chin toward chest).
// Uses the 2-D proportion of upper face (eye midpoint → nose tip) versus the
// total face height (eye midpoint → chin).  When the head tilts forward the
// forehead faces the camera, foreshortening the lower portion so the
// eye-to-nose distance grows relative to nose-to-chin.
// Returns null if required landmarks are missing or face is too small.
function computeHeadPitchRatio(kp) {
  if (kp.length < 478) return null;

  const eyeMidY  = (kp[468].y + kp[473].y) / 2; // average of iris centers
  const noseTipY = kp[4].y;                       // apex of the nose
  const chinY    = kp[152].y;                     // chin center

  // Sanity check: landmarks should be in top-to-bottom image order
  if (noseTipY <= eyeMidY || chinY <= noseTipY) return null;

  const upperH = noseTipY - eyeMidY; // eye-midpoint to nose
  const totalH = chinY    - eyeMidY; // eye-midpoint to chin
  if (totalH < 1) return null;

  // upperH / totalH grows as the head tilts down (forehead faces camera more,
  // lower face foreshortens) and shrinks as the head tilts up.
  return upperH / totalH;
}

// Returns a combined gaze ratio in [0, 1] where 0 = looking up and 1 = looking down.
// Combines head-pitch ratio (80 %) and vertical iris position (20 %).
// Head position is heavily weighted because even slight upward/downward head
// movement is a strong signal for the UP/DOWN reading intent.  The raw iris
// position within the eye socket carries much less discriminative weight here
// since pupil dilation (see PUPIL_SIGNAL_WEIGHT) is the dominant predictor.
// The calibration offset normalises the combined metric so each user's
// neutral looking-straight-ahead position maps to 0.5.
// Returns null if iris data is unavailable.
function computeGazeRatio(kp) {
  const vertical = computeVerticalGazeRatio(kp);
  if (vertical === null) return null;

  const pitch = computeHeadPitchRatio(kp);
  if (pitch === null) return vertical;

  return vertical * 0.2 + pitch * 0.8;
}

// ---------------------------------------------------------------------------
// Pupil (iris) size
// ---------------------------------------------------------------------------

// Returns the average iris radius normalised by the inter-ocular distance (IOD),
// yielding a dimensionless ratio that is stable across different camera distances.
// Both the radius and IOD are computed in video-pixel space before dividing.
// Typical values are in the range 0.15 – 0.35.
// Returns null if iris landmarks are unavailable (requires refineLandmarks: true).
function computeIrisRadius(kp) {
  if (kp.length < 478) return null;

  const radii = [];
  for (const [centerIdx, edgeIdxs] of [
    [468, LEFT_IRIS_EDGE_INDICES],
    [473, RIGHT_IRIS_EDGE_INDICES],
  ]) {
    const center = kp[centerIdx];
    const distances = edgeIdxs
      .filter((i) => i < kp.length)
      .map((i) => {
        const dx = kp[i].x - center.x;
        const dy = kp[i].y - center.y;
        return Math.sqrt(dx * dx + dy * dy);
      });
    if (distances.length) {
      radii.push(distances.reduce((a, b) => a + b, 0) / distances.length);
    }
  }

  if (!radii.length) return null;
  const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;

  // Normalise by inter-ocular distance (left iris centre → right iris centre)
  const dx = kp[473].x - kp[468].x;
  const dy = kp[473].y - kp[468].y;
  const iod = Math.sqrt(dx * dx + dy * dy);
  if (iod < 1) return null;

  return avgRadius / iod;
}

// Returns a signed offset in [−PUPIL_SIGNAL_WEIGHT, +PUPIL_SIGNAL_WEIGHT] that
// nudges the combined gaze ratio based on how much the current (smoothed) pupil
// size deviates from the long-term baseline:
//   positive deviation (dilation)   → negative offset → pushes ratio toward 0 (up)
//   negative deviation (constriction) → positive offset → pushes ratio toward 1 (down)
// Returns 0 when insufficient data is available.
function computePupilGazeContribution(currentPupilSize, baseline) {
  if (baseline === null || baseline < PUPIL_BASELINE_MIN || currentPupilSize === null) return 0;
  const deviation = (currentPupilSize - baseline) / baseline;
  const clamped = Math.max(-PUPIL_SIGNAL_CLAMP, Math.min(PUPIL_SIGNAL_CLAMP, deviation));
  // Invert: dilation (positive) → negative contribution (toward up / lower ratio)
  return -(clamped / PUPIL_SIGNAL_CLAMP) * PUPIL_SIGNAL_WEIGHT;
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
// canvas.  The moving dot sits at the combined gaze-ratio position
// (0 = looking up, 1 = looking down).  Threshold lines mark the up/down zones.
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

// Draws a small pupil-size label in the bottom-left corner of the canvas.
// `pupilSize` is the dimensionless iris-radius / IOD ratio from computeIrisRadius().
// It is multiplied by 100 here to produce a human-readable display value (e.g. "23.4").
function drawPupilSizeLabel(ctx, pupilSize, canvasWidth, canvasHeight) {
  const displayValue = (pupilSize * 100).toFixed(1);
  const label = `Pupil: ${displayValue}`;
  const fontSize = Math.max(12, Math.round(canvasHeight * 0.038));
  const x = 12;
  const y = canvasHeight - 12;

  ctx.save();
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Dark shadow for contrast against any background
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(label, x, y);

  // White text
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x, y);
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

function renderOverlay(ctx, faces, scale, offsetX, offsetY, gazeRatio, pupilSize) {
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

  // Draw pupil-size label on the canvas when a measurement is available
  if (pupilSize !== null && pupilSize !== undefined) {
    drawPupilSizeLabel(ctx, pupilSize, ctx.canvas.width, ctx.canvas.height);
  }
}

// ---------------------------------------------------------------------------
// Public tracking loop
// ---------------------------------------------------------------------------

export function startTracking(video, canvas, onGaze, onGazeRatio, onStatus, onPupilSize) {
  const ctx = canvas.getContext('2d');
  // Reset smoothing and stability state for each new session
  smoothedGazeRatio = 0.5;
  smoothedPupilSize = null;
  pupilBaseline     = null;
  let lastDirection    = 'neutral';
  let pendingDirection = 'neutral';
  let stableFrames     = 0;

  // Calibration state – collect the user's neutral gaze ratio before tracking
  let calibrationSamples = [];
  let calibrationOffset  = 0;
  let isCalibrating      = true;
  if (onStatus) onStatus('Calibrating… look straight ahead');

  async function loop() {
    if (detector && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      // Keep canvas pixel dimensions in sync with its CSS display size
      const dw = canvas.clientWidth;
      const dh = canvas.clientHeight;
      // Guard: do not collapse the canvas to 0×0 when the section is hidden
      // (display:none makes clientWidth/clientHeight return 0).  Preserving the
      // last known dimensions keeps the tracking loop healthy and avoids needing
      // a full re-initialisation when the preview is revealed again.
      if (dw > 0 && dh > 0 && (canvas.width !== dw || canvas.height !== dh)) {
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
        const blinking = faces && faces.length > 0 && isBlinking(faces[0].keypoints);
        if (faces && faces.length > 0 && !blinking) {
          const raw = computeGazeRatio(faces[0].keypoints);
          if (raw !== null) {
            if (isCalibrating) {
              // Collect samples to establish the user's neutral gaze position
              calibrationSamples.push(raw);
              gazeRatio = raw; // show raw position on the indicator during calibration
              if (calibrationSamples.length >= CALIBRATION_FRAMES) {
                const avg = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
                calibrationOffset = avg - 0.5; // how far neutral is from the midpoint
                isCalibrating = false;
                smoothedGazeRatio = 0.5; // reset EMA after calibration
                if (onStatus) onStatus('Tracking…');
              }
            } else {
              // Apply calibration offset so that the user's neutral gaze maps to 0.5.
              // The pupil-size deviation is the DOMINANT predictor (PUPIL_SIGNAL_WEIGHT = 0.90):
              //   dilation (dark scene / looking UP)   → large negative contribution → ratio toward 0
              //   constriction (bright scene / looking DOWN) → large positive contribution → ratio toward 1
              // The head-pitch + iris-position signal (computeGazeRatio) is attenuated so that the
              // pupil signal clearly dominates.  Within that signal head pitch carries 80 % of the
              // weight, reinforcing the rule:
              //   head up + larger pupil  → high confidence UP
              //   head down + smaller pupil → high confidence DOWN
              const pupilContrib = computePupilGazeContribution(smoothedPupilSize, pupilBaseline);
              const gazeComponent = 0.5 + (raw - calibrationOffset - 0.5) * GAZE_COMPONENT_SCALE;
              const adjusted = gazeComponent + pupilContrib;
              // Exponential moving average smoothing
              smoothedGazeRatio =
                smoothedGazeRatio + GAZE_SMOOTHING * (adjusted - smoothedGazeRatio);
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
          }
        } else if (!faces || faces.length === 0) {
          // No face in frame — reset to neutral
          if (lastDirection !== 'neutral') {
            lastDirection    = 'neutral';
            pendingDirection = 'neutral';
            stableFrames     = 0;
            onGaze('neutral');
          }
        }
        // When blinking, we simply hold the last known gaze direction.

        // --- Pupil (iris) size ---
        // Skip pupil measurement during blinks (eyelid occludes the iris).
        let pupilSize = null;
        if (faces && faces.length > 0 && !blinking) {
          const rawPupil = computeIrisRadius(faces[0].keypoints);
          if (rawPupil !== null) {
            if (smoothedPupilSize === null) {
              smoothedPupilSize = rawPupil;
            } else {
              smoothedPupilSize =
                smoothedPupilSize + PUPIL_SMOOTHING * (rawPupil - smoothedPupilSize);
            }
            pupilSize = smoothedPupilSize;
          }
          // Update the slow-moving pupil baseline so that only short-term
          // deviations (caused by the screen luminance change) are treated as
          // a directional signal, while long-term drift is absorbed.
          if (smoothedPupilSize !== null) {
            if (pupilBaseline === null) {
              pupilBaseline = smoothedPupilSize;
            } else {
              pupilBaseline =
                pupilBaseline + PUPIL_BASELINE_SMOOTHING * (smoothedPupilSize - pupilBaseline);
            }
          }
        } else if (!faces || faces.length === 0) {
          // No face — reset pupil smoothing so next detection starts fresh
          smoothedPupilSize = null;
          pupilBaseline     = null;
        }

        renderOverlay(ctx, faces, scale, offsetX, offsetY, gazeRatio, pupilSize);
        if (onGazeRatio) onGazeRatio(gazeRatio);
        if (onPupilSize) onPupilSize(pupilSize);
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
