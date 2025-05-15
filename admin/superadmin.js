document.addEventListener('DOMContentLoaded', () => {
    // Get references to the search input and results container specific to this page
    const searchInput = document.getElementById('searchResetInput');
    const searchResults = document.getElementById('searchResults');

    // Check if the elements exist before adding listeners
    if (!searchInput || !searchResults) {
        console.error('Search input or results container not found in the DOM.');
        return;
    }

    searchInput.addEventListener('input', async (event) => {
        const query = event.target.value.trim();

        if (query.length < 2) { // Require at least 2 characters to search
            searchResults.innerHTML = ''; // Clear results if query is too short
            return;
        }

        try {
            // Use a new API endpoint specifically for searching admins
            const response = await fetch(`/api/admins/search?q=${encodeURIComponent(query)}`);

            if (response.ok) {
                const results = await response.json();
                displayAdminResults(results);
            } else {
                console.error('Error fetching admin search results:', response.status);
                searchResults.innerHTML = '<p class="text-red-400">Error fetching results.</p>';
            }
        } catch (error) {
            console.error('Admin Search error:', error);
            searchResults.innerHTML = '<p class="text-red-400">An error occurred during search.</p>';
        }
    });

    // Function to display search results for administrators
    function displayAdminResults(admins) {
        searchResults.innerHTML = ''; // Clear previous results

        if (admins.length === 0) {
            searchResults.innerHTML = '<p class="text-gray-400">No administrators found matching your query.</p>';
            return;
        }

        admins.forEach(admin => {
            const adminCard = document.createElement('div');
            // Use a class name specific to admin results if needed for styling
            adminCard.classList.add('admin-card'); // Assuming you have .admin-card CSS

            // Display format: f_name l_name | department
            adminCard.innerHTML = `
                <p class="text-lg font-semibold">${admin.f_name} ${admin.l_name} <span class="text-gray-400 font-normal">| ${admin.department_name || 'N/A'}</span></p>
                <p class="text-sm text-gray-400">Email: ${admin.email}</p>
            `;

            // Add click listener to navigate to the password reset page for this admin
            adminCard.addEventListener('click', () => {
                // Navigate to the reset password page, passing the admin's ID
                window.location.href = `/reset-password?id=${admin.id}`;
            });

            searchResults.appendChild(adminCard);
        });
    }
});