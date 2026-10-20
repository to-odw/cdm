(function () {
  var form = document.querySelector(".paper-search");
  if (!form) return;
  var input = form.querySelector("input");
  var grid = document.querySelector(".paper-grid");
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".paper-card"));
  var count = document.querySelector(".paper-count");
  var empty = document.querySelector(".paper-empty");

  function tokensOf(query) {
    return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  // Smallest window whose characters cover the query in order.
  // Extra skipped characters are allowed, but only a few — a match
  // scattered across a paragraph is not a match.
  function bestMatch(text, token) {
    var hay = text.toLowerCase();
    var at = hay.indexOf(token);
    if (at >= 0) return [[at, at + token.length]];
    var allowance = Math.max(1, Math.round(token.length * 0.4));
    var best = null;
    var bestSpan = Infinity;
    for (var i = 0; i < hay.length; i++) {
      if (hay.charAt(i) !== token.charAt(0)) continue;
      var positions = [i];
      var n = 1;
      for (var j = i + 1; j < hay.length && n < token.length; j++) {
        if (j - i > token.length - 1 + allowance) break;
        if (hay.charAt(j) === token.charAt(n)) {
          positions.push(j);
          n++;
        }
      }
      if (n < token.length) continue;
      var span = positions[positions.length - 1] - positions[0];
      if (span - (token.length - 1) > allowance) continue;
      if (span < bestSpan) {
        bestSpan = span;
        best = positions;
      }
    }
    if (!best) return null;
    var ranges = [];
    var start = best[0];
    var prev = best[0];
    for (var k = 1; k < best.length; k++) {
      if (best[k] === prev + 1) prev = best[k];
      else {
        ranges.push([start, prev + 1]);
        start = prev = best[k];
      }
    }
    ranges.push([start, prev + 1]);
    return ranges;
  }

  function merge(ranges) {
    if (!ranges.length) return [];
    ranges.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var out = [ranges[0].slice()];
    for (var i = 1; i < ranges.length; i++) {
      var last = out[out.length - 1];
      if (ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
      else out.push(ranges[i].slice());
    }
    return out;
  }

  function paint(el, text, ranges) {
    el.replaceChildren();
    if (!ranges.length) {
      el.textContent = text;
      return;
    }
    var cursor = 0;
    ranges.forEach(function (r) {
      if (r[0] > cursor) el.appendChild(document.createTextNode(text.slice(cursor, r[0])));
      var mark = document.createElement("mark");
      mark.className = "hit";
      mark.textContent = text.slice(r[0], r[1]);
      el.appendChild(mark);
      cursor = r[1];
    });
    if (cursor < text.length) el.appendChild(document.createTextNode(text.slice(cursor)));
  }

  function fields(article) {
    return article.querySelectorAll("[data-field]");
  }

  function raw(el) {
    if (!el.dataset.raw) el.dataset.raw = el.textContent;
    return el.dataset.raw;
  }

  function apply(query) {
    var tokens = tokensOf(query);
    var shown = 0;
    cards.forEach(function (card) {
      var matched = !tokens.length || tokens.every(function (token) {
        return Array.prototype.some.call(fields(card), function (el) {
          return bestMatch(raw(el), token);
        });
      });
      card.hidden = !matched;
      if (matched) shown++;
      fields(card).forEach(function (el) {
        var text = raw(el);
        var ranges = [];
        if (matched) {
          tokens.forEach(function (token) {
            var found = bestMatch(text, token);
            if (found) ranges = ranges.concat(found);
          });
        }
        paint(el, text, merge(ranges));
      });
    });
    grid.classList.toggle("is-searching", tokens.length > 0);
    empty.hidden = shown > 0;
    count.textContent = tokens.length
      ? shown + (shown === 1 ? " match" : " matches")
      : cards.length + " publications";
  }

  input.addEventListener("input", function () { apply(input.value); });
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  apply("");
})();
