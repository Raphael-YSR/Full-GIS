document.addEventListener("DOMContentLoaded", () => {
  const tenderId = new URLSearchParams(window.location.search).get("id");
  if (!tenderId) {
    window.location.href = "/admin/tenders/manage-tenders.html";
    return;
  }

  // DOM Elements
  const tenderInfoDiv = document.getElementById("tenderInfo");
  const editForm = document.getElementById("editTenderForm");
  const saveBtn = document.getElementById("saveBtn");
  const documentsContainer = document.getElementById("documents-container");
  const saveDocumentsBtn = document.getElementById("saveDocumentsBtn");
  const paragraphsContainer = document.getElementById("paragraphs-container");
  const saveParagraphsBtn = document.getElementById("saveParagraphsBtn");

  // Form fields
  const titleInput = document.getElementById("title");
  const slugInput = document.getElementById("slug");
  const referenceInput = document.getElementById("reference_number");
  const categorySelect = document.getElementById("category");
  const procurementInput = document.getElementById("procurement_method");
  const publishedDateInput = document.getElementById("published_date");
  const closingDateInput = document.getElementById("closing_date");
  const statusSelect = document.getElementById("status");
  const descriptionTextarea = document.getElementById("description");

  // Track original data for dirty checking
  let originalTenderData = {};
  let originalDocuments = [];
  let originalParagraphs = [];

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
      location.reload();
    }
  });

  function getStatusBadge(status) {
    const statusMap = {
      open: '<span class="status-badge status-open">OPEN</span>',
      closed: '<span class="status-badge status-closed">CLOSED</span>',
      cancelled: '<span class="status-badge status-cancelled">CANCELLED</span>',
      awarded: '<span class="status-badge status-awarded">AWARDED</span>',
    };
    return statusMap[status] || status.toUpperCase();
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-KE");
  }

  // Document block functions
  function createDocumentBlock(
    id = null,
    title = "",
    url = "",
    docType = "PDF",
  ) {
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
    if (id) wrap.dataset.docId = id;
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

  // Paragraph block functions
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

  // Collect functions
  function collectDocuments() {
    const docs = [];
    documentsContainer.querySelectorAll(".document-block").forEach((block) => {
      const title = block.querySelector(".doc-title")?.value.trim();
      const url = block.querySelector(".doc-url")?.value.trim();
      const docType = block.querySelector(".doc-type")?.value;
      if (title && url) {
        docs.push({
          id: block.dataset.docId ? parseInt(block.dataset.docId) : null,
          title,
          file_url: url,
          document_type: docType,
        });
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

  // Load tender data
  async function loadTender() {
    try {
      const response = await fetch(`/gis/tenders/${tenderId}`);
      if (!response.ok) {
        if (response.status === 404) {
          window.location.href = "/admin/tenders/manage-tenders.html";
        }
        throw new Error("Failed to load tender");
      }
      const tender = await response.json();

      // Store original data
      originalTenderData = {
        title: tender.title,
        slug: tender.slug,
        reference_number: tender.reference_number,
        category: tender.category,
        procurement_method: tender.procurement_method,
        published_date: tender.published_date,
        closing_date: tender.closing_date,
        status: tender.status,
        description: tender.description,
      };
      originalDocuments = [...(tender.documents || [])];
      originalParagraphs = [...(tender.paragraphs || [])];

      // Display tender info header
      tenderInfoDiv.innerHTML = `
                <h2>${escapeHtml(tender.title)}</h2>
                <p>Reference: ${tender.reference_number || "—"} | Status: ${getStatusBadge(tender.status)} | Views: ${tender.view_count || 0}</p>
                <p class="text-xs mt-1">Created: ${formatDate(tender.created_at)} | Last updated: ${formatDate(tender.updated_at)}</p>
            `;
      tenderInfoDiv.classList.remove("hidden");

      // Populate form
      titleInput.value = tender.title || "";
      slugInput.value = tender.slug || "";
      referenceInput.value = tender.reference_number || "";
      categorySelect.value = tender.category || "";
      procurementInput.value = tender.procurement_method || "";
      publishedDateInput.value = tender.published_date || "";
      closingDateInput.value = tender.closing_date || "";
      statusSelect.value = tender.status || "open";
      descriptionTextarea.value = tender.description || "";

      // Populate documents
      documentsContainer.innerHTML = "";
      if (tender.documents && tender.documents.length) {
        tender.documents.forEach((doc) => {
          documentsContainer.appendChild(
            createDocumentBlock(
              doc.id,
              doc.title,
              doc.file_url,
              doc.document_type,
            ),
          );
        });
      }
      documentsContainer.appendChild(createAddDocumentBtn());

      // Populate paragraphs
      paragraphsContainer.innerHTML = "";
      if (tender.paragraphs && tender.paragraphs.length) {
        tender.paragraphs.forEach((para) => {
          paragraphsContainer.appendChild(createParagraphBlock(para.content));
        });
      }
      paragraphsContainer.appendChild(createAddParagraphBtn());
    } catch (err) {
      console.error("Error loading tender:", err);
      showPopup("Failed to load tender data", true);
    }
  }

  // Save main tender info
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = "SAVING...";

    const updatedData = {
      title: titleInput.value.trim(),
      slug: slugInput.value.trim(),
      reference_number: referenceInput.value.trim() || null,
      category: categorySelect.value || null,
      procurement_method: procurementInput.value.trim() || null,
      published_date: publishedDateInput.value || null,
      closing_date: closingDateInput.value || null,
      status: statusSelect.value,
      description: descriptionTextarea.value.trim() || null,
    };

    try {
      const response = await fetch(`/gis/tenders/${tenderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      if (response.ok) {
        showPopup("Tender updated successfully!");
        originalTenderData = updatedData;
      } else {
        const error = await response.json();
        showPopup(error.error || "Failed to update tender", true);
      }
    } catch (err) {
      console.error("Error updating tender:", err);
      showPopup("An unexpected error occurred", true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "UPDATE TENDER";
    }
  });

  // Save documents (creates new, updates existing, deletes removed)
  saveDocumentsBtn.addEventListener("click", async () => {
    saveDocumentsBtn.disabled = true;
    saveDocumentsBtn.textContent = "SAVING...";

    const currentDocs = collectDocuments();
    const docsToDelete = originalDocuments
      .filter(
        (origDoc) => !currentDocs.some((currDoc) => currDoc.id === origDoc.id),
      )
      .map((doc) => doc.id);

    try {
      // Delete removed documents
      for (const docId of docsToDelete) {
        if (docId) {
          await fetch(`/gis/tenders/${tenderId}/documents/${docId}`, {
            method: "DELETE",
          });
        }
      }

      // Add/update documents
      for (const doc of currentDocs) {
        const method = doc.id ? "PUT" : "POST";
        const url = doc.id
          ? `/gis/tenders/${tenderId}/documents/${doc.id}`
          : `/gis/tenders/${tenderId}/documents`;

        await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: doc.title,
            file_url: doc.file_url,
            document_type: doc.document_type,
          }),
        });
      }

      showPopup("Documents saved successfully!");
      // Refresh original documents
      const refresh = await fetch(`/gis/tenders/${tenderId}`);
      const refreshed = await refresh.json();
      originalDocuments = refreshed.documents || [];
    } catch (err) {
      console.error("Error saving documents:", err);
      showPopup("Failed to save documents", true);
    } finally {
      saveDocumentsBtn.disabled = false;
      saveDocumentsBtn.textContent = "SAVE DOCUMENTS";
    }
  });

  // Save paragraphs
  saveParagraphsBtn.addEventListener("click", async () => {
    saveParagraphsBtn.disabled = true;
    saveParagraphsBtn.textContent = "SAVING...";

    const paragraphs = collectParagraphs();

    try {
      const response = await fetch(`/gis/tenders/${tenderId}/article`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hero_image_url: null, // Tenders don't have hero images, but keeping structure
          blocks: paragraphs,
        }),
      });

      if (response.ok) {
        showPopup("Additional content saved successfully!");
        originalParagraphs = paragraphs;
      } else {
        const error = await response.json();
        showPopup(error.error || "Failed to save content", true);
      }
    } catch (err) {
      console.error("Error saving paragraphs:", err);
      showPopup("Failed to save additional content", true);
    } finally {
      saveParagraphsBtn.disabled = false;
      saveParagraphsBtn.textContent = "SAVE ADDITIONAL CONTENT";
    }
  });

  loadTender();
});
