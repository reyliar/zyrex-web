(function () {
    'use strict';

    var doc = document.querySelector('.lp-doc');
    var progress = document.querySelector('.lp-progress');
    if (!doc) return;

    var links = Array.prototype.slice.call(document.querySelectorAll('.lp-toc a'));
    var sections = links
        .map(function (link) { return document.querySelector(link.getAttribute('href')); })
        .filter(Boolean);

    function activate(id) {
        links.forEach(function (link) {
            link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
    }

    var ticking = false;

    function update() {
        ticking = false;

        var rect = doc.getBoundingClientRect();
        var total = rect.height - window.innerHeight;
        var passed = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
        if (progress) progress.style.transform = 'scaleX(' + (total > 0 ? passed / total : 0) + ')';

        if (!sections.length) return;
        var current = sections[0];
        for (var i = 0; i < sections.length; i++) {
            if (sections[i].getBoundingClientRect().top <= 170) current = sections[i];
        }
        activate(current.id);
    }

    function onScroll() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
})();
