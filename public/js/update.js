/* =====================================================
   UPDATE.JS — Extra UI Features
   1. Balance badge in topbar (auto-update)
   2. Count-up animation for metric cards
   3. "Today" button in calendar
   4. Reset filter one-click in History
   5. Pull to refresh (mobile)
   6. Login enhancements (PIN dots, typing effect, etc.)
   ===================================================== */

/* ══════════════════════════════════════════════════════
   FEATURE 1 — BALANCE BADGE IN TOPBAR
   Shows current month's total balance in topbar corner,
   auto-updates whenever dashboard is rendered.
   ══════════════════════════════════════════════════════ */

(function patchTopbarBadge() {
  /* Inject badge HTML into topbar after DOM is ready */
  function injectBadge() {
    const topbarRight = document.querySelector('.topbar > div:last-child');
    if (!topbarRight || document.getElementById('topbar-balance-badge')) return;

    const badge = document.createElement('div');
    badge.id = 'topbar-balance-badge';
    badge.className = 'topbar-balance-badge';
    badge.title = 'Total saldo bulan ini (klik untuk ke Dashboard)';
    badge.setAttribute('role', 'button');
    badge.onclick = () => {
      const dashBtn = document.querySelector('.nav-btn');
      if (dashBtn) { showPage('dashboard', dashBtn); syncBottomNav && syncBottomNav('dashboard'); }
    };
    badge.innerHTML = `
      <span class="tbb-icon">💰</span>
      <span class="tbb-label">Saldo</span>
      <span class="tbb-val positive" id="tbb-val">—</span>
    `;

    /* Insert before theme-toggle button */
    const themeBtn = topbarRight.querySelector('.theme-toggle');
    if (themeBtn) topbarRight.insertBefore(badge, themeBtn);
    else topbarRight.prepend(badge);
  }

  /* Calculate & display current balance */
  window.updateTopbarBalance = function () {
    const valEl = document.getElementById('tbb-val');
    if (!valEl) return;

    const now = new Date();
    const txM = (window.transactions || []).filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    // Exclude savings wallet to avoid double-counting deposits/withdrawals
    const income  = txM.filter(t => t.type === 'in'  && t.wallet !== 'tabungan').reduce((s, t) => s + t.amount, 0);
    const expense = txM.filter(t => t.type === 'out' && t.wallet !== 'tabungan').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    const newText  = (balance >= 0 ? '+' : '-') + fmtShort(Math.abs(balance));
    const newClass = balance >= 0 ? 'tbb-val positive' : 'tbb-val negative';

    if (valEl.textContent !== newText) {
      valEl.className = newClass + ' pulse-anim';
      valEl.textContent = newText;
      setTimeout(() => valEl.classList.remove('pulse-anim'), 400);
    } else {
      valEl.className = newClass;
    }
  };

  /* Patch renderDashboard to also update badge */
  const _origRenderDashboard = window.renderDashboard;
  window.renderDashboard = function () {
    _origRenderDashboard && _origRenderDashboard.apply(this, arguments);
    injectBadge();
    window.updateTopbarBalance();
  };

  /* Patch addTransaction, saveEdit, deleteTx for real-time balance update */
  ['addTransaction', 'saveEdit', 'deleteTx'].forEach(fnName => {
    const orig = window[fnName];
    if (!orig) return;
    window[fnName] = async function () {
      const result = await orig.apply(this, arguments);
      window.updateTopbarBalance();
      return result;
    };
  });

  /* Fallback: inject badge once after login */
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(injectBadge, 1200);
  });
})();


/* ══════════════════════════════════════════════════════
   FEATURE 2 — COUNT-UP ANIMATION FOR METRIC CARDS
   Each time metric cards are rendered, numbers count up
   from 0 to target value over 600ms.
   ══════════════════════════════════════════════════════ */

