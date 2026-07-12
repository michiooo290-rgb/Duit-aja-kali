/* ===== CONSTANTS ===== */
const MONTHS  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
const DEFAULT_CAT_OUT = ['🍜 Makanan','🧋 Minuman','🚗 Transportasi','🛍 Belanja','🎮 Hiburan','🕹️ Top Up Game','❤️ Kesehatan','📋 Tagihan','🏠 Sewa','💡 Listrik/Air','📦 Lainnya'];
const DEFAULT_CAT_IN  = ['💼 Gaji','💻 Freelance','📈 Investasi','🎁 Hadiah','📦 Lainnya'];
// Legacy aliases so older code still works
let CAT_OUT = DEFAULT_CAT_OUT;
let CAT_IN  = DEFAULT_CAT_IN;
const CAT_EMOJI = {
  Makanan:'🍜', Minuman:'🧋', Transportasi:'🚗', Belanja:'🛍', Hiburan:'🎮', 'Top Up Game':'🕹️', Kesehatan:'❤️', Tagihan:'📋', Sewa:'🏠', 'Listrik/Air':'💡', Gaji:'💼', Freelance:'💻', Investasi:'📈', Hadiah:'🎁', Lainnya:'📦'
};

/* ===== KATEGORI CUSTOM ===== */
let customCatsOut = JSON.parse(localStorage.getItem('duit_cats_out') || '[]');
let customCatsIn  = JSON.parse(localStorage.getItem('duit_cats_in')  || '[]');

function getAllCatsOut() { return [...DEFAULT_CAT_OUT, ...customCatsOut]; }
function getAllCatsIn()  { return [...DEFAULT_CAT_IN,  ...customCatsIn];  }

function refreshCatAliases() {
  CAT_OUT = getAllCatsOut();
  CAT_IN  = getAllCatsIn();
  // rebuild CAT_EMOJI with custom entries
  getAllCatsOut().concat(getAllCatsIn()).forEach(c => {
    const parts = c.split(' '), emoji = parts[0], name = parts.slice(1).join(' ');
    if (name && emoji) CAT_EMOJI[name] = emoji;
  });
}

function saveCats() {
  localStorage.setItem('duit_cats_out', JSON.stringify(customCatsOut));
  localStorage.setItem('duit_cats_in',  JSON.stringify(customCatsIn));
  refreshCatAliases();
}

// Init on load
refreshCatAliases();

function addCustomCategory() {
  const type  = document.getElementById('cat-type-new').value;
  const emoji = document.getElementById('cat-emoji-new').value.trim() || '📦';
  const name  = document.getElementById('cat-name-new').value.trim();

  if (!name) { showMsg('cat-msg', '⚠️ Isi nama kategori!', 'error'); return; }
  if (name.length > 24) { showMsg('cat-msg', '⚠️ Nama terlalu panjang (maks 24 karakter)', 'error'); return; }

  const entry = `${emoji} ${name}`;
  if ([...getAllCatsOut(), ...getAllCatsIn()].some(c => c.toLowerCase() === entry.toLowerCase())) {
    showMsg('cat-msg', '⚠️ Kategori sudah ada!', 'error'); return;
  }

  if (type === 'out') customCatsOut.push(entry);
  else                customCatsIn.push(entry);
  saveCats();

  document.getElementById('cat-name-new').value  = '';
  document.getElementById('cat-emoji-new').value = '';
  showMsg('cat-msg', `✅ Kategori "${entry}" berhasil ditambahkan!`, 'success');
  setTimeout(() => { const m = document.getElementById('cat-msg'); if (m) m.style.display = 'none'; }, 2500);
  renderCategoryChips();
  updateCatOptions();
}

async function deleteCustomCategory(type, entry) {
  const _delCatOk = await showConfirm({ icon:'🏷️', title:'Hapus kategori?', message:`Hapus kategori "${entry}"?`, okText:'Hapus' });
  if (!_delCatOk) return;
  if (type === 'out') customCatsOut = customCatsOut.filter(c => c !== entry);
  else                customCatsIn  = customCatsIn.filter(c => c !== entry);
  saveCats();
  renderCategoryChips();
  updateCatOptions();
}

