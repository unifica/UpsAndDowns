// ---------------------------------------------------------------------------
// Technique 5 — Visual noise around the UP word
// Draws random dots and short lines on a small canvas overlaid on the UP word.
// The noise refreshes periodically so the viewer's eye can never fully settle,
// increasing cognitive load (and thereby sympathetic arousal / pupil dilation).
// ---------------------------------------------------------------------------

(function initUpNoise() {
  'use strict';

  const NOISE_INTERVAL_MS = 120;  // repaint interval
  const DOT_COUNT         = 18;   // random dots per frame
  const LINE_COUNT        = 6;    // random line segments per frame
  const DOT_RADIUS_MAX    = 2.5;
  const LINE_LENGTH_MAX   = 18;
  const RESIZE_DEBOUNCE_MS = 200;

  let noiseTimer = null;
  let resizeTimer = null;

  function drawNoise(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    // Random dots
    for (let i = 0; i < DOT_COUNT; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * DOT_RADIUS_MAX + 0.5;
      const alpha = Math.random() * 0.5 + 0.15;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = Math.random() > 0.5 ? '#888' : '#555';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Random short line segments
    for (let i = 0; i < LINE_COUNT; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = Math.random() * LINE_LENGTH_MAX + 4;
      const angle = Math.random() * Math.PI * 2;
      const alpha = Math.random() * 0.35 + 0.1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = Math.random() > 0.5 ? '#777' : '#444';
      ctx.lineWidth = Math.random() * 1.2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
      ctx.restore();
    }
  }

  function sizeCanvas(canvas) {
    // Match the canvas pixel buffer to its CSS-rendered size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }

  function stop() {
    if (noiseTimer !== null) {
      clearInterval(noiseTimer);
      noiseTimer = null;
    }
    if (resizeTimer !== null) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
  }

  function start() {
    var canvas = document.getElementById('up-noise-canvas');
    if (!canvas) return;

    // Clean up any previous instance
    stop();

    sizeCanvas(canvas);
    drawNoise(canvas);

    // Redraw on a timer for a constantly-shifting noise field
    noiseTimer = setInterval(function () {
      drawNoise(canvas);
    }, NOISE_INTERVAL_MS);

    // Debounced resize handler
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        sizeCanvas(canvas);
      }, RESIZE_DEBOUNCE_MS);
    });
  }

  // Initialise once the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
