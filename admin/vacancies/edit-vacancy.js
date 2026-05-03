document.addEventListener("DOMContentLoaded", () => {
  const vacancyId = new URLSearchParams(window.location.search).get("id");
  if (!vacancyId) {
    window.location.href = "/admin/vacancies/manage-vacancies.html";
    return;
  }

  // DOM Elements
  const vacancyInfoDiv = document.getElementById("vacancyInfo");
  const editForm = document.getElementById("editVacancyForm");
  const saveBtn = document.getElementById("saveBtn");
  const documentsContainer = document.getElementById("documents-container");
  const saveDocumentsBtn = document.getElementById("saveDocumentsBtn");

  // Form fields
  const titleInput = document.getElementById("title");
  const slugInput = document.getElementById("slug");
  const referenceInput = document.getElementById("reference_number");
  const jobGradeInput = document.getElementById("job_grade");
  const departmentInput = document.getElementById("department");
  const locationInput = document.getElementById("location");
  const employmentTypeSelect = document.getElementById("employment_type");
  const salaryRangeInput = document.getElementById("salary_range");
  const statusSelect = document.getElementById("status");
  const publishedDateInput = document.getElementById("published_date");
  const closingDateInput = document.getElementById("closing_date");
  const descriptionTextarea = document.getElementById("description");
  const requirementsTextarea = document.getElementById("requirements");
  const responsibilitiesTextarea = document.getElementById("responsibilities");

  // Track original data
  let originalDocuments = [];

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
      filled: '<span class="status-badge status-filled">FILLED</span>',
    };
    return statusMap[status] || status.toUpperCase();
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-KE");
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
    btn.textContent = "+ ADD ATTACHMENT";
    btn.addEventListener("click", () => {
      const newBlock = createDocumentBlock();
      documentsContainer.insertBefore(newBlock, btn);
    });
    return btn;
  }

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

  // Load vacancy data
  async function loadVacancy() {
    try {
      const response = await fetch(`/gis/vacancies/${vacancyId}`);
      if (!response.ok) {
        if (response.status === 404) {
          window.location.href = "/admin/vacancies/manage-vacancies.html";
        }
        throw new Error("Failed to load vacancy");
      }
      const vacancy = await response.json();

      // Store original data
      originalDocuments = [...(vacancy.documents || [])];

      // Display vacancy info header
      vacancyInfoDiv.innerHTML = `
                <h2>${escapeHtml(vacancy.title)}</h2>
                <p>Reference: ${vacancy.reference_number || "—"} | Status: ${getStatusBadge(vacancy.status)} | Views: ${vacancy.view_count || 0}</p>
                <p class="text-xs mt-1">Published: ${formatDate(vacancy.published_date)} | Closing: ${formatDate(vacancy.closing_date)}</p>
                <p class="text-xs">Created: ${formatDate(vacancy.created_at)} | Last updated: ${formatDate(vacancy.updated_at)}</p>
            `;
      vacancyInfoDiv.classList.remove("hidden");

      // Populate form
      titleInput.value = vacancy.title || "";
      slugInput.value = vacancy.slug || "";
      referenceInput.value = vacancy.reference_number || "";
      jobGradeInput.value = vacancy.job_grade || "";
      departmentInput.value = vacancy.department || "";
      locationInput.value = vacancy.location || "";
      employmentTypeSelect.value = vacancy.employment_type || "permanent";
      salaryRangeInput.value = vacancy.salary_range || "";
      statusSelect.value = vacancy.status || "open";
      publishedDateInput.value = vacancy.published_date || "";
      closingDateInput.value = vacancy.closing_date || "";
      descriptionTextarea.value = vacancy.description || "";
      requirementsTextarea.value = vacancy.requirements || "";
      responsibilitiesTextarea.value = vacancy.responsibilities || "";

      // Populate documents
      documentsContainer.innerHTML = "";
      if (vacancy.documents && vacancy.documents.length) {
        vacancy.documents.forEach((doc) => {
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
    } catch (err) {
      console.error("Error loading vacancy:", err);
      showPopup("Failed to load vacancy data", true);
    }
  }

  // Save main vacancy info
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = "SAVING...";

    const updatedData = {
      title: titleInput.value.trim(),
      slug: slugInput.value.trim(),
      reference_number: referenceInput.value.trim() || null,
      job_grade: jobGradeInput.value.trim() || null,
      department: departmentInput.value.trim() || null,
      location: locationInput.value.trim() || null,
      employment_type: employmentTypeSelect.value,
      salary_range: salaryRangeInput.value.trim() || null,
      status: statusSelect.value,
      published_date: publishedDateInput.value || null,
      closing_date: closingDateInput.value || null,
      description: descriptionTextarea.value.trim() || null,
      requirements: requirementsTextarea.value.trim() || null,
      responsibilities: responsibilitiesTextarea.value.trim() || null,
    };

    try {
      const response = await fetch(`/gis/vacancies/${vacancyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      if (response.ok) {
        showPopup("Vacancy updated successfully!");
      } else {
        const error = await response.json();
        showPopup(error.error || "Failed to update vacancy", true);
      }
    } catch (err) {
      console.error("Error updating vacancy:", err);
      showPopup("An unexpected error occurred", true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "UPDATE VACANCY";
    }
  });

  // Save attachments
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
          await fetch(`/gis/vacancies/${vacancyId}/documents/${docId}`, {
            method: "DELETE",
          });
        }
      }

      // Add/update documents
      for (const doc of currentDocs) {
        const method = doc.id ? "PUT" : "POST";
        const url = doc.id
          ? `/gis/vacancies/${vacancyId}/documents/${doc.id}`
          : `/gis/vacancies/${vacancyId}/documents`;

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

      showPopup("Attachments saved successfully!");
      // Refresh original documents
      const refresh = await fetch(`/gis/vacancies/${vacancyId}`);
      const refreshed = await refresh.json();
      originalDocuments = refreshed.documents || [];
    } catch (err) {
      console.error("Error saving attachments:", err);
      showPopup("Failed to save attachments", true);
    } finally {
      saveDocumentsBtn.disabled = false;
      saveDocumentsBtn.textContent = "SAVE ATTACHMENTS";
    }
  });

  loadVacancy();
});