function renderCategoryChips() {
  const outEl = document.getElementById('cat-chips-out');
  const inEl  = document.getElementById('cat-chips-in');
  if (!outEl || !inEl) return;

  function chipHTML(cats, type, defaults) {
    return cats.map(c => {
      const isDefault = defaults.includes(c);
      return `<span class="cat-chip${isDefault ? ' cat-chip-default' : ''}">
        ${c}${!isDefault ? `<button onclick="deleteCustomCategory('${type}','${c.replace(/'/g,"\\'")}')" title="Hapus">✕</button>` : ''}
      </span>`;
    }).join('');
  }

  outEl.innerHTML = chipHTML(getAllCatsOut(), 'out', DEFAULT_CAT_OUT);
  inEl.innerHTML  = chipHTML(getAllCatsIn(),  'in',  DEFAULT_CAT_IN);
}

/* ===== API HELPER ===== */
const API_BASE = '';

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(API_BASE + path, opts);
  const data = await res.json();
  if (!data.ok && res.status !== 200) throw new Error(data.message || 'API error');
  return data;
}

/* ===== STATE ===== */
let transactions   = [];
window.transactions = transactions;   // diakses kalender.js
let settings       = { budget: 0, reminders: {}, name: 'Pengguna' };
let selectedSheets = { tx: true, summary: true, cat: true, ratio: true };
let chartCat       = null, chartTrend = null, chartTabungan = null;
let currentUser    = { name: 'Pengguna', emoji: '👤' };
let recurringList  = JSON.parse(localStorage.getItem('duit_recurring') || '[]');
let rencanaNabung  = JSON.parse(localStorage.getItem('duit_rencana_nabung') || '[]');
function saveRencanaNabung() { localStorage.setItem('duit_rencana_nabung', JSON.stringify(rencanaNabung)); }

/* ===== AUTH ===== */
function initLoginScreen() {
  // Load saved avatar (photo atau emoji)
  const savedPhoto = localStorage.getItem('duit_avatar_photo');
  const savedAvatar = localStorage.getItem('duit_avatar') || '👤';

  if (savedPhoto) {
    currentUser.emoji = '📷';
    currentUser.photo = savedPhoto;
    applyAvatarToAll(savedPhoto, true);
  } else {
    currentUser.emoji = savedAvatar;
    currentUser.photo = null;
    applyAvatarToAll(savedAvatar, false);
  }

  document.getElementById('login-name').textContent = currentUser.name;
}

async function doLogin() {
  const pin     = document.getElementById('pin-input').value;
  const loginBtn = document.querySelector('.login-btn');
  loginBtn.disabled = true;

  try {
    const data = await api('POST', '/api/login', { pin });

    currentUser.name = data.name || 'Pengguna';
    loginBtn.textContent = '✓ Masuk...';
    loginBtn.style.background = '#4A7C59';

    await loadUserData();

    setTimeout(() => {
      document.getElementById('login-screen').classList.add('hidden');
      updateTopbarUser();
      showSkeleton();
      setTimeout(() => {
        hideSkeleton();
        renderDashboard();
        populateFilters();
        updateRecurringBadge();
      }, 800);
    }, 400);

  } catch (err) {
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'block';
    errEl.textContent = err.message === 'PIN salah' ? '❌ PIN salah, coba lagi.' : '❌ ' + err.message;
    const pinInput = document.getElementById('pin-input');
    pinInput.value = '';
    pinInput.style.animation = 'none'; pinInput.offsetHeight;
    pinInput.style.animation = 'pinShake 0.4s cubic-bezier(.36,.07,.19,.97) both';
    setTimeout(() => { pinInput.style.animation = ''; pinInput.focus(); }, 450);
    loginBtn.textContent = 'Masuk →';
    loginBtn.style.background = '';
  }

  loginBtn.disabled = false;
}

async function logout() {
  const _logoutOk = await showConfirm({ icon:'👋', title:'Keluar?', message:'Keluar dari akun ' + currentUser.name + '?', okText:'Ya, keluar', danger:false });
  if (!_logoutOk) return;
  transactions = [];
  settings = { budget: 0, reminders: {}, name: 'Pengguna' };
  document.getElementById('pin-input').value = '';
  document.getElementById('login-error').style.display = 'none';
  const loginBtn = document.querySelector('.login-btn');
  loginBtn.textContent = 'Masuk →';
  loginBtn.style.background = '';
  initLoginScreen();
  document.getElementById('login-screen').classList.remove('hidden');
}

function updateTopbarUser() {
  document.getElementById('topbar-username').textContent = currentUser.name;
  if (currentUser.photo) {
    applyAvatarToAll(currentUser.photo, true);
  } else {
    applyAvatarToAll(currentUser.emoji, false);
  }
}

/* ===== LOAD DATA ===== */
async function loadUserData() {
  const [txRes, setRes] = await Promise.all([
    api('GET', '/api/transactions').catch(() => ({data: []})),
    api('GET', '/api/settings').catch(() => ({data: {}}))
  ]);

  transactions = txRes.data || [];
  window.transactions = transactions;   // sync ke kalender.js

  if (transactions.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    transactions = [
      { id: Date.now() - 1000, type: 'in',  cat: 'Gaji',       desc: 'Gaji Bulanan', amount: 1000000, date: today, ratio: 'in', wallet: 'mbanking' },
      { id: Date.now(),        type: 'in',  cat: 'Gaji',       desc: 'Uang Saku',    amount: 200000,  date: today, ratio: 'in', wallet: 'dompet'   }
    ];
  }

  const s = setRes.data || {};
  settings.budget    = parseFloat(s.budget) || 0;
  settings.name      = s.name || 'Pengguna';
  settings.reminders = s.reminders ? JSON.parse(s.reminders) : {};
  currentUser.name   = settings.name;
}

/* ===== FORMATTERS ===== */
function fmt(n)      { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function fmtShort(n) {
  if (n >= 1000000) return 'Rp ' + (n / 1000000).toFixed(1) + 'jt';
  if (n >= 1000)    return 'Rp ' + (n / 1000).toFixed(0) + 'rb';
  return 'Rp ' + Math.round(n);
}
function formatInputRupiah(el) {
  let val = el.value.replace(/[^0-9]/g, '');
  if (val !== '') { el.value = parseInt(val, 10).toLocaleString('id-ID'); } else { el.value = ''; }
}

function updateDate() {
  const el = document.getElementById('topbar-date');
  if(!el) return;
  function renderTime() {
    const d    = new Date();
    const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const bln  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const tanggal = hari[d.getDay()] + ', ' + d.getDate() + ' ' + bln[d.getMonth()] + ' ' + d.getFullYear();
    const jam = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    el.innerHTML = tanggal + ' &nbsp;|&nbsp; <strong>' + jam + '</strong>';
  }
  renderTime(); setInterval(renderTime, 1000);
}

function updateRecurringBadge() {
  const due = getDueRecurringCount();
  const pill = document.querySelector('.pill-item[data-page="berulang"] .pill-label');
  if (pill) {
    pill.innerHTML = due > 0 ? `Berulang <span class="nav-badge">${due}</span>` : 'Berulang';
  }
}

/* ===== NAVIGATION ===== */
let _currentPage = 'dashboard';
const PAGE_ORDER  = ['dashboard','catat','berulang','riwayat','analisa','ekspor','tabungan','target','kalender','pengaturan'];

function showPage(id, btn) {
  if (id === _currentPage) return;

  const oldIdx = PAGE_ORDER.indexOf(_currentPage);
  const newIdx = PAGE_ORDER.indexOf(id);
  const goRight = newIdx > oldIdx;

  // Sembunyikan halaman lama langsung
  const outEl = document.getElementById('page-' + _currentPage);
  if (outEl) outEl.classList.remove('active');

  // Tampilkan halaman baru dengan animasi masuk
  const inEl = document.getElementById('page-' + id);
  if (!inEl) return;

  inEl.classList.add('active', goRight ? 'slide-in-right' : 'slide-in-left');
  setTimeout(() => inEl.classList.remove('slide-in-right', 'slide-in-left'), 350);

  document.querySelectorAll('.nav-btn, .pill-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  _currentPage = id;

  if (id === 'dashboard')  renderDashboard();
  if (id === 'riwayat')    { populateFilters(); renderHistory(); }
  if (id === 'analisa')    renderAnalisa();
  if (id === 'ekspor')     { populateFilters(); renderExportStats(); }
  if (id === 'berulang')   renderRecurringPage();
  if (id === 'tabungan')   renderTabunganPage();
  if (id === 'target')     renderTargets();
  if (id === 'kalender')   renderKalender();
  if (id === 'pengaturan') loadSettings();
}

/* ===== CATEGORIES ===== */
function updateCatOptions() {
  const type = document.getElementById('inp-type').value;
  document.getElementById('inp-cat').innerHTML = (type === 'out' ? CAT_OUT : CAT_IN).map(c => `<option value="${c.replace(/^.+?\s/, '')}">${c}</option>`).join('');
  document.getElementById('ratio-group').style.display = type === 'out' ? '' : 'none';
}

/* ===== ADD TRANSACTION ===== */
async function addTransaction() {
  const type      = document.getElementById('inp-type').value;
  const wallet    = document.getElementById('inp-wallet').value;
  const cat       = document.getElementById('inp-cat').value;
  const desc      = document.getElementById('inp-desc').value.trim();
  const amountRaw = document.getElementById('inp-amount').value.replace(/\./g, '');
  const amount    = parseFloat(amountRaw);
  const date      = document.getElementById('inp-date').value;
  const ratio     = type === 'in' ? 'in' : document.getElementById('inp-ratio').value;

  if (!desc || !amount || !date || isNaN(amount) || amount <= 0) {
    showMsg('catat-msg', '⚠️ Lengkapi semua kolom!', 'error'); return;
  }

  const isRecurring = document.getElementById('inp-recurring')?.checked;
  const freq        = document.getElementById('inp-freq')?.value || 'monthly';
  const tx = { id: Date.now(), type, wallet, cat, desc, amount, date, ratio };

  try {
    await api('POST', '/api/transactions', tx).catch(e => console.warn('Offline mode', e));
    transactions.unshift(tx);
    // Simpan ke daftar berulang jika dicentang
    if (isRecurring) {
      recurringList.push({ id: Date.now() + 1, type, wallet, cat, desc, amount, ratio, freq, lastRun: date });
      saveRecurring();
    }
    checkBudgetAlert();
    document.getElementById('inp-desc').value   = '';
    document.getElementById('inp-amount').value = '';
    if (document.getElementById('inp-recurring')) document.getElementById('inp-recurring').checked = false;
    toggleRecurringOpts();
    showMsg('catat-msg', isRecurring ? '✅ Transaksi & jadwal berulang disimpan!' : '✅ Transaksi berhasil disimpan!', 'success');
    setTimeout(() => { document.getElementById('catat-msg').style.display = 'none'; }, 2000);
  } catch (err) {
    showMsg('catat-msg', '❌ Gagal simpan: ' + err.message, 'error');
  }
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text; el.className = 'msg ' + type; el.style.display = 'block';
}


/* ===== TABUNGAN BANK MODAL (SETOR dari Dashboard) ===== */
async function openTabunganModal() {
  const balTabungan = transactions.filter(t => t.wallet === 'tabungan')
    .reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);

  const confirmed = await showConfirm({
    icon: '💰',
    title: 'Setor ke Tabungan Bank',
    message: `
      <div style="text-align:center;margin-bottom:12px;padding:10px;background:rgba(74,124,89,0.08);border-radius:10px">
        <div style="font-size:11px;color:#9CA3AF">Saldo Tabungan</div>
        <div style="font-size:20px;font-weight:800;color:  #4A7C59">${fmt(Math.max(balTabungan,0))}</div>
      </div>
      <label style="font-size:12px;color:#9CA3AF;display:block;margin-bottom:4px">Jumlah Setor (Rp)</label>
      <input id="tab-amt-inp" type="text" placeholder="Contoh: 500.000"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);
               background:rgba(255,255,255,0.06);color:#EEE;font-size:14px;box-sizing:border-box;margin-bottom:10px"
        oninput="this.value=this.value.replace(/[^0-9]/g,'').replace(/\\B(?=(\\d{3})+(?!\\d))/g,'.')">
      <label style="font-size:12px;color:#9CA3AF;display:block;margin-bottom:4px">Sumber Dana</label>
      <select id="tab-src-sel"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);
               background:rgba(255,255,255,0.06);color:#EEE;font-size:13px;box-sizing:border-box">
        <option value="mbanking">🏦 M-Banking</option>
        <option value="dompet">👛 Dompet</option>
      </select>`,
    okText: 'Setor'
  });
  if (!confirmed) return;

  const rawAmt = document.getElementById('tab-amt-inp')?.value?.replace(/\./g, '');
  const src    = document.getElementById('tab-src-sel')?.value || 'mbanking';
  const amt    = parseFloat(rawAmt || '0');
  if (!amt || amt <= 0) { showToast('Jumlah tidak valid', 'warning'); return; }

  const srcLabel = src === 'mbanking' ? '🏦 M-Banking' : '👛 Dompet';
  const today = new Date().toISOString().split('T')[0];

  const txOut = { id: Date.now(),     type: 'out', wallet: src,        cat: 'Tabungan', desc: 'Setor Tabungan Bank',   amount: amt, date: today, ratio: 'savings' };
  const txIn  = { id: Date.now() + 1, type: 'in',  wallet: 'tabungan', cat: 'Tabungan', desc: `Setor dari ${srcLabel}`, amount: amt, date: today, ratio: 'in' };

  try { await api('POST', '/api/transactions', txOut).catch(e => console.warn(e)); } catch(e) {}
  try { await api('POST', '/api/transactions', txIn).catch(e => console.warn(e));  } catch(e) {}
  transactions.unshift(txIn);
  transactions.unshift(txOut);
  window.transactions = transactions;

  showToast(`✅ Setor ${fmt(amt)} dari ${srcLabel} berhasil!`, 'success');
  renderDashboard();
  if (typeof window.updateTopbarBalance === 'function') window.updateTopbarBalance();
}


/* ===== DASHBOARD ===== */
function renderDashboard() {
  renderTodayWidget();
  checkBudgetAlert();
  renderHealthScore();
  const now  = new Date();
  const txM  = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  
  // Exclude wallet tabungan dari income/expense agar tidak double-count saat setor/tarik tabungan
  const income  = txM.filter(t => t.type === 'in'  && t.wallet !== 'tabungan').reduce((s, t) => s + t.amount, 0);
  const expense = txM.filter(t => t.type === 'out' && t.wallet !== 'tabungan').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  // Saldo M-Banking & Dompet dihitung akumulatif dari SEMUA transaksi (bukan hanya bulan ini)
  const balMbanking  = transactions.filter(t => t.wallet === 'mbanking').reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
  const balDompet    = transactions.filter(t => t.wallet === 'dompet').reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
  // Saldo tabungan dihitung dari SEMUA transaksi (bukan hanya bulan ini) agar akumulatif
  const balTabungan  = transactions.filter(t => t.wallet === 'tabungan').reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);

  document.getElementById('metrics').innerHTML = [
    { icon:'💰', label:'Total Saldo',      val: fmtShort(Math.abs(balance)), color: balance >= 0 ? '#4A7C59' : '#B5651D', bg: balance >= 0 ? 'rgba(74,124,89,0.1)' : 'rgba(181,101,29,0.1)',   border: balance >= 0 ? 'rgba(74,124,89,0.15)' : 'rgba(181,101,29,0.15)' },
    { icon:'🏦', label:'Saldo M-Banking',  val: fmtShort(balMbanking),       color:'#4A7C59', bg:'rgba(74,124,89,0.08)',  border:'rgba(74,124,89,0.12)' },
    { icon:'👛', label:'Saldo Dompet',     val: fmtShort(balDompet),         color:'#C9A050', bg:'rgba(201,160,80,0.08)',  border:'rgba(201,160,80,0.12)' },
    { icon:'🏧', label:'Tabungan Bank',    val: fmtShort(balTabungan),       color:'#4A7C59', bg:'rgba(74,124,89,0.08)', border:'rgba(74,124,89,0.12)', clickable: true },
    { icon:'📉', label:'Total Keluar',     val: fmtShort(expense),           color:'#B5651D', bg:'rgba(181,101,29,0.08)',   border:'rgba(181,101,29,0.12)' },
  ].map(m => `
    <div class="metric glass" style="border-color:${m.border};${m.clickable ? 'cursor:pointer' : ''}"
         ${m.clickable ? 'onclick="openTabunganModal()" title="Klik untuk setor/tarik tabungan"' : ''}>
      <div class="metric-icon" style="background:${m.bg};border-color:${m.border}">${m.icon}</div>
      <div class="metric-label">${m.label}${m.clickable ? ' <span style=\"font-size:9px;opacity:0.6\">(klik)</span>' : ''}</div>
      <div class="metric-value" style="color:${m.color}">${m.val}</div>
    </div>`).join('');

  const catMap = {};
  txM.filter(t => t.type === 'out').forEach(t => { catMap[t.cat] = (catMap[t.cat] || 0) + t.amount; });
  const cats   = Object.keys(catMap);
  const colors = ['#4A7C59','#B5651D','#C9A050','#2D2A26','#7C9A84','#8B6F3D','#A0785A','#6B8F76','#C4884A'];
  if (chartCat) chartCat.destroy();
  chartCat = new Chart(document.getElementById('chartCat'), {
    type: 'doughnut',
    data: { labels: cats, datasets: [{ data: cats.map(c => catMap[c]), backgroundColor: colors.slice(0, cats.length), borderWidth: 0, hoverOffset: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11, family: 'DM Sans' }, boxWidth: 10, padding: 12, color: '#AAA' } } }, cutout: '65%' }
  });

  const tL = [], tI = [], tO = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    tL.push(MONTHS[d.getMonth()] + ' ' + d.getFullYear());
    const txs = transactions.filter(t => { const td = new Date(t.date); return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear(); });
    tI.push(txs.filter(t => t.type === 'in'  && t.wallet !== 'tabungan').reduce((s, t) => s + t.amount, 0));
    tO.push(txs.filter(t => t.type === 'out' && t.wallet !== 'tabungan').reduce((s, t) => s + t.amount, 0));
  }
  if (chartTrend) chartTrend.destroy();
  chartTrend = new Chart(document.getElementById('chartTrend'), {
    type: 'bar',
    data: { labels: tL, datasets: [ { label: 'Pemasukan', data: tI, backgroundColor: 'rgba(74,124,89,0.7)', borderRadius: 6, borderSkipped: false }, { label: 'Pengeluaran', data: tO, backgroundColor: 'rgba(181,101,29,0.7)', borderRadius: 6, borderSkipped: false } ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { size: 11, family: 'DM Sans' }, boxWidth: 10, padding: 14 } } }, scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => fmtShort(v) }, grid: { color: 'rgba(45,42,38,0.06)' } } } }
  });

  const needs = txM.filter(t => t.type === 'out' && t.ratio === 'needs').reduce((s, t) => s + t.amount, 0);
  const wants = txM.filter(t => t.type === 'out' && t.ratio === 'wants').reduce((s, t) => s + t.amount, 0);
  const svgs  = txM.filter(t => t.type === 'out' && t.ratio === 'savings').reduce((s, t) => s + t.amount, 0);
  const tot   = (needs + wants + svgs) || 1;
  const pN = Math.round(needs / tot * 100), pW = Math.round(wants / tot * 100), pS = 100 - pN - pW;
  document.getElementById('ratioBar').innerHTML = `<div class="ratio-seg" style="width:${pN}%;background:var(--primary)"></div><div class="ratio-seg" style="width:${pW}%;background:var(--amber)"></div><div class="ratio-seg" style="width:${pS}%;background:var(--green)"></div>`;
  document.getElementById('rl-needs').textContent   = `Kebutuhan ${pN}%`;
  document.getElementById('rl-wants').textContent   = `Keinginan ${pW}%`;
  document.getElementById('rl-savings').textContent = `Tabungan ${pS}%`;

  const tipEl = document.getElementById('ratio-tip');
  tipEl.textContent = pN > 50 ? '⚠️ Kebutuhan melebihi 50% — evaluasi pengeluaran rutin.' : pW > 30 ? '⚠️ Keinginan melebihi 30% — kurangi pengeluaran tidak wajib.' : pS >= 20 ? '✅ Rasio keuanganmu sudah ideal! Pertahankan terus.' : '💡 Tingkatkan porsi tabungan ke minimal 20%.';
  tipEl.style.display = 'block';

  document.getElementById('recent-list').innerHTML = transactions.slice(0, 5).length ? transactions.slice(0, 5).map(t => txRow(t)).join('') : '<div class="empty"><div class="empty-anim"><span style="font-size:32px">📭</span></div><p>Belum ada transaksi</p><div class="empty-hint">Mulai catat pengeluaranmu hari ini</div></div>';
}

/* ===== TX ROW ===== */
function txRow(t) {
  const em  = CAT_EMOJI[t.cat] || '📦';
  const ibg = t.type === 'out' ? 'rgba(181,101,29,0.1)' : 'rgba(74,124,89,0.1)';
  const rl  = t.ratio === 'needs' ? 'Kebutuhan' : t.ratio === 'wants' ? 'Keinginan' : t.ratio === 'savings' ? 'Tabungan' : 'Pemasukan';
  const wal = t.wallet === 'mbanking' ? '🏦 M-Banking' : t.wallet === 'tabungan' ? '🏧 Tabungan Bank' : '👛 Dompet';
  return `<div class="tx-item">
    <div class="tx-left">
      <div class="tx-icon" style="background:${ibg}">${em}</div>
      <div>
        <div class="tx-name">${t.desc} <span style="font-size:10px;color:var(--gray-mid);font-weight:normal">(${wal})</span></div>
        <div class="tx-meta">${t.cat} · ${t.date} · <span class="badge badge-${t.ratio}">${rl}</span></div>
      </div>
    </div>
    <div class="tx-right">
      <div class="tx-amt ${t.type}">${t.type === 'out' ? '-' : '+'}${fmt(t.amount)}</div>
      <button class="tx-dup" onclick="duplicateTx(${t.id})" title="Duplikat ke form Catat">⧉</button>
      <button class="tx-edit" onclick="openEditModal(${t.id})" title="Edit">✏️</button>
      <button class="tx-del" onclick="deleteTx(${t.id})">🗑️</button>
    </div>
  </div>`;
}

/* ===== EDIT MODAL ===== */
function openEditModal(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  document.getElementById('edit-id').value     = id;
  document.getElementById('edit-type').value   = t.type;
  document.getElementById('edit-wallet').value = t.wallet || 'mbanking';
  document.getElementById('edit-desc').value   = t.desc;
  document.getElementById('edit-date').value   = t.date;
  document.getElementById('edit-amount').value = parseInt(t.amount).toLocaleString('id-ID');
  updateEditCatOptions();
  document.getElementById('edit-cat').value    = t.cat;
  const ratioGroup = document.getElementById('edit-ratio-group');
  if (t.type === 'out') {
    ratioGroup.style.display = '';
    document.getElementById('edit-ratio').value = t.ratio || 'needs';
  } else {
    ratioGroup.style.display = 'none';
  }
  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal(e) {
  if (e && e.target !== document.getElementById('edit-modal')) return;
  document.getElementById('edit-modal').style.display = 'none';
  document.getElementById('edit-msg').style.display = 'none';
}

function updateEditCatOptions() {
  const type = document.getElementById('edit-type').value;
  document.getElementById('edit-cat').innerHTML = (type === 'out' ? CAT_OUT : CAT_IN).map(c => `<option value="${c.replace(/^.+?\s/, '')}">${c}</option>`).join('');
  document.getElementById('edit-ratio-group').style.display = type === 'out' ? '' : 'none';
}

async function saveEdit() {
  const id     = parseInt(document.getElementById('edit-id').value);
  const type   = document.getElementById('edit-type').value;
  const wallet = document.getElementById('edit-wallet').value;
  const desc   = document.getElementById('edit-desc').value.trim();
  const cat    = document.getElementById('edit-cat').value;
  const date   = document.getElementById('edit-date').value;
  const amtRaw = document.getElementById('edit-amount').value.replace(/\./g, '');
  const amount = parseFloat(amtRaw);
  const ratio  = type === 'in' ? 'in' : document.getElementById('edit-ratio').value;

  if (!desc || !amount || !date || isNaN(amount) || amount <= 0) {
    showMsg('edit-msg', '⚠️ Lengkapi semua kolom!', 'error'); return;
  }

  const idx = transactions.findIndex(x => x.id === id);
  if (idx === -1) return;
  const updated = { ...transactions[idx], type, wallet, desc, cat, date, amount, ratio };

  try {
    await api('PUT', '/api/transactions/' + id, updated).catch(e => console.warn('Offline mode', e));
    transactions[idx] = updated;
    document.getElementById('edit-modal').style.display = 'none';
    const pg = document.querySelector('.page.active').id.replace('page-', '');
    if (pg === 'dashboard') renderDashboard();
    if (pg === 'riwayat')   renderHistory();
    if (pg === 'analisa')   renderAnalisa();
  } catch (err) {
    showMsg('edit-msg', '❌ Gagal simpan: ' + err.message, 'error');
  }
}

async function deleteTx(id) {
  const _delTxOk = await showConfirm({ icon:'🗑️', title:'Hapus transaksi?', message:'Transaksi ini akan dihapus permanen.', okText:'Hapus' });
  if (!_delTxOk) return;
  try {
    await api('DELETE', '/api/transactions/' + id).catch(e => console.warn('Offline mode', e));
    transactions = transactions.filter(t => t.id !== id);
    const pg = document.querySelector('.page.active').id.replace('page-', '');
    if (pg === 'dashboard') renderDashboard();
    if (pg === 'riwayat')   renderHistory();
    if (pg === 'analisa')   renderAnalisa();
  } catch (err) {
    showToast('Gagal hapus: ' + err.message, 'error');
  }
}

/* ===== DUPLICATE TRANSACTION ===== */
function duplicateTx(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;

  // Pindah ke halaman Catat
  const catBtn = document.querySelector('.pill-item[data-page="catat"]');
  showPage('catat', catBtn);
  syncBottomNav && syncBottomNav('catat');

  // Isi form dengan data transaksi yang di-duplikat
  setTimeout(() => {
    document.getElementById('inp-type').value   = t.type;
    document.getElementById('inp-wallet').value = t.wallet || 'mbanking';
    document.getElementById('inp-desc').value   = t.desc;
    document.getElementById('inp-date').value   = new Date().toISOString().split('T')[0]; // tanggal hari ini
    updateCatOptions();
    setTimeout(() => {
      document.getElementById('inp-cat').value   = t.cat;
      if (t.type === 'out') document.getElementById('inp-ratio').value = t.ratio || 'needs';
      const amtEl = document.getElementById('inp-amount');
      amtEl.value = parseInt(t.amount).toLocaleString('id-ID');
    }, 50);
    showToast(`⧉ Form diisi dari transaksi "${t.desc}"`, 'info', 2500);
    // Scroll ke atas form
    document.getElementById('page-catat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

/* ===== FILTERS ===== */
function populateFilters() {
  ['fil-month-h', 'fil-month-e'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    const seen = new Set();
    transactions.forEach(t => { const d = new Date(t.date); seen.add(d.getFullYear() + '-' + (d.getMonth() + 1)); });
    sel.innerHTML = '<option value="all">Semua bulan</option>';
    [...seen].sort().reverse().forEach(k => {
      const [y, m] = k.split('-'); const o = document.createElement('option');
      o.value = k; o.textContent = MONTHS[parseInt(m) - 1] + ' ' + y; sel.appendChild(o);
    });
  });
  const catSel = document.getElementById('fil-cat-h');
  if (catSel) {
    const cats = [...new Set(transactions.map(t => t.cat))].sort();
    catSel.innerHTML = '<option value="all">Semua kategori</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }
}

function getFiltered(mId='fil-month-h', tId='fil-type-h', cId='fil-cat-h', wId='fil-wallet-h', search='') {
  const m   = document.getElementById(mId)?.value   || 'all';
  const tp  = document.getElementById(tId)?.value   || 'all';
  const cat = cId ? (document.getElementById(cId)?.value  || 'all') : 'all';
  const wal = wId ? (document.getElementById(wId)?.value  || 'all') : 'all';

  // Range tanggal
  const dateFrom = document.getElementById('fil-date-from')?.value || '';
  const dateTo   = document.getElementById('fil-date-to')?.value   || '';

  return transactions.filter(t => {
    const d  = new Date(t.date), mk = d.getFullYear() + '-' + (d.getMonth() + 1);
    if (m   !== 'all' && mk      !== m)   return false;
    if (tp  !== 'all' && t.type  !== tp)  return false;
    if (cat !== 'all' && t.cat   !== cat) return false;
    if (wal !== 'all' && t.wallet !== wal) return false;
    if (dateFrom && t.date < dateFrom)    return false;
    if (dateTo   && t.date > dateTo)      return false;
    if (search && !t.desc.toLowerCase().includes(search.toLowerCase())
               && !t.cat.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
}

/* ===== SORT STATE ===== */
let _historySort = 'newest'; // newest | oldest | highest | lowest

function setHistorySort(val) {
  _historySort = val;
  renderHistory();
}

function sortTransactions(data) {
  const d = [...data];
  if (_historySort === 'newest')  return d.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  if (_historySort === 'oldest')  return d.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  if (_historySort === 'highest') return d.sort((a, b) => b.amount - a.amount);
  if (_historySort === 'lowest')  return d.sort((a, b) => a.amount - b.amount);
  return d;
}

function renderHistory() {
  const search = document.getElementById('search-input')?.value || '';
  // Show/hide clear button
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.style.display = search ? 'flex' : 'none';

  const data = getFiltered('fil-month-h', 'fil-type-h', 'fil-cat-h', 'fil-wallet-h', search);
  const sorted = sortTransactions(data);

  // Inject sort bar sekali
  let sortBar = document.getElementById('history-sort-bar');
  if (!sortBar) {
    sortBar = document.createElement('div');
    sortBar.id = 'history-sort-bar';
    sortBar.className = 'history-sort-bar';
    const histList = document.getElementById('history-list');
    histList.parentElement.insertBefore(sortBar, histList);
  }
  sortBar.innerHTML = `
    <span class="sort-label">Urutkan:</span>
    ${[['newest','🕐 Terbaru'],['oldest','🕰 Terlama'],['highest','⬆ Terbesar'],['lowest','⬇ Terkecil']]
      .map(([val, label]) => `<button class="sort-btn${_historySort===val?' active':''}" onclick="setHistorySort('${val}')">${label}</button>`)
      .join('')}
  `;

  document.getElementById('history-list').innerHTML = sorted.length
    ? sorted.map(t => txRow(t)).join('')
    : '<div class="empty"><div class="empty-anim"><span style="font-size:32px">🔍</span></div><p>Tidak ada transaksi yang cocok</p><div class="empty-hint">Coba ubah filter atau kata kunci</div></div>';

  const out = data.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const inp = data.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const bal = inp - out;
  document.getElementById('history-total').innerHTML =
    `<span style="color:var(--green)">+${fmt(inp)}</span>&nbsp;
     <span style="color:var(--gray-mid)">·</span>&nbsp;
     <span style="color:var(--red)">-${fmt(out)}</span>&nbsp;
     <span style="color:var(--gray-mid)">·</span>&nbsp;
     <span style="color:${bal>=0?'var(--green)':'var(--red)'}">Saldo: ${fmt(Math.abs(bal))}</span>&nbsp;
     <span style="color:var(--gray-mid)">(${sorted.length} transaksi)</span>`;
}

function clearSearch() {
  const inp = document.getElementById('search-input');
  if (inp) { inp.value = ''; inp.focus(); }
  renderHistory();
  renderFilterChips();
}

function clearAllFilters() {
  const inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  ['fil-month-h','fil-type-h','fil-cat-h','fil-wallet-h'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = 'all';
  });
  ['fil-date-from','fil-date-to'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderHistory(); renderFilterChips();
}

function renderFilterChips() {
  const chipsEl = document.getElementById('filter-chips');
  if (!chipsEl) return;

  const search   = document.getElementById('search-input')?.value   || '';
  const month    = document.getElementById('fil-month-h')?.value    || 'all';
  const type     = document.getElementById('fil-type-h')?.value     || 'all';
  const cat      = document.getElementById('fil-cat-h')?.value      || 'all';
  const wallet   = document.getElementById('fil-wallet-h')?.value   || 'all';
  const dateFrom = document.getElementById('fil-date-from')?.value  || '';
  const dateTo   = document.getElementById('fil-date-to')?.value    || '';

  const chips = [];
  if (search)          chips.push({ label: `"${search}"`,                       clear: `clearSearch()` });
  if (month !== 'all') {
    const [y,mo] = month.split('-');
    chips.push({ label: `${MONTHS[parseInt(mo)-1]} ${y}`,                       clear: `resetFilter('fil-month-h')` });
  }
  if (type  !== 'all') chips.push({ label: type==='out'?'💸 Pengeluaran':'💵 Pemasukan', clear:`resetFilter('fil-type-h')` });
  if (cat   !== 'all') chips.push({ label: cat,                                 clear:`resetFilter('fil-cat-h')` });
  if (wallet!== 'all') chips.push({ label: wallet==='mbanking'?'🏦 M-Banking': wallet==='tabungan'?'🏧 Tabungan Bank':'👛 Dompet', clear:`resetFilter('fil-wallet-h')` });
  if (dateFrom)        chips.push({ label: `Dari ${dateFrom}`,                  clear:`resetDateFilter('from')` });
  if (dateTo)          chips.push({ label: `Sampai ${dateTo}`,                  clear:`resetDateFilter('to')` });

  if (!chips.length) { chipsEl.style.display='none'; return; }
  chipsEl.style.display = 'flex';
  chipsEl.innerHTML = chips.map(c =>
    `<span class="filter-chip">${c.label}<button onclick="${c.clear}">✕</button></span>`
  ).join('') + (chips.length > 1
    ? `<button class="chip-clear-all" onclick="clearAllFilters()">Hapus semua ✕</button>`
    : '');
}

function resetDateFilter(which) {
  if (which === 'from') { const el=document.getElementById('fil-date-from'); if(el) el.value=''; }
  else                  { const el=document.getElementById('fil-date-to');   if(el) el.value=''; }
  renderHistory(); renderFilterChips();
}

function resetFilter(id) {
  const el = document.getElementById(id);
  if (el) el.value = 'all';
  renderHistory();
  renderFilterChips();
}

/* ===== ANALISA ===== */
let chartCatTrend = null;

function renderAnalisa() {
  renderWalletCharts();
  renderBorosHarian();

  /* ── Tabel ringkasan per bulan ── */
  const byMonth = {};
  transactions.forEach(t => {
    const d = new Date(t.date), key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!byMonth[key]) byMonth[key] = { label: MONTHS[d.getMonth()] + ' ' + d.getFullYear(), in: 0, out: 0 };
    if (t.type === 'in') byMonth[key].in += t.amount; else byMonth[key].out += t.amount;
  });
  document.getElementById('monthly-tbody').innerHTML = Object.keys(byMonth).sort().reverse().map(k => {
    const b = byMonth[k], s = b.in - b.out, ok = s >= 0;
    return `<tr><td style="font-weight:600;color:#DDD">${b.label}</td><td style="color:var(--green)">${fmt(b.in)}</td><td style="color:var(--red)">${fmt(b.out)}</td><td style="color:${ok ? '#4A7C59' : '#B5651D'};font-weight:700">${fmt(Math.abs(s))}</td><td><span class="badge" style="background:${ok ? 'rgba(74,124,89,0.12)' : 'rgba(181,101,29,0.12)'};color:${ok ? '#4A7C59' : '#B5651D'}">${ok ? 'Surplus' : 'Defisit'}</span></td></tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-mid)">Belum ada data</td></tr>';

  /* ── Grafik tren per kategori ── */
  renderCatTrendChart();

  /* ── Top pengeluaran ── */
  const catMap = {}; transactions.filter(t => t.type === 'out').forEach(t => { catMap[t.cat] = (catMap[t.cat] || 0) + t.amount; });
  const tops = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5); const maxV = tops[0]?.[1] || 1;
  document.getElementById('top-spending').innerHTML = tops.length ? tops.map(([cat, amt], i) => `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="font-weight:600;color:#DDD">${i + 1}. ${CAT_EMOJI[cat] || '📦'} ${cat}</span><span style="color:var(--red)">${fmt(amt)}</span></div><div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.round(amt / maxV * 100)}%;background:linear-gradient(90deg,#B5651D,#C9A050);border-radius:3px;transition:width 0.6s"></div></div></div>`).join('') : '<div class="empty"><p>Belum ada data</p></div>';

  /* ── Rasio 50/30/20 ── */
  const needs = transactions.filter(t => t.type === 'out' && t.ratio === 'needs').reduce((s, t) => s + t.amount, 0), wants = transactions.filter(t => t.type === 'out' && t.ratio === 'wants').reduce((s, t) => s + t.amount, 0), svgs  = transactions.filter(t => t.type === 'out' && t.ratio === 'savings').reduce((s, t) => s + t.amount, 0), tot   = (needs + wants + svgs) || 1;
  document.getElementById('ratio-analisa').innerHTML = [ { label: 'Kebutuhan', amt: needs, target: 50, color: '#4A7C59', ok: needs / tot * 100 <= 50 }, { label: 'Keinginan', amt: wants, target: 30, color: '#C9A050', ok: wants / tot * 100 <= 30 }, { label: 'Tabungan',  amt: svgs,  target: 20, color: '#4A7C59', ok: svgs  / tot * 100 >= 20 } ].map(item => {
    const pct = Math.round(item.amt / tot * 100);
    return `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-weight:600;color:${item.color};font-size:13px">${item.label}</span><span style="font-size:11px;font-weight:700;color:${item.ok ? '#4A7C59' : '#B5651D'}">${item.ok ? '✅ Aman' : '⚠️ Perlu perhatian'}</span></div><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-mid);margin-bottom:7px"><span>Aktual: <strong style="color:#DDD">${pct}%</strong></span><span>Target: <strong style="color:#DDD">${item.target}%</strong></span></div><div style="height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.min(pct, 100)}%;background:${item.color};border-radius:3px;transition:width 0.6s"></div></div></div>`;
  }).join('');
}

