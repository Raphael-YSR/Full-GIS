document.addEventListener("DOMContentLoaded", () => {
  const addProjectForm = document.getElementById("addProjectForm");
  const pasteCoordinatesButton = document.getElementById("pasteCoordinates");

  const popupContainer = document.createElement("div");
  popupContainer.className =
    "fixed inset-0 flex items-center justify-center z-50 hidden";
  popupContainer.id = "customPopup";

  popupContainer.innerHTML = `
        <div class="absolute inset-0 bg-black bg-opacity-30"></div>
        <div class="bg-black rounded-lg shadow-lg p-6 max-w-md w-full mx-4 relative z-10 font-marlinsoftmedium">
            <div class="flex items-center">
                <div class="flex items-center justify-center mr-4 flex-shrink-0 bg-green-100 rounded-full p-2">
                    <svg class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <div>
                    <p class="text-white" id="popupMessage"></p>
                </div>
            </div>
            <button id="closePopup" class="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-200">
                OK
            </button>
        </div>
    `;
  document.body.appendChild(popupContainer);

  const showPopup = (message) => {
    document.getElementById("popupMessage").textContent = message;
    popupContainer.classList.remove("hidden");
  };

  document.getElementById("closePopup").addEventListener("click", () => {
    popupContainer.classList.add("hidden");
  });

  // Coordinate Pasting Logic
  if (pasteCoordinatesButton) {
    pasteCoordinatesButton.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        const coordMatch = text.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
        if (coordMatch) {
          document.getElementById("latitude").value = coordMatch[1];
          document.getElementById("longitude").value = coordMatch[2];
        } else {
          showPopup(
            "No valid coordinates found in clipboard (Format: lat, lng)",
          );
        }
      } catch (err) {
        showPopup("Failed to access clipboard.");
      }
    });
  }

  async function populateDropdowns() {
    try {
      const [counties, types, statuses] = await Promise.all([
        fetch("/gis/counties").then((res) => res.json()),
        fetch("/gis/types").then((res) => res.json()),
        fetch("/gis/statuses").then((res) => res.json()),
      ]);

      const countySelect = document.getElementById("county_id");
      const typeSelect = document.getElementById("project_type");
      const statusSelect = document.getElementById("project_status");

      counties.forEach((c) =>
        countySelect.add(new Option(c.county_name, c.id)),
      );
      types.forEach((t) => typeSelect.add(new Option(t.type, t.id)));
      statuses.forEach((s) => statusSelect.add(new Option(s.status, s.id)));
    } catch (error) {
      console.error("Error populating dropdowns:", error);
    }
  }

  if (addProjectForm) {
    populateDropdowns();
    addProjectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const projectData = Object.fromEntries(new FormData(addProjectForm));

      try {
        const response = await fetch("/gis/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectData),
        });

        if (response.ok) {
          showPopup(`${projectData.project_name} has been added!`);
          addProjectForm.reset();
        } else {
          const errorData = await response.json();
          showPopup(`Error: ${errorData.error}`);
        }
      } catch (error) {
        showPopup("An unexpected error occurred.");
      }
    });
  }
});
