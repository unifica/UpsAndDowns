import { loadModel, startTracking, stopTracking } from './eyeTracker.js';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service worker registered:', registration.scope);
      })
      .catch((err) => {
        console.error('Service worker registration failed:', err);
      });
  });
}

// DOM references
const startBtn        = document.getElementById('start-btn');
const togglePreviewBtn = document.getElementById('toggle-preview-btn');
const statusEl        = document.getElementById('status');
const video           = document.getElementById('video');
const canvas          = document.getElementById('overlay');
const cameraSection   = document.getElementById('camera-section');
const wordUp          = document.querySelector('.edge-word--top');
const wordDown        = document.querySelector('.edge-word--bottom');
const debugUpFill     = document.getElementById('debug-bar-up-fill');
const debugUpLabel    = document.getElementById('debug-bar-up-label');
const debugDownFill   = document.getElementById('debug-bar-down-fill');
const debugDownLabel  = document.getElementById('debug-bar-down-label');
const pupilSizeEl     = document.getElementById('pupil-size-value');

let running = false;
let previewVisible = true;

function setStatus(message) {
  statusEl.textContent = message;
}

function setGaze(direction) {
  if (!wordUp || !wordDown) return;
  wordUp.classList.toggle('edge-word--active', direction === 'up');
  wordDown.classList.toggle('edge-word--active', direction === 'down');
}

function updateDebugBars(gazeRatio) {
  if (gazeRatio === null || gazeRatio === undefined) {
    debugUpFill.style.width    = '0%';
    debugDownFill.style.width  = '0%';
    debugUpLabel.textContent   = '—';
    debugDownLabel.textContent = '—';
    return;
  }
  const upPct   = Math.round((1 - gazeRatio) * 100);
  const downPct = 100 - upPct;
  debugUpFill.style.width    = `${upPct}%`;
  debugDownFill.style.width  = `${downPct}%`;
  debugUpLabel.textContent   = `${upPct}%`;
  debugDownLabel.textContent = `${downPct}%`;
}

function updatePupilSize(pupilSize) {
  if (!pupilSizeEl) return;
  if (pupilSize === null || pupilSize === undefined) {
    pupilSizeEl.textContent = '—';
    return;
  }
  pupilSizeEl.textContent = (pupilSize * 100).toFixed(1);
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  // Wait until the first frame is available so videoWidth/videoHeight are set
  await new Promise((resolve) => {
    video.addEventListener('loadeddata', resolve, { once: true });
  });
  // Initialise canvas pixel dimensions to match its displayed size
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

function stopCamera() {
  const stream = video.srcObject;
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}

function setPreviewVisible(visible) {
  previewVisible = visible;
  // Use a CSS class that moves the section off-screen rather than display:none,
  // so the <video> element continues to receive frames and MediaPipe tracking
  // is unaffected even when the preview is hidden.
  cameraSection.classList.toggle('preview-hidden', !visible);
  togglePreviewBtn.textContent = visible ? 'Hide Preview' : 'Show Preview';
}

// Begin loading the AI model as soon as the page is ready so it is warm
// by the time the user clicks Start.
loadModel(setStatus).catch((err) => {
  console.error('Model load error:', err);
  setStatus('AI model failed to load');
  startBtn.disabled = true;
  startBtn.title = 'AI model could not be loaded';
});

togglePreviewBtn.addEventListener('click', () => {
  setPreviewVisible(!previewVisible);
});

startBtn.addEventListener('click', async () => {
  if (!running) {
    running = true;
    startBtn.disabled = true;
    startBtn.textContent = 'Starting…';
    try {
      await startCamera();
      startTracking(video, canvas, setGaze, updateDebugBars, setStatus, updatePupilSize);
      startBtn.textContent = 'Stop';
      togglePreviewBtn.disabled = false;
    } catch (err) {
      console.error('Camera error:', err);
      setStatus('Camera access denied');
      running = false;
      startBtn.textContent = 'Start';
    }
    startBtn.disabled = false;
  } else {
    running = false;
    stopTracking(canvas);
    setGaze('neutral');
    updateDebugBars(null);
    updatePupilSize(null);
    stopCamera();
    // Restore preview visibility for next session
    setPreviewVisible(true);
    togglePreviewBtn.disabled = true;
    startBtn.textContent = 'Start';
    setStatus('Ready');
  }
});
