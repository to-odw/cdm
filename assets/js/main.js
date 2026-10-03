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
  function setActive() {
    var current = null;
    var y = window.scrollY + header.offsetHeight + 40;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= y) current = ids[i]; });
    links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + current); });
  }
  window.addEventListener("scroll", setActive, { passive: true });
  setActive();

  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
