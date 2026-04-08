// ---------------------------------------------------------------------------
// Technique 5 — Visual noise around the UP word
// Draws random dots and short lines on a small canvas overlaid on the UP word.
// The noise refreshes periodically so the viewer's eye can never fully settle,
// increasing cognitive load (and thereby sympathetic arousal / pupil dilation).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sentence replacement — the UP label is swapped for a randomly chosen
// complex sentence and the DOWN label for a simple sentence each page load.
// ---------------------------------------------------------------------------
(function replaceSentences() {
  'use strict';

  var COMPLEX_SENTENCES = [
    'The ephemeral luminescence perpetuates existential nocturnal contemplation.',
    'Perspicacious observers elucidate labyrinthine philosophical constructs.',
    'Mellifluous cadences permeate the subconscious perceptual apparatus.',
    'Serendipitous concatenation of circumstance engenders unprecedented metamorphosis.',
    'Loquacious orators obfuscate substantive discourse with circumlocutory rhetoric.',
    'The magnanimous benefactor ameliorates the penurious circumstances of others.',
    'Ineffable transcendence characterizes the quintessential metaphysical experience.',
    'Resplendent iridescence of the ethereal nebula defies perspicuous comprehension.',
    'Nefarious machinations precipitate inevitable cataclysmic repercussions.',
    'Ubiquitous equivocation permeates the labyrinthine bureaucratic apparatus.',
    'Sycophantic supplicants perpetuate the iniquitous hegemonic discourse.',
    'Crepuscular phenomena engender melancholic existential ruminations.',
    'Diaphanous ephemera eludes the perspicacious cognoscenti and neophytes alike.',
    'Obsequious deliberations obfuscate the substantive philosophical quandaries.',
    'Tenacious perseverance necessitates extraordinary psychological fortitude.',
    'Vicissitudes of circumstance precipitate inexplicable ontological transformations.',
    'Sesquipedalian tendencies obfuscate otherwise lucid communicative exchanges.',
    'Supercilious demeanors engender considerable antagonism and consternation.',
    'Gossamer philosophical constructs perplex the uninitiated intellect considerably.',
    'Defenestration of outmoded paradigms necessitates scrupulous epistemological reconsideration.',
    'Schadenfreude permeates the surreptitious observations of perfidious individuals.',
    'Weltanschauung transcends conventional perspectival limitations of cognition.',
    'Obstreperous neophytes promulgate iniquitous heterodox philosophical ideologies.',
    'Ostentatious pontificating perpetuates mendacious societal misconceptions.',
    'Recalcitrant superciliousness precipitates deleterious interpersonal ramifications.',
    'Perspicuous articulation necessitates scrupulous attention to lexical precision.',
    'Ineffable melancholic luminescence engenders crepuscular existential contemplation.',
    'Circumlocutory deliberations perpetuate unresolvable philosophical paradoxes.',
    'Idiosyncratic proclivities engender labyrinthine interpersonal complications.',
    'Subliminal concatenations of semiotics perpetuate hegemonic ideological discourse.',
    'Interminable deliberations circumvent expeditious administrative resolutions.',
    'Surreptitious machinations undermine ostensibly benevolent philanthropic endeavors.',
    'Clandestine communications precipitate irreversible geopolitical ramifications.',
    'Mendacious representations promulgate iniquitous societal misconceptions.',
    'Quotidian phenomena belie the underlying metaphysical complexities therein.',
    'Recondite philosophical treatises elucidate ineffable cosmological phenomena.',
    'Nebulous premonitions precipitate inexplicable psychological transformations.',
    'Disingenuous platitudes proliferate in ostentatious rhetorical discourse.',
    'Veridical representations necessitate scrupulous epistemological investigations.',
    'Circumspect individuals deliberate exhaustively before consequential determinations.',
    'Perspicacious cognition transcends conventional paradigmatic limitations.',
    'Extemporaneous deliberations precipitate unforeseen epistemological revelations.',
    'Intransigent ideological positions perpetuate unresolvable philosophical quandaries.',
    'Equanimity characterizes the quintessential philosophical temperament therein.',
    'Phenomenological manifestations perplex both cognoscenti and neophytes alike.',
    'Grandiose pretentions belie the underlying insipid philosophical constructs.',
    'Ephemeral oscillations perpetuate interminable philosophical contemplation.',
    'Inexorable vicissitudes characterize the ontological human predicament.',
    'Pellucid articulation necessitates scrupulous attention to lexical precision.',
    'Pulchritudinous soliloquies engender ineffable melancholic ruminative contemplation.'
  ];

  var SIMPLE_SENTENCES = [
    'The dog runs fast in the yard.',
    'She drinks a cup of hot tea.',
    'The sun comes up in the east.',
    'He goes to bed at ten.',
    'They eat lunch by the big tree.',
    'The cat sits on the warm mat.',
    'A bird flies over the red house.',
    'We walk to the shop each day.',
    'The kids play games in the park.',
    'He reads a book in his room.',
    'She buys fresh bread from the store.',
    'The fish swim deep in the sea.',
    'We sit and watch the rain fall.',
    'The moon lights up the dark sky.',
    'A boy runs home after school.',
    'She puts the cup on the shelf.',
    'He opens the door to let them in.',
    'The wind blows the leaves off the tree.',
    'They swim in the cool blue lake.',
    'A dog barks at the gate.',
    'She cleans the floor with a wet mop.',
    'He drives to work each day.',
    'The kids eat ice cream in the heat.',
    'A boat sails out to sea.',
    'She hangs the wash out to dry.',
    'He digs a hole in the soft dirt.',
    'The train stops at each small town.',
    'A cow eats grass in the field.',
    'She fills the pot with cold water.',
    'He cuts the bread with a sharp knife.',
    'The bird sings in the tall pine tree.',
    'We push the cart down the long hall.',
    'She picks the red roses from the bush.',
    'He waits for the bus in the cold.',
    'The child draws a big sun on paper.',
    'We fry the eggs in a pan.',
    'She ties her shoes and goes outside.',
    'He lifts the box and puts it down.',
    'The dog brings the ball back to him.',
    'We sit by the fire on cold nights.',
    'She gives the cat a bowl of milk.',
    'He paints the old fence white.',
    'The kids jump in the piles of leaves.',
    'A bus full of kids goes by.',
    'She pours the soup into a big bowl.',
    'He throws a stone into the pond.',
    'The old man feeds the ducks at the lake.',
    'We pick up sticks from the wet grass.',
    'She turns off the light and goes to sleep.',
    'He plants seeds in the warm dark earth.'
  ];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function setRandomSentences() {
    var upEl = document.querySelector('.up-text');
    if (upEl) upEl.textContent = pickRandom(COMPLEX_SENTENCES);

    var downEl = document.querySelector('.down-text');
    if (downEl) downEl.textContent = pickRandom(SIMPLE_SENTENCES);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setRandomSentences);
  } else {
    setRandomSentences();
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

  // Thin black scratch lines drawn on top of the UP text
  const SCRATCH_COUNT        = 12;  // lines per repaint
  const SCRATCH_INTERVAL_MS  = 2400; // refresh slower so the effect is subtle

  let noiseTimer = null;
  let scratchTimer = null;
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

  // Draw thin black lines that span across the canvas, partially obscuring the
  // UP text beneath.  Lines are long enough to cross the text at random angles.
  function drawScratchLines(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    const diagonal = Math.sqrt(w * w + h * h);
    for (let i = 0; i < SCRATCH_COUNT; i++) {
      // Anchor the line at a random point near the centre of the canvas
      const cx = (Math.random() * 0.6 + 0.2) * w;
      const cy = (Math.random() * 0.6 + 0.2) * h;
      const angle = Math.random() * Math.PI; // 0–180° covers all orientations
      const halfLen = (Math.random() * 0.3 + 0.5) * diagonal;
      const x1 = cx - Math.cos(angle) * halfLen;
      const y1 = cy - Math.sin(angle) * halfLen;
      const x2 = cx + Math.cos(angle) * halfLen;
      const y2 = cy + Math.sin(angle) * halfLen;

      ctx.save();
      ctx.globalAlpha = Math.random() * 0.20 + 0.12; // 0.12–0.32, subtle
      ctx.strokeStyle = '#000';
      ctx.lineWidth = Math.random() * 0.8 + 0.4;     // 0.4–1.2 px, thin
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
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
    if (scratchTimer !== null) {
      clearInterval(scratchTimer);
      scratchTimer = null;
    }
    if (resizeTimer !== null) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
  }

  function start() {
    const canvas = document.getElementById('up-noise-canvas');
    const linesCanvas = document.getElementById('up-lines-canvas');
    if (!canvas) return;

    // Clean up any previous instance
    stop();

    sizeCanvas(canvas);
    drawNoise(canvas);

    // Redraw on a timer for a constantly-shifting noise field
    noiseTimer = setInterval(function () {
      drawNoise(canvas);
    }, NOISE_INTERVAL_MS);

    // Scratch lines canvas — size and draw if present
    if (linesCanvas) {
      sizeCanvas(linesCanvas);
      drawScratchLines(linesCanvas);

      scratchTimer = setInterval(function () {
        drawScratchLines(linesCanvas);
      }, SCRATCH_INTERVAL_MS);
    }

    // Debounced resize handler
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        sizeCanvas(canvas);
        if (linesCanvas) sizeCanvas(linesCanvas);
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
