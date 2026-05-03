document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addVacancyForm");
  const titleInput = document.getElementById("title");
  const slugInput = document.getElementById("slug");
  const documentsContainer = document.getElementById("documents-container");

  // Popup elements
  const popup = document.getElementById("popup");
  const popupIcon = document.getElementById("popupIcon");
  const popupTitle = document.getElementById("popupTitle");
  const popupMessage = document.getElementById("popupMessage");
  const closePopup = document.getElementById("closePopup");

  function showPopup(message, isError = false) {
    if (isError) {
      popupIcon.className = "fas fa-times-circle text-red-500 text-5xl mb-4";
      popupTitle.textContent = "Error";
    } else {
      popupIcon.className = "fas fa-check-circle text-green-500 text-5xl mb-4";
      popupTitle.textContent = "Success";
    }
    popupMessage.textContent = message;
    popup.classList.remove("hidden");
  }

  closePopup.addEventListener("click", () => {
    popup.classList.add("hidden");
    if (!popupMessage.textContent.includes("Error")) {
      window.location.href = "/admin/vacancies/manage-vacancies.html";
    }
  });

  // Auto-generate slug from title
  function slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  titleInput.addEventListener("input", () => {
    if (
      !slugInput.value ||
      slugInput.value === slugify(titleInput.dataset.oldValue || "")
    ) {
      slugInput.value = slugify(titleInput.value);
    }
  });
  titleInput.addEventListener("blur", () => {
    titleInput.dataset.oldValue = titleInput.value;
  });

  // Document block functions
  function createDocumentBlock(title = "", url = "", docType = "PDF") {
    const wrap = document.createElement("div");
    wrap.className = "document-block relative";
    wrap.innerHTML = `
            <div class="form-row" style="margin-bottom: 0.5rem;">
                <input type="text" class="doc-title" placeholder="Document title *" value="${escapeHtml(title)}">
                <input type="url" class="doc-url" placeholder="File URL *" value="${escapeHtml(url)}">
                <select class="doc-type" style="width: auto;">
                    <option value="PDF" ${docType === "PDF" ? "selected" : ""}>PDF</option>
                    <option value="DOC" ${docType === "DOC" ? "selected" : ""}>DOC</option>
                    <option value="DOCX" ${docType === "DOCX" ? "selected" : ""}>DOCX</option>
                </select>
            </div>
            <button type="button" class="block-remove-btn" title="Remove">×</button>
        `;
    wrap
      .querySelector(".block-remove-btn")
      .addEventListener("click", () => wrap.remove());
    return wrap;
  }

  function createAddDocumentBtn() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "text-xs font-marlin text-blue-400 hover:text-blue-300 border border-blue-400 hover:border-blue-300 px-3 py-1 rounded mt-2 block";
    btn.textContent = "+ ADD ATTACHMENT";
    btn.addEventListener("click", () => {
      const newBlock = createDocumentBlock();
      documentsContainer.insertBefore(newBlock, btn);
    });
    return btn;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>]/g, function (m) {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      return m;
    });
  }

  // Initialize documents container
  documentsContainer.innerHTML = "";
  documentsContainer.appendChild(createAddDocumentBtn());

  // Collect attachments
  function collectDocuments() {
    const docs = [];
    documentsContainer.querySelectorAll(".document-block").forEach((block) => {
      const title = block.querySelector(".doc-title")?.value.trim();
      const url = block.querySelector(".doc-url")?.value.trim();
      const docType = block.querySelector(".doc-type")?.value;
      if (title && url) {
        docs.push({ title, file_url: url, document_type: docType });
      }
    });
    return docs;
  }

  // Form submission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector("[type=submit]");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "ADDING...";
    submitBtn.disabled = true;

    const vacancyData = {
      title: document.getElementById("title").value.trim(),
      slug: document.getElementById("slug").value.trim(),
      reference_number:
        document.getElementById("reference_number").value.trim() || null,
      job_grade: document.getElementById("job_grade").value.trim() || null,
      department: document.getElementById("department").value.trim() || null,
      location: document.getElementById("location").value.trim() || null,
      employment_type: document.getElementById("employment_type").value,
      salary_range:
        document.getElementById("salary_range").value.trim() || null,
      published_date: document.getElementById("published_date").value || null,
      closing_date: document.getElementById("closing_date").value || null,
      status: document.getElementById("status").value,
      description: document.getElementById("description").value.trim() || null,
      requirements:
        document.getElementById("requirements").value.trim() || null,
      responsibilities:
        document.getElementById("responsibilities").value.trim() || null,
      documents: collectDocuments(),
    };

    // Validation
    if (!vacancyData.title) {
      showPopup("Job title is required", true);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }
    if (!vacancyData.slug) {
      showPopup("Slug is required", true);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    try {
      const response = await fetch("/gis/vacancies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vacancyData),
      });

      if (response.ok) {
        const result = await response.json();
        showPopup(result.message || "Vacancy added successfully!");
      } else {
        const error = await response.json();
        showPopup(error.error || "Failed to add vacancy", true);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    } catch (err) {
      console.error("Error adding vacancy:", err);
      showPopup("An unexpected error occurred", true);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
});
