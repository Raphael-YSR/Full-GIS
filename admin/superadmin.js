document.addEventListener("DOMContentLoaded", () => {
  const adminListContainer = document.getElementById("adminList");

  async function fetchAdmins() {
    try {
      const response = await fetch("/gis/superadmin/admins");
      if (response.ok) {
        const admins = await response.json();
        if (!adminListContainer) return;
        adminListContainer.innerHTML = "";
        admins.forEach((admin) => {
          const row = document.createElement("tr");
          row.innerHTML = `
                        <td>${admin.first_name} ${admin.last_name}</td>
                        <td>${admin.email}</td>
                        <td><button onclick="resetPassword('${admin.id}')">Reset Pass</button></td>
                    `;
          adminListContainer.appendChild(row);
        });
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  }

  window.resetPassword = async (adminId) => {
    const newPassword = prompt("New password:");
    if (!newPassword) return;
    try {
      // Updated path to /gis/...
      await fetch("/gis/superadmin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, newPassword }),
      });
      alert("Password reset!");
    } catch (error) {
      alert("Failed.");
    }
  };

  fetchAdmins();
});
