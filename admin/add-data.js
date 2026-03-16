document.addEventListener("DOMContentLoaded", () => {
  const addProjectForm = document.getElementById("addProjectForm");
  const pasteCoordinatesButton = document.getElementById("pasteCoordinates");
  const submitBtn = addProjectForm.querySelector("[type=submit]");

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

  // ─── Dirty tracking — submit disabled until something changes ─
  function setSubmitEnabled(enabled) {
    submitBtn.disabled = !enabled;
    submitBtn.classList.toggle("opacity-50", !enabled);
    submitBtn.classList.toggle("cursor-not-allowed", !enabled);
  }
  setSubmitEnabled(false);

  function markDirty() {
    setSubmitEnabled(true);
  }

  addProjectForm.addEventListener("input", markDirty);
  addProjectForm.addEventListener("change", markDirty);

  // ─── Coordinate Pasting ───────────────────────────────────────
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
          markDirty();
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
      useGeolocationButton.disabled = true;
      useGeolocationButton.style.opacity = "0.5";
      navigator.geolocation.getCurrentPosition(
        (position) => {
          document.getElementById("latitude").value =
            position.coords.latitude.toFixed(6);
          document.getElementById("longitude").value =
            position.coords.longitude.toFixed(6);
          markDirty();
          showPopup(
            `Location detected successfully!\nAccuracy: ±${Math.round(position.coords.accuracy)}m`,
          );
          useGeolocationButton.disabled = false;
          useGeolocationButton.style.opacity = "1";
        },
        (error) => {
          let msg = "Unable to retrieve your location.";
          if (error.code === error.PERMISSION_DENIED)
            msg = "Location access denied. Please enable location permissions.";
          else if (error.code === error.POSITION_UNAVAILABLE)
            msg = "Location information is unavailable.";
          else if (error.code === error.TIMEOUT)
            msg = "Location request timed out. Please try again.";
          showPopup(msg);
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

      const mandated = counties.filter((c) => c.is_mandated);
      const featured = counties.filter((c) => !c.is_mandated);

      const mandatedGroup = document.createElement("optgroup");
      mandatedGroup.label = "── Mandated Counties ──";
      mandated.forEach((c) =>
        mandatedGroup.appendChild(new Option(c.county_name, c.id)),
      );
      const featuredGroup = document.createElement("optgroup");
      featuredGroup.label = "── Featured Counties ──";
      featured.forEach((c) =>
        featuredGroup.appendChild(new Option(c.county_name, c.id)),
      );
      countySelect.appendChild(mandatedGroup);
      countySelect.appendChild(featuredGroup);

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

  function createParagraphBlock(value = "") {
    const wrap = document.createElement("div");
    wrap.className = "paragraph-block relative";
    wrap.innerHTML = `
      <textarea class="w-full text-base p-2 font-inter paragraph-input"
        placeholder="Write a paragraph about this project..." rows="4"></textarea>
      <button type="button" class="block-remove-btn" title="Remove">×</button>
    `;
    wrap.querySelector("textarea").value = value;
    wrap.querySelector("textarea").addEventListener("input", markDirty);
    wrap.querySelector(".block-remove-btn").addEventListener("click", () => {
      wrap.remove();
      markDirty();
    });
    return wrap;
  }

  function getAddParagraphBtn() {
    return document.getElementById("addParagraphBtn");
  }

  function createAddParagraphBtn() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "addParagraphBtn";
    btn.className =
      "text-xs font-marlin text-blue-400 hover:text-blue-300 border border-blue-400 hover:border-blue-300 px-3 py-1 rounded mt-2 block";
    btn.textContent = "+ ADD PARAGRAPH";
    btn.addEventListener("click", () => {
      const newBlock = createParagraphBlock();
      paragraphsContainer.insertBefore(newBlock, btn);
      newBlock.querySelector("textarea").focus();
      markDirty();
    });
    return btn;
  }

  // Seed: one default block + add button at bottom
  paragraphsContainer.innerHTML = "";
  paragraphsContainer.appendChild(createParagraphBlock());
  paragraphsContainer.appendChild(createAddParagraphBtn());

  // ─── Gallery Image Blocks ─────────────────────────────────────
  const imagesContainer = document.getElementById("images-container");

  function createImageBlock(value = "") {
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
    input.value = value;

    if (value) {
      preview.src = value;
      preview.style.display = "block";
      preview.onerror = () => (preview.style.display = "none");
    }

    input.addEventListener("input", () => {
      const url = input.value.trim();
      if (url) {
        preview.src = url;
        preview.style.display = "block";
        preview.onerror = () => (preview.style.display = "none");
      } else {
        preview.style.display = "none";
      }
      markDirty();
    });

    wrap.querySelector(".block-remove-btn").addEventListener("click", () => {
      wrap.remove();
      markDirty();
    });
    return wrap;
  }

  function createAddImageBtn() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "addImageBtn";
    btn.className =
      "text-xs font-marlin text-blue-400 hover:text-blue-300 border border-blue-400 hover:border-blue-300 px-3 py-1 rounded mt-2 block";
    btn.textContent = "+ ADD IMAGE";
    btn.addEventListener("click", () => {
      const newBlock = createImageBlock();
      imagesContainer.insertBefore(newBlock, btn);
      newBlock.querySelector("input").focus();
      markDirty();
    });
    return btn;
  }

  // Seed: just the add button (no default image block)
  imagesContainer.innerHTML = "";
  imagesContainer.appendChild(createAddImageBtn());

  // ─── Collect blocks ───────────────────────────────────────────
  function collectBlocks() {
    const blocks = [];
    let sortOrder = 0;
    paragraphsContainer.querySelectorAll(".paragraph-input").forEach((ta) => {
      const text = ta.value.trim();
      if (text)
        blocks.push({
          block_type: "paragraph",
          content: text,
          sort_order: sortOrder++,
        });
    });
    imagesContainer.querySelectorAll(".image-url-input").forEach((input) => {
      const url = input.value.trim();
      if (url)
        blocks.push({
          block_type: "image",
          content: url,
          sort_order: sortOrder++,
        });
    });
    return blocks;
  }

  // ─── Form Submit ──────────────────────────────────────────────
  if (addProjectForm) {
    populateDropdowns();

    addProjectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setSubmitEnabled(false);
      submitBtn.textContent = "ADDING...";

      const projectData = Object.fromEntries(new FormData(addProjectForm));
      const heroUrl = heroInput?.value.trim() || null;
      const blocks = collectBlocks();

      try {
        const response = await fetch("/gis/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showPopup(`Error: ${errorData.error}`);
          setSubmitEnabled(true);
          submitBtn.textContent = "ADD PROJECT";
          return;
        }

        const result = await response.json();
        const newProjectId = result.id;

        // If website content provided, create the article
        if (newProjectId && (heroUrl || blocks.length > 0)) {
          try {
            await fetch(`/gis/projects/${newProjectId}/article`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hero_image_url: heroUrl, blocks }),
            });
          } catch (articleErr) {
            console.error("Article creation failed:", articleErr);
          }
        }

        showPopup(`${projectData.project_name} has been added!`);
        addProjectForm.reset();

        // Re-seed block UI after reset
        paragraphsContainer.innerHTML = "";
        paragraphsContainer.appendChild(createParagraphBlock());
        paragraphsContainer.appendChild(createAddParagraphBtn());
        imagesContainer.innerHTML = "";
        imagesContainer.appendChild(createAddImageBtn());
        if (heroPreviewWrap) heroPreviewWrap.classList.add("hidden");

        submitBtn.textContent = "ADD PROJECT";
        // Keep disabled until next change
      } catch (error) {
        showPopup("An unexpected error occurred.");
        setSubmitEnabled(true);
        submitBtn.textContent = "ADD PROJECT";
      }
    });
  }
});
