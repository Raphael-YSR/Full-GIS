document.addEventListener("DOMContentLoaded", () => {
  const addAdminForm = document.getElementById("addAdminForm");
  const departmentSelect = document.getElementById("department_id");
  const successModal = document.getElementById("successModal");
  const adminDetailsElement = document.getElementById("adminDetails");

  async function populateDept() {
    try {
      // Updated path to /gis/...
      const departmentData = await fetch("/gis/departments").then((res) =>
        res.json(),
      );
      if (departmentSelect) {
        departmentData.forEach((dept) => {
          const option = new Option(dept.name, dept.id);
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
        // Updated path to /gis/...
        const response = await fetch("/gis/superadmin/add-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(adminData),
        });

        if (response.ok) {
          adminDetailsElement.textContent = `Login Credentials for ${adminData.first_name}:\nEmail: ${adminData.email}\nPassword: ${adminData.password}`;
          successModal.style.display = "flex";
          addAdminForm.reset();
        } else {
          const errorData = await response.json();
          alert(`Error: ${errorData.error}`);
        }
      } catch (err) {
        console.error("Error adding admin:", err);
      }
    });
  }

  populateDept();
});
