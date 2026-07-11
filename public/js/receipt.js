/* =====================================================
   RECEIPT.JS — Transaction Receipt Feature
   Adds a "Receipt" 🧾 button to each expense transaction
   (type: 'out') via QRIS or Wallet.
   Receipt displays as a modal overlay that can be
   downloaded as a PNG image.
   ===================================================== */

/* ══════════════════════════════════════════════════════
   INJECT RECEIPT CSS
   ══════════════════════════════════════════════════════ */
(function injectReceiptCSS() {
  const style = document.createElement('style');
  style.id = 'receipt-styles';
  style.textContent = `
    /* ── Receipt button on tx-row ── */
    .tx-struk {
      background: rgba(74,124,89,0.10);
      border: 1px solid rgba(74,124,89,0.25);
      color: #4A7C59;
      border-radius: 8px;
      width: 30px; height: 30px;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .tx-struk:hover {
      background: rgba(74,124,89,0.18);
    }
    .tx-struk:active { transform: scale(0.95); }

    /* ── Modal Overlay ── */
    #struk-modal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(45,42,38,0.6);
      backdrop-filter: blur(4px);
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeInUp 0.25s cubic-bezier(.16,1,.3,1) both;
    }
    #struk-modal.open { display: flex; }

    /* ── Receipt Card ── */
    .struk-card {
      background: #FAFAF8;
      color: #1A1A1A;
      border-radius: 16px;
      width: 100%;
      max-width: 360px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(45,42,38,0.3);
      font-family: 'Courier New', Courier, monospace;
      animation: scaleIn 0.3s cubic-bezier(.16,1,.3,1) both;
    }

    /* ── Receipt Header ── */
    .struk-header {
      background: #2D2A26;
      padding: 22px 24px 18px;
      text-align: center;
      color: #F5F0E8;
      position: relative;
      overflow: hidden;
    }
    .struk-header::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23F5F0E8' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E");
      pointer-events: none;
    }
    .struk-header-icon {
      font-size: 32px;
      display: block;
      margin-bottom: 6px;
      position: relative;
    }
    .struk-header-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      position: relative;
      opacity: 0.9;
    }
    .struk-header-sub {
      font-size: 11px;
      opacity: 0.55;
      margin-top: 3px;
      position: relative;
      font-family: 'DM Sans', sans-serif;
    }

    /* ── Receipt Zigzag Edge ── */
    .struk-zigzag {
      height: 16px;
      background: linear-gradient(-45deg, #FAFAF8 8px, transparent 0) 0 8px,
                  linear-gradient( 45deg, #FAFAF8 8px, transparent 0) 0 8px;
      background-size: 16px 16px;
      background-color: #2D2A26;
      position: relative;
    }
    .struk-zigzag-bottom {
      height: 16px;
      background: linear-gradient(-45deg, transparent 8px, #FAFAF8 0) 0 8px,
                  linear-gradient( 45deg, transparent 8px, #FAFAF8 0) 0 8px;
      background-size: 16px 16px;
      background-color: #2D2A26;
    }

    /* ── Receipt Body ── */
    .struk-body {
      padding: 18px 24px;
      background: #FAFAF8;
    }

    /* ── Info Row ── */
    .struk-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 5px 0;
      font-size: 12px;
      color: #444;
      line-height: 1.5;
      gap: 10px;
    }
    .struk-row .label {
      color: #888;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .struk-row .value {
      color: #1A1A1A;
      font-weight: 600;
      text-align: right;
      word-break: break-word;
    }
    .struk-row .value.amount {
      font-size: 14px;
      font-weight: 800;
      color: #B5651D;
    }

    /* ── Dashed Divider ── */
    .struk-divider {
      border: none;
      border-top: 2px dashed #D1D5DB;
      margin: 10px 0;
    }
    .struk-divider-solid {
      border: none;
      border-top: 1px solid #E5E7EB;
      margin: 8px 0;
    }

    /* ── Payment Method Badge ── */
    .struk-payment-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(74,124,89,0.08);
      border: 1px solid rgba(74,124,89,0.25);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      color: #4A7C59;
      margin: 10px auto 0;
      width: 100%;
      justify-content: center;
      font-family: 'DM Sans', sans-serif;
      letter-spacing: 0.02em;
    }
    .struk-payment-badge.qris {
      background: linear-gradient(135deg, #FFF7ED, #FEF3C7);
      border-color: #FCD34D;
      color: #92400E;
    }

    /* ── QR Placeholder (QRIS) ── */
    .struk-qr-wrap {
      display: flex;
      justify-content: center;
      margin: 12px 0;
    }
    .struk-qr {
      width: 80px; height: 80px;
      border: 2px solid #E5E7EB;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      font-size: 10px;
      color: #9CA3AF;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .struk-qr svg {
      width: 64px; height: 64px;
    }

    /* ── Receipt Footer ── */
    .struk-footer {
      background: #2D2A26;
      padding: 14px 24px 18px;
      text-align: center;
    }
    .struk-footer-note {
      font-size: 10px;
      color: rgba(245,240,232,0.45);
      font-family: 'DM Sans', sans-serif;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .struk-footer-app {
      font-size: 13px;
      color: rgba(245,240,232,0.85);
      font-weight: 700;
      font-family: 'DM Sans', sans-serif;
      letter-spacing: 0.08em;
    }
    .struk-no-ref {
      font-size: 10px;
      color: rgba(245,240,232,0.35);
      margin-top: 4px;
      font-family: 'Courier New', monospace;
    }

    /* ── Action buttons below receipt ── */
    .struk-actions {
      display: flex;
      gap: 10px;
      margin-top: 14px;
      max-width: 360px;
      width: 100%;
    }
    .struk-btn {
      flex: 1;
      padding: 11px 0;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
      font-family: 'DM Sans', sans-serif;
      letter-spacing: 0.01em;
    }
    .struk-btn-close {
      background: rgba(45,42,38,0.08);
      color: #7A7570;
      border: 1px solid rgba(45,42,38,0.15);
    }
    .struk-btn-close:hover { background: rgba(45,42,38,0.14); }
    .struk-btn-save {
      background: #2D2A26;
      color: #F5F0E8;
    }
    .struk-btn-save:hover { background: #3D3A36; }
    .struk-btn-save:active { transform: scale(0.99); }

    /* ── Barcode visual ── */
    .struk-barcode {
      display: flex;
      justify-content: center;
      gap: 2px;
      margin: 8px 0 4px;
    }
    .struk-barcode span {
      display: inline-block;
      height: 32px;
      border-radius: 1px;
      background: #2D2A26;
    }
  `;
  document.head.appendChild(style);
})();


