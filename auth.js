// auth.js — Session management & header control for Vently

// ── Guard: redirect to login if not authenticated ──────────────────────────
// Only runs on pages that are NOT login.html
async function checkIfLoggedIn() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
      // Not logged in → send to login page
      window.location.href = 'login.html';
      return null;
    }

    // Logged in → update the header UI
    _applyLoggedInUI(session.user);
    return session.user;

  } catch (err) {
    console.error('[auth] checkIfLoggedIn error:', err);
    // If Supabase isn't configured yet, stay on page but don't crash
    return null;
  }
}

// ── Show logged-in header state ────────────────────────────────────────────
function _applyLoggedInUI(user) {
  const loginBtn    = document.getElementById('login-btn');
  const logoutBtn   = document.getElementById('logout-btn');
  const profileLink = document.getElementById('profile-link');
  const postBox     = document.getElementById('post-box');

  if (loginBtn)    loginBtn.style.display    = 'none';
  if (logoutBtn)   logoutBtn.style.display   = 'inline-flex';
  if (profileLink) profileLink.style.display = 'flex';
  if (postBox)     postBox.style.display     = 'block';
}

// ── Logout ─────────────────────────────────────────────────────────────────
async function logout() {
  try {
    await supabaseClient.auth.signOut();
  } catch (err) {
    console.error('[auth] logout error:', err);
  } finally {
    window.location.href = 'login.html';
  }
}

// ── Listen for auth state changes (token refresh, external sign-out) ────────
try {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'login.html';
    }
    if (event === 'SIGNED_IN' && session) {
      _applyLoggedInUI(session.user);
    }
  });
} catch (_) { /* Supabase not yet configured */ }