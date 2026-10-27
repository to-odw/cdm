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
