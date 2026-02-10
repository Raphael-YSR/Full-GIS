document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");

  searchInput.addEventListener("input", async (event) => {
    const query = event.target.value.trim();
    if (query.length === 0) {
      searchResults.innerHTML = "";
      return;
    }

    try {
      // Updated path to /gis/...
      const response = await fetch(
        `/gis/search?q=${encodeURIComponent(query)}`,
      );
      if (response.ok) {
        const results = await response.json();
        searchResults.innerHTML = "";
        results.forEach((p) => {
          const card = document.createElement("div");
          card.className = "project-card";
          card.innerHTML = `<h3>${p.project_name}</h3><p>${p.county}</p>`;
          card.onclick = () => (window.location.href = `/edit-data?id=${p.id}`);
          searchResults.appendChild(card);
        });
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  });
});