function renderCatTrendChart() {
  const canvas = document.getElementById('chartCatTrend');
  if (!canvas) return;

  // Ambil 6 bulan terakhir
  const now    = new Date();
  const months = [];
  const labels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
    labels.push(MONTHS[d.getMonth()] + ' ' + d.getFullYear());
  }

  // Ambil top 5 kategori pengeluaran (semua waktu)
  const catTotals = {};
  transactions.filter(t => t.type === 'out').forEach(t => {
    catTotals[t.cat] = (catTotals[t.cat] || 0) + t.amount;
  });
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);

  if (!topCats.length) return;

  const COLORS = ['#4A7C59','#B5651D','#C9A050','#2D2A26','#7C9A84','#8B6F3D','#A0785A'];

  // Build dataset per kategori
  const datasets = topCats.map((cat, i) => {
    const data = months.map(({ year, month }) =>
      transactions
        .filter(t => t.type === 'out' && t.cat === cat && (() => { const d = new Date(t.date); return d.getMonth() === month && d.getFullYear() === year; })())
        .reduce((s, t) => s + t.amount, 0)
    );
    return {
      label: (CAT_EMOJI[cat] || '📦') + ' ' + cat,
      data,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '18',
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: COLORS[i % COLORS.length],
      tension: 0.4,
      fill: false,
    };
  });

  if (chartCatTrend) chartCatTrend.destroy();
  chartCatTrend = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11, family: 'DM Sans' }, boxWidth: 10, padding: 12, color: '#AAA' }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmtShort(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 10 } } },
        y: {
          grid: { color: 'rgba(45,42,38,0.06)' },
          ticks: { callback: v => fmtShort(v), color: '#9CA3AF', font: { size: 10 } }
        }
      }
    }
  });
}

/* ===== EXPORT RAPI & TERTATA ===== */
function renderExportStats() {
  const m  = document.getElementById('fil-month-e')?.value || 'all'; const tp = document.getElementById('fil-type-e')?.value  || 'all';
  const data = transactions.filter(t => { const d = new Date(t.date), mk = d.getFullYear() + '-' + (d.getMonth() + 1); if (m !== 'all' && mk !== m) return false; if (tp !== 'all' && t.type !== tp) return false; return true; });
  const out = data.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0), inp = data.filter(t => t.type === 'in').reduce((s, t)  => s + t.amount, 0);
  document.getElementById('ekspor-stats').innerHTML = [ { label: 'Total transaksi', val: data.length, color: '#DDD' }, { label: 'Pengeluaran', val: fmtShort(out), color: 'var(--red)' }, { label: 'Pemasukan', val: fmtShort(inp), color: 'var(--green)' } ].map(s => `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--gray-mid);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.05em">${s.label}</div><div style="font-size:16px;font-weight:700;color:${s.color}">${s.val}</div></div>`).join('');
  document.getElementById('fil-month-e').onchange = renderExportStats; document.getElementById('fil-type-e').onchange  = renderExportStats;
}

function toggleSheet(key, el) { selectedSheets[key] = !selectedSheets[key]; el.classList.toggle('selected', selectedSheets[key]); }

function doExport() {
  const m = document.getElementById('fil-month-e')?.value || 'all'; 
  const tp = document.getElementById('fil-type-e')?.value || 'all';
  
  const data = transactions.filter(t => {
    const d = new Date(t.date), mk = d.getFullYear() + '-' + (d.getMonth() + 1);
    if (m !== 'all' && mk !== m) return false;
    if (tp !== 'all' && t.type !== tp) return false;
    return true;
  });

  if (!data.length) { showMsg('export-msg', '⚠️ Tidak ada data.', 'error'); return; }
  if (!Object.values(selectedSheets).some(Boolean)) { showMsg('export-msg', '⚠️ Pilih minimal satu sheet.', 'error'); return; }
  
  document.getElementById('btn-export').disabled = true; 
  document.getElementById('export-progress').style.display = 'block';
  const fill = document.getElementById('exp-fill'); fill.style.width = '20%';
  
  setTimeout(() => {
    try {
      const wb = XLSX.utils.book_new();

      // ============================================
      // SETUP EXCEL STYLING (WARNA, BORDER, RUPIAH)
      // ============================================
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4A7C59" } }, // Warna Biru Khas Aplikasi
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin", color: {rgb:"BFDBFE"} }, bottom: { style: "thin", color: {rgb:"BFDBFE"} }, left: { style: "thin", color: {rgb:"BFDBFE"} }, right: { style: "thin", color: {rgb:"BFDBFE"} } }
      };

      const dataStyleLeft = {
        alignment: { horizontal: "left", vertical: "center" },
        border: { top: { style: "thin", color: {rgb:"E5E7EB"} }, bottom: { style: "thin", color: {rgb:"E5E7EB"} }, left: { style: "thin", color: {rgb:"E5E7EB"} }, right: { style: "thin", color: {rgb:"E5E7EB"} } }
      };

      const dataStyleMoney = {
        alignment: { horizontal: "right", vertical: "center" },
        border: { top: { style: "thin", color: {rgb:"E5E7EB"} }, bottom: { style: "thin", color: {rgb:"E5E7EB"} }, left: { style: "thin", color: {rgb:"E5E7EB"} }, right: { style: "thin", color: {rgb:"E5E7EB"} } },
        z: '"Rp"#,##0_);\\("Rp"#,##0\\)' // Format Rupiah Otomatis
      };

      const dataStyleCenter = {
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin", color: {rgb:"E5E7EB"} }, bottom: { style: "thin", color: {rgb:"E5E7EB"} }, left: { style: "thin", color: {rgb:"E5E7EB"} }, right: { style: "thin", color: {rgb:"E5E7EB"} } }
      };

      const applyStylesToSheet = (ws) => {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({r: R, c: C});
            if(!ws[cellRef]) continue;

            if (R === 0) {
              ws[cellRef].s = headerStyle; // Baris 1 selalu Header
            } else {
              if (typeof ws[cellRef].v === 'number') {
                ws[cellRef].s = dataStyleMoney; // Default untuk angka adalah Rupiah
              } else {
                ws[cellRef].s = dataStyleLeft; // Teks biasa rata kiri
              }
            }
          }
        }
      };
      // ============================================

      if (selectedSheets.tx) {
        const rows = [['No','Tanggal','Tipe','Dompet/Bank','Kategori','Keterangan','Jumlah (Rp)','Golongan']];
        let total = 0;
        data.forEach((t, i) => {
          const amt = t.type === 'out' ? -t.amount : t.amount;
          total += amt;
          rows.push([
            i+1, 
            t.date, 
            t.type === 'out' ? 'Pengeluaran' : 'Pemasukan', 
            t.wallet === 'mbanking' ? 'M-Banking' : t.wallet === 'tabungan' ? 'Tabungan Bank' : 'Dompet', 
            t.cat, 
            t.desc, 
            amt, 
            t.ratio === 'needs' ? 'Kebutuhan' : t.ratio === 'wants' ? 'Keinginan' : t.ratio === 'savings' ? 'Tabungan' : 'Pemasukan'
          ]);
        });
        rows.push(['','','','','','TOTAL', total,'']);
        
        const ws = XLSX.utils.aoa_to_sheet(rows); 
        ws['!cols'] = [{wch:5}, {wch:12}, {wch:14}, {wch:14}, {wch:16}, {wch:35}, {wch:18}, {wch:14}];
        applyStylesToSheet(ws);

        // Styling ekstra untuk baris bawah (Total)
        const lastRow = rows.length - 1;
        for(let C=0; C<=7; C++) {
          const ref = XLSX.utils.encode_cell({r:lastRow, c:C});
          if(ws[ref]) ws[ref].s = { ...ws[ref].s, font: { bold: true }, fill: { fgColor: { rgb: "F3F4F6" } } };
        }
        XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Transaksi');
      }

      fill.style.width = '45%';
      
      if (selectedSheets.summary) {
        const bm = {}; 
        data.forEach(t => { 
          const d=new Date(t.date), k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); 
          if(!bm[k]) bm[k] = {label:MONTHS[d.getMonth()]+' '+d.getFullYear(), in:0, out:0}; 
          if(t.type==='in') bm[k].in += t.amount; else bm[k].out += t.amount; 
        });
        
        const rows = [['Bulan','Pemasukan','Pengeluaran','Saldo','Status']];
        Object.keys(bm).sort().forEach(k => { 
          const b=bm[k], s=b.in-b.out; 
          rows.push([b.label, b.in, b.out, s, s>=0 ? 'Surplus' : 'Defisit']); 
        });
        
        const ws = XLSX.utils.aoa_to_sheet(rows); 
        ws['!cols']=[{wch:16}, {wch:20}, {wch:20}, {wch:20}, {wch:12}]; 
        applyStylesToSheet(ws);
        XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan Bulanan');
      }

      fill.style.width = '65%';
      
      if (selectedSheets.cat) {
        const cm={}; 
        data.filter(t=>t.type==='out').forEach(t=>{cm[t.cat]=(cm[t.cat]||0)+t.amount;}); 
        const total = Object.values(cm).reduce((s,v)=>s+v,0) || 1;
        
        const rows=[['Kategori','Total (Rp)','Persentase','Jumlah Transaksi']];
        Object.entries(cm).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt]) => {
          rows.push([cat, amt, amt/total, data.filter(t=>t.type==='out'&&t.cat===cat).length]);
        });
        
        const ws=XLSX.utils.aoa_to_sheet(rows); 
        ws['!cols']=[{wch:18}, {wch:22}, {wch:14}, {wch:18}]; 
        applyStylesToSheet(ws);
        
        // Memperbaiki format kolom persentase & transaksi
        for (let R = 1; R < rows.length; ++R) {
          const cellPct = XLSX.utils.encode_cell({r: R, c: 2});
          const cellNum = XLSX.utils.encode_cell({r: R, c: 3});
          if(ws[cellPct]) ws[cellPct].z = '0.0%'; 
          if(ws[cellNum]) { ws[cellNum].s = dataStyleCenter; ws[cellNum].z = '0'; }
        }
        XLSX.utils.book_append_sheet(wb, ws, 'Per Kategori');
      }

      fill.style.width = '82%';
      
      if (selectedSheets.ratio) {
        const n=data.filter(t=>t.type==='out'&&t.ratio==='needs').reduce((s,t)=>s+t.amount,0);
        const w=data.filter(t=>t.type==='out'&&t.ratio==='wants').reduce((s,t)=>s+t.amount,0);
        const sv=data.filter(t=>t.type==='out'&&t.ratio==='savings').reduce((s,t)=>s+t.amount,0);
        const tt=(n+w+sv)||1;
        
        const rows=[
          ['Golongan','Total (Rp)','Aktual','Target','Selisih','Evaluasi'],
          ['Kebutuhan', n, n/tt, 0.50, (n/tt)-0.50, n/tt<=0.50 ? 'Aman' : 'Melebihi'],
          ['Keinginan', w, w/tt, 0.30, (w/tt)-0.30, w/tt<=0.30 ? 'Aman' : 'Melebihi'],
          ['Tabungan', sv, sv/tt, 0.20, (sv/tt)-0.20, sv/tt>=0.20 ? 'Tercapai' : 'Kurang'],
          ['TOTAL', n+w+sv, 1, 1, 0, '']
        ];
        
        const ws=XLSX.utils.aoa_to_sheet(rows); 
        ws['!cols']=[{wch:14},{wch:20},{wch:12},{wch:12},{wch:12},{wch:14}]; 
        applyStylesToSheet(ws);

        // Format khusus untuk rasio (Persentase)
        for (let R = 1; R <= 4; ++R) {
          [2, 3, 4].forEach(C => {
            const ref = XLSX.utils.encode_cell({r: R, c: C});
            if(ws[ref]) ws[ref].z = '0.0%';
          });
          // Bold row TOTAL
          if (R === 4) { 
            for(let C=0; C<=5; C++){
              const ref = XLSX.utils.encode_cell({r: R, c: C});
              if(ws[ref]) ws[ref].s = { ...ws[ref].s, font: { bold: true }, fill: { fgColor: { rgb: "F3F4F6" } } };
            }
          }
        }
        XLSX.utils.book_append_sheet(wb, ws, 'Rasio 50-30-20');
      }

      fill.style.width = '97%';
      const now = new Date(), fn = `DuitTracker_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.xlsx`;
      XLSX.writeFile(wb, fn); 
      fill.style.width = '100%';
      showMsg('export-msg', '✅ File berhasil diunduh dan sudah dirapikan!', 'success');
      
    } catch (e) { 
      showMsg('export-msg', '❌ Gagal: ' + e.message, 'error'); 
    }
    
    document.getElementById('btn-export').disabled = false;
    setTimeout(() => { document.getElementById('export-progress').style.display = 'none'; fill.style.width = '0%'; }, 1500);
  }, 300);
}

/* ===== SETTINGS ===== */
function loadSettings() {
  if (settings.budget) { document.getElementById('inp-budget').value = parseInt(settings.budget, 10).toLocaleString('id-ID'); }
  document.getElementById('inp-name').value = settings.name || currentUser.name || '';
  ['daily','weekly','budget'].forEach(k => { const el = document.getElementById('rem-' + k); if (el) el.checked = !!(settings.reminders?.[k]); });
  updateBudgetInfo();
  renderCategoryChips();

  // Sync profil avatar UI
  const savedPhoto = localStorage.getItem('duit_avatar_photo');
  const avatar = localStorage.getItem('duit_avatar') || '👤';
  const avatarDisplay = document.getElementById('profile-avatar-display');
  const nameDisplay   = document.getElementById('profile-name-display');
  if (nameDisplay) nameDisplay.textContent = settings.name || currentUser.name || 'Pengguna';

  if (savedPhoto && avatarDisplay) {
    avatarDisplay.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center';
    avatarDisplay.innerHTML = `<img src="${savedPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
  } else if (avatarDisplay) {
    avatarDisplay.style.cssText = '';
    avatarDisplay.textContent = avatar;
  }

  // Tampilkan/sembunyikan tombol hapus foto
  const removeRow = document.getElementById('remove-photo-row');
  if (removeRow) removeRow.style.display = savedPhoto ? 'block' : 'none';

  // Highlight selected avatar
  document.querySelectorAll('.avatar-opt').forEach(el => {
    el.classList.toggle('selected', !savedPhoto && el.textContent.trim() === avatar);
  });
}

async function saveBudget(v) {
  const rawV = String(v).replace(/\./g, '');
  settings.budget = parseFloat(rawV) || 0;
  try { await api('POST', '/api/settings', { key: 'budget', value: settings.budget }).catch(e=>console.warn(e)); }
  catch (e) { console.error('Gagal simpan budget:', e); }
  updateBudgetInfo();
}

async function saveName(v) {
  settings.name = v;
  currentUser.name = v;
  updateTopbarUser();
  initLoginScreen();
  const nameDisplay = document.getElementById('profile-name-display');
  if (nameDisplay) nameDisplay.textContent = v || 'Pengguna';
  try { await api('POST', '/api/settings', { key: 'name', value: v }).catch(e=>console.warn(e)); }
  catch (e) { console.error('Gagal simpan nama:', e); }
}

async function savePin() {
  const np = document.getElementById('inp-pin-new').value;
  const cp = document.getElementById('inp-pin-confirm').value;
  if (np.length !== 4 || !/^\d{4}$/.test(np)) { showMsg('pin-msg', '⚠️ PIN harus 4 angka!', 'error'); return; }
  if (np !== cp) { showMsg('pin-msg', '⚠️ PIN tidak cocok!', 'error'); return; }

  const oldPin = await showPrompt('Masukkan PIN lama untuk konfirmasi:', '', 'password');
  if (!oldPin) return;

  try {
    await api('POST', '/api/change-pin', { oldPin, newPin: np });
    document.getElementById('inp-pin-new').value = '';
    document.getElementById('inp-pin-confirm').value = '';
    showMsg('pin-msg', '✅ PIN berhasil diubah!', 'success');
    setTimeout(() => { document.getElementById('pin-msg').style.display = 'none'; }, 2500);
  } catch (err) {
    showMsg('pin-msg', '❌ ' + err.message, 'error');
  }
}

function updateBudgetInfo() {
  const el = document.getElementById('budget-info');
  if (!el || !settings.budget) { if (el) el.textContent = ''; return; }
  const now = new Date();
  const expense = transactions.filter(t => { const d = new Date(t.date); return t.type==='out' && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); }).reduce((s, t) => s + t.amount, 0);
  const pct = Math.round(expense / settings.budget * 100);
  el.innerHTML = `Terpakai: <strong style="color:${pct>=80?'var(--red)':'var(--green)'}">${fmt(expense)}</strong> dari ${fmt(settings.budget)} (<strong>${pct}%</strong>)`;
}

async function saveReminder(key, val) {
  if (!settings.reminders) settings.reminders = {};
  settings.reminders[key] = val;
  try { await api('POST', '/api/settings', { key: 'reminders', value: JSON.stringify(settings.reminders) }).catch(e=>console.warn(e)); }
  catch (e) { console.error('Gagal simpan reminder:', e); }
  if (val && 'Notification' in window) {
    Notification.requestPermission().then(p => { showMsg('rem-msg', p==='granted' ? '✅ Reminder aktif!' : '⚠️ Izinkan notifikasi di browser.', p==='granted' ? 'success' : 'error'); });
  } else { showMsg('rem-msg', 'Reminder dinonaktifkan.', 'success'); }
  setTimeout(() => { document.getElementById('rem-msg').style.display = 'none'; }, 3000);
}

async function confirmReset() {
  const _resetOk = await showConfirm({ icon:'🚨', title:'Hapus semua data?', message:'Semua transaksi akan dihapus permanen. Tindakan ini tidak bisa dibatalkan!', okText:'Ya, hapus semua' });
  if (_resetOk) {
    try {
      await api('DELETE', '/api/transactions').catch(e=>console.warn(e));
      transactions = [];
      renderDashboard();
      showToast('Data berhasil dihapus.', 'success');
    } catch (err) {
      showToast('Gagal hapus: ' + err.message, 'error');
    }
  }
}

/* ===== MOBILE BOTTOM NAV ===== */
function syncBottomNav(pageId) {
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  const match = document.querySelector(`.bnav-btn[data-page="${pageId}"]`);
  if (match) match.classList.add('active');
}

function syncTopNav(pageId) {
  document.querySelectorAll('.pill-item').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pageId);
  });
}

/* ===== PILL NAV (desktop top bar, GSAP hover-circle) ===== */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.pill-nav-wrap .pill-item').forEach(pill => {
    const circle = pill.querySelector('.pill-hover-circle');
    if (!circle || !window.gsap) return;
    gsap.set(circle, { yPercent: 100 });
    pill.addEventListener('mouseenter', () => {
      gsap.to(circle, { yPercent: 0, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
    });
    pill.addEventListener('mouseleave', () => {
      gsap.to(circle, { yPercent: 100, duration: 0.25, ease: 'power3.in', overwrite: 'auto' });
    });
  });
});

function openMoreMenu() {
  const sheet = document.getElementById('more-menu-sheet');
  sheet.style.display = 'block';
  document.body.style.overflow = 'hidden';
  // update badge
  const due = getDueRecurringCount();
  const badge = document.getElementById('more-recurring-badge');
  if (badge) { badge.textContent = due; badge.style.display = due > 0 ? 'flex' : 'none'; }
  // highlight item matching the current page
  document.querySelectorAll('.more-menu-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === _currentPage);
  });
}

function closeMoreMenu() {
  document.getElementById('more-menu-sheet').style.display = 'none';
  document.body.style.overflow = '';
}

/* ===== AVATAR ===== */
function toggleAvatarPicker() {
  const grid = document.getElementById('avatar-picker-grid');
  grid.style.display = grid.style.display === 'none' ? 'flex' : 'none';
}

/* Helper: set avatar di semua elemen (emoji string atau data URL foto) */
function applyAvatarToAll(value, isPhoto) {
  const targets = [
    { id: 'profile-avatar-display', isSpan: true },
    { id: 'topbar-avatar',          isSpan: false },
    { id: 'login-avatar',           isSpan: false },
  ];

  targets.forEach(({ id, isSpan }) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isPhoto) {
      el.innerHTML = `<img src="${value}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
    } else {
      el.innerHTML = isSpan ? value : value;
    }
  });

  // Profile big avatar
  const big = document.getElementById('profile-avatar-display');
  if (big) {
    if (isPhoto) {
      big.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center';
      big.innerHTML = `<img src="${value}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
    } else {
      big.style.cssText = '';
      big.textContent = value;
    }
  }
}

function selectAvatar(emoji) {
  currentUser.emoji = emoji;
  currentUser.photo = null;
  localStorage.setItem('duit_avatar', emoji);
  localStorage.removeItem('duit_avatar_photo');

  applyAvatarToAll(emoji, false);

  // Highlight selected
  document.querySelectorAll('.avatar-opt').forEach(el => {
    el.classList.toggle('selected', el.textContent.trim() === emoji);
  });
  // Auto close after pick
  setTimeout(() => {
    const grid = document.getElementById('avatar-picker-grid');
    if (grid) grid.style.display = 'none';
  }, 300);
}

function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('File harus berupa gambar (JPG, PNG, dll)', 'warning'); return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('Ukuran foto maksimal 2 MB', 'warning'); return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const dataUrl = e.target.result;

    // Simpan ke localStorage (sebagai data URL)
    try {
      localStorage.setItem('duit_avatar_photo', dataUrl);
      localStorage.setItem('duit_avatar', '📷');
    } catch (err) {
      showToast('Foto terlalu besar untuk disimpan. Coba foto yang lebih kecil.', 'warning'); return;
    }

    currentUser.emoji = '📷';
    currentUser.photo = dataUrl;

    applyAvatarToAll(dataUrl, true);

    // Tampilkan tombol hapus foto
    const removeRow = document.getElementById('remove-photo-row');
    if (removeRow) removeRow.style.display = 'block';

    // Reset file input agar bisa upload ulang file yg sama
    event.target.value = '';
  };
  reader.readAsDataURL(file);
}

/* Hapus foto, kembali ke emoji default */
function removeAvatarPhoto() {
  localStorage.removeItem('duit_avatar_photo');
  localStorage.setItem('duit_avatar', '👤');
  currentUser.emoji = '👤';
  currentUser.photo = null;
  applyAvatarToAll('👤', false);

  const removeRow = document.getElementById('remove-photo-row');
  if (removeRow) removeRow.style.display = 'none';
}

/* ===== GRAFIK PER WALLET ===== */
let chartWalletBalance = null, chartWalletTrend = null;

function renderWalletCharts() {
  // Kumpulkan semua wallet unik
  const wallets = [...new Set(transactions.map(t => t.wallet))];
  const walletLabel = { mbanking: '🏦 M-Banking', dompet: '👛 Dompet', tabungan: '🏧 Tabungan Bank' };
  const walletColor = { mbanking: '#4A7C59', dompet: '#C9A050', tabungan: '#2D2A26' };
  const defaultColors = ['#4A7C59','#B5651D','#C9A050','#2D2A26','#7C9A84'];

  // ---- Chart 1: Saldo per wallet (donut) ----
  const balances = wallets.map(w =>
    transactions.reduce((s, t) => s + (t.wallet === w ? (t.type === 'in' ? t.amount : -t.amount) : 0), 0)
  );
  const labels1 = wallets.map(w => walletLabel[w] || ('💼 ' + w));
  const colors1  = wallets.map((w, i) => walletColor[w] || defaultColors[i % defaultColors.length]);

  if (chartWalletBalance) chartWalletBalance.destroy();
  chartWalletBalance = new Chart(document.getElementById('chartWalletBalance'), {
    type: 'doughnut',
    data: {
      labels: labels1,
      datasets: [{ data: balances.map(b => Math.max(b, 0)), backgroundColor: colors1, borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11, family: 'DM Sans' }, boxWidth: 10, padding: 12, color: '#AAA' } } }
    }
  });

  // ---- Chart 2: Tren pengeluaran per wallet (line) — 6 bulan ----
  const now = new Date();
  const tLabels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    tLabels.push(MONTHS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2));
  }

  const datasets = wallets.map((w, i) => {
    const color = walletColor[w] || defaultColors[i % defaultColors.length];
    const data = [];
    for (let j = 5; j >= 0; j--) {
      const d = new Date(now.getFullYear(), now.getMonth() - j, 1);
      const total = transactions
        .filter(t => t.wallet === w && t.type === 'out' && (() => { const td = new Date(t.date); return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear(); })())
        .reduce((s, t) => s + t.amount, 0);
      data.push(total);
    }
    return {
      label: walletLabel[w] || w,
      data,
      borderColor: color,
      backgroundColor: color + '22',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: color
    };
  });

  if (chartWalletTrend) chartWalletTrend.destroy();
  chartWalletTrend = new Chart(document.getElementById('chartWalletTrend'), {
    type: 'line',
    data: { labels: tLabels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { size: 11, family: 'DM Sans' }, boxWidth: 10, padding: 14, color: '#AAA' } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#666' } },
        y: { ticks: { callback: v => fmtShort(v), color: '#666' }, grid: { color: 'rgba(45,42,38,0.06)' } }
      }
    }
  });
}



let isDark = localStorage.getItem('duit_theme') !== 'light'; // tambah baris ini di atas

function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
}

function toggleTheme() {
  isDark = !isDark;
  localStorage.setItem('duit_theme', isDark ? 'dark' : 'light');
  applyTheme();
}

applyTheme();

/* ===== BUDGET ALERT REAL-TIME ===== */
let lastAlertPct = 0;

function checkBudgetAlert() {
  const banner = document.getElementById('budget-alert-banner');
  if (!banner || !settings.budget) { if (banner) banner.style.display = 'none'; return; }
  const now = new Date();
  const expense = transactions
    .filter(t => { const d = new Date(t.date); return t.type==='out' && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); })
    .reduce((s, t) => s + t.amount, 0);
  const pct = Math.round(expense / settings.budget * 100);

  if (pct >= 100) {
    banner.style.display = 'flex';
    banner.className = 'budget-alert-banner alert-danger';
    banner.innerHTML = `<span>🚨</span><div><strong>Anggaran Habis!</strong> Pengeluaran sudah ${pct}% dari anggaran bulan ini (${fmt(expense)} / ${fmt(settings.budget)})</div><button onclick="this.parentElement.style.display='none'">✕</button>`;
  } else if (pct >= 80) {
    banner.style.display = 'flex';
    banner.className = 'budget-alert-banner alert-warn';
    banner.innerHTML = `<span>⚠️</span><div><strong>Anggaran Hampir Habis!</strong> Sudah terpakai ${pct}% — sisa ${fmt(settings.budget - expense)}</div><button onclick="this.parentElement.style.display='none'">✕</button>`;
  } else {
    banner.style.display = 'none';
  }

  // Browser notification saat pertama kali lewat threshold
  if (pct >= 80 && lastAlertPct < 80 && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('⚠️ Duit Tracker — Anggaran hampir habis!', {
      body: `Pengeluaran bulan ini sudah ${pct}% dari anggaran.`,
      icon: '💰'
    });
  }
  lastAlertPct = pct;
}

/* ===== TODAY WIDGET ===== */
function renderTodayWidget() {
  const widget = document.getElementById('today-widget');
  if (!widget) return;
  const today = new Date().toISOString().split('T')[0];
  const txToday = transactions.filter(t => t.date === today);
  const incToday = txToday.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const outToday = txToday.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const countToday = txToday.length;

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  })();

  widget.innerHTML = `
    <div class="today-greet">${greet}, <strong>${currentUser.name}</strong> ${currentUser.emoji}</div>
    <div class="today-stats">
      <div class="today-stat">
        <div class="today-stat-label">Pemasukan hari ini</div>
        <div class="today-stat-val green">+${fmt(incToday)}</div>
      </div>
      <div class="today-divider"></div>
      <div class="today-stat">
        <div class="today-stat-label">Pengeluaran hari ini</div>
        <div class="today-stat-val red">-${fmt(outToday)}</div>
      </div>
      <div class="today-divider"></div>
      <div class="today-stat">
        <div class="today-stat-label">Transaksi hari ini</div>
        <div class="today-stat-val">${countToday} transaksi</div>
      </div>
    </div>
    ${countToday === 0 ? '<div class="today-empty">📝 Belum ada transaksi hari ini. Yuk catat!</div>' : ''}
  `;
}

/* ===== TRANSAKSI BERULANG ===== */

function saveRecurring() {
  localStorage.setItem('duit_recurring', JSON.stringify(recurringList));
}

function toggleRecurringOpts() {
  const on = document.getElementById('inp-recurring').checked;
  const freq = document.getElementById('inp-freq');
  freq.style.display = on ? 'block' : 'none';
}

function renderRecurringPage() {
  const container = document.getElementById('recurring-list');
  if (!container) return;
  if (!recurringList.length) {
    container.innerHTML = `<div class="card glass"><div class="empty"><div class="empty-anim"><span style="font-size:32px">🔁</span></div><p>Belum ada transaksi berulang.</p><div class="empty-hint">Aktifkan saat mencatat transaksi</div></div></div>`;
    return;
  }
  const freqLabel = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' };
  container.innerHTML = recurringList.map(r => {
    const due = isRecurringDue(r);
    return `<div class="card glass" style="margin-bottom:1rem;${due ? 'border-color:rgba(201,160,80,0.3)' : ''}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="tx-icon" style="background:${r.type==='out'?'rgba(181,101,29,0.1)':'rgba(74,124,89,0.1)'}">${CAT_EMOJI[r.cat]||'📦'}</div>
          <div>
            <div style="font-weight:700;font-size:13px;color:#EEE">${r.desc}</div>
            <div style="font-size:11px;color:var(--gray-mid);margin-top:2px">${r.cat} · ${freqLabel[r.freq]} · ${r.wallet==='mbanking'?'🏦':r.wallet==='tabungan'?'🏧':'👛'} ${r.wallet==='mbanking'?'M-Banking':r.wallet==='tabungan'?'Tabungan Bank':'Dompet'}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:13px;color:${r.type==='out'?'var(--red)':'var(--green)'}">${r.type==='out'?'-':'+'}${fmt(r.amount)}</div>
          ${due ? '<div style="font-size:10px;color:var(--amber);font-weight:700;margin-top:2px">⏰ Jatuh tempo!</div>' : `<div style="font-size:10px;color:var(--gray-mid);margin-top:2px">Terakhir: ${r.lastRun||'-'}</div>`}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        ${due ? `<button class="btn-primary" style="flex:2;font-size:12px;padding:8px" onclick="executeRecurring(${r.id})">✅ Catat Sekarang</button>` : ''}
        <button class="btn-outline" style="flex:1;font-size:12px;padding:8px;justify-content:center" onclick="skipRecurring(${r.id})">⏭ Skip</button>
        <button class="tx-del" style="font-size:14px" onclick="deleteRecurring(${r.id})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function isRecurringDue(r) {
  if (!r.lastRun) return true;
  const last = new Date(r.lastRun);
  const now  = new Date();
  if (r.freq === 'daily')   return (now - last) >= 86400000;
  if (r.freq === 'weekly')  return (now - last) >= 7 * 86400000;
  if (r.freq === 'monthly') return now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear();
  return false;
}

async function executeRecurring(id) {
  const r = recurringList.find(x => x.id === id);
  if (!r) return;
  const today = new Date().toISOString().split('T')[0];
  const tx = { id: Date.now(), type: r.type, wallet: r.wallet, cat: r.cat, desc: r.desc, amount: r.amount, date: today, ratio: r.ratio };
  try {
    await api('POST', '/api/transactions', tx).catch(e => console.warn('Offline', e));
    transactions.unshift(tx);
    r.lastRun = today;
    saveRecurring();
    checkBudgetAlert();
    renderRecurringPage();
    showToast(`✅ "${r.desc}" berhasil dicatat!`, 'success');
  } catch(e) { showToast('Gagal: ' + e.message, 'error'); }
}

function skipRecurring(id) {
  const r = recurringList.find(x => x.id === id);
  if (!r) return;
  r.lastRun = new Date().toISOString().split('T')[0];
  saveRecurring();
  renderRecurringPage();
}

async function deleteRecurring(id) {
  const _delRecOk = await showConfirm({ icon:'🔁', title:'Hapus berulang?', message:'Hapus transaksi berulang ini?', okText:'Hapus' });
  if (!_delRecOk) return;
  recurringList = recurringList.filter(r => r.id !== id);
  saveRecurring();
  renderRecurringPage();
}

function getDueRecurringCount() {
  return recurringList.filter(r => isRecurringDue(r)).length;
}

/* ===== SKELETON LOADING ===== */
function showSkeleton() {
  const sk = document.getElementById('dashboard-skeleton');
  const content = document.getElementById('dashboard-content');
  if (sk) sk.style.display = 'block';
  if (content) content.style.display = 'none';
}

function hideSkeleton() {
  const sk = document.getElementById('dashboard-skeleton');
  if (sk) {
    sk.style.animation = 'skFadeOut 0.3s ease both';
    setTimeout(() => {
      sk.style.display = 'none';
      sk.style.animation = '';
    }, 300);
  }
}

/* ===== GLOBAL SEARCH ===== */
let _gsearchOpen = false;

function openGlobalSearch() {
  _gsearchOpen = true;
  const box     = document.getElementById('global-search-box');
  const trigger = document.getElementById('global-search-trigger');
  const results = document.getElementById('global-search-results');
  box.style.display     = 'flex';
  trigger.style.display = 'none';
  results.style.display = 'none';
  setTimeout(() => document.getElementById('global-search-input').focus(), 50);
  document.addEventListener('click', _gsearchOutside);
}

function closeGlobalSearch() {
  _gsearchOpen = false;
  document.getElementById('global-search-box').style.display     = 'none';
  document.getElementById('global-search-trigger').style.display = 'flex';
  document.getElementById('global-search-results').style.display = 'none';
  document.getElementById('global-search-input').value           = '';
  document.removeEventListener('click', _gsearchOutside);
}

function _gsearchOutside(e) {
  const wrap = document.getElementById('global-search-wrap');
  if (wrap && !wrap.contains(e.target)) closeGlobalSearch();
}

function handleGlobalSearchKey(e) {
  if (e.key === 'Escape') { closeGlobalSearch(); return; }
  const items = document.querySelectorAll('.gsearch-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const active = document.querySelector('.gsearch-item.gsi-focus');
    const next = active ? active.nextElementSibling : items[0];
    if (active) active.classList.remove('gsi-focus');
    if (next) next.classList.add('gsi-focus');
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const active = document.querySelector('.gsearch-item.gsi-focus');
    const prev = active ? active.previousElementSibling : items[items.length - 1];
    if (active) active.classList.remove('gsi-focus');
    if (prev) prev.classList.add('gsi-focus');
  }
  if (e.key === 'Enter') {
    const active = document.querySelector('.gsearch-item.gsi-focus');
    if (active) active.click();
  }
}

function renderGlobalSearch() {
  const q       = document.getElementById('global-search-input').value.trim().toLowerCase();
  const results = document.getElementById('global-search-results');
  if (!q) { results.style.display = 'none'; return; }

  const hits = transactions.filter(t =>
    t.desc.toLowerCase().includes(q) ||
    t.cat.toLowerCase().includes(q) ||
    t.date.includes(q) ||
    String(t.amount).includes(q.replace(/\./g,''))
  ).slice(0, 8);

  if (!hits.length) {
    results.style.display = 'block';
    results.innerHTML = `<div class="gsearch-empty">Tidak ada hasil untuk "<strong>${q}</strong>"</div>`;
    return;
  }

  results.style.display = 'block';
  results.innerHTML = hits.map(t => {
    const em   = CAT_EMOJI[t.cat] || '📦';
    const sign = t.type === 'out' ? '-' : '+';
    const col  = t.type === 'out' ? 'var(--red)' : 'var(--green)';
    const hi   = (str) => str.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'), '<mark>$1</mark>');
    return `<div class="gsearch-item" onclick="gsearchJump(${t.id})">
      <span class="gsi-icon">${em}</span>
      <div class="gsi-body">
        <div class="gsi-desc">${hi(t.desc)}</div>
        <div class="gsi-meta">${t.cat} · ${t.date}</div>
      </div>
      <div class="gsi-amt" style="color:${col}">${sign}${fmtShort(t.amount)}</div>
    </div>`;
  }).join('') + `<div class="gsearch-footer" onclick="gsearchShowAll('${q}')">Lihat semua hasil di Riwayat →</div>`;
}

function gsearchJump(id) {
  closeGlobalSearch();
  // buka riwayat dan highlight transaksi
  const navBtn = document.querySelector('.pill-item[data-page="riwayat"]');
  showPage('riwayat', navBtn);
  setTimeout(() => {
    const inp = document.getElementById('search-input');
    const tx  = transactions.find(t => t.id === id);
    if (inp && tx) { inp.value = tx.desc; renderHistory(); renderFilterChips(); }
    // scroll ke item
    setTimeout(() => {
      const el = document.querySelector('.tx-item');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }, 100);
}

function gsearchShowAll(q) {
  closeGlobalSearch();
  const navBtn = document.querySelector('.pill-item[data-page="riwayat"]');
  showPage('riwayat', navBtn);
  setTimeout(() => {
    const inp = document.getElementById('search-input');
    if (inp) { inp.value = q; renderHistory(); renderFilterChips(); }
  }, 100);
}

/* ===== DARK / LIGHT MODE ===== */
let targets = JSON.parse(localStorage.getItem('duit_targets') || '[]');
let selectedEmoji = '🏠';

function selectEmoji(el, emoji) {
  document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  selectedEmoji = emoji;
}

function saveTargets() {
  localStorage.setItem('duit_targets', JSON.stringify(targets));
}

async function addTarget() {
  const name   = document.getElementById('tgt-name').value.trim();
  const amount = parseFloat(document.getElementById('tgt-amount').value.replace(/\./g, ''));
  const saved  = parseFloat(document.getElementById('tgt-saved').value.replace(/\./g, '') || '0');
  const date   = document.getElementById('tgt-date').value;
  const wallet = document.getElementById('tgt-wallet')?.value || 'mbanking';

  if (!name || !amount || isNaN(amount) || amount <= 0) {
    showMsg('tgt-msg', '⚠️ Isi nama dan target dana!', 'error'); return;
  }

  const targetId = Date.now();
  targets.push({ id: targetId, name, amount, saved: saved || 0, date, emoji: selectedEmoji, wallet });
  saveTargets();

  /* Kalau ada saldo awal, catat sebagai transaksi tabungan */
  if (saved && saved > 0) {
    const today = new Date().toISOString().split('T')[0];
    const initTx = {
      id: Date.now() + 1,
      type: 'out',
      wallet,
      cat: 'Tabungan',
      desc: `Tabungan: ${name}`,
      amount: saved,
      date: today,
      ratio: 'savings',
      targetId
    };
    try {
      await api('POST', '/api/transactions', initTx).catch(e => console.warn('Offline mode', e));
    } catch(e) { console.warn('Offline mode', e); }
    transactions.unshift(initTx);
    window.transactions = transactions;
  }

  document.getElementById('tgt-name').value   = '';
  document.getElementById('tgt-amount').value = '';
  document.getElementById('tgt-saved').value  = '';
  document.getElementById('tgt-date').value   = '';
  if (document.getElementById('tgt-wallet')) document.getElementById('tgt-wallet').value = 'mbanking';
  showMsg('tgt-msg', '✅ Target berhasil ditambahkan!', 'success');
  setTimeout(() => { document.getElementById('tgt-msg').style.display = 'none'; }, 2000);
  renderTargets();
}

async function deleteTarget(id) {
  const _delTgtOk = await showConfirm({ icon:'🎯', title:'Hapus target?', message:'Hapus target tabungan ini?', okText:'Hapus' });
  if (!_delTgtOk) return;
  targets = targets.filter(t => t.id !== id);
  saveTargets();
  renderTargets();
}

async function openTopUpModal(id) {
  const t = targets.find(x => x.id === id);
  if (!t) return;

  const walletDefault = t.wallet || 'mbanking';

  /* Buat dialog custom dengan input jumlah + pilihan wallet */
  const dialogHTML = `
    <div style="margin-bottom:10px">
      <label style="font-size:12px;color:var(--gray-mid);display:block;margin-bottom:4px">Jumlah Top Up (Rp)</label>
      <input id="topup-amt-inp" type="text" placeholder="Contoh: 500.000"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);
               background:rgba(255,255,255,0.06);color:#EEE;font-size:14px;box-sizing:border-box"
        oninput="this.value=this.value.replace(/[^0-9]/g,'').replace(/\\B(?=(\\d{3})+(?!\\d))/g,'.')">
      <label style="font-size:12px;color:var(--gray-mid);display:block;margin:10px 0 4px">Sumber Dana</label>
      <select id="topup-wallet-sel"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);
               background:rgba(255,255,255,0.06);color:#EEE;font-size:13px;box-sizing:border-box">
        <option value="mbanking" ${walletDefault==='mbanking'?'selected':''}>🏦 M-Banking</option>
        <option value="dompet"   ${walletDefault==='dompet'  ?'selected':''}>👛 Dompet</option>
      </select>
    </div>`;

  const confirmed = await showConfirm({
    icon: '💰',
    title: `Top Up: ${t.name}`,
    message: dialogHTML,
    okText: 'Simpan Top Up'
  });
  if (!confirmed) return;

  const rawAmt = document.getElementById('topup-amt-inp')?.value?.replace(/\./g,'');
  const wallet = document.getElementById('topup-wallet-sel')?.value || walletDefault;
  const amt    = parseFloat(rawAmt || '0');
  if (!amt || isNaN(amt) || amt <= 0) { showToast('Jumlah tidak valid', 'warning'); return; }

  /* Update saldo target */
  t.saved  = Math.min(t.saved + amt, t.amount);
  t.wallet = wallet;
  saveTargets();

  /* Catat transaksi pengeluaran kategori Tabungan */
  const today = new Date().toISOString().split('T')[0];
  const topupTx = {
    id: Date.now(),
    type: 'out',
    wallet,
    cat: 'Tabungan',
    desc: `Tabungan: ${t.name}`,
    amount: amt,
    date: today,
    ratio: 'savings',
    targetId: t.id
  };
  try {
    await api('POST', '/api/transactions', topupTx).catch(e => console.warn('Offline mode', e));
  } catch(e) { console.warn('Offline mode', e); }
  transactions.unshift(topupTx);
  window.transactions = transactions;

  const walletLabel = wallet === 'mbanking' ? '🏦 M-Banking' : '👛 Dompet';
  showToast(`\u2705 Top Up ${fmt(amt)} dari ${walletLabel} berhasil!`, 'success');
  renderTargets();
  if (typeof window.updateTopbarBalance === 'function') window.updateTopbarBalance();
}

function renderTargets() {
  const container = document.getElementById('target-list');
  if (!container) return;
  if (!targets.length) {
    container.innerHTML = `<div class="card glass"><div class="empty"><div class="empty-anim"><span style="font-size:32px">🎯</span></div><p>Belum ada target tabungan</p><div class="empty-hint">Buat target pertamamu!</div></div></div>`;
    return;
  }

  container.innerHTML = targets.map(t => {
    const pct     = Math.min(Math.round(t.saved / t.amount * 100), 100);
    const remain  = Math.max(t.amount - t.saved, 0);
    const done    = pct >= 100;
    const today   = new Date();
    let daysLeft  = '';
    if (t.date) {
      const dl = Math.ceil((new Date(t.date) - today) / 86400000);
      daysLeft  = dl > 0 ? `${dl} hari lagi` : dl === 0 ? 'Hari ini!' : `Lewat ${Math.abs(dl)} hari`;
    }
    const barColor = done ? '#4A7C59' : pct >= 60 ? '#4A7C59' : pct >= 30 ? '#C9A050' : '#B5651D';

    return `<div class="card glass target-card" style="margin-bottom:1rem;${done ? 'border-color:rgba(74,124,89,0.3)' : ''}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="target-emoji">${t.emoji}</div>
          <div>
            <div style="font-weight:700;font-size:14px;color:#EEE">${t.name}</div>
            <div style="font-size:11px;color:var(--gray-mid);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              <span>${t.wallet === 'mbanking' ? '🏦 M-Banking' : '👛 Dompet'}</span>
              ${t.date ? `<span>· 🗓 ${t.date} ${daysLeft ? '· ' + daysLeft : ''}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          ${!done ? `<button class="btn-outline" style="font-size:11px;padding:6px 10px" onclick="openTopUpModal(${t.id})">💰 Top Up</button>` : '<span style="font-size:11px;font-weight:700;color:var(--green)">✅ Tercapai!</span>'}
          <button class="tx-del" onclick="deleteTarget(${t.id})" style="font-size:14px">🗑️</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-mid);margin-bottom:6px">
        <span>Terkumpul: <strong style="color:#DDD">${fmt(t.saved)}</strong></span>
        <span>Target: <strong style="color:#DDD">${fmt(t.amount)}</strong></span>
      </div>
      <div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width 0.6s cubic-bezier(.4,0,.2,1)"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px">
        <span style="color:${barColor};font-weight:700">${pct}% tercapai</span>
        ${!done ? `<span style="color:var(--gray-mid)">Sisa: <strong style="color:#DDD">${fmt(remain)}</strong></span>` : ''}
      </div>
    </div>`;
  }).join('');
}


/* =====================================================
   FINANCIAL HEALTH SCORE
   ===================================================== */
function calcHealthScore() {
  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();

  const txMonth = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const totalIn  = txMonth.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const totalOut = txMonth.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const savings  = txMonth.filter(t => t.ratio === 'savings').reduce((s, t) => s + t.amount, 0);
  const needs    = txMonth.filter(t => t.ratio === 'needs').reduce((s, t) => s + t.amount, 0);
  const wants    = txMonth.filter(t => t.ratio === 'wants').reduce((s, t) => s + t.amount, 0);

  const budget   = settings.budget || 0;
  const saldo    = totalIn - totalOut;

  let score = 0;
  const criteria = [];

  // 1. Saldo positif (20 poin)
  if (totalIn > 0) {
    const savingsRate = saldo / totalIn;
    if (savingsRate >= 0.2) {
      score += 20; criteria.push({ label: 'Saldo positif ≥20%', pts: 20, ok: true });
    } else if (savingsRate > 0) {
      const pts = Math.round(savingsRate / 0.2 * 20);
      score += pts; criteria.push({ label: 'Saldo positif (sebagian)', pts, ok: true });
    } else {
      criteria.push({ label: 'Saldo masih negatif bulan ini', pts: 0, ok: false });
    }
  } else {
    criteria.push({ label: 'Belum ada pemasukan bulan ini', pts: 0, ok: null });
  }

  // 2. Rasio tabungan (20 poin)
  if (totalOut > 0) {
    const savPct = savings / totalOut;
    if (savPct >= 0.2) {
      score += 20; criteria.push({ label: 'Tabungan ≥20% pengeluaran', pts: 20, ok: true });
    } else if (savPct > 0) {
      const pts = Math.round(savPct / 0.2 * 20);
      score += pts; criteria.push({ label: `Tabungan ${Math.round(savPct*100)}% pengeluaran`, pts, ok: 'partial' });
    } else {
      criteria.push({ label: 'Belum ada alokasi tabungan', pts: 0, ok: false });
    }
  }

  // 3. Kebutuhan ≤50% pemasukan (20 poin)
  if (totalIn > 0 && needs > 0) {
    const needPct = needs / totalIn;
    if (needPct <= 0.5) {
      score += 20; criteria.push({ label: `Kebutuhan ${Math.round(needPct*100)}% pemasukan (≤50%)`, pts: 20, ok: true });
    } else {
      const pts = Math.max(0, Math.round((1 - (needPct - 0.5) / 0.5) * 20));
      score += pts; criteria.push({ label: `Kebutuhan ${Math.round(needPct*100)}% pemasukan (idealnya ≤50%)`, pts, ok: false });
    }
  } else {
    criteria.push({ label: 'Belum ada data kebutuhan', pts: 0, ok: null });
  }

  // 4. Anggaran tidak terlampaui (20 poin)
  if (budget > 0) {
    const pct = totalOut / budget;
    if (pct <= 0.8) {
      score += 20; criteria.push({ label: `Anggaran terpakai ${Math.round(pct*100)}% (aman)`, pts: 20, ok: true });
    } else if (pct <= 1) {
      const pts = Math.round((1 - pct) / 0.2 * 20);
      score += pts; criteria.push({ label: `Anggaran terpakai ${Math.round(pct*100)}% (mendekati batas)`, pts, ok: 'partial' });
    } else {
      criteria.push({ label: `Anggaran terlampaui ${Math.round(pct*100)}%`, pts: 0, ok: false });
    }
  } else {
    criteria.push({ label: 'Belum set anggaran bulanan', pts: 0, ok: null });
  }

  // 5. Ada target tabungan aktif (20 poin)
  const activeTargets = (JSON.parse(localStorage.getItem('duit_targets') || '[]')).filter(t => (t.saved / t.amount) < 1);
  if (activeTargets.length > 0) {
    const avgProgress = activeTargets.reduce((s, t) => s + t.saved / t.amount, 0) / activeTargets.length;
    const pts = Math.round(Math.min(avgProgress * 2, 1) * 20);
    score += pts; criteria.push({ label: `${activeTargets.length} target aktif (rata-rata ${Math.round(avgProgress*100)}%)`, pts, ok: pts >= 10 });
  } else {
    criteria.push({ label: 'Belum ada target tabungan', pts: 0, ok: false });
  }

  score = Math.min(100, Math.round(score));
  return { score, criteria, totalIn, totalOut, saldo };
}

function renderHealthScore() {
  const wrap = document.getElementById('health-score-wrap');
  if (!wrap) return;

  if (!transactions.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:20px;font-size:13px;color:var(--gray-mid)">Belum ada data transaksi untuk dihitung.</div>`;
    return;
  }

  const { score, criteria } = calcHealthScore();

  const color = score >= 80 ? '#4A7C59' : score >= 60 ? '#4A7C59' : score >= 40 ? '#C9A050' : '#B5651D';
  const label = score >= 80 ? 'Sangat Sehat 🎉' : score >= 60 ? 'Cukup Sehat 👍' : score >= 40 ? 'Perlu Perhatian ⚠️' : 'Kritis 🚨';
  const desc  = score >= 80
    ? 'Keuanganmu dalam kondisi prima! Pertahankan kebiasaan baik ini.'
    : score >= 60
    ? 'Sudah lumayan, tapi masih ada ruang untuk perbaikan.'
    : score >= 40
    ? 'Beberapa aspek keuangan perlu segera diperbaiki.'
    : 'Keuanganmu membutuhkan perhatian serius sekarang.';

  // Gauge SVG
  const radius = 54, cx = 70, cy = 70;
  const circumference = Math.PI * radius; // setengah lingkaran
  const dash = (score / 100) * circumference;

  const criteriaHTML = criteria.map(c => {
    const icon = c.ok === true ? '✅' : c.ok === false ? '❌' : c.ok === 'partial' ? '🟡' : '⬜';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--gray-mid)">
          <span>${icon}</span><span>${c.label}</span>
        </div>
        <span style="font-size:12px;font-weight:700;color:${c.pts >= 15 ? '#4A7C59' : c.pts >= 8 ? '#C9A050' : '#B5651D'}">${c.pts}/20</span>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;margin-bottom:20px">
      <div style="flex-shrink:0">
        <svg width="140" height="80" viewBox="0 0 140 80">
          <!-- Track -->
          <path d="M 16 70 A 54 54 0 0 1 124 70" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12" stroke-linecap="round"/>
          <!-- Fill -->
          <path d="M 16 70 A 54 54 0 0 1 124 70" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
            stroke-dasharray="${dash} ${circumference}" style="transition:stroke-dasharray 1s ease"/>
          <!-- Score text -->
          <text x="70" y="64" text-anchor="middle" font-size="26" font-weight="800" fill="${color}" font-family="DM Sans,sans-serif">${score}</text>
          <text x="70" y="78" text-anchor="middle" font-size="10" fill="#888" font-family="DM Sans,sans-serif">/100</text>
        </svg>
      </div>
      <div style="flex:1;min-width:160px">
        <div style="font-size:16px;font-weight:800;color:${color};margin-bottom:4px">${label}</div>
        <div style="font-size:12px;color:var(--gray-mid);line-height:1.5">${desc}</div>
      </div>
    </div>
    <div style="margin-top:4px">
      <div style="font-size:11px;font-weight:700;color:var(--gray-mid);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Detail penilaian</div>
      ${criteriaHTML}
    </div>
    <div style="margin-top:12px;font-size:11px;color:var(--gray-mid);text-align:right">*Berdasarkan data bulan ini</div>
  `;

  // Light mode text fix
  if (document.documentElement.getAttribute('data-theme') === 'light') {
    wrap.querySelectorAll('[style*="color:var(--gray-mid)"]').forEach(el => {
      el.style.color = '#6B7280';
    });
  }
}

/* =====================================================
   BACKUP & RESTORE JSON
   ===================================================== */
function doBackupJSON() {
  const allTargets    = JSON.parse(localStorage.getItem('duit_targets')    || '[]');
  const allRecurring  = JSON.parse(localStorage.getItem('duit_recurring')  || '[]');
  const customCatOut  = JSON.parse(localStorage.getItem('duit_cats_out')   || '[]');
  const customCatIn   = JSON.parse(localStorage.getItem('duit_cats_in')    || '[]');
  const avatar        = localStorage.getItem('duit_avatar')  || '👤';
  const theme         = localStorage.getItem('duit_theme')   || 'dark';

  const backup = {
    _meta: {
      app: 'Duit Tracker Pro',
      version: '1.0',
      exported_at: new Date().toISOString(),
      total_transactions: transactions.length,
    },
    settings: {
      name: settings.name,
      budget: settings.budget,
      reminders: settings.reminders,
      avatar,
      theme,
    },
    transactions,
    targets: allTargets,
    recurring: allRecurring,
    custom_categories: { out: customCatOut, in: customCatIn },
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.href     = url;
  a.download = `duittracker-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);

  const info = document.getElementById('backup-info');
  if (info) {
    info.innerHTML = `✅ Backup berhasil! <strong>${transactions.length} transaksi</strong>, ${allTargets.length} target, ${allRecurring.length} berulang · ${date}`;
  }
  showMsg('backup-msg', '💾 File backup berhasil diunduh!', 'success');
  setTimeout(() => { const m = document.getElementById('backup-msg'); if(m) m.style.display='none'; }, 3000);
}

function doRestoreJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = JSON.parse(e.target.result);

      // Validasi struktur
      if (!data._meta || data._meta.app !== 'Duit Tracker Pro') {
        showMsg('backup-msg', '❌ File bukan backup Duit Tracker Pro!', 'error'); return;
      }

      const txCount  = (data.transactions || []).length;
      const tgtCount = (data.targets      || []).length;
      const recCount = (data.recurring    || []).length;

      const confirmed = await showConfirm({
        icon: '📂',
        title: 'Restore backup?',
        message: `Dari: ${data._meta.exported_at?.split('T')[0] || '?'}\n\n📋 ${txCount} transaksi  🎯 ${tgtCount} target  🔁 ${recCount} berulang\n\n⚠️ Data sekarang akan ditimpa!`,
        okText: 'Ya, restore', danger: true
      });
      if (!confirmed) { event.target.value = ''; return; }

      // Restore transactions (kirim ke server jika ada)
      transactions = data.transactions || [];
      window.transactions = transactions;

      // Restore localStorage
      if (data.targets)   localStorage.setItem('duit_targets',    JSON.stringify(data.targets));
      if (data.recurring) localStorage.setItem('duit_recurring',  JSON.stringify(data.recurring));
      if (data.custom_categories?.out) localStorage.setItem('duit_cats_out', JSON.stringify(data.custom_categories.out));
      if (data.custom_categories?.in)  localStorage.setItem('duit_cats_in',  JSON.stringify(data.custom_categories.in));
      if (data.settings?.avatar) localStorage.setItem('duit_avatar', data.settings.avatar);
      if (data.settings?.theme)  localStorage.setItem('duit_theme',  data.settings.theme);

      // Update state
      if (data.settings?.budget)    settings.budget    = data.settings.budget;
      if (data.settings?.name)      { settings.name = data.settings.name; currentUser.name = data.settings.name; }
      if (data.settings?.reminders) settings.reminders = data.settings.reminders;

      // Refresh alias kategori
      refreshCatAliases();

      // Re-render halaman aktif
      renderDashboard();
      updateTopbarUser();

      const info = document.getElementById('backup-info');
      if (info) info.innerHTML = `✅ Restore berhasil dari backup <strong>${data._meta.exported_at?.split('T')[0]}</strong> · ${txCount} transaksi dipulihkan`;

      showMsg('backup-msg', `✅ Restore berhasil! ${txCount} transaksi dipulihkan.`, 'success');
      setTimeout(() => { const m = document.getElementById('backup-msg'); if(m) m.style.display='none'; }, 4000);

    } catch (err) {
      showMsg('backup-msg', '❌ File tidak valid atau rusak: ' + err.message, 'error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}


/* =====================================================
   TOAST NOTIFICATION SYSTEM
   ===================================================== */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const colors = {
    success: { bg: 'rgba(74,124,89,0.92)', border: 'rgba(74,124,89,0.4)', icon: '✅' },
    error:   { bg: 'rgba(181,101,29,0.92)',  border: 'rgba(181,101,29,0.4)',  icon: '❌' },
    warning: { bg: 'rgba(201,160,80,0.92)', border: 'rgba(201,160,80,0.4)', icon: '⚠️' },
    info:    { bg: 'rgba(45,42,38,0.92)', border: 'rgba(45,42,38,0.4)', icon: 'ℹ️' },
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    display:flex;align-items:center;gap:10px;
    padding:12px 16px;border-radius:14px;
    background:${c.bg};border:1px solid ${c.border};
    color:#fff;font-size:13px;font-weight:600;
    box-shadow:0 8px 32px rgba(0,0,0,0.35);
    pointer-events:auto;cursor:pointer;
    max-width:100%;word-break:break-word;
    backdrop-filter:blur(12px);
    opacity:0;transform:translateY(16px);
    transition:opacity 0.25s ease,transform 0.25s ease;
  `;
  toast.innerHTML = `<span style="font-size:16px;flex-shrink:0">${c.icon}</span><span style="flex:1">${message}</span>`;
  toast.onclick = () => dismissToast(toast);

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  const timer = setTimeout(() => dismissToast(toast), duration);
  toast._timer = timer;
}

function dismissToast(toast) {
  clearTimeout(toast._timer);
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(10px)';
  setTimeout(() => toast.remove(), 250);
}

/* =====================================================
   CUSTOM CONFIRM DIALOG
   ===================================================== */
function showConfirm(options) {
  return new Promise(resolve => {
    const overlay   = document.getElementById('confirm-overlay');
    const iconEl    = document.getElementById('confirm-icon');
    const titleEl   = document.getElementById('confirm-title');
    const msgEl     = document.getElementById('confirm-msg');
    const okBtn     = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    iconEl.textContent  = options.icon  || '❓';
    titleEl.textContent = options.title || 'Konfirmasi';
    // Gunakan innerHTML agar konten modal yang berisi form/HTML dapat dirender dengan benar
    msgEl.innerHTML     = options.message || '';
    okBtn.textContent   = options.okText || 'Ya, lanjutkan';

    const danger = options.danger !== false;
    okBtn.style.background = danger
      ? 'linear-gradient(135deg,#B5651D,#9A4A15)'
      : '#4A7C59';
    okBtn.style.color = '#fff';

    overlay.style.display = 'flex';

    const cleanup = (result) => {
      overlay.style.display = 'none';
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(result);
    };

    okBtn.onclick     = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);

    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
  });
}

/* =====================================================
   CUSTOM PROMPT DIALOG
   ===================================================== */
function showPrompt(title, defaultValue = '', inputType = 'text') {
  return new Promise(resolve => {
    const overlay   = document.getElementById('prompt-overlay');
    const titleEl   = document.getElementById('prompt-title');
    const input     = document.getElementById('prompt-input');
    const okBtn     = document.getElementById('prompt-ok');
    const cancelBtn = document.getElementById('prompt-cancel');

    titleEl.textContent  = title;
    input.value          = defaultValue;
    input.type           = inputType;

    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 50);

    const cleanup = (val) => {
      overlay.style.display = 'none';
      okBtn.onclick     = null;
      cancelBtn.onclick = null;
      input.onkeydown   = null;
      resolve(val);
    };

    okBtn.onclick     = () => cleanup(input.value);
    cancelBtn.onclick = () => cleanup(null);
    input.onkeydown   = (e) => { if (e.key === 'Enter') cleanup(input.value); if (e.key === 'Escape') cleanup(null); };
  });
}

/* =====================================================
   HARI PALING BOROS DALAM SEMINGGU
   ===================================================== */
function renderBorosHarian() {
  const el = document.getElementById('boros-harian');
  if (!el) return;

  const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const dayTotals = Array(7).fill(0);
  const dayCount  = Array(7).fill(0);

  transactions.filter(t => t.type === 'out').forEach(t => {
    const d = new Date(t.date);
    const dow = d.getDay();
    dayTotals[dow] += t.amount;
    dayCount[dow]++;
  });

  const maxTotal = Math.max(...dayTotals, 1);
  const borosIdx = dayTotals.indexOf(maxTotal);

  if (maxTotal === 0) {
    el.innerHTML = `<div style="text-align:center;padding:20px;font-size:13px;color:var(--gray-mid)">Belum ada data pengeluaran.</div>`;
    return;
  }

  const bars = HARI.map((hari, i) => {
    const total   = dayTotals[i];
    const count   = dayCount[i];
    const pct     = Math.round(total / maxTotal * 100);
    const isBoros = i === borosIdx && total > 0;
    const barColor = isBoros
      ? '#B5651D'
      : pct > 60 ? '#C9A050'
      : pct > 30 ? '#4A7C59'
      : 'rgba(255,255,255,0.15)';

    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:0">
        <div style="font-size:11px;font-weight:700;color:${isBoros ? '#B5651D' : 'var(--gray-mid)'};white-space:nowrap">
          ${isBoros ? '🔥' : ''}${fmtShort(total)}
        </div>
        <div style="width:100%;height:120px;background:rgba(255,255,255,0.04);border-radius:8px;display:flex;align-items:flex-end;overflow:hidden">
          <div style="width:100%;height:${Math.max(pct,2)}%;background:${barColor};border-radius:6px 6px 0 0;transition:height 0.6s cubic-bezier(.4,0,.2,1)"></div>
        </div>
        <div style="font-size:11px;font-weight:${isBoros ? '800' : '600'};color:${isBoros ? '#B5651D' : 'var(--gray-mid)'}">
          ${hari.slice(0, 3)}
        </div>
        <div style="font-size:10px;color:var(--gray-mid)">${count}x</div>
      </div>`;
  }).join('');

  const avg = dayTotals.reduce((s, v) => s + v, 0) / 7;
  const hematIdx = dayTotals.reduce((minI, v, i) => (v > 0 && v < dayTotals[minI] ? i : minI),
    dayTotals.findIndex(v => v > 0));

  el.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:16px;padding:0 4px">
      ${bars}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px">
      <div style="background:rgba(181,101,29,0.08);border:1px solid rgba(181,101,29,0.15);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--gray-mid);margin-bottom:4px">🔥 Paling boros</div>
        <div style="font-size:13px;font-weight:800;color:  #B5651D">${HARI[borosIdx]}</div>
        <div style="font-size:10px;color:var(--gray-mid);margin-top:2px">${fmtShort(maxTotal)}</div>
      </div>
      <div style="background:rgba(74,124,89,0.08);border:1px solid rgba(74,124,89,0.15);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--gray-mid);margin-bottom:4px">🌿 Paling hemat</div>
        <div style="font-size:13px;font-weight:800;color:  #4A7C59">${hematIdx >= 0 ? HARI[hematIdx] : '-'}</div>
        <div style="font-size:10px;color:var(--gray-mid);margin-top:2px">${hematIdx >= 0 ? fmtShort(dayTotals[hematIdx]) : '-'}</div>
      </div>
      <div style="background:rgba(74,124,89,0.08);border:1px solid rgba(74,124,89,0.15);border-radius:12px;padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--gray-mid);margin-bottom:4px">📊 Rata-rata/hari</div>
        <div style="font-size:13px;font-weight:800;color:  #4A7C59">${fmtShort(avg)}</div>
        <div style="font-size:10px;color:var(--gray-mid);margin-top:2px">per hari</div>
      </div>
    </div>
    <div style="margin-top:10px;font-size:11px;color:var(--gray-mid);text-align:right">*Berdasarkan semua data pengeluaran</div>
  `;
}

/* ===== INIT ===== */
const inpAmount = document.getElementById('inp-amount');
if (inpAmount) {
  inpAmount.setAttribute('type', 'text');
  inpAmount.addEventListener('input', function() { formatInputRupiah(this); });
}

const inpBudget = document.getElementById('inp-budget');
if (inpBudget) {
  inpBudget.setAttribute('type', 'text');
  inpBudget.addEventListener('input', function() { formatInputRupiah(this); saveBudget(this.value); });
}

updateDate();
initLoginScreen();
document.getElementById('inp-date').value = new Date().toISOString().split('T')[0];
updateCatOptions();

/* =====================================================
   KEYBOARD SHORTCUTS
   ===================================================== */
document.addEventListener('keydown', function(e) {
  // Jangan aktif saat user sedang mengetik di input/textarea/select
  const tag = document.activeElement?.tagName;
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    || document.activeElement?.isContentEditable;

  // Esc — tutup modal/search yang terbuka
  if (e.key === 'Escape') {
    if (document.getElementById('edit-modal')?.style.display === 'flex') {
      document.getElementById('edit-modal').style.display = 'none'; return;
    }
    if (document.getElementById('confirm-overlay')?.style.display === 'flex') {
      document.getElementById('confirm-cancel')?.click(); return;
    }
    if (document.getElementById('prompt-overlay')?.style.display === 'flex') {
      document.getElementById('prompt-cancel')?.click(); return;
    }
    if (_gsearchOpen) { closeGlobalSearch(); return; }
    const moreSheet = document.getElementById('more-menu-sheet');
    if (moreSheet?.style.display === 'block') { closeMoreMenu(); return; }
  }

  if (isTyping) return; // shortcut lain tidak aktif saat mengetik

  const navMap = {
    '1': 'dashboard', '2': 'catat',   '3': 'berulang',
    '4': 'riwayat',   '5': 'analisa', '6': 'ekspor',
    '7': 'target',    '8': 'kalender','9': 'pengaturan',
  };

  // / — buka global search
  if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    openGlobalSearch();
    return;
  }

  // N — ke halaman Catat
  if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    const btn = document.querySelector('.pill-item[data-page="catat"]');
    showPage('catat', btn);
    syncBottomNav && syncBottomNav('catat');
    setTimeout(() => document.getElementById('inp-desc')?.focus(), 200);
    return;
  }

  // 1–9 — pindah tab
  if (navMap[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const pageId = navMap[e.key];
    const idx    = PAGE_ORDER.indexOf(pageId) + 1;
    const btn    = document.querySelector(`.pill-item[data-page="${pageId}"]`);
    showPage(pageId, btn);
    syncBottomNav && syncBottomNav(pageId);
    return;
  }
});





/* =====================================================
   PATCH — Tambahkan fungsi ini ke script.js
   ===================================================== */

/* ----- Quick date range shortcuts ----- */
function setDateRange(preset) {
  const now   = new Date();
  const toStr = d => d.toISOString().split('T')[0];
  const from  = document.getElementById('fil-date-from');
  const to    = document.getElementById('fil-date-to');
  if (!from || !to) return;

  if (preset === 'thisMonth') {
    from.value = toStr(new Date(now.getFullYear(), now.getMonth(), 1));
    to.value   = toStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  } else if (preset === 'lastMonth') {
    from.value = toStr(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    to.value   = toStr(new Date(now.getFullYear(), now.getMonth(), 0));
  } else if (preset === 'last7') {
    const d7 = new Date(now); d7.setDate(now.getDate() - 6);
    from.value = toStr(d7);
    to.value   = toStr(now);
  } else if (preset === 'last30') {
    const d30 = new Date(now); d30.setDate(now.getDate() - 29);
    from.value = toStr(d30);
    to.value   = toStr(now);
  }
  renderHistory(); renderFilterChips();
}
/* =====================================================
   KALENDER TRANSAKSI — kalender.js
   Semua logika render kalender, navigasi & detail
   ===================================================== */

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

/* ── Render kalender bulan aktif ── */
function renderKalender() {
  const container = document.getElementById('kalender-wrap');
  if (!container) return;

  const now          = new Date();
  const firstDay     = new Date(calYear, calMonth, 1).getDay();   // 0=Minggu
  const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
  const HARI         = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const BULAN_PENUH  = ['Januari','Februari','Maret','April','Mei','Juni',
                        'Juli','Agustus','September','Oktober','November','Desember'];

  /* Kumpulkan ringkasan per tanggal */
  const dayMap = {};
  (window.transactions || transactions || []).forEach(t => {
    const d = new Date(t.date);
    if (d.getMonth() !== calMonth || d.getFullYear() !== calYear) return;
    const key = d.getDate();
    if (!dayMap[key]) dayMap[key] = { in: 0, out: 0, count: 0 };
    if (t.type === 'in') dayMap[key].in  += t.amount;
    else                 dayMap[key].out += t.amount;
    dayMap[key].count++;
  });

  const maxOut = Math.max(...Object.values(dayMap).map(d => d.out), 1);

  /* ── Header navigasi ── */
  const headerHTML = `
    <div class="cal-header">
      <button class="cal-nav" onclick="calPrev()">‹</button>
      <div class="cal-month-label">${BULAN_PENUH[calMonth]} ${calYear}</div>
      <button class="cal-nav" onclick="calNext()">›</button>
    </div>`;

  /* ── Ringkasan bulan ── */
  const totalIn  = Object.values(dayMap).reduce((s, d) => s + d.in,    0);
  const totalOut = Object.values(dayMap).reduce((s, d) => s + d.out,   0);
  const totalTx  = Object.values(dayMap).reduce((s, d) => s + d.count, 0);
  const saldo    = totalIn - totalOut;

  const summaryHTML = `
    <div class="cal-summary">
      <div class="cal-sum-item">
        <div class="cal-sum-label">Pemasukan</div>
        <div class="cal-sum-val green">+${fmtShort(totalIn)}</div>
      </div>
      <div class="cal-sum-item">
        <div class="cal-sum-label">Pengeluaran</div>
        <div class="cal-sum-val red">-${fmtShort(totalOut)}</div>
      </div>
      <div class="cal-sum-item">
        <div class="cal-sum-label">Transaksi</div>
        <div class="cal-sum-val">${totalTx}x</div>
      </div>
      <div class="cal-sum-item">
        <div class="cal-sum-label">Saldo</div>
        <div class="cal-sum-val" style="color:${saldo >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${saldo >= 0 ? '+' : '-'}${fmtShort(Math.abs(saldo))}
        </div>
      </div>
    </div>`;

  /* ── Header hari ── */
  const dayHeaders = HARI.map(h => `<div class="cal-day-header">${h}</div>`).join('');

  /* ── Sel kosong sebelum tanggal 1 ── */
  let cells = '';
  for (let i = 0; i < firstDay; i++) {
    cells += `<div class="cal-cell empty"></div>`;
  }

  /* ── Sel tiap tanggal ── */
  const todayStr = now.toISOString().split('T')[0];
  for (let d = 1; d <= daysInMonth; d++) {
    const data    = dayMap[d];
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const intensity = data ? Math.round(data.out / maxOut * 100) : 0;

    /* Titik warna */
    let dot = '';
    if (data) {
      if (data.in > 0 && data.out > 0) dot = '<span class="cal-dot both"></span>';
      else if (data.in > 0)            dot = '<span class="cal-dot inc"></span>';
      else                             dot = '<span class="cal-dot out"></span>';
    }

    /* Heat-map background */
    const heatBg = data && data.out > 0
      ? `rgba(181,101,29,${(0.08 + intensity / 100 * 0.35).toFixed(2)})`
      : data && data.in > 0
      ? `rgba(74,124,89,0.08)`
      : '';

    cells += `
      <div class="cal-cell${isToday ? ' today' : ''}${data ? ' has-data' : ''}"
           style="${heatBg ? `background:${heatBg}` : ''}"
           onclick="showCalDetail('${dateStr}')">
        <div class="cal-date">${d}</div>
        ${dot}
        ${data ? `<div class="cal-amount">${fmtShort(data.out || data.in)}</div>` : ''}
      </div>`;
  }

  /* ── Legend ── */
  const legendHTML = `
    <div class="cal-legend">
      <span class="cal-dot inc"></span><span>Pemasukan</span>
      <span class="cal-dot out" style="margin-left:10px"></span><span>Pengeluaran</span>
      <span class="cal-dot both" style="margin-left:10px"></span><span>Keduanya</span>
    </div>`;

  container.innerHTML = `
    ${headerHTML}
    ${summaryHTML}
    <div class="cal-grid">
      ${dayHeaders}
      ${cells}
    </div>
    ${legendHTML}
    <div id="cal-detail"></div>`;
}

/* ── Navigasi bulan ── */
function calPrev() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderKalender();
}

function calNext() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderKalender();
}

/* ── Detail transaksi satu hari ── */
function showCalDetail(dateStr) {
  const det   = document.getElementById('cal-detail');
  if (!det) return;

  const txDay = (window.transactions || transactions || []).filter(t => t.date === dateStr);

  if (!txDay.length) {
    det.innerHTML = `
      <div style="text-align:center;padding:16px;font-size:12px;color:var(--gray-mid)">
        Tidak ada transaksi pada <strong>${dateStr}</strong>
      </div>`;
    return;
  }

  const out = txDay.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const inc = txDay.filter(t => t.type === 'in').reduce((s, t)  => s + t.amount, 0);

  det.innerHTML = `
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.07)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--gray-dark,#EEE)">📅 ${dateStr}</div>
        <div style="font-size:11px;color:var(--gray-mid)">
          ${txDay.length} transaksi &nbsp;·&nbsp;
          <span style="color:var(--green)">+${fmtShort(inc)}</span>
          &nbsp;·&nbsp;
          <span style="color:var(--red)">-${fmtShort(out)}</span>
        </div>
      </div>
      ${txDay.map(t => txRow(t)).join('')}
    </div>`;
}
/* =====================================================
   HALAMAN TABUNGAN BANK
   ===================================================== */

function renderTabunganPage() {
  const txTabungan = transactions.filter(t => t.wallet === 'tabungan');
  const balTabungan = txTabungan.reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
  const totalSetor  = txTabungan.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const totalTarik  = txTabungan.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);

  // Hitung rata-rata setor per bulan
  const bulanSet = new Set(txTabungan.filter(t => t.type === 'in').map(t => t.date.slice(0, 7)));
  const avgSetor = bulanSet.size > 0 ? totalSetor / bulanSet.size : 0;

  // ── Hero saldo ──
  const heroSaldo = document.getElementById('tab-hero-saldo');
  if (heroSaldo) heroSaldo.textContent = fmt(Math.max(balTabungan, 0));
  const heroSub = document.getElementById('tab-hero-sub');
  if (heroSub) heroSub.textContent = txTabungan.length > 0
    ? `${txTabungan.length} transaksi · Rata-rata setor ${fmtShort(avgSetor)}/bln`
    : 'Belum ada transaksi tabungan';

  // ── Stats grid ──
  const statsEl = document.getElementById('tab-stats-grid');
  if (statsEl) statsEl.innerHTML = [
    { label: 'Total Disetor', val: fmtShort(totalSetor), color: '#4A7C59', icon: '💰' },
    { label: 'Total Ditarik', val: fmtShort(totalTarik), color: '#B5651D', icon: '🏧' },
    { label: 'Rata-rata/Bulan', val: fmtShort(avgSetor), color: '#4A7C59', icon: '📊' },
  ].map(s => `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:12px 10px;text-align:center">
      <div style="font-size:18px;margin-bottom:4px">${s.icon}</div>
      <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">${s.label}</div>
      <div style="font-size:14px;font-weight:800;color:${s.color}">${s.val}</div>
    </div>`).join('');

  // ── Rencana nabung otomatis ──
  renderRencanaNabungList();

  // ── Grafik tren 6 bulan ──
  renderTabunganChart(txTabungan);

  // ── Histori ──
  const histEl = document.getElementById('tab-history-list');
  if (histEl) {
    const sorted = [...txTabungan].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!sorted.length) {
      histEl.innerHTML = `<div class="empty" style="padding:20px 0"><div class="empty-anim"><span style="font-size:32px">🏧</span></div><p>Belum ada transaksi tabungan</p></div>`;
    } else {
      histEl.innerHTML = sorted.map(t => {
        const isIn = t.type === 'in';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:10px;background:${isIn ? 'rgba(74,124,89,0.12)' : 'rgba(181,101,29,0.12)'};display:flex;align-items:center;justify-content:center;font-size:16px">${isIn ? '💰' : '🏧'}</div>
            <div>
              <div style="font-size:13px;font-weight:600;color:#EEE">${t.desc}</div>
              <div style="font-size:11px;color:#9CA3AF;margin-top:1px">${t.date}</div>
            </div>
          </div>
          <div style="font-size:14px;font-weight:700;color:${isIn ? '#4A7C59' : '#B5651D'}">${isIn ? '+' : '-'}${fmtShort(t.amount)}</div>
        </div>`;
      }).join('');
    }
  }
}

function renderTabunganChart(txTabungan) {
  const canvas = document.getElementById('chartTabungan');
  if (!canvas) return;

  // Ambil 6 bulan terakhir
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleString('id-ID', { month:'short', year:'2-digit' }) });
  }

  const dataSetor = months.map(m => txTabungan.filter(t => t.type === 'in'  && t.date.startsWith(m.key)).reduce((s,t)=>s+t.amount,0));
  const dataTarik = months.map(m => txTabungan.filter(t => t.type === 'out' && t.date.startsWith(m.key)).reduce((s,t)=>s+t.amount,0));

  // Saldo kumulatif
  let running = 0;
  const dataSaldo = months.map((m, i) => {
    running += dataSetor[i] - dataTarik[i];
    return running;
  });

  if (chartTabungan) chartTabungan.destroy();
  chartTabungan = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { type: 'bar',  label: 'Setor',  data: dataSetor, backgroundColor: 'rgba(74,124,89,0.5)',  borderColor: '#4A7C59', borderWidth: 1, borderRadius: 6 },
        { type: 'bar',  label: 'Tarik',  data: dataTarik, backgroundColor: 'rgba(181,101,29,0.4)',   borderColor: '#B5651D', borderWidth: 1, borderRadius: 6 },
        { type: 'line', label: 'Saldo',  data: dataSaldo, borderColor: '#4A7C59', backgroundColor: 'rgba(74,124,89,0.1)', borderWidth: 2, pointRadius: 4, tension: 0.4, fill: true, yAxisID: 'y2' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11, family: 'DM Sans' }, boxWidth: 10, padding: 10, color: '#AAA' } } },
      scales: {
        x: { ticks: { color: '#9CA3AF', font: { size: 10 } }, grid: { color: 'rgba(45,42,38,0.06)' } },
        y:  { ticks: { color: '#9CA3AF', font: { size: 10 }, callback: v => fmtShort(v) }, grid: { color: 'rgba(45,42,38,0.06)' } },
        y2: { position: 'right', ticks: { color: '#4A7C59', font: { size: 10 }, callback: v => fmtShort(v) }, grid: { display: false } }
      }
    }
  });
}

/* ── Rencana Nabung ── */
function renderRencanaNabungList() {
  const el = document.getElementById('tab-rencana-list');
  if (!el) return;
  if (!rencanaNabung.length) {
    el.innerHTML = `<div style="text-align:center;padding:12px 0;color:#9CA3AF;font-size:13px">Belum ada rencana nabung otomatis</div>`;
    return;
  }
  const freqLabel = { daily:'Harian', weekly:'Mingguan', monthly:'Bulanan' };
  el.innerHTML = rencanaNabung.map(r => {
    const due = isRencanaDue(r);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid ${due ? 'rgba(201,160,80,0.3)' : 'rgba(255,255,255,0.06)'};margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">🎯</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#EEE">${r.nama}</div>
          <div style="font-size:11px;color:#9CA3AF">${freqLabel[r.freq]} · ${r.src === 'mbanking' ? '🏦 M-Banking' : '👛 Dompet'} → 🏧 · ${fmt(r.amount)}</div>
          ${due ? '<div style="font-size:10px;color:#F59E0B;font-weight:700;margin-top:2px">⏰ Jatuh tempo!</div>' : `<div style="font-size:10px;color:#9CA3AF;margin-top:2px">Terakhir: ${r.lastRun || '-'}</div>`}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        ${due ? `<button class="btn-primary" style="font-size:11px;padding:6px 10px" onclick="executeRencana(${r.id})">✅ Setor</button>` : ''}
        <button class="tx-del" style="font-size:14px" onclick="deleteRencana(${r.id})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function isRencanaDue(r) {
  if (!r.lastRun) return true;
  const last = new Date(r.lastRun);
  const now  = new Date();
  if (r.freq === 'daily')   return (now - last) >= 86400000;
  if (r.freq === 'weekly')  return (now - last) >= 7 * 86400000;
  if (r.freq === 'monthly') return now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear();
  return false;
}

async function openRencanaNabungModal() {
  const confirmed = await showConfirm({
    icon: '🎯',
    title: 'Tambah Rencana Nabung',
    message: `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <label style="font-size:12px;color:#9CA3AF;display:block;margin-bottom:4px">Nama Rencana</label>
          <input id="rn-nama" type="text" placeholder="Contoh: Nabung Bulanan"
            style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#EEE;font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:#9CA3AF;display:block;margin-bottom:4px">Jumlah (Rp)</label>
          <input id="rn-amount" type="text" placeholder="Contoh: 500.000"
            style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#EEE;font-size:13px;box-sizing:border-box"
            oninput="this.value=this.value.replace(/[^0-9]/g,'').replace(/\\B(?=(\\d{3})+(?!\\d))/g,'.')">
        </div>
        <div>
          <label style="font-size:12px;color:#9CA3AF;display:block;margin-bottom:4px">Sumber Dana</label>
          <select id="rn-src" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#EEE;font-size:13px;box-sizing:border-box">
            <option value="mbanking">🏦 M-Banking</option>
            <option value="dompet">👛 Dompet</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:#9CA3AF;display:block;margin-bottom:4px">Frekuensi</label>
          <select id="rn-freq" style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#EEE;font-size:13px;box-sizing:border-box">
            <option value="weekly">Mingguan</option>
            <option value="monthly" selected>Bulanan</option>
            <option value="daily">Harian</option>
          </select>
        </div>
      </div>`,
    okText: 'Simpan Rencana'
  });
  if (!confirmed) return;

  const nama   = document.getElementById('rn-nama')?.value?.trim();
  const rawAmt = document.getElementById('rn-amount')?.value?.replace(/\./g, '');
  const src    = document.getElementById('rn-src')?.value || 'mbanking';
  const freq   = document.getElementById('rn-freq')?.value || 'monthly';
  const amount = parseFloat(rawAmt || '0');

  if (!nama || !amount || amount <= 0) { showToast('Isi nama dan jumlah!', 'warning'); return; }

  rencanaNabung.push({ id: Date.now(), nama, amount, src, freq, lastRun: null });
  saveRencanaNabung();
  showToast(`✅ Rencana "${nama}" ditambahkan!`, 'success');
  renderTabunganPage();
}

async function executeRencana(id) {
  const r = rencanaNabung.find(x => x.id === id);
  if (!r) return;

  const today   = new Date().toISOString().split('T')[0];
  const srcLabel = r.src === 'mbanking' ? '🏦 M-Banking' : '👛 Dompet';

  const txOut = { id: Date.now(),     type: 'out', wallet: r.src,      cat: 'Tabungan', desc: `Rencana Nabung: ${r.nama}`, amount: r.amount, date: today, ratio: 'savings' };
  const txIn  = { id: Date.now() + 1, type: 'in',  wallet: 'tabungan', cat: 'Tabungan', desc: `Rencana Nabung: ${r.nama}`, amount: r.amount, date: today, ratio: 'in' };

  try { await api('POST', '/api/transactions', txOut).catch(e => console.warn(e)); } catch(e) {}
  try { await api('POST', '/api/transactions', txIn).catch(e => console.warn(e));  } catch(e) {}
  transactions.unshift(txIn);
  transactions.unshift(txOut);
  window.transactions = transactions;

  r.lastRun = today;
  saveRencanaNabung();

  showToast(`✅ Setor ${fmt(r.amount)} dari ${srcLabel} berhasil!`, 'success');
  renderTabunganPage();
  if (typeof window.updateTopbarBalance === 'function') window.updateTopbarBalance();
}

async function deleteRencana(id) {
  const ok = await showConfirm({ icon:'🗑️', title:'Hapus rencana?', message:'Hapus rencana nabung ini?', okText:'Hapus' });
  if (!ok) return;
  rencanaNabung = rencanaNabung.filter(r => r.id !== id);
  saveRencanaNabung();
  renderTabunganPage();
}

/* ── Modal Tarik terpisah (dipanggil dari tombol Tarik di hero) ── */
async function openTabunganTarikModal() {
  const balTabungan = transactions.filter(t => t.wallet === 'tabungan')
    .reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);

  if (balTabungan <= 0) { showToast('Saldo tabungan kosong', 'warning'); return; }

  const confirmed = await showConfirm({
    icon: '🏧',
    title: 'Tarik Tabungan Bank',
    message: `
      <div style="text-align:center;margin-bottom:12px;padding:10px;background:rgba(74,124,89,0.08);border-radius:10px">
        <div style="font-size:11px;color:#9CA3AF">Saldo tersedia</div>
        <div style="font-size:20px;font-weight:800;color:  #4A7C59">${fmt(balTabungan)}</div>
      </div>
      <label style="font-size:12px;color:#9CA3AF;display:block;margin-bottom:4px">Jumlah Tarik (Rp)</label>
      <input id="tarik-amt-inp" type="text" placeholder="Contoh: 200.000"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#EEE;font-size:14px;box-sizing:border-box;margin-bottom:10px"
        oninput="this.value=this.value.replace(/[^0-9]/g,'').replace(/\\B(?=(\\d{3})+(?!\\d))/g,'.')">
      <label style="font-size:12px;color:#9CA3AF;display:block;margin-bottom:4px">Masuk ke</label>
      <select id="tarik-dst-sel"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#EEE;font-size:13px;box-sizing:border-box">
        <option value="mbanking">🏦 M-Banking</option>
        <option value="dompet">👛 Dompet</option>
      </select>`,
    okText: 'Tarik'
  });
  if (!confirmed) return;

  const rawAmt = document.getElementById('tarik-amt-inp')?.value?.replace(/\./g, '');
  const dst    = document.getElementById('tarik-dst-sel')?.value || 'mbanking';
  const amt    = parseFloat(rawAmt || '0');
  if (!amt || amt <= 0) { showToast('Jumlah tidak valid', 'warning'); return; }
  if (amt > balTabungan) { showToast('Saldo tabungan tidak cukup', 'warning'); return; }

  const dstLabel = dst === 'mbanking' ? '🏦 M-Banking' : '👛 Dompet';
  const today = new Date().toISOString().split('T')[0];

  const txOut = { id: Date.now(),     type: 'out', wallet: 'tabungan', cat: 'Tabungan', desc: `Tarik ke ${dstLabel}`, amount: amt, date: today, ratio: 'savings' };
  const txIn  = { id: Date.now() + 1, type: 'in',  wallet: dst,        cat: 'Tabungan', desc: `Tarik Tabungan Bank`,  amount: amt, date: today, ratio: 'in' };

  try { await api('POST', '/api/transactions', txOut).catch(e => console.warn(e)); } catch(e) {}
  try { await api('POST', '/api/transactions', txIn).catch(e => console.warn(e));  } catch(e) {}
  transactions.unshift(txIn);
  transactions.unshift(txOut);
  window.transactions = transactions;

  showToast(`✅ Tarik ${fmt(amt)} ke ${dstLabel} berhasil!`, 'success');
  renderTabunganPage();
  if (typeof window.updateTopbarBalance === 'function') window.updateTopbarBalance();
}