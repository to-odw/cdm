(function () {
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".menu-toggle");

  // Header shadow once the page scrolls
  function onScroll() { header.classList.toggle("scrolled", window.scrollY > 10); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile menu
  toggle.addEventListener("click", function () {
    var open = header.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll(".mobile-nav a").forEach(function (a) {
    a.addEventListener("click", function () {
      header.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  // "Show more publications"
  document.querySelectorAll("[data-toggle-more]").forEach(function (btn) {
    var list = document.getElementById(btn.getAttribute("data-toggle-more"));
    btn.addEventListener("click", function () {
      var expanded = list.classList.toggle("expanded");
      btn.setAttribute("aria-expanded", String(expanded));
      btn.textContent = expanded ? "Show fewer publications" : "Show more publications";
    });
  });

  // Highlight the nav link for the section in view
  var links = document.querySelectorAll(".nav-links a, .mobile-nav a");
  var ids = ["our-work", "research", "programmes", "newsletter", "about"];
  var sections = ids.map(function (id) { return document.getElementById(id); });
  var pageNav = document.body.getAttribute("data-nav");
  function setActive() {
    if (pageNav) {
      links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === pageNav); });
      return;
    }
    var current = null;
    var y = window.scrollY + header.offsetHeight + 40;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= y) current = ids[i]; });
    links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + current); });
  }
  window.addEventListener("scroll", setActive, { passive: true });
  setActive();

  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  document.querySelectorAll(".photo-slider").forEach(function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll(".slide"));
    var dots = Array.prototype.slice.call(root.querySelectorAll(".slider-dots button"));
    var caption = root.querySelector(".slider-caption");
    var index = 0;
    var timer = null;

    function show(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, i) { slide.hidden = i !== index; });
      dots.forEach(function (dot, i) { dot.setAttribute("aria-current", String(i === index)); });
      var current = slides[index];
      if (caption && current) caption.innerHTML = current.getAttribute("data-caption") || "";
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      timer = setInterval(function () { show(index + 1); }, 6000);
    }

    root.querySelector(".slider-prev").addEventListener("click", function () { show(index - 1); start(); });
    root.querySelector(".slider-next").addEventListener("click", function () { show(index + 1); start(); });
    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () { show(i); start(); });
    });
    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", start);

    var startX = null;
    root.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    root.addEventListener("pointerup", function (e) {
      if (startX == null) return;
      var delta = e.clientX - startX;
      if (Math.abs(delta) > 40) show(index + (delta < 0 ? 1 : -1));
      startX = null;
      start();
    });

    show(0);
    start();
  });
})();
