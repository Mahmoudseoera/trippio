window.onload = function () {
  // Back to Top
  let progressPath = document.getElementById("progress-path");
  let progressWrap = document.getElementById("progress-wrap");
  let pathLength = progressPath.getTotalLength();
  progressPath.style.transition = progressPath.style.webkitTransition = "none";
  progressPath.style.strokeDasharray = pathLength + " " + pathLength;
  progressPath.style.strokeDashoffset = pathLength;
  progressPath.getBoundingClientRect();
  progressPath.style.transition = progressPath.style.webkitTransition =
    "stroke-dashoffset 10ms linear";

  const onScollEvent = function (event) {
    let scroll = window.scrollY;
    let height = document.body.scrollHeight - window.innerHeight;
    let progress = pathLength - (scroll * pathLength) / height;
    progressPath.style.strokeDashoffset = progress;

    let offset = 50;
    if (window.scrollY > offset) {
      progressWrap.classList.add("active-progress");
    } else {
      progressWrap.classList.remove("active-progress");
    }
  };

  onScollEvent();
  window.onscroll = onScollEvent;
  progressWrap.onclick = function (event) {
    window.scroll({ top: 0, behavior: "smooth" });
    return false;
  };
};
(() => {

})();

// Start flatpickr init  //
document.querySelectorAll("input[type='date']").forEach(function (input) {
  flatpickr(input, {
    minDate: "today"
  });
});

  document.addEventListener('DOMContentLoaded', () => {

      // Header: switch from floating transparent-over-hero to a solid fixed bar on scroll
      const headerWrap = document.getElementById('headerWrap');
      if (headerWrap) {
        const toggleHeaderFixed = () => {
          if (window.scrollY > 80) {
            headerWrap.classList.add('is-fixed');
          } else {
            headerWrap.classList.remove('is-fixed');
          }
        };
        toggleHeaderFixed();
        window.addEventListener('scroll', toggleHeaderFixed, { passive: true });
      }

  //* ── NAVBAR scroll ── *//


      // Mobile menu: open/close + Viator-style drill-down into subcategories
      const mobileMenu = document.getElementById('mobileMenu');
      const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
      const burgerBtn = document.getElementById('burgerBtn');
      const mobileMenuClose = document.getElementById('mobileMenuClose');
      const mobileMenuBack = document.getElementById('mobileMenuBack');
      const mobileSubpanels = document.querySelectorAll('.mobile-menu__subpanel');
      const mobileDropdownToggles = document.querySelectorAll('.mobile-menu__dropdown-toggle');

      function closeMobileDropdowns(exceptToggle) {
        mobileDropdownToggles.forEach(toggle => {
          if (toggle === exceptToggle) return;
          const menu = document.getElementById(toggle.getAttribute('aria-controls'));
          toggle.setAttribute('aria-expanded', 'false');
          toggle.closest('.mobile-menu__dropdown')?.classList.remove('is-open');
          if (menu) menu.hidden = true;
        });
      }

      function openMobileMenu() {
        mobileMenu.classList.add('is-open');
        mobileMenuOverlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      }
      function closeMobileMenu() {
        mobileMenu.classList.remove('is-open');
        mobileMenuOverlay.classList.remove('is-open');
        mobileMenu.classList.remove('is-drilled');
        closeMobileDropdowns();
        document.body.style.overflow = '';
      }

      if (burgerBtn) burgerBtn.addEventListener('click', openMobileMenu);
      if (mobileMenuClose) mobileMenuClose.addEventListener('click', closeMobileMenu);
      if (mobileMenuOverlay) mobileMenuOverlay.addEventListener('click', closeMobileMenu);

      mobileDropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
          const menu = document.getElementById(toggle.getAttribute('aria-controls'));
          if (!menu) return;

          const willOpen = toggle.getAttribute('aria-expanded') !== 'true';
          closeMobileDropdowns(willOpen ? toggle : null);
          toggle.setAttribute('aria-expanded', String(willOpen));
          toggle.closest('.mobile-menu__dropdown')?.classList.toggle('is-open', willOpen);
          menu.hidden = !willOpen;
        });
      });

      document.querySelectorAll('.mobile-menu__dropdown-menu [data-value]').forEach(option => {
        option.addEventListener('click', () => {
          const dropdown = option.closest('.mobile-menu__dropdown');
          const toggle = dropdown?.querySelector('.mobile-menu__dropdown-toggle');
          const currentValue = toggle?.querySelector('.mobile-menu__current-value');
          if (currentValue) currentValue.textContent = option.dataset.value;
          closeMobileDropdowns();
        });
      });


      // Arrow click drills into subcategories; the category name link still navigates normally
      document.querySelectorAll('.mobile-menu__cat-arrow').forEach(arrow => {
        arrow.addEventListener('click', () => {
          const row = arrow.closest('.mobile-menu__cat-row');
          const key = row.getAttribute('data-cat');
          const panel = document.querySelector(`.mobile-menu__subpanel[data-subpanel="${key}"]`);
          if (!panel) return;

          mobileSubpanels.forEach(p => p.classList.remove('is-active'));
          panel.classList.add('is-active');

          mobileMenu.classList.add('is-drilled');
        });
      });

      if (mobileMenuBack) {
        mobileMenuBack.addEventListener('click', () => {
          mobileMenu.classList.remove('is-drilled');
        });
      }
});
  
document.getElementById("year").textContent = new Date().getFullYear();

document.addEventListener("DOMContentLoaded", function () {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});


