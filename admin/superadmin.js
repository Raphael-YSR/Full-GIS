document.addEventListener("DOMContentLoaded", () => {
  const currentPath = window.location.pathname;

  // ===== PASSWORD GENERATION UTILITY =====
  function generatePassword(length = 12) {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  // ===== ADD ADMIN PAGE =====
  if (currentPath.includes("/add-admin")) {
    const addAdminForm = document.getElementById("addAdminForm");
    const departmentSelect = document.getElementById("department_id");
    const successModal = document.getElementById("successModal");
    const adminDetailsElement = document.getElementById("adminDetails");
    const passwordInput = document.getElementById("password");
    const passgenBtn = document.getElementById("passgen");

    // Password generation
    if (passgenBtn) {
      passgenBtn.addEventListener("click", () => {
        const newPassword = generatePassword();
        passwordInput.value = newPassword;
      });
    }

    async function populateDept() {
      try {
        const departmentData = await fetch("/gis/departments").then((res) =>
          res.json(),
        );
        if (departmentSelect) {
          departmentData.forEach((dept) => {
            const option = new Option(dept.department_name, dept.id);
            departmentSelect.appendChild(option);
          });
        }
      } catch (error) {
        console.error("Error fetching departments:", error);
      }
    }

    if (addAdminForm) {
      addAdminForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(addAdminForm);
        const adminData = Object.fromEntries(formData.entries());

        try {
          const response = await fetch("/gis/admins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adminData),
          });

          if (response.ok) {
            const result = await response.json();
            const emailMessage = `Login Credentials for ${adminData.f_name} ${adminData.l_name}:\nEmail: ${adminData.email}\nPassword: ${adminData.password}`;
            adminDetailsElement.textContent = emailMessage;

            // Copy to clipboard
            navigator.clipboard.writeText(emailMessage);

            successModal.classList.remove("hidden");
            addAdminForm.reset();
          } else {
            const errorData = await response.json();
            alert(`Error: ${errorData.error}`);
          }
        } catch (err) {
          console.error("Error adding admin:", err);
          alert("An error occurred while adding the administrator");
        }
      });
    }

    // Modal controls
    const closeModalBtn = document.getElementById("closeModalBtn");
    const copyDetailsBtn = document.getElementById("copyDetailsBtn");

    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", () => {
        successModal.classList.add("hidden");
      });
    }

    if (copyDetailsBtn) {
      copyDetailsBtn.addEventListener("click", () => {
        const details = adminDetailsElement.textContent;
        navigator.clipboard.writeText(details);
        alert("Details copied to clipboard!");
      });
    }

    populateDept();
  }

  // ===== SEARCH ADMIN PAGE =====
  if (currentPath.includes("/search-admin")) {
    const searchInput = document.getElementById("searchAdminInput");
    const searchResults = document.getElementById("searchResults");

    if (searchInput) {
      searchInput.addEventListener("input", async (event) => {
        const query = event.target.value.trim();
        if (query.length === 0) {
          searchResults.innerHTML = "";
          return;
        }

        try {
          const response = await fetch(
            `/gis/admins/search?q=${encodeURIComponent(query)}`,
          );
          if (response.ok) {
            const results = await response.json();
            searchResults.innerHTML = "";
            results.forEach((admin) => {
              const card = document.createElement("div");
              card.className = "admin-card";
              card.innerHTML = `
                <h3 class="font-bold">${admin.fname} ${admin.lname}</h3>
                <p class="text-gray-400">${admin.email}</p>
                <p class="text-sm text-gray-500">${admin.department_name || "No Department"}</p>
              `;
              card.onclick = () =>
                (window.location.href = `/gis/delete-admin?id=${admin.id}`);
              searchResults.appendChild(card);
            });
          }
        } catch (error) {
          console.error("Search error:", error);
        }
      });
    }
  }

  // ===== DELETE ADMIN PAGE =====
  if (currentPath.includes("/delete-admin")) {
    const adminId = new URLSearchParams(window.location.search).get("id");
    const deleteBtn = document.getElementById("deleteAdminBtn");
    const adminDetailsDiv = document.getElementById("adminDetails");

    async function fetchAdminDetails(id) {
      try {
        const response = await fetch(`/gis/admins/${id}`);
        if (response.ok) {
          const admin = await response.json();
          adminDetailsDiv.innerHTML = `
            <h2 class="text-xl font-bold mb-2">${admin.fname} ${admin.lname}</h2>
            <p class="text-gray-400">Email: ${admin.email}</p>
            <p class="text-gray-400">Department: ${admin.department_name || "N/A"}</p>
          `;
        }
      } catch (error) {
        console.error("Error fetching admin details:", error);
      }
    }

    if (adminId) {
      fetchAdminDetails(adminId);

      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          if (
            confirm(
              "Are you absolutely sure you want to delete this administrator?",
            )
          ) {
            try {
              const response = await fetch(`/gis/admins/${adminId}`, {
                method: "DELETE",
              });

              if (response.ok) {
                alert("Administrator deleted successfully");
                window.location.href = "/gis/search-admin";
              } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error}`);
              }
            } catch (error) {
              console.error("Delete error:", error);
              alert("An error occurred while deleting");
            }
          }
        });
      }
    }
  }

  // ===== RESET PASSWORD SEARCH PAGE =====
  if (currentPath.includes("/reset-search")) {
    const searchInput = document.getElementById("searchResetInput");
    const searchResults = document.getElementById("searchResults");

    if (searchInput) {
      searchInput.addEventListener("input", async (event) => {
        const query = event.target.value.trim();
        if (query.length === 0) {
          searchResults.innerHTML = "";
          return;
        }

        try {
          const response = await fetch(
            `/gis/admins/search?q=${encodeURIComponent(query)}`,
          );
          if (response.ok) {
            const results = await response.json();
            searchResults.innerHTML = "";
            results.forEach((admin) => {
              const card = document.createElement("div");
              card.className = "admin-card";
              card.innerHTML = `
                <h3 class="font-bold">${admin.fname} ${admin.lname}</h3>
                <p class="text-gray-400">${admin.email}</p>
                <p class="text-sm text-gray-500">${admin.department_name || "No Department"}</p>
              `;
              card.onclick = () =>
                (window.location.href = `/gis/reset-password?id=${admin.id}`);
              searchResults.appendChild(card);
            });
          }
        } catch (error) {
          console.error("Search error:", error);
        }
      });
    }
  }

  // ===== RESET PASSWORD PAGE =====
  if (currentPath.includes("/reset-password")) {
    const adminId = new URLSearchParams(window.location.search).get("id");
    const resetForm = document.getElementById("resetPasswordForm");
    const passwordInput = document.getElementById("newPassword");
    const passgenBtn = document.getElementById("passgen");
    const successModal = document.getElementById("successModal");
    const emailMessageElement = document.getElementById("emailMessage");

    // Password generation
    if (passgenBtn) {
      passgenBtn.addEventListener("click", () => {
        const newPassword = generatePassword();
        passwordInput.value = newPassword;
      });
    }

    async function fetchAdminDetails(id) {
      try {
        const response = await fetch(`/gis/admins/${id}`);
        if (response.ok) {
          const admin = await response.json();
          document.getElementById("adminName").textContent =
            `${admin.fname} ${admin.lname}`;
          document.getElementById("adminFullName").textContent =
            `${admin.fname} ${admin.lname}`;
          document.getElementById("adminEmail").textContent = admin.email;
          document.getElementById("adminDepartment").textContent =
            admin.department_name || "N/A";
          document.getElementById("adminLastLogin").textContent =
            admin.last_login
              ? new Date(admin.last_login).toLocaleString()
              : "Never";
        }
      } catch (error) {
        console.error("Error fetching admin details:", error);
      }
    }

    if (adminId) {
      fetchAdminDetails(adminId);

      if (resetForm) {
        resetForm.addEventListener("submit", async (e) => {
          e.preventDefault();

          const newPassword = passwordInput.value;
          if (!newPassword || newPassword.length < 8) {
            alert("Password must be at least 8 characters long");
            return;
          }

          try {
            const response = await fetch(
              `/gis/admins/${adminId}/reset-password`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: newPassword }),
              },
            );

            if (response.ok) {
              const adminName =
                document.getElementById("adminName").textContent;
              const adminEmail =
                document.getElementById("adminEmail").textContent;
              const emailMessage = `Password Reset for ${adminName}\n\nEmail: ${adminEmail}\nNew Password: ${newPassword}\n\nPlease change your password after logging in.`;

              emailMessageElement.textContent = emailMessage;

              // Copy to clipboard
              navigator.clipboard.writeText(emailMessage);

              successModal.classList.remove("hidden");
              resetForm.reset();
            } else {
              const errorData = await response.json();
              alert(`Error: ${errorData.error}`);
            }
          } catch (error) {
            console.error("Reset error:", error);
            alert("An error occurred while resetting the password");
          }
        });
      }
    }

    // Modal controls
    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", () => {
        successModal.classList.add("hidden");
      });
    }
  }

  // ===== SEARCH DELETE PROJECT PAGE =====
  if (currentPath.includes("/search-delete")) {
    const searchInput = document.getElementById("searchInput");
    const searchResults = document.getElementById("searchResults");

    if (searchInput) {
      searchInput.addEventListener("input", async (event) => {
        const query = event.target.value.trim();
        if (query.length === 0) {
          searchResults.innerHTML = "";
          return;
        }

        try {
          const response = await fetch(
            `/gis/api/search?q=${encodeURIComponent(query)}`,
          );
          if (response.ok) {
            const results = await response.json();
            searchResults.innerHTML = "";
            results.forEach((p) => {
              const card = document.createElement("div");
              card.className = "project-card";
              card.innerHTML = `
                <h3 class="font-bold">${p.project_name}</h3>
                <p class="text-gray-400">${p.county}</p>
                <p class="text-sm text-gray-500">Status: ${p.status}</p>
              `;
              card.onclick = () =>
                (window.location.href = `/gis/delete-project?id=${p.id}`);
              searchResults.appendChild(card);
            });
          }
        } catch (error) {
          console.error("Search error:", error);
        }
      });
    }
  }

  // ===== DELETE PROJECT PAGE =====
  if (currentPath.includes("/delete-project")) {
    const projectId = new URLSearchParams(window.location.search).get("id");
    const deleteBtn = document.getElementById("deleteProjectBtn");
    const projectDetailsDiv = document.getElementById("projectDetails");

    async function fetchProjectDetails(id) {
      try {
        const response = await fetch(`/gis/projects/${id}`);
        if (response.ok) {
          const project = await response.json();
          projectDetailsDiv.innerHTML = `
            <h2 class="text-xl font-bold mb-2">${project.project_name}</h2>
            <p class="text-gray-400">County: ${project.county_name}</p>
            <p class="text-gray-400">Type: ${project.type_name}</p>
            <p class="text-gray-400">Status: ${project.status_name}</p>
          `;
        }
      } catch (error) {
        console.error("Error fetching project details:", error);
      }
    }

    if (projectId) {
      fetchProjectDetails(projectId);

      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          if (
            confirm(
              "Are you absolutely sure you want to delete this project? This cannot be undone.",
            )
          ) {
            try {
              const response = await fetch(`/gis/projects/${projectId}`, {
                method: "DELETE",
              });

              if (response.ok) {
                alert("Project deleted successfully");
                window.location.href = "/gis/search-delete";
              } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error}`);
              }
            } catch (error) {
              console.error("Delete error:", error);
              alert("An error occurred while deleting");
            }
          }
        });
      }
    }
  }
});
