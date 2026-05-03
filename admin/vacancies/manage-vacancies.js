document.addEventListener("DOMContentLoaded", () => {
  let currentPage = 1;
  let currentFilters = {
    search: "",
    status: "",
    employment_type: "",
  };
  let deleteId = null;

  const tableBody = document.getElementById("vacanciesTableBody");
  const paginationDiv = document.getElementById("pagination");
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const employmentFilter = document.getElementById("employmentFilter");
  const resetFilters = document.getElementById("resetFilters");

  // Popup elements
  const popup = document.getElementById("popup");
  const popupIcon = document.getElementById("popupIcon");
  const popupTitle = document.getElementById("popupTitle");
  const popupMessage = document.getElementById("popupMessage");
  const closePopup = document.getElementById("closePopup");

  // Delete modal elements
  const deleteModal = document.getElementById("deleteModal");
  const deleteTitle = document.getElementById("deleteTitle");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

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
      loadVacancies();
    }
  });

  function showDeleteModal(id, title) {
    deleteId = id;
    deleteTitle.textContent = title;
    deleteModal.classList.remove("hidden");
  }

  cancelDeleteBtn.addEventListener("click", () => {
    deleteModal.classList.add("hidden");
    deleteId = null;
  });

  confirmDeleteBtn.addEventListener("click", async () => {
    if (!deleteId) return;

    try {
      const response = await fetch(`/gis/vacancies/${deleteId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        showPopup("Vacancy deleted successfully!");
        deleteModal.classList.add("hidden");
        loadVacancies();
      } else {
        const error = await response.json();
        showPopup(error.error || "Failed to delete vacancy", true);
      }
    } catch (err) {
      showPopup("Error deleting vacancy", true);
    }
    deleteId = null;
  });

  function getStatusBadge(status) {
    const statusMap = {
      open: '<span class="status-badge status-open">OPEN</span>',
      closed: '<span class="status-badge status-closed">CLOSED</span>',
      filled: '<span class="status-badge status-filled">FILLED</span>',
    };
    return (
      statusMap[status] ||
      `<span class="status-badge">${status.toUpperCase()}</span>`
    );
  }

  function getEmploymentBadge(type) {
    const typeMap = {
      permanent: "Permanent",
      contract: "Contract",
      internship: "Internship",
      temporary: "Temporary",
    };
    return `<span class="employment-badge">${typeMap[type] || type}</span>`;
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

  async function loadVacancies() {
    tableBody.innerHTML =
      '<tr><td colspan="8" class="text-center py-8 text-gray-400">Loading...</td></tr>';

    const params = new URLSearchParams({
      page: currentPage,
      limit: 20,
      ...(currentFilters.search && { search: currentFilters.search }),
      ...(currentFilters.status && { status: currentFilters.status }),
      ...(currentFilters.employment_type && {
        employment_type: currentFilters.employment_type,
      }),
    });

    try {
      const response = await fetch(`/gis/vacancies?${params}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      const vacancies = result.data;
      const pagination = result.pagination;

      if (vacancies.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="8" class="text-center py-8 text-gray-400">No vacancies found.</td></tr>';
        paginationDiv.innerHTML = "";
        return;
      }

      tableBody.innerHTML = vacancies
        .map(
          (vacancy) => `
                <tr class="border-b border-gray-700 hover:bg-gray-700">
                    <td class="px-4 py-3 text-sm">${vacancy.reference_number || "—"}</td>
                    <td class="px-4 py-3 text-sm font-medium">${escapeHtml(vacancy.title)}</td>
                    <td class="px-4 py-3 text-sm">${vacancy.department || "—"}</td>
                    <td class="px-4 py-3 text-sm">${getEmploymentBadge(vacancy.employment_type)}</td>
                    <td class="px-4 py-3 text-sm">${formatDate(vacancy.published_date)}</td>
                    <td class="px-4 py-3 text-sm">${formatDate(vacancy.closing_date)}</td>
                    <td class="px-4 py-3">${getStatusBadge(vacancy.status)}</td>
                    <td class="px-4 py-3 text-center">
                        <a href="/admin/vacancies/edit-vacancy.html?id=${vacancy.id}" class="edit-btn inline-block">
                            <i class="fas fa-edit"></i>
                        </a>
                        <button onclick="window.deleteVacancy(${vacancy.id}, '${escapeHtml(vacancy.title.replace(/'/g, "\\'"))}')" class="delete-btn">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `,
        )
        .join("");

      renderPagination(pagination);
    } catch (err) {
      console.error("Error loading vacancies:", err);
      tableBody.innerHTML =
        '<tr><td colspan="8" class="text-center py-8 text-red-400">Failed to load vacancies.</td></tr>';
    }
  }

  window.deleteVacancy = (id, title) => {
    showDeleteModal(id, title);
  };

  function renderPagination(pagination) {
    const { page, pages, total } = pagination;

    if (pages <= 1) {
      paginationDiv.innerHTML = "";
      return;
    }

    let html = `
            <button class="page-btn ${page === 1 ? "disabled" : ""}"
                    ${page === 1 ? "disabled" : `onclick="goToPage(${page - 1})"`}>
                ← Previous
            </button>
        `;

    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(pages, page + 2);

    for (let i = startPage; i <= endPage; i++) {
      html += `
                <button class="page-btn ${i === page ? "active" : ""}"
                        onclick="goToPage(${i})">
                    ${i}
                </button>
            `;
    }

    html += `
            <button class="page-btn ${page === pages ? "disabled" : ""}"
                    ${page === pages ? "disabled" : `onclick="goToPage(${page + 1})"`}>
                Next →
            </button>
        `;

    paginationDiv.innerHTML = html;
  }

  window.goToPage = (page) => {
    currentPage = page;
    loadVacancies();
  };

  // Filter handlers
  let debounceTimeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      currentFilters.search = searchInput.value;
      currentPage = 1;
      loadVacancies();
    }, 300);
  });

  statusFilter.addEventListener("change", () => {
    currentFilters.status = statusFilter.value;
    currentPage = 1;
    loadVacancies();
  });

  employmentFilter.addEventListener("change", () => {
    currentFilters.employment_type = employmentFilter.value;
    currentPage = 1;
    loadVacancies();
  });

  resetFilters.addEventListener("click", () => {
    searchInput.value = "";
    statusFilter.value = "";
    employmentFilter.value = "";
    currentFilters = { search: "", status: "", employment_type: "" };
    currentPage = 1;
    loadVacancies();
  });

  loadVacancies();
});
