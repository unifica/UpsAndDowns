// ---------------------------------------------------------------------------
// Technique 5 — Visual noise around the UP word
// Draws random dots and short lines on a small canvas overlaid on the UP word.
// The noise refreshes periodically so the viewer's eye can never fully settle,
// increasing cognitive load (and thereby sympathetic arousal / pupil dilation).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Word replacement — the UP label is swapped for a randomly chosen
// complicated word each time the page loads.
// ---------------------------------------------------------------------------
(function replaceUpWord() {
  'use strict';

  var WORDS = [
    'Ephemeral', 'Mellifluous', 'Serendipity', 'Perspicacious', 'Loquacious',
    'Magnanimous', 'Ineffable', 'Ethereal', 'Resplendent', 'Nefarious',
    'Quintessential', 'Perfidious', 'Incandescent', 'Ubiquitous', 'Equivocal',
    'Sycophantic', 'Crepuscular', 'Diaphanous', 'Melancholic', 'Obsequious',
    'Tenacious', 'Vicissitude', 'Sesquipedalian', 'Supercilious', 'Gossamer',
    'Defenestration', 'Callipygian', 'Schadenfreude', 'Weltanschauung', 'Zugzwang',
    'Absquatulate', 'Collywobbles', 'Flibbertigibbet', 'Widdershins', 'Labyrinthine',
    'Surreptitious', 'Pulchritude', 'Soliloquy', 'Limpid', 'Euphonious',
    'Perspicuity', 'Recalcitrant', 'Obstreperous', 'Exacerbate', 'Plethora',
    'Ostentatious', 'Pontificate', 'Nonchalant', 'Superfluous', 'Discombobulate'
  ];

  function setRandomWord() {
    var el = document.querySelector('.up-text');
    if (!el) return;
    el.textContent = WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setRandomWord);
  } else {
    setRandomWord();
  }
})();

(function initUpNoise() {
  'use strict';

  const NOISE_INTERVAL_MS = 80;   // repaint interval (faster for more agitation)
  const DOT_COUNT         = 35;   // random dots per frame
  const LINE_COUNT        = 14;   // random line segments per frame
  const DOT_RADIUS_MAX    = 3.0;
  const LINE_LENGTH_MAX   = 24;
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
      const alpha = Math.random() * 0.6 + 0.20;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = Math.random() > 0.5 ? '#999' : '#444';
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
      const alpha = Math.random() * 0.45 + 0.12;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = Math.random() > 0.5 ? '#888' : '#333';
      ctx.lineWidth = Math.random() * 1.5 + 0.3;
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
