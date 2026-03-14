document.addEventListener("DOMContentLoaded", () => {
  const addProjectForm = document.getElementById("addProjectForm");
  const pasteCoordinatesButton = document.getElementById("pasteCoordinates");

  // ─── Popup ───────────────────────────────────────────────────
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
        <div><p class="text-white" id="popupMessage"></p></div>
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

  // ─── Coordinate Pasting ──────────────────────────────────────
  if (pasteCoordinatesButton) {
    pasteCoordinatesButton.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        const coordMatch = text.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
        if (coordMatch) {
          const num1 = parseFloat(coordMatch[1]);
          const num2 = parseFloat(coordMatch[2]);
          if (Math.abs(num1) <= 90 && Math.abs(num2) <= 180) {
            document.getElementById("latitude").value = num1;
            document.getElementById("longitude").value = num2;
          } else if (Math.abs(num2) <= 90 && Math.abs(num1) <= 180) {
            document.getElementById("latitude").value = num2;
            document.getElementById("longitude").value = num1;
          } else {
            document.getElementById("latitude").value = num1;
            document.getElementById("longitude").value = num2;
          }
          showPopup("Coordinates pasted successfully!");
        } else {
          showPopup(
            "No valid coordinates found in clipboard (Format: lat, lng)",
          );
        }
      } catch (err) {
        showPopup("Failed to access clipboard. Please grant permission.");
      }
    });
  }

  // ─── Geolocation ─────────────────────────────────────────────
  const useGeolocationButton = document.getElementById("useGeolocation");
  if (useGeolocationButton) {
    useGeolocationButton.addEventListener("click", () => {
      if (!navigator.geolocation) {
        showPopup("Geolocation is not supported by your browser.");
        return;
      }
      const originalHTML = useGeolocationButton.innerHTML;
      useGeolocationButton.disabled = true;
      useGeolocationButton.style.opacity = "0.5";

      navigator.geolocation.getCurrentPosition(
        (position) => {
          document.getElementById("latitude").value =
            position.coords.latitude.toFixed(6);
          document.getElementById("longitude").value =
            position.coords.longitude.toFixed(6);
          showPopup(
            `Location detected!\nAccuracy: ±${Math.round(position.coords.accuracy)}m`,
          );
          useGeolocationButton.disabled = false;
          useGeolocationButton.style.opacity = "1";
        },
        (error) => {
          const msgs = {
            [error.PERMISSION_DENIED]:
              "Location access denied. Please enable location permissions.",
            [error.POSITION_UNAVAILABLE]:
              "Location information is unavailable.",
            [error.TIMEOUT]: "Location request timed out. Please try again.",
          };
          showPopup(msgs[error.code] || "Unable to retrieve your location.");
          useGeolocationButton.disabled = false;
          useGeolocationButton.style.opacity = "1";
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }

  // ─── Dropdowns ───────────────────────────────────────────────
  async function populateDropdowns() {
    try {
      const [counties, types, statuses] = await Promise.all([
        fetch("/gis/counties").then((r) => r.json()),
        fetch("/gis/types").then((r) => r.json()),
        fetch("/gis/statuses").then((r) => r.json()),
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

  // ─── Hero Image Preview ──────────────────────────────────────
  const heroInput = document.getElementById("hero_image_url");
  const heroPreviewWrap = document.getElementById("hero-preview-wrap");
  const heroPreview = document.getElementById("hero-preview");

  if (heroInput) {
    heroInput.addEventListener("input", () => {
      const url = heroInput.value.trim();
      if (url) {
        heroPreview.src = url;
        heroPreviewWrap.classList.remove("hidden");
        heroPreview.onerror = () => heroPreviewWrap.classList.add("hidden");
      } else {
        heroPreviewWrap.classList.add("hidden");
      }
    });
  }

  // ─── Paragraph Blocks ────────────────────────────────────────
  const paragraphsContainer = document.getElementById("paragraphs-container");
  const addParagraphBtn = document.getElementById("addParagraphBtn");

  function createParagraphBlock() {
    const wrap = document.createElement("div");
    wrap.className = "paragraph-block relative";
    wrap.innerHTML = `
      <textarea class="w-full text-base p-2 font-inter paragraph-input"
        placeholder="Write a paragraph about this project..." rows="4"></textarea>
      <button type="button" class="block-remove-btn" title="Remove">×</button>
    `;
    wrap
      .querySelector(".block-remove-btn")
      .addEventListener("click", () => wrap.remove());
    return wrap;
  }

  if (addParagraphBtn) {
    addParagraphBtn.addEventListener("click", () => {
      paragraphsContainer.appendChild(createParagraphBlock());
    });
  }

  // ─── Gallery Image Blocks ─────────────────────────────────────
  const imagesContainer = document.getElementById("images-container");
  const addImageBtn = document.getElementById("addImageBtn");

  function createImageBlock() {
    const wrap = document.createElement("div");
    wrap.className = "image-block relative";
    wrap.innerHTML = `
      <input type="url" class="w-full text-base h-9 p-2 font-inter image-url-input"
        placeholder="https://..." />
      <img class="image-block-preview" alt="Preview" />
      <button type="button" class="block-remove-btn" title="Remove">×</button>
    `;
    const input = wrap.querySelector(".image-url-input");
    const preview = wrap.querySelector(".image-block-preview");
    input.addEventListener("input", () => {
      const url = input.value.trim();
      if (url) {
        preview.src = url;
        preview.style.display = "block";
        preview.onerror = () => {
          preview.style.display = "none";
        };
      } else {
        preview.style.display = "none";
      }
    });
    wrap
      .querySelector(".block-remove-btn")
      .addEventListener("click", () => wrap.remove());
    return wrap;
  }

  if (addImageBtn) {
    addImageBtn.addEventListener("click", () => {
      imagesContainer.appendChild(createImageBlock());
    });
  }

  // ─── Collect Article Content ──────────────────────────────────
  function collectBlocks() {
    const blocks = [];
    let sortOrder = 0;

    // Paragraphs first (in DOM order)
    paragraphsContainer.querySelectorAll(".paragraph-input").forEach((ta) => {
      const text = ta.value.trim();
      if (text) {
        blocks.push({
          block_type: "paragraph",
          content: text,
          sort_order: sortOrder++,
        });
      }
    });

    // Gallery images after
    imagesContainer.querySelectorAll(".image-url-input").forEach((input) => {
      const url = input.value.trim();
      if (url) {
        blocks.push({
          block_type: "image",
          content: url,
          sort_order: sortOrder++,
        });
      }
    });

    return blocks;
  }

  // ─── Submit ───────────────────────────────────────────────────
  if (addProjectForm) {
    populateDropdowns();

    addProjectForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitBtn = addProjectForm.querySelector("[type=submit]");
      submitBtn.disabled = true;
      submitBtn.textContent = "SAVING...";

      const projectData = Object.fromEntries(new FormData(addProjectForm));

      try {
        // Step 1: Create the project
        const projectRes = await fetch("/gis/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectData),
        });

        if (!projectRes.ok) {
          const err = await projectRes.json();
          showPopup(`Error: ${err.error}`);
          submitBtn.disabled = false;
          submitBtn.textContent = "ADD PROJECT";
          return;
        }

        const projectResult = await projectRes.json();
        const newProjectId = projectResult.id;

        // Step 2: Create article if any content was filled in
        const heroUrl = document.getElementById("hero_image_url")?.value.trim();
        const blocks = collectBlocks();
        const hasContent = heroUrl || blocks.length > 0;

        if (hasContent && newProjectId) {
          const articleRes = await fetch(`/projects/${newProjectId}/article`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hero_image_url: heroUrl || null, blocks }),
          });

          if (!articleRes.ok) {
            // Project saved but article failed — tell admin
            showPopup(
              `"${projectData.project_name}" was added, but the website content failed to save. You can add it later from the edit page.`,
            );
            addProjectForm.reset();
            resetWebsiteContent();
            submitBtn.disabled = false;
            submitBtn.textContent = "ADD PROJECT";
            return;
          }
        }

        showPopup(`"${projectData.project_name}" has been added!`);
        addProjectForm.reset();
        resetWebsiteContent();
      } catch (error) {
        console.error(error);
        showPopup("An unexpected error occurred.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "ADD PROJECT";
      }
    });
  }

  // ─── Reset website content section ───────────────────────────
  function resetWebsiteContent() {
    if (heroInput) heroInput.value = "";
    if (heroPreviewWrap) heroPreviewWrap.classList.add("hidden");

    // Reset paragraphs to just one empty block
    if (paragraphsContainer) {
      paragraphsContainer.innerHTML = `
        <div class="paragraph-block relative">
          <textarea class="w-full text-base p-2 font-inter paragraph-input"
            placeholder="Write a paragraph about this project..." rows="4"></textarea>
        </div>
      `;
    }

    // Clear all gallery image blocks
    if (imagesContainer) imagesContainer.innerHTML = "";
  }
});