document.addEventListener("DOMContentLoaded", function () {
  const faqItems = document.querySelectorAll(".faq-item");
  const toggleBtn = document.querySelector(".BrandName-faq-toggle-btn");
  const ctaLink = document.querySelector(".BrandName-faq-cta-link");

  if (!faqItems.length || !ctaLink) return;

  const step = 5;
  let visibleCount = step;

  if (faqItems.length <= step) {
    if (toggleBtn) toggleBtn.style.display = "none";
    ctaLink.style.display = "inline-flex";
    return;
  }

  faqItems.forEach((item, index) => {
    item.style.display = index < visibleCount ? "block" : "none";
  });

  toggleBtn.addEventListener("click", () => {
    const isExpanded = toggleBtn.classList.contains("expanded");

    if (!isExpanded) {
      visibleCount += step;

      faqItems.forEach((item, index) => {
        if (index < visibleCount) {
          item.style.display = "block";
        }
      });

      if (visibleCount >= faqItems.length) {
        toggleBtn.textContent = "Show Less ↑";
        toggleBtn.classList.add("expanded");

        ctaLink.style.display = "inline-flex";
        ctaLink.style.marginLeft = "10px";
      }

    } else {
      visibleCount = step;

      faqItems.forEach((item, index) => {
        item.style.display = index < visibleCount ? "block" : "none";
      });

      toggleBtn.textContent = "Show More ↓";
      toggleBtn.classList.remove("expanded");

      ctaLink.style.display = "none";
    }
  });

  ctaLink.style.display = "none";


  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});
/* =========================================================
   Reusable Show More / Show Less (character-length based)
   -----------------------------------------------------------
   Usage: add class="js-readmore" to any element (a <p>, a
   section description, card content, etc). Optionally set
   data-max-length="180" (defaults to 220 characters).
   If the text is shorter than the limit, nothing happens —
   no button is added. Safe to call again for content that
   gets injected later (AJAX, tabs, etc): initShowMore(scopeEl)
========================================================= */
function initShowMore(root) {
  root = root || document;
  var DEFAULT_MAX_LENGTH = 220;

  root.querySelectorAll('.js-readmore:not(.is-readmore-ready)').forEach(function (el) {
    el.classList.add('is-readmore-ready');

    var maxLength = parseInt(el.getAttribute('data-max-length'), 10) || DEFAULT_MAX_LENGTH;
    var fullText = el.textContent.trim();

    if (fullText.length <= maxLength) return;

    var cut = fullText.slice(0, maxLength);
    var lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > 0) cut = cut.slice(0, lastSpace);
    var shortText = cut.trim() + '…';

    var textSpan = document.createElement('p');
    textSpan.className = 'js-readmore-text';
    textSpan.textContent = shortText;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'js-readmore-btn';
    btn.innerHTML = 'Show More <i class="fa-solid fa-chevron-down"></i>';

    btn.addEventListener('click', function () {
      var expanded = el.classList.toggle('is-expanded');
      textSpan.textContent = expanded ? fullText : shortText;
      btn.innerHTML = expanded
        ? 'Show Less <i class="fa-solid fa-chevron-up"></i>'
        : 'Show More <i class="fa-solid fa-chevron-down"></i>';
    });

    el.textContent = '';
    el.appendChild(textSpan);
    el.appendChild(document.createTextNode(' '));
    el.appendChild(btn);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initShowMore();
});

// Let desktop users drag horizontally anywhere inside the partners banner.
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.partners-banner').forEach(function (banner) {
    var startX = 0;
    var startScrollLeft = 0;
    var activePointerId = null;

    banner.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;

      event.preventDefault();
      activePointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = banner.scrollLeft;
      banner.classList.add('is-dragging');
      banner.setPointerCapture(activePointerId);
    });

    banner.addEventListener('pointermove', function (event) {
      if (event.pointerId !== activePointerId) return;

      event.preventDefault();
      banner.scrollLeft = startScrollLeft - (event.clientX - startX);
    });

    function stopDragging(event) {
      if (event.pointerId !== activePointerId) return;

      banner.classList.remove('is-dragging');
      if (banner.hasPointerCapture(activePointerId)) {
        banner.releasePointerCapture(activePointerId);
      }
      activePointerId = null;
    }

    banner.addEventListener('pointerup', stopDragging);
    banner.addEventListener('pointercancel', stopDragging);

    banner.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      event.preventDefault();
      banner.scrollBy({
        left: event.key === 'ArrowRight' ? 180 : -180,
        behavior: 'smooth'
      });
    });
  });
});


// Sliding hover indicator on main nav
  const mainNav = document.getElementById('mainNav');

  if (mainNav) {
    const navItems = [...mainNav.children].filter(item => item.matches('li'));
    const homeItem = mainNav.querySelector('.nav-link.is-active')?.closest('li') || navItems[0];
    let currentItem = homeItem;

    function moveIndicator(item) {
      const link = item?.querySelector(':scope > .nav-link');
      if (!link) return;

      const navRect = mainNav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();

      mainNav.style.setProperty('--indicator-width', `${linkRect.width}px`);
      mainNav.style.setProperty('--indicator-x', `${linkRect.left - navRect.left}px`);
    }

    function initialiseIndicator() {
      if (!homeItem) return;
      currentItem = homeItem;
      moveIndicator(homeItem);
    }

    navItems.forEach(item => {
      item.addEventListener('mouseenter', () => {
        currentItem = item;
        moveIndicator(item);
      });
    });

    // On mouse leave, return to Home instead of hiding
    mainNav.addEventListener('mouseleave', () => {
      currentItem = homeItem;
      moveIndicator(homeItem);
    });

    // Keep the indicator aligned without reactivating or moving any nav item.
    window.addEventListener('resize', () => {
      moveIndicator(currentItem || homeItem);
    });

    requestAnimationFrame(initialiseIndicator);
    document.fonts?.ready.then(() => moveIndicator(currentItem || homeItem));
  }

