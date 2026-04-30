// Fetch only the logged in user's vents
async function fetchMyVents() {
    const session = await requireAuth();

    const { data, error } = await supabase
        .from("vents")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

    if (error) console.error(error);
    else renderMyVents(data);
}

// Render user's own vents with delete button
function renderMyVents(vents) {
    const feed = document.getElementById("my-feed");
    feed.innerHTML = "";

    if (vents.length === 0) {
        feed.innerHTML = "<p style='text-align:center; color:#94a3b8;'>You haven't vented yet!</p>";
        return;
    }

    vents.forEach(vent => {
        const card = document.createElement("div");
        card.className = "vent-card";
        card.innerHTML = `
      <span class="mood-tag ${vent.mood}">${vent.mood}</span>
      <p>${vent.content}</p>
      <small>${timeAgo(vent.created_at)}</small>
      <div class="reactions">
        <span>❤️ ${vent.reactions.heart}</span>
        <span>🔥 ${vent.reactions.fire}</span>
        <span>🤗 ${vent.reactions.hug}</span>
        <span>😢 ${vent.reactions.cry}</span>
        <span>💪 ${vent.reactions.strong}</span>
      </div>
      <button class="delete-btn" onclick="deleteVent('${vent.id}')">🗑️ Delete</button>
    `;
        feed.appendChild(card);
    });
}

// Delete a vent
async function deleteVent(ventId) {
    const confirm = window.confirm("Delete this vent?");
    if (!confirm) return;

    const { error } = await supabase.from("vents").delete().eq("id", ventId);
    if (error) alert("Error deleting: " + error.message);
    else fetchMyVents();
}

// On page load
window.onload = () => {
    fetchMyVents();
};
