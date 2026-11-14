// Posts are written in a small markdown subset, so the feed, the profile timeline and
// the single post page have to format them with the same rules. Raw text goes in; the
// output is already-escaped HTML that the caller can drop into the page.
(function () {
  'use strict';
  // Placeholders keep finished markup away from the emphasis and autolink passes.
  var SLOT = '\u0000';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Mirrors and admin tools can hand us text that was escaped upstream, which would
  // otherwise print as a literal "&#39;". One decode pass happens before `esc` runs,
  // so the escaping still neutralises anything that gets decoded.
  var NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

  function decode(value) {
    return String(value == null ? '' : value).replace(/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});/g, function (match, body) {
      if (body.charAt(0) === '#') {
        var hex = body.charAt(1).toLowerCase() === 'x';
        var code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        if (!isFinite(code) || code <= 0 || code > 0x10ffff) return match;
        try { return String.fromCodePoint(code); } catch (error) { return match; }
      }
      var named = NAMED[body.toLowerCase()];
      return named === undefined ? match : named;
    });
  }

  // `href`/`url` reach this point already escaped by the caller.
  function anchorRaw(urlEscaped, labelHtml) {
    return '<a class="pf-post-link" href="' + urlEscaped + '" target="_blank" rel="noopener nofollow ugc">' + labelHtml + '</a>';
  }

  function trimUrl(raw) {
    var url = raw, tail = '';
    var punctuation = /[.,;:!?]+$/.exec(url);
    if (punctuation) { tail = punctuation[0]; url = url.slice(0, -tail.length); }
    while (url.slice(-1) === ')' && url.indexOf('(') === -1) { tail = ')' + tail; url = url.slice(0, -1); }
    return { url: url, tail: tail };
  }

  function autolink(html) {
    return html.replace(/https?:\/\/[^\s<>\u0000"']+/gi, function (raw) {
      var parts = trimUrl(raw);
      if (!/^https?:\/\/[^/?#]+/i.test(parts.url)) return raw;
      return anchorRaw(parts.url, parts.url) + parts.tail;
    });
  }

  function emphasis(html) {
    return html
      .replace(/\*\*([^*\n]{1,500})\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^\w_])__([^_\n]{1,500})__(?![\w_])/g, '$1<strong>$2</strong>')
      .replace(/(^|[^*\w])\*([^*\n]{1,500})\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^\w_])_([^_\n]{1,500})_(?![\w_])/g, '$1<em>$2</em>')
      .replace(/~~([^~\n]{1,500})~~/g, '<del>$1</del>');
  }

  // One line of text: code spans, markdown links, mentions/hashtags, emphasis and
  // bare URLs. `decorate` receives escaped plain text and may add anchors of its own.
  function inline(raw, decorate) {
    var slots = [];
    var text = decode(raw);
    function keep(html) { slots.push(html); return SLOT + (slots.length - 1) + SLOT; }
    text = text.replace(/`([^`\n]{1,400})`/g, function (_, code) { return keep('<code>' + esc(code) + '</code>'); });
    text = text.replace(/\[([^\]\n]{1,300})\]\((https?:\/\/[^\s)]{1,600})\)/gi, function (_, label, url) {
      return keep(anchorRaw(esc(url), esc(label)));
    });
    var html = esc(text);
    if (typeof decorate === 'function') html = decorate(html);
    html = autolink(emphasis(html));
    return html.replace(new RegExp(SLOT + '(\\d+)' + SLOT, 'g'), function (_, index) { return slots[Number(index)] || ''; });
  }

  // Blocks are handled line by line: fenced code, headings, quotes, lists and rules,
  // with everything else keeping its line breaks.
  function blocks(raw, decorate) {
    var lines = decode(raw).replace(/\r\n?/g, '\n').split('\n');
    var out = [], list = null;
    function closeList() { if (list) { out.push('</' + list + '>'); list = null; } }
    for (var index = 0; index < lines.length; index += 1) {
      var line = lines[index];
      if (/^\s*```/.test(line)) {
        var code = [], cursor = index + 1;
        while (cursor < lines.length && !/^\s*```\s*$/.test(lines[cursor])) { code.push(lines[cursor]); cursor += 1; }
        closeList();
        out.push('<pre class="pf-code"><code>' + esc(code.join('\n')) + '</code></pre>');
        index = cursor;
        continue;
      }
      if (!line.trim()) { closeList(); out.push('<br>'); continue; }
      var heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
      if (heading) {
        closeList();
        out.push('<strong class="pf-post-heading">' + inline(heading[1], decorate) + '</strong><br>');
        continue;
      }
      if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { closeList(); out.push('<hr class="pf-post-rule">'); continue; }
      if (/^\s*>/.test(line)) {
        closeList();
        var quoted = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) {
          quoted.push(inline(lines[index].replace(/^\s*>\s?/, ''), decorate));
          index += 1;
        }
        index -= 1;
        out.push('<blockquote class="pf-post-quote">' + quoted.join('<br>') + '</blockquote>');
        continue;
      }
      var bullet = /^\s{0,3}[-*+]\s+(.*)$/.exec(line);
      var numbered = /^\s{0,3}\d{1,3}[.)]\s+(.*)$/.exec(line);
      if (bullet || numbered) {
        var kind = bullet ? 'ul' : 'ol';
        if (list !== kind) { closeList(); out.push('<' + kind + ' class="pf-post-list">'); list = kind; }
        out.push('<li>' + inline((bullet || numbered)[1], decorate) + '</li>');
        continue;
      }
      closeList();
      out.push(inline(line, decorate) + '<br>');
    }
    closeList();
    return out.join('').replace(/(?:<br>)+$/, '');
  }

  window.ZyrexPostFormat = { esc: esc, inline: inline, blocks: blocks };
})();
