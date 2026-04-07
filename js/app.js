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
const video = document.getElementById('video');

let running = false;

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
  } catch (err) {
    setStatus('Camera access denied');
    console.error('Camera error:', err);
  }
}

function stopCamera() {
  const stream = video.srcObject;
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}

function setStatus(message) {
  statusEl.textContent = message;
}

startBtn.addEventListener('click', () => {
  if (!running) {
    running = true;
    startBtn.textContent = 'Stop';
    setStatus('Tracking…');
    startCamera();
  } else {
    running = false;
    startBtn.textContent = 'Start';
    setStatus('Ready');
    stopCamera();
  }
});
