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
const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('status');
const video    = document.getElementById('video');
const canvas   = document.getElementById('overlay');
const wordUp   = document.querySelector('.edge-word--top');
const wordDown = document.querySelector('.edge-word--bottom');

let running = false;

function setStatus(message) {
  statusEl.textContent = message;
}

function setGaze(direction) {
  if (!wordUp || !wordDown) return;
  wordUp.classList.toggle('edge-word--active', direction === 'up');
  wordDown.classList.toggle('edge-word--active', direction === 'down');
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

// Begin loading the AI model as soon as the page is ready so it is warm
// by the time the user clicks Start.
loadModel(setStatus).catch((err) => {
  console.error('Model load error:', err);
  setStatus('AI model failed to load');
  startBtn.disabled = true;
  startBtn.title = 'AI model could not be loaded';
});

startBtn.addEventListener('click', async () => {
  if (!running) {
    running = true;
    startBtn.disabled = true;
    startBtn.textContent = 'Starting…';
    try {
      await startCamera();
      startTracking(video, canvas, setGaze);
      setStatus('Tracking…');
      startBtn.textContent = 'Stop';
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
    stopCamera();
    startBtn.textContent = 'Start';
    setStatus('Ready');
  }
});