(function patchCountUp() {
  /* Easing: ease-out cubic */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* Animate a single metric-value element */
  function animateMetricValue(el, targetNum) {
    /* Add slide animation class */
    el.classList.add('count-up-anim');
    setTimeout(() => el.classList.remove('count-up-anim'), 450);

    const dur    = 600;       // ms
    const start  = performance.now();
    const origText = el.textContent;  // preserve original text format
    const origHTML = el.innerHTML;    // preserve markup (e.g. .metric-currency span) for final restore

    /* Detect format: jt (million) / rb (thousand) / plain */
    const isMillion = origText.includes('jt');
    const isThousand = origText.includes('rb');

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / dur, 1);
      const val = targetNum * easeOut(progress);

      /* Format according to scale */
      if (isMillion)       el.textContent = 'Rp ' + (val / 1_000_000).toFixed(1) + 'jt';
      else if (isThousand) el.textContent = 'Rp ' + (val / 1_000).toFixed(0) + 'rb';
      else                 el.textContent = 'Rp ' + Math.round(val).toLocaleString('id-ID');

      if (progress < 1) requestAnimationFrame(tick);
      else el.innerHTML = origHTML; // restore exact markup (keeps .metric-currency span)
    }
    requestAnimationFrame(tick);
  }

  /* Extract number from fmtShort text */
  function parseMetricNumber(text) {
    const clean = text.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
    const num   = parseFloat(clean) || 0;
    if (text.includes('jt')) return num * 1_000_000;
    if (text.includes('rb')) return num * 1_000;
    return num;
  }

  /* Patch renderDashboard: after render, animate all .metric-value */
  const _orig = window.renderDashboard;
  window.renderDashboard = function () {
    _orig && _orig.apply(this, arguments);

    /* Wait for DOM update, then animate */
    requestAnimationFrame(() => {
      document.querySelectorAll('#metrics .metric-value').forEach(el => {
        const target = parseMetricNumber(el.textContent);
        if (target > 0) animateMetricValue(el, target);
      });
    });
  };
})();


/* ══════════════════════════════════════════════════════
   FEATURE 3 — "TODAY" BUTTON IN CALENDAR
   Appears in cal-header whenever user navigates to a
   different month. Automatically hides when on current month.
   ══════════════════════════════════════════════════════ */

(function patchCalTodayButton() {
  const _origRenderKalender = window.renderKalender;

  window.renderKalender = function () {
    _origRenderKalender && _origRenderKalender.apply(this, arguments);

    /* Check if viewing a different month
       Fallback to current month/year if calMonth/calYear not set */
    const now  = new Date();
    const nowM = now.getMonth();
    const nowY = now.getFullYear();
    const cm   = (window.calMonth !== undefined && window.calMonth !== null) ? window.calMonth : nowM;
    const cy   = (window.calYear  !== undefined && window.calYear  !== null) ? window.calYear  : nowY;
    const isCurrentMonth = (cm === nowM && cy === nowY);

    const header = document.querySelector('.cal-header');
    if (!header) return;

    /* Remove old button if exists */
    const existing = header.querySelector('.cal-today-btn');
    if (existing) existing.remove();

    /* If not current month, inject button */
    if (!isCurrentMonth) {
      const btn = document.createElement('button');
      btn.className = 'cal-today-btn';
      btn.title = 'Kembali ke bulan ini';
      btn.innerHTML = '📍 Hari Ini';
      btn.onclick = function () {
        window.calYear  = now.getFullYear();
        window.calMonth = now.getMonth();
        renderKalender();
        /* Auto-click today's date */
        setTimeout(() => {
          const todayStr = now.toISOString().split('T')[0];
          if (typeof showCalDetail === 'function') showCalDetail(todayStr);
        }, 100);
      };
      /* Insert in header (between prev button and label) */
      const label = header.querySelector('.cal-month-label');
      if (label) header.insertBefore(btn, label);
      else header.appendChild(btn);
    }
  };
})();


/* ══════════════════════════════════════════════════════
   FEATURE 4 — RESET FILTER ONE-CLICK IN HISTORY
   Red "Reset all filters ✕" button appears above the
   transaction list when any filter is active,
   auto-hides when all filters are cleared.
   ══════════════════════════════════════════════════════ */

