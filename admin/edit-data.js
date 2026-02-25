document.addEventListener("DOMContentLoaded", () => {
  const projectId = new URLSearchParams(window.location.search).get("id");
  const editProjectForm = document.getElementById("editProjectForm");

  // Popup Container initialization
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

  async function fetchProjectDetails(id) {
    try {
      const response = await fetch(`/gis/project/${id}`);
      if (!response.ok) throw new Error("Not found");
      const project = await response.json();

      document.getElementById("latitude").value = project.latitude;
      document.getElementById("longitude").value = project.longitude;
      document.getElementById("progress").value = project.progress;
      document.getElementById("description").value = project.description || "";

      // Display project details at the top
      const projectDetailsDiv = document.getElementById("projectDetails");
      if (projectDetailsDiv) {
        projectDetailsDiv.innerHTML = `
          <h2 class="text-xl font-bold mb-2">${project.project_name}</h2>
          <p class="text-gray-400">County: ${project.county_name}</p>
          <p class="text-gray-400">Type: ${project.type_name}</p>
        `;
      }

      const statuses = await fetch("/gis/statuses").then((res) => res.json());
      const statusSelect = document.getElementById("project_status");
      statusSelect.innerHTML = "";
      statuses.forEach((s) => {
        const opt = new Option(s.status, s.id);
        if (s.id === project.project_status) opt.selected = true;
        statusSelect.add(opt);
      });
    } catch (error) {
      console.error("Error fetching details:", error);
      showPopup("Error loading project details");
    }
  }

  if (projectId) fetchProjectDetails(projectId);

  if (editProjectForm) {
    editProjectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const projectData = Object.fromEntries(new FormData(editProjectForm));
      try {
        const response = await fetch(`/gis/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectData),
        });
        if (response.ok) {
          showPopup("Project updated successfully!");
        } else {
          const errorData = await response.json();
          showPopup(`Error: ${errorData.error}`);
        }
      } catch (error) {
        showPopup("Error updating project.");
      }
    });
  }
});
