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

const LEFT_EYE_COLOR     = '#6c63ff'; // brand purple
const RIGHT_EYE_COLOR    = '#63e6ff'; // cyan complement
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

function drawLandmarkDots(ctx, kp, scaleX, scaleY) {
  for (const point of kp) {
    drawGlowDot(ctx, point.x * scaleX, point.y * scaleY, LANDMARK_DOT_COLOR, 2);
  }
}

function renderOverlay(ctx, faces, scaleX, scaleY) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!faces || faces.length === 0) return;

  for (const face of faces) {
    const kp = face.keypoints;

    // --- Bright green dots for all detected facial feature positions ---
    drawLandmarkDots(ctx, kp, scaleX, scaleY);

    // --- Eye contour ellipses ---
    for (const [indices, color] of [
      [LEFT_EYE_INDICES, LEFT_EYE_COLOR],
      [RIGHT_EYE_INDICES, RIGHT_EYE_COLOR],
    ]) {
      const valid = indices.filter((i) => i < kp.length);
      if (!valid.length) continue;
      const pts = valid.map((i) => ({
        x: kp[i].x * scaleX,
        y: kp[i].y * scaleY,
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
          x: kp[i].x * scaleX,
          y: kp[i].y * scaleY,
        }));
        // pts[0] is the iris center in MediaPipe's ordering
        drawGlowEllipse(ctx, getBounds(pts), color, 1);
        drawGlowDot(ctx, pts[0].x, pts[0].y, color);
      }
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
        const scaleX = canvas.width  / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;
        renderOverlay(ctx, faces, scaleX, scaleY);
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
