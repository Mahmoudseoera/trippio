
(() => {
    const section = document.getElementById('tour-tabs');
    if (!section) return;

    const tabs = [...section.querySelectorAll('[role="tab"]')];
    const panels = [...section.querySelectorAll('[role="tabpanel"]')];

    function activate(tab, { focus = false } = {}) {
        tabs.forEach(t => {
            const on = t === tab;
            t.setAttribute('aria-selected', on);
            t.tabIndex = on ? 0 : -1;
        });
        panels.forEach(p => { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
        if (focus) tab.focus();

        // If the user is scrolled inside the section, bring the new list back to the top
        const top = section.getBoundingClientRect().top;
        if (top < 0) section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }

    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => activate(tab));
        tab.addEventListener('keydown', e => {
            const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
            if (e.key in keys) {
                e.preventDefault();
                activate(tabs[(i + keys[e.key] + tabs.length) % tabs.length], { focus: true });
            }
            if (e.key === 'Home') { e.preventDefault(); activate(tabs[0], { focus: true }); }
            if (e.key === 'End')  { e.preventDefault(); activate(tabs[tabs.length - 1], { focus: true }); }
        });
    });

    const layout = matchMedia('(max-width: 860px)');
    const tablist = section.querySelector('[role="tablist"]');
    const orient = () => tablist.setAttribute('aria-orientation', layout.matches ? 'horizontal' : 'vertical');
    orient();
    layout.addEventListener('change', orient);

    // Optional deep link: /page#tours=cruises
    const m = location.hash.match(/tours=(\w+)/);
    const target = m && tabs.find(t => t.id === 'tab-' + m[1]);
    if (target) activate(target);
})();
