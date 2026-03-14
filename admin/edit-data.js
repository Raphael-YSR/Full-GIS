document.addEventListener("DOMContentLoaded", () => {
  const projectId = new URLSearchParams(window.location.search).get("id");
  const editProjectForm = document.getElementById("editProjectForm");
  const articleForm = document.getElementById("articleForm");

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

  // ─── Track whether an article already exists ─────────────────
  let articleExists = false;

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
      <button type="button" class="block-remove-btn" title="Remove">x</button>
    `;
    wrap.querySelector("textarea").value = value;
    wrap
      .querySelector(".block-remove-btn")
      .addEventListener("click", () => wrap.remove());
    return wrap;
  }

  document.getElementById("addParagraphBtn").addEventListener("click", () => {
    paragraphsContainer.appendChild(createParagraphBlock());
  });

  // ─── Gallery Image Blocks ─────────────────────────────────────
  const imagesContainer = document.getElementById("images-container");

  function createImageBlock(value = "") {
    const wrap = document.createElement("div");
    wrap.className = "image-block relative";
    wrap.innerHTML = `
      <input type="url" class="w-full text-base h-9 p-2 font-inter image-url-input"
        placeholder="https://..." />
      <img class="image-block-preview" alt="Preview" />
      <button type="button" class="block-remove-btn" title="Remove">x</button>
    `;
    const input = wrap.querySelector(".image-url-input");
    const preview = wrap.querySelector(".image-block-preview");
    input.value = value;

    if (value) {
      preview.src = value;
      preview.style.display = "block";
      preview.onerror = () => {
        preview.style.display = "none";
      };
    }

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

  document.getElementById("addImageBtn").addEventListener("click", () => {
    imagesContainer.appendChild(createImageBlock());
  });

  // ─── Collect blocks from DOM ──────────────────────────────────
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

  // ─── Populate article section from fetched data ───────────────
  function populateArticleSection(data) {
    const badge = document.getElementById("article-badge");

    if (!data.article_id) {
      articleExists = false;
      badge.textContent = "NEW";
      badge.className = "article-status-badge badge-new";
      return;
    }

    articleExists = true;
    badge.textContent = "EXISTING";
    badge.className = "article-status-badge badge-exists";

    if (data.hero_image_url && heroInput) {
      heroInput.value = data.hero_image_url;
      heroPreview.src = data.hero_image_url;
      heroPreviewWrap.classList.remove("hidden");
    }

    paragraphsContainer.innerHTML = "";
    imagesContainer.innerHTML = "";

    (data.blocks || []).forEach((block) => {
      if (block.block_type === "paragraph") {
        paragraphsContainer.appendChild(createParagraphBlock(block.content));
      } else if (block.block_type === "image") {
        imagesContainer.appendChild(createImageBlock(block.content));
      }
    });

    if (paragraphsContainer.children.length === 0) {
      paragraphsContainer.appendChild(createParagraphBlock());
    }
  }

  // ─── Fetch project + article data ────────────────────────────
  async function fetchProjectDetails(id) {
    try {
      const [projectRes, articleRes] = await Promise.all([
        fetch(`/gis/projects/${id}`),
        fetch(`/projects/${id}/article`),
      ]);

      if (!projectRes.ok) throw new Error("Project not found");
      const project = await projectRes.json();

      document.getElementById("latitude").value = project.latitude;
      document.getElementById("longitude").value = project.longitude;
      document.getElementById("progress").value = project.progress;
      document.getElementById("description").value = project.description || "";

      const projectDetailsDiv = document.getElementById("projectDetails");
      if (projectDetailsDiv) {
        projectDetailsDiv.innerHTML = `
          <h2 class="text-xl font-bold mb-2">${project.project_name}</h2>
          <p class="text-gray-400">County: ${project.county}</p>
          <p class="text-gray-400">Type: ${project.project_type_name}</p>
        `;
      }

      const statuses = await fetch("/gis/statuses").then((r) => r.json());
      const statusSelect = document.getElementById("project_status");
      statusSelect.innerHTML = "";
      statuses.forEach((s) => {
        const opt = new Option(s.status, s.id);
        if (s.id === project.project_status) opt.selected = true;
        statusSelect.add(opt);
      });

      if (articleRes.ok) {
        const articleData = await articleRes.json();
        populateArticleSection(articleData);
      }
    } catch (error) {
      console.error("Error fetching details:", error);
      showPopup("Error loading project details.");
    }
  }

  if (projectId) fetchProjectDetails(projectId);

  // ─── Metadata form submit ─────────────────────────────────────
  if (editProjectForm) {
    editProjectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = editProjectForm.querySelector("[type=submit]");
      submitBtn.disabled = true;
      submitBtn.textContent = "SAVING...";

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
          const err = await response.json();
          showPopup(`Error: ${err.error}`);
        }
      } catch (error) {
        showPopup("Error updating project.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "UPDATE PROJECT";
      }
    });
  }

  // ─── Article form submit ──────────────────────────────────────
  if (articleForm) {
    articleForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = document.getElementById("articleSubmitBtn");
      submitBtn.disabled = true;
      submitBtn.textContent = "SAVING...";

      const heroUrl = heroInput?.value.trim() || null;
      const blocks = collectBlocks();
      const method = articleExists ? "PUT" : "POST";

      try {
        const response = await fetch(`/projects/${projectId}/article`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hero_image_url: heroUrl, blocks }),
        });

        if (response.ok) {
          if (!articleExists) {
            articleExists = true;
            const badge = document.getElementById("article-badge");
            badge.textContent = "EXISTING";
            badge.className = "article-status-badge badge-exists";
          }
          showPopup("Website content saved successfully!");
        } else {
          const err = await response.json();
          showPopup(`Error: ${err.error}`);
        }
      } catch (error) {
        showPopup("Error saving website content.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "SAVE WEBSITE CONTENT";
      }
    });
  }
});
