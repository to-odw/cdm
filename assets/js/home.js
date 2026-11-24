(function () {
  var media = document.querySelector(".opening-media");
  if (!media) return;
  var frames = Array.prototype.slice.call(media.querySelectorAll("img"));
  if (frames.length < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var index = 0;
  var timer = null;

  function show(next) {
    index = next;
    frames.forEach(function (img, i) {
      img.classList.toggle("is-shown", i === index);
    });
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    timer = setInterval(function () {
      show((index + 1) % frames.length);
    }, 5500);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  start();
})();

/* Programme cards rise in from the left once scrolling brings them up. */
(function () {
  var band = document.querySelector(".programmes-band");
  if (!band) return;
  var cards = Array.prototype.slice.call(band.querySelectorAll(".programme-card"));
  if (!cards.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  function reveal() {
    cards.forEach(function (card) { card.classList.add("is-in"); });
  }

  if (!("IntersectionObserver" in window)) {
    reveal();
    return;
  }

  var done = false;
  function finish() {
    if (done) return;
    done = true;
    reveal();
    io.disconnect();
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      finish();
    });
  }, { threshold: 0.2 });

  io.observe(band);

  var rect = band.getBoundingClientRect();
  var visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  if (visible > 0) finish();

  band.addEventListener("focusin", finish);
})();
