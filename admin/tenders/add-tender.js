document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addTenderForm");
  const titleInput = document.getElementById("title");
  const slugInput = document.getElementById("slug");
  const documentsContainer = document.getElementById("documents-container");
  const paragraphsContainer = document.getElementById("paragraphs-container");

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
      window.location.href = "/admin/tenders/manage-tenders.html";
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
                    <option value="XLSX" ${docType === "XLSX" ? "selected" : ""}>XLSX</option>
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
    btn.textContent = "+ ADD DOCUMENT";
    btn.addEventListener("click", () => {
      const newBlock = createDocumentBlock();
      documentsContainer.insertBefore(newBlock, btn);
    });
    return btn;
  }

  // Paragraph block functions (for rich content)
  function createParagraphBlock(content = "") {
    const wrap = document.createElement("div");
    wrap.className = "paragraph-block relative";
    wrap.innerHTML = `
            <textarea class="w-full text-base p-2 font-inter paragraph-input" placeholder="Write a paragraph about this tender..." rows="4">${escapeHtml(content)}</textarea>
            <button type="button" class="block-remove-btn" title="Remove">×</button>
        `;
    wrap
      .querySelector(".block-remove-btn")
      .addEventListener("click", () => wrap.remove());
    return wrap;
  }

  function createAddParagraphBtn() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "text-xs font-marlin text-blue-400 hover:text-blue-300 border border-blue-400 hover:border-blue-300 px-3 py-1 rounded mt-2 block";
    btn.textContent = "+ ADD PARAGRAPH";
    btn.addEventListener("click", () => {
      const newBlock = createParagraphBlock();
      paragraphsContainer.insertBefore(newBlock, btn);
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

  // Initialize containers
  documentsContainer.innerHTML = "";
  documentsContainer.appendChild(createDocumentBlock());
  documentsContainer.appendChild(createAddDocumentBtn());

  paragraphsContainer.innerHTML = "";
  paragraphsContainer.appendChild(createAddParagraphBtn());

  // Collect data function
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

  function collectParagraphs() {
    const paragraphs = [];
    let sortOrder = 0;
    paragraphsContainer.querySelectorAll(".paragraph-input").forEach((ta) => {
      const content = ta.value.trim();
      if (content) {
        paragraphs.push({
          block_type: "paragraph",
          content: content,
          sort_order: sortOrder++,
        });
      }
    });
    return paragraphs;
  }

  // Form submission
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector("[type=submit]");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "ADDING...";
    submitBtn.disabled = true;

    const tenderData = {
      title: document.getElementById("title").value.trim(),
      slug: document.getElementById("slug").value.trim(),
      reference_number:
        document.getElementById("reference_number").value.trim() || null,
      category: document.getElementById("category").value || null,
      procurement_method:
        document.getElementById("procurement_method").value.trim() || null,
      published_date: document.getElementById("published_date").value || null,
      closing_date: document.getElementById("closing_date").value || null,
      status: document.getElementById("status").value,
      description: document.getElementById("description").value.trim() || null,
      documents: collectDocuments(),
      paragraphs: collectParagraphs(),
    };

    // Validation
    if (!tenderData.title) {
      showPopup("Tender title is required", true);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }
    if (!tenderData.slug) {
      showPopup("Slug is required", true);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    try {
      const response = await fetch("/gis/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenderData),
      });

      if (response.ok) {
        const result = await response.json();
        showPopup(result.message || "Tender added successfully!");
      } else {
        const error = await response.json();
        showPopup(error.error || "Failed to add tender", true);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    } catch (err) {
      console.error("Error adding tender:", err);
      showPopup("An unexpected error occurred", true);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
});
