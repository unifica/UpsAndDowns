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

// ---------------------------------------------------------------------------
// Overlay rendering
// ---------------------------------------------------------------------------

function drawLandmarkDots(ctx, kp, scale, offsetX, offsetY) {
  for (const point of kp) {
    drawGlowDot(ctx, point.x * scale + offsetX, point.y * scale + offsetY, LANDMARK_DOT_COLOR, 2);
  }
}

function renderOverlay(ctx, faces, scale, offsetX, offsetY) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!faces || faces.length === 0) return;

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
}

// ---------------------------------------------------------------------------
// Public tracking loop
// ---------------------------------------------------------------------------

export function startTracking(video, canvas) {
  const ctx = canvas.getContext('2d');

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
        const scale = Math.max(cw / vw, ch / vh);
        const offsetX = (cw - vw * scale) / 2;
        const offsetY = (ch - vh * scale) / 2;
        renderOverlay(ctx, faces, scale, offsetX, offsetY);
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
