// profile.js — Fixed: uses supabaseClient, no broken requireAuth dependency

// ── Utilities ──────────────────────────────────────────────────────
function moodEmoji(m) {
  return { anxious:'😰', sad:'💙', angry:'🔥', lost:'🌫️', hopeful:'🌱' }[m] || '💬';
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── State ──────────────────────────────────────────────────────────
let allMyVents = [];
let pendingDeleteId = null;
let currentUser = null;

// ── Boot ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Get session using supabaseClient (defined in config.js)
  let session;
  try {
    const res = await supabaseClient.auth.getSession();
    session = res.data.session;
  } catch (err) {
    console.error('[profile] getSession error:', err);
    window.location.href = 'login.html';
    return;
  }

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  currentUser = session.user;

  // Populate profile header
  const emailDisplay = document.getElementById('user-email-display');
  const userSince    = document.getElementById('user-since');
  if (emailDisplay) emailDisplay.textContent = currentUser.email || 'Anonymous';
  if (userSince) {
    const d = new Date(currentUser.created_at);
    userSince.textContent = 'Member since ' + d.toLocaleDateString('en-US', { month:'long', year:'numeric' });
  }
  // Avatar emoji from email initial
  const avatarEl = document.getElementById('avatar-el');
  if (avatarEl && currentUser.email) {
    avatarEl.textContent = currentUser.email[0].toUpperCase();
  }

  // Load vents
  await loadMyVents();

  // Mood filter chips
  document.querySelectorAll('#my-mood-filter .fchip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#my-mood-filter .fchip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderFeed(chip.dataset.f === 'all' ? null : chip.dataset.f);
    });
  });

  // Delete modal wiring
  document.getElementById('cancel-delete').addEventListener('click', closeModal);
  document.getElementById('confirm-delete').addEventListener('click', confirmDelete);
  document.getElementById('delete-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Auth state listener for sign-out
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = 'login.html';
  });
});

// ── Fetch from Supabase ────────────────────────────────────────────
async function loadMyVents() {
  const feed = document.getElementById('my-feed');
  feed.innerHTML = '<div class="spin-wrap"><div class="spinner"></div>Loading your vents…</div>';

  try {
    const { data, error } = await supabaseClient
      .from('vents')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    allMyVents = data || [];
    computeStats(allMyVents);
    renderFeed(null);

  } catch (err) {
    console.error('[profile] loadMyVents error:', err);
    feed.innerHTML = `<div class="state-msg"><span class="ico">⚠️</span><p>Couldn't load vents: ${esc(err.message)}</p></div>`;
  }
}

// ── Compute & display stats ────────────────────────────────────────
function computeStats(vents) {
  document.getElementById('stat-total').textContent = vents.length;

  // Total reactions
  let totalReactions = 0;
  const moodCount = {};
  vents.forEach(v => {
    const r = v.reactions || {};
    Object.values(r).forEach(n => { totalReactions += (Number(n) || 0); });
    if (v.mood) moodCount[v.mood] = (moodCount[v.mood] || 0) + 1;
  });
  document.getElementById('stat-reactions').textContent = totalReactions;

  // Top mood
  let topMood = '—';
  let topCount = 0;
  Object.entries(moodCount).forEach(([m, c]) => { if (c > topCount) { topCount = c; topMood = moodEmoji(m); } });
  document.getElementById('stat-mood').textContent = topMood;
}

// ── Render feed (with optional filter) ────────────────────────────
function renderFeed(moodFilter) {
  const feed = document.getElementById('my-feed');
  const REACTIONS = ['❤️','😢','😤','🤝','🌱'];

  const filtered = moodFilter
    ? allMyVents.filter(v => v.mood === moodFilter)
    : allMyVents;

  const countLabel = document.getElementById('vent-count-label');
  if (countLabel) countLabel.textContent = filtered.length + ' vent' + (filtered.length !== 1 ? 's' : '');

  if (filtered.length === 0) {
    feed.innerHTML = `<div class="state-msg"><span class="ico">🌫️</span><p>${moodFilter ? 'No ' + cap(moodFilter) + ' vents yet.' : "You haven't vented yet."}</p></div>`;
    return;
  }

  feed.innerHTML = '';
  filtered.forEach((vent, i) => {
    const reactions = vent.reactions || {};
    const card = document.createElement('div');
    card.className = 'vent-card';
    card.style.animationDelay = i * 40 + 'ms';
    card.innerHTML = `
      <div class="card-top">
        <span class="mood-tag ${vent.mood || 'lost'}">${moodEmoji(vent.mood)} ${cap(vent.mood || 'lost')}</span>
        <span class="time-ago">${timeAgo(vent.created_at)}</span>
      </div>
      <p class="vent-text">${esc(vent.content)}</p>
      <div class="reaction-row">
        ${REACTIONS.map(e => `<span class="react-chip">${e} ${reactions[e] || 0}</span>`).join('')}
      </div>
      <button class="delete-btn" data-id="${vent.id}">🗑️ Delete</button>`;
    card.querySelector('.delete-btn').addEventListener('click', () => openModal(vent.id));
    feed.appendChild(card);
  });
}

// ── Delete modal ───────────────────────────────────────────────────
function openModal(id) {
  pendingDeleteId = id;
  document.getElementById('delete-modal').classList.add('open');
}
function closeModal() {
  pendingDeleteId = null;
  document.getElementById('delete-modal').classList.remove('open');
}
async function confirmDelete() {
  if (!pendingDeleteId) return;
  const btn = document.getElementById('confirm-delete');
  btn.textContent = 'Deleting…';
  btn.disabled = true;

  try {
    const { error } = await supabaseClient.from('vents').delete().eq('id', pendingDeleteId);
    if (error) throw error;
    allMyVents = allMyVents.filter(v => v.id !== pendingDeleteId);
    computeStats(allMyVents);
    const activeFilter = document.querySelector('#my-mood-filter .fchip.active');
    renderFeed(activeFilter?.dataset.f === 'all' ? null : activeFilter?.dataset.f || null);
    showToast('🗑️ Vent deleted.');
  } catch (err) {
    showToast('❌ Delete failed: ' + err.message);
  } finally {
    btn.textContent = 'Delete 🗑️';
    btn.disabled = false;
    closeModal();
  }
}