(function patchResetFilterBar() {
  /* Inject container once on History page */
  function ensureResetBar() {
    if (document.getElementById('filter-reset-bar')) return;
    const histList = document.getElementById('history-list');
    if (!histList) return;

    const bar = document.createElement('div');
    bar.id = 'filter-reset-bar';
    bar.className = 'filter-reset-bar';
    bar.innerHTML = `
      <button class="btn-reset-filters hidden" id="btn-reset-all-filters"
              onclick="clearAllFilters()" title="Reset semua filter sekaligus">
        🗑️ Reset semua filter
      </button>`;
    histList.parentElement.insertBefore(bar, histList);
  }

  /* Show/hide button based on filter state */
  function syncResetBar() {
    ensureResetBar();
    const btn = document.getElementById('btn-reset-all-filters');
    if (!btn) return;

    const hasSearch   = !!(document.getElementById('search-input')?.value);
    const hasMonth    = document.getElementById('fil-month-h')?.value !== 'all';
    const hasType     = document.getElementById('fil-type-h')?.value  !== 'all';
    const hasCat      = document.getElementById('fil-cat-h')?.value   !== 'all';
    const hasWallet   = document.getElementById('fil-wallet-h')?.value !== 'all';
    const hasDateFrom = !!(document.getElementById('fil-date-from')?.value);
    const hasDateTo   = !!(document.getElementById('fil-date-to')?.value);

    const anyActive = hasSearch || hasMonth || hasType || hasCat || hasWallet || hasDateFrom || hasDateTo;
    btn.classList.toggle('hidden', !anyActive);
  }

  /* Patch renderHistory and renderFilterChips */
  const _origRenderHistory = window.renderHistory;
  window.renderHistory = function () {
    _origRenderHistory && _origRenderHistory.apply(this, arguments);
    syncResetBar();
  };

  const _origRenderFilterChips = window.renderFilterChips;
  window.renderFilterChips = function () {
    _origRenderFilterChips && _origRenderFilterChips.apply(this, arguments);
    syncResetBar();
  };

  /* Patch clearAllFilters to hide button after reset */
  const _origClearAll = window.clearAllFilters;
  window.clearAllFilters = function () {
    _origClearAll && _origClearAll.apply(this, arguments);
    syncResetBar();
  };
})();


/* ══════════════════════════════════════════════════════
   FEATURE 5 — PULL TO REFRESH
   Pull down on page to refresh data.
   Only active on mobile (touch devices).
   ══════════════════════════════════════════════════════ */

(function patchPullToRefresh() {
  let startY = 0;
  let currentY = 0;
  let pulling = false;
  let indicator = null;
  const THRESHOLD = 80;

  function createIndicator() {
    if (document.getElementById('ptr-indicator')) return;
    const el = document.createElement('div');
    el.id = 'ptr-indicator';
    el.className = 'ptr-indicator';
    el.innerHTML = '<span class="ptr-arrow">↓</span>';
    document.body.appendChild(el);
    indicator = el;
  }

  function canPull() {
    return window.scrollY <= 0;
  }

  function onTouchStart(e) {
    if (!canPull()) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }

  function onTouchMove(e) {
    if (!pulling) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    if (diff < 0) { pulling = false; return; }
    if (!canPull()) { pulling = false; return; }

    createIndicator();
    if (!indicator) return;

    const progress = Math.min(diff / THRESHOLD, 1);
    const translateY = Math.min(diff * 0.5, 60);

    indicator.style.transform = `translateX(-50%) translateY(${20 + translateY}px)`;
    indicator.style.opacity = progress;

    if (diff >= THRESHOLD) {
      indicator.classList.add('ready');
    } else {
      indicator.classList.remove('ready');
    }
  }

  function onTouchEnd() {
    if (!pulling) return;
    pulling = false;
    const diff = currentY - startY;

    if (diff >= THRESHOLD && indicator) {
      // Trigger refresh
      indicator.classList.remove('ready');
      indicator.classList.add('refreshing');
      indicator.innerHTML = '<div class="ptr-spinner"></div>';
      indicator.style.transform = 'translateX(-50%) translateY(80px)';
      indicator.style.opacity = '1';

      // Refresh data
      doRefresh().finally(() => {
        setTimeout(() => {
          if (indicator) {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateX(-50%) translateY(-60px)';
            indicator.classList.remove('refreshing');
            setTimeout(() => {
              if (indicator) indicator.innerHTML = '<span class="ptr-arrow">↓</span>';
            }, 300);
          }
        }, 600);
      });
    } else {
      // Cancel
      if (indicator) {
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateX(-50%) translateY(-60px)';
        indicator.classList.remove('ready');
      }
    }
  }

  async function doRefresh() {
    // Re-render current page
    try {
      if (typeof loadUserData === 'function') await loadUserData();
    } catch(e) { /* offline */ }

    if (typeof renderDashboard === 'function' && document.getElementById('page-dashboard')?.classList.contains('active')) {
      renderDashboard();
    }
    if (typeof renderHistory === 'function' && document.getElementById('page-riwayat')?.classList.contains('active')) {
      renderHistory();
    }
    if (typeof renderKalender === 'function' && document.getElementById('page-kalender')?.classList.contains('active')) {
      renderKalender();
    }
    if (typeof renderTabunganPage === 'function' && document.getElementById('page-tabungan')?.classList.contains('active')) {
      renderTabunganPage();
    }
    if (typeof renderTargets === 'function' && document.getElementById('page-target')?.classList.contains('active')) {
      renderTargets();
    }
    if (typeof window.updateTopbarBalance === 'function') window.updateTopbarBalance();
  }

  // Only enable on touch devices
  if ('ontouchstart' in window) {
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
  }
})();


/* ══════════════════════════════════════════════════════
   FEATURE 6 — LOGIN ENHANCEMENTS
   1. PIN dots visual
   2. Typing effect headline
   3. Floating orbs
   4. Success transition
   ══════════════════════════════════════════════════════ */

/* --- PIN DOTS --- */
window.updatePinDots = function() {
  const input = document.getElementById('pin-input');
  const dots = document.querySelectorAll('.pin-dot');
  if (!input || !dots.length) return;
  const len = input.value.length;
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < len);
  });
};

// Click on dots focuses the hidden input
document.addEventListener('DOMContentLoaded', () => {
  const dotsWrap = document.getElementById('pin-dots');
  const pinInput = document.getElementById('pin-input');
  if (dotsWrap && pinInput) {
    dotsWrap.addEventListener('click', () => pinInput.focus());
  }
});

/* --- TYPING EFFECT --- */
(function patchTypingEffect() {
  document.addEventListener('DOMContentLoaded', () => {
    const headline = document.querySelector('.login-left-headline');
    if (!headline) return;

    const originalHTML = headline.innerHTML;
    const textContent = headline.textContent;
    headline.innerHTML = '';
    headline.style.visibility = 'visible';

    let i = 0;
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    headline.appendChild(cursor);

    function typeChar() {
      if (i < textContent.length) {
        const char = textContent[i];
        if (char === '\n') {
          headline.insertBefore(document.createElement('br'), cursor);
        } else {
          const span = document.createTextNode(char);
          headline.insertBefore(span, cursor);
        }
        i++;
        const delay = char === ',' || char === '.' ? 120 : 35 + Math.random() * 25;
        setTimeout(typeChar, delay);
      } else {
        // Restore original HTML with em tags after typing finishes
        setTimeout(() => {
          headline.innerHTML = originalHTML;
        }, 500);
      }
    }

    // Start typing after login screen animation
    setTimeout(typeChar, 1200);
  });
})();

/* --- FLOATING ORBS --- */
(function patchFloatingOrbs() {
  document.addEventListener('DOMContentLoaded', () => {
    const left = document.querySelector('.login-left');
    if (!left) return;

    // Create floating orbs
    function spawnOrb() {
      const orb = document.createElement('div');
      const size = 4 + Math.random() * 12;
      const x = Math.random() * 100;
      const startY = 60 + Math.random() * 30;
      const dur = 6 + Math.random() * 6;
      const delay = Math.random() * 2;
      const hue = Math.random() > 0.5 ? '210,100%,60%' : '190,80%,55%'; // blue or cyan

      orb.style.cssText = `
        position:absolute;
        left:${x}%;
        bottom:${startY}%;
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        background: radial-gradient(circle, hsla(${hue},0.8), hsla(${hue},0));
        box-shadow: 0 0 ${size*2}px hsla(${hue},0.4);
        pointer-events:none;
        z-index:1;
        opacity:0;
        animation: orbRise ${dur}s ease-in-out ${delay}s infinite;
      `;
      left.appendChild(orb);
      setTimeout(() => orb.remove(), (dur + delay) * 1000 * 2);
    }

    // Add connecting lines (constellation-like)
    function spawnLine() {
      const line = document.createElement('div');
      const w = 30 + Math.random() * 80;
      const x = Math.random() * 80;
      const y = 20 + Math.random() * 60;
      const angle = -30 + Math.random() * 60;
      const dur = 8 + Math.random() * 6;

      line.style.cssText = `
        position:absolute;
        left:${x}%;
        top:${y}%;
        width:${w}px;
        height:1px;
        background: linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent);
        transform: rotate(${angle}deg);
        pointer-events:none;
        z-index:1;
        opacity:0;
        animation: lineFade ${dur}s ease-in-out ${Math.random()*3}s infinite;
      `;
      left.appendChild(line);
      setTimeout(() => line.remove(), dur * 2000);
    }

    // Initial batch
    for (let i = 0; i < 10; i++) setTimeout(() => spawnOrb(), i * 300);
    for (let i = 0; i < 4; i++) setTimeout(() => spawnLine(), i * 500);

    // Continuous
    setInterval(spawnOrb, 800);
    setInterval(spawnLine, 3000);
  });
})();

/* --- SUCCESS TRANSITION --- */
(function patchLoginSuccess() {
  const _origDoLogin = window.doLogin;
  if (!_origDoLogin) return;

  window.doLogin = async function() {
    const pin = document.getElementById('pin-input').value;
    const loginBtn = document.querySelector('.login-btn');
    const dots = document.querySelectorAll('.pin-dot');
    loginBtn.disabled = true;

    try {
      const data = await api('POST', '/api/login', { pin });

      currentUser.name = data.name || 'Pengguna';

      // Success animation on dots
      dots.forEach((dot, i) => {
        setTimeout(() => {
          dot.classList.remove('filled');
          dot.classList.add('success');
        }, i * 80);
      });

      loginBtn.textContent = '✓ Berhasil!';
      loginBtn.style.background = 'linear-gradient(135deg,#10B981,#059669)';

      // Trigger success overlay
      const overlay = document.getElementById('login-success-overlay');
      if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => overlay.classList.remove('active'), 800);
      }

      await loadUserData();

      setTimeout(() => {
        document.getElementById('login-screen').classList.add('hidden');
        updateTopbarUser();
        showSkeleton();
        // Reset dots
        dots.forEach(d => { d.classList.remove('success', 'filled'); });
        setTimeout(() => {
          hideSkeleton();
          renderDashboard();
          populateFilters();
          updateRecurringBadge();
        }, 800);
      }, 700);

    } catch (err) {
      const errEl = document.getElementById('login-error');
      errEl.style.display = 'block';
      errEl.textContent = err.message === 'PIN salah' ? '❌ PIN salah, coba lagi.' : '❌ ' + err.message;

      // Error animation on dots
      dots.forEach((dot, i) => {
        setTimeout(() => dot.classList.add('error'), i * 50);
      });
      const dotsWrap = document.getElementById('pin-dots');
      if (dotsWrap) dotsWrap.classList.add('pin-dots-shake');

      setTimeout(() => {
        dots.forEach(d => d.classList.remove('error', 'filled'));
        if (dotsWrap) dotsWrap.classList.remove('pin-dots-shake');
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-input').focus();
      }, 600);

      loginBtn.textContent = 'Masuk →';
      loginBtn.style.background = '';
    }

    loginBtn.disabled = false;
  };
})();