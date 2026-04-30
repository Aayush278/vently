// app.js — Main application logic for Vently

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Check auth — redirects to login.html if no session
  const user = await checkIfLoggedIn();

  // 2. Load the public feed (visible to everyone who passes auth check)
  fetchVents(null);

  // 3. Wire up the post button
  const postBtn = document.getElementById('post-btn');
  if (postBtn) {
    postBtn.addEventListener('click', () => handlePost(user));
  }
});

// ── Fetch & render vents ───────────────────────────────────────────────────
async function fetchVents(moodFilter) {
  const feed = document.getElementById('feed');
  if (!feed) return;

  // Show loading state
  feed.innerHTML = `
    <div class="loading-text">
      <div class="spinner"></div>
      Loading vents…
    </div>`;

  try {
    let query = supabaseClient
      .from('vents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (moodFilter) query = query.eq('mood', moodFilter);

    const { data: vents, error } = await query;
    if (error) throw error;

    if (!vents || vents.length === 0) {
      feed.innerHTML = `
        <div class="feed-empty">
          <span class="emoji">🌫️</span>
          No vents here yet. Be the first to share.
        </div>`;
      return;
    }

    feed.innerHTML = '';
    vents.forEach((vent, i) => {
      const card = buildVentCard(vent, i);
      feed.appendChild(card);
    });

  } catch (err) {
    console.error('[app] fetchVents error:', err);
    feed.innerHTML = `
      <div class="feed-empty">
        <span class="emoji">⚠️</span>
        Couldn't load vents. Check your connection.
      </div>`;
  }
}

// ── Build a vent card DOM element ──────────────────────────────────────────
function buildVentCard(vent, index) {
  const REACTIONS = ['❤️', '😢', '😤', '🤝', '🌱'];

  const card = document.createElement('div');
  card.className = 'vent-card';
  card.style.animationDelay = `${index * 40}ms`;

  const reactions = vent.reactions || {};

  card.innerHTML = `
    <div class="card-top">
      <span class="mood-tag ${vent.mood || 'lost'}">${moodEmoji(vent.mood)} ${capitalize(vent.mood || 'lost')}</span>
      <span class="time-ago">${timeAgo(vent.created_at)}</span>
    </div>
    <p class="vent-text">${escapeHTML(vent.content)}</p>
    <div class="reaction-bar">
      ${REACTIONS.map(emoji => `
        <button class="reaction-btn" data-vent-id="${vent.id}" data-emoji="${emoji}" title="React with ${emoji}">
          <span class="emoji">${emoji}</span>
          <span class="count">${reactions[emoji] || 0}</span>
        </button>`).join('')}
    </div>`;

  // Wire reaction buttons
  card.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => handleReaction(btn, vent.id));
  });

  return card;
}

// ── Handle posting a new vent ──────────────────────────────────────────────
async function handlePost(user) {
  const input   = document.getElementById('vent-input');
  const postBtn = document.getElementById('post-btn');
  const content = input?.value.trim();

  if (!content) {
    showToast('✍️ Write something before posting.');
    return;
  }

  const activeChip = document.querySelector('#post-box .mood-chip.active');
  const mood = activeChip ? activeChip.dataset.mood : 'lost';

  postBtn.disabled    = true;
  postBtn.textContent = 'Posting…';

  try {
    const { error } = await supabaseClient.from('vents').insert({
      content,
      mood,
      user_id: user?.id || null,
      reactions: {}
    });
    if (error) throw error;

    input.value = '';
    document.getElementById('char-count').textContent = '0 / 280';
    document.querySelectorAll('#post-box .mood-chip').forEach(c => c.classList.remove('active'));
    showToast('🕊️ Your vent was posted anonymously!');
    fetchVents(null);

    // Reset active filter to All
    document.querySelectorAll('.filter-bar .mood-chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.filter-bar .mood-chip[data-filter="all"]')?.classList.add('active');

  } catch (err) {
    console.error('[app] handlePost error:', err);
    showToast('❌ Could not post. Try again.');
  } finally {
    postBtn.disabled    = false;
    postBtn.textContent = 'Post Anonymously 🕊️';
  }
}

// ── Handle reaction click ──────────────────────────────────────────────────
async function handleReaction(btn, ventId) {
  const emoji    = btn.dataset.emoji;
  const countEl  = btn.querySelector('.count');
  const current  = parseInt(countEl.textContent) || 0;

  // Optimistic update
  countEl.textContent = current + 1;
  btn.classList.add('reacted');

  try {
    // Fetch current reactions
    const { data, error } = await supabaseClient
      .from('vents')
      .select('reactions')
      .eq('id', ventId)
      .single();
    if (error) throw error;

    const reactions = data.reactions || {};
    reactions[emoji] = (reactions[emoji] || 0) + 1;

    await supabaseClient.from('vents').update({ reactions }).eq('id', ventId);
  } catch (err) {
    // Rollback
    countEl.textContent = current;
    btn.classList.remove('reacted');
    console.error('[app] handleReaction error:', err);
  }
}

// ── Toast helper ───────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Utilities ──────────────────────────────────────────────────────────────
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function moodEmoji(mood) {
  const map = { anxious: '😰', sad: '💙', angry: '🔥', lost: '🌫️', hopeful: '🌱' };
  return map[mood] || '💬';
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