/* ══════════════════════════════════════════════════════
   INJECT MODAL HTML
   ══════════════════════════════════════════════════════ */
(function injectReceiptModal() {
  if (document.getElementById('struk-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'struk-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Transaction Receipt');
  modal.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;width:100%;max-width:360px">
      <div class="struk-card" id="struk-printable">
        <!-- dynamically populated -->
      </div>
      <div class="struk-actions">
        <button class="struk-btn struk-btn-close" onclick="closeStruk()">✕ Tutup</button>
        <button class="struk-btn struk-btn-save" onclick="downloadStruk()">⬇️ Simpan PNG</button>
      </div>
    </div>
  `;
  /* Close on backdrop click */
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeStruk();
  });
  document.body.appendChild(modal);
})();


/* ══════════════════════════════════════════════════════
   HELPER — Generate Unique Reference Number
   ══════════════════════════════════════════════════════ */
function genRefNumber(txId) {
  const base = txId ? String(txId).slice(-6) : Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  const prefix = 'DUT';
  const mid = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${mid}-${base}`;
}

/* ══════════════════════════════════════════════════════
   HELPER — Generate Decorative SVG QR Code
   ══════════════════════════════════════════════════════ */
function makeQRsvg() {
  /* Decorative QR — random pattern that looks like a QR code */
  const seed = Math.floor(Math.random() * 0xFFFFFF);
  const cells = 11;
  const size = 64;
  const cellSize = size / cells;
  let rects = '';

  function seededRand(s) {
    let x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  }

  /* Finder patterns (top-left, top-right, bottom-left corners) */
  function finder(ox, oy) {
    rects += `<rect x="${ox*cellSize}" y="${oy*cellSize}" width="${7*cellSize}" height="${7*cellSize}" fill="#1A1A1A" rx="1"/>`;
    rects += `<rect x="${(ox+1)*cellSize}" y="${(oy+1)*cellSize}" width="${5*cellSize}" height="${5*cellSize}" fill="#fff" rx="0.5"/>`;
    rects += `<rect x="${(ox+2)*cellSize}" y="${(oy+2)*cellSize}" width="${3*cellSize}" height="${3*cellSize}" fill="#1A1A1A" rx="0.5"/>`;
  }
  finder(0, 0);
  finder(cells - 7, 0);
  finder(0, cells - 7);

  /* Random data modules */
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const isFinderZone =
        (r < 8 && c < 8) ||
        (r < 8 && c >= cells - 8) ||
        (r >= cells - 8 && c < 8);
      if (isFinderZone) continue;
      const val = seededRand(seed + r * cells + c);
      if (val > 0.45) {
        rects += `<rect x="${c*cellSize}" y="${r*cellSize}" width="${cellSize}" height="${cellSize}" fill="#1A1A1A"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${rects}</svg>`;
}

/* ══════════════════════════════════════════════════════
   HELPER — Generate Decorative Barcode Visual
   ══════════════════════════════════════════════════════ */
function makeBarcodeHTML() {
  const widths = [];
  for (let i = 0; i < 36; i++) {
    widths.push(Math.random() > 0.5 ? (Math.random() > 0.7 ? 3 : 2) : 1);
  }
  const bars = widths.map(w =>
    `<span style="width:${w}px;height:${Math.random() > 0.3 ? 32 : 22}px"></span>`
  ).join('');
  return `<div class="struk-barcode">${bars}</div>`;
}

/* ══════════════════════════════════════════════════════
   HELPER — Format Date to Full Indonesian String
   ══════════════════════════════════════════════════════ */
function formatReceiptDate(dateStr) {
  const DAYS   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/* ══════════════════════════════════════════════════════
   MAIN — Show Receipt
   ══════════════════════════════════════════════════════ */
window.showStruk = function(txId) {
  const transactions = window.transactions || [];
  const t = transactions.find(x => x.id === txId);
  if (!t) return;

  const isQRIS   = t.wallet === 'qris';
  const isWallet = t.wallet === 'dompet' || t.wallet === 'cash';
  const isMbanking = t.wallet === 'mbanking';

  /* Payment method icon & label */
  let payIcon, payLabel, payClass;
  if (isQRIS) {
    payIcon = '⬛'; payLabel = 'QRIS'; payClass = 'qris';
  } else if (isWallet) {
    payIcon = '👛'; payLabel = 'Dompet / Tunai'; payClass = '';
  } else {
    payIcon = '🏦'; payLabel = 'M-Banking / Transfer'; payClass = '';
  }

  /* Category icon */
  const CAT_EMOJI_MAP = window.CAT_EMOJI || {};
  const catEmoji = CAT_EMOJI_MAP[t.cat] || '📦';

  /* Reference number */
  const refNo = genRefNumber(t.id);

  /* Consistent pseudo-random time based on tx id */
  const hour  = String(7 + (t.id % 14)).padStart(2, '0');
  const min   = String((t.id * 7) % 60).padStart(2, '0');
  const sec   = String((t.id * 13) % 60).padStart(2, '0');
  const timeStr = `${hour}:${min}:${sec} WIB`;

  /* Classification label */
  const ratioLabel = t.ratio === 'needs' ? '🟡 Kebutuhan' : t.ratio === 'wants' ? '🟠 Keinginan' : t.ratio === 'savings' ? '🟢 Tabungan' : '—';

  /* Receipt HTML content */
  const receiptHTML = `
    <div class="struk-header">
      <span class="struk-header-icon">${catEmoji}</span>
      <div class="struk-header-title">Struk Pengeluaran</div>
      <div class="struk-header-sub">DuitKu · Bukti Transaksi Digital</div>
    </div>
    <div class="struk-zigzag"></div>

    <div class="struk-body">

      <!-- Main amount -->
      <div style="text-align:center;margin:4px 0 14px">
        <div style="font-size:11px;color:#9CA3AF;font-family:'DM Sans',sans-serif;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">Total Pembayaran</div>
        <div style="font-size:28px;font-weight:900;color:#B5651D;letter-spacing:-0.02em;font-family:'DM Sans',sans-serif">
          ${typeof fmt === 'function' ? fmt(t.amount) : 'Rp ' + Math.round(t.amount).toLocaleString('id-ID')}
        </div>
      </div>

      <hr class="struk-divider">

      <!-- Transaction details -->
      <div class="struk-row">
        <span class="label">Keterangan</span>
        <span class="value">${t.desc}</span>
      </div>
      <div class="struk-row">
        <span class="label">Kategori</span>
        <span class="value">${catEmoji} ${t.cat}</span>
      </div>
      <div class="struk-row">
        <span class="label">Klasifikasi</span>
        <span class="value">${ratioLabel}</span>
      </div>

      <hr class="struk-divider-solid">

      <div class="struk-row">
        <span class="label">Tanggal</span>
        <span class="value">${formatReceiptDate(t.date)}</span>
      </div>
      <div class="struk-row">
        <span class="label">Waktu</span>
        <span class="value">${timeStr}</span>
      </div>
      <div class="struk-row">
        <span class="label">No. Referensi</span>
        <span class="value" style="font-size:10px;color:#6B7280">${refNo}</span>
      </div>

      <hr class="struk-divider">

      <!-- Payment method -->
      <div style="font-size:10px;color:#9CA3AF;text-align:center;margin-bottom:6px;font-family:'DM Sans',sans-serif;letter-spacing:0.06em;text-transform:uppercase">Metode Pembayaran</div>
      <div class="struk-payment-badge ${payClass}">
        <span style="font-size:16px">${payIcon}</span>
        <span>${payLabel}</span>
      </div>

      ${isQRIS ? `
        <!-- QR Code for QRIS -->
        <div style="margin-top:14px">
          <div style="font-size:10px;color:#9CA3AF;text-align:center;margin-bottom:8px;font-family:'DM Sans',sans-serif;letter-spacing:0.06em;text-transform:uppercase">Scan QRIS</div>
          <div class="struk-qr-wrap">
            <div class="struk-qr">${makeQRsvg()}</div>
          </div>
          <div style="font-size:9px;color:#9CA3AF;text-align:center;font-family:'DM Sans',sans-serif">* QR dekoratif, bukan QR aktif</div>
        </div>
      ` : `
        ${makeBarcodeHTML()}
        <div style="font-size:9px;color:#9CA3AF;text-align:center;margin-top:2px;font-family:'DM Sans',sans-serif">${refNo}</div>
      `}

    </div>

    <div class="struk-zigzag-bottom"></div>
    <div class="struk-footer">
      <div class="struk-footer-note">Diterbitkan oleh</div>
      <div class="struk-footer-app">💰 DuitKu</div>
      <div class="struk-no-ref">Simpan struk ini sebagai bukti transaksi Anda</div>
    </div>
  `;

  const printable = document.getElementById('struk-printable');
  if (printable) printable.innerHTML = receiptHTML;

  const modal = document.getElementById('struk-modal');
  if (modal) modal.classList.add('open');
};


/* ══════════════════════════════════════════════════════
   CLOSE RECEIPT
   ══════════════════════════════════════════════════════ */
window.closeStruk = function() {
  const modal = document.getElementById('struk-modal');
  if (modal) modal.classList.remove('open');
};

/* Close with Escape key */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeStruk();
});


/* ══════════════════════════════════════════════════════
   DOWNLOAD RECEIPT AS PNG
   Uses html2canvas (CDN) if available,
   falls back to print dialog.
   ══════════════════════════════════════════════════════ */
window.downloadStruk = async function() {
  const printable = document.getElementById('struk-printable');
  if (!printable) return;

  const btn = document.querySelector('.struk-btn-save');
  const origText = btn.textContent;
  btn.textContent = '⏳ Menyimpan...';
  btn.disabled = true;

  /* Load html2canvas if not already available */
  if (typeof html2canvas === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    }).catch(() => null);
  }

  if (typeof html2canvas !== 'undefined') {
    try {
      const canvas = await html2canvas(printable, {
        scale: 2.5,
        backgroundColor: '#FAFAF8',
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      const link = document.createElement('a');
      link.download = `struk-duitku-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      btn.textContent = '✅ Tersimpan!';
      setTimeout(() => {
        btn.textContent = origText;
        btn.disabled = false;
      }, 1800);
    } catch (err) {
      console.error('html2canvas error:', err);
      fallbackPrint(btn, origText);
    }
  } else {
    fallbackPrint(btn, origText);
  }
};

function fallbackPrint(btn, origText) {
  /* Fallback: open print dialog */
  try {
    const printable = document.getElementById('struk-printable');
    const win = window.open('', '_blank', 'width=400,height=700');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Struk DuitKu</title>
        <style>
          body { margin: 0; background: #FAFAF8; display: flex; justify-content: center; padding: 20px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${printable.outerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  } catch(e) {}
  btn.textContent = '🖨️ Print dibuka';
  setTimeout(() => {
    btn.textContent = origText;
    btn.disabled = false;
  }, 2000);
}


/* ══════════════════════════════════════════════════════
   PATCH txRow — Add 🧾 button for expense transactions
   ══════════════════════════════════════════════════════ */
(function patchTxRow() {
  function doPatching() {
    /* txRow is defined as a function declaration in script.js,
       so it exists in global scope but may not be explicitly on window —
       expose it to window first so we can wrap it. */
    if (typeof txRow === 'function' && !window._receiptTxRowPatched) {
      const _origTxRow = txRow;

      window.txRow = function(t) {
        const originalHTML = _origTxRow(t);

        /* Only for expense transactions */
        if (t.type !== 'out') return originalHTML;

        /* Insert receipt button before duplicate button (⧉) */
        const receiptBtn = `<button class="tx-struk" onclick="showStruk(${t.id})" title="Lihat Struk">🧾</button>`;

        /* Inject after tx-amt, before tx-dup */
        return originalHTML.replace(
          '<button class="tx-dup"',
          receiptBtn + '<button class="tx-dup"'
        );
      };

      window._receiptTxRowPatched = true;
    } else if (!window._receiptTxRowPatched) {
      /* txRow not available yet, retry after load */
      window.addEventListener('load', doPatching, { once: true });
    }
  }

  /* Run after DOMContentLoaded so script.js has been parsed */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doPatching);
  } else {
    doPatching();
  }
})();

/* ══════════════════════════════════════════════════════
   PATCH showCalDetail — Receipt in calendar detail
   Calendar uses txRow() directly, so patching txRow
   is sufficient. No additional patch needed.
   ══════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════
   PATCH addTransaction — Offer receipt after recording
   ══════════════════════════════════════════════════════ */
(function patchAddTransactionReceipt() {
  const _orig = window.addTransaction;
  if (!_orig) return;

  window.addTransaction = async function() {
    const typeEl = document.getElementById('inp-type');
    const isOut = typeEl && typeEl.value === 'out';

    const result = await _orig.apply(this, arguments);

    /* If expense, offer to view receipt */
    if (isOut) {
      const latestTx = (window.transactions || [])[0];
      if (latestTx && latestTx.type === 'out') {
        /* Toast with view receipt button */
        const toastId = 'receipt-toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.style.cssText = `
          position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
          background:rgba(30,30,40,0.97); border:1px solid rgba(201,160,80,0.3);
          color:#EEE; padding:12px 18px; border-radius:14px; font-size:13px;
          display:flex; align-items:center; gap:12px; z-index:9998;
          box-shadow:0 8px 32px rgba(0,0,0,0.5);
          animation:fadeInUp 0.3s cubic-bezier(.16,1,.3,1) both;
          font-family:'DM Sans',sans-serif; white-space:nowrap;
          max-width: calc(100vw - 40px);
        `;
        toast.innerHTML = `
          <span style="font-size:16px">🧾</span>
          <span>Transaksi dicatat!</span>
          <button onclick="showStruk(${latestTx.id});document.getElementById('${toastId}')?.remove()"
            style="background:rgba(201,160,80,0.18);border:1px solid rgba(201,160,80,0.35);
                   color:#C9A050;border-radius:8px;padding:5px 12px;font-size:12px;
                   font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit">
            Lihat Struk
          </button>
          <button onclick="this.closest('#${toastId}').remove()"
            style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;padding:0 4px">✕</button>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
          const el = document.getElementById(toastId);
          if (el) el.remove();
        }, 5000);
      }
    }

    return result;
  };
})();