document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    searchInput.addEventListener('input', async (event) => {
        const query = event.target.value.trim();

        if (query.length === 0) {
            searchResults.innerHTML = ''; // Clear results if input is empty
            return;
        }

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const results = await response.json();
                displayResults(results);
            } else {
                console.error('Error fetching search results:', response.status);
                searchResults.innerHTML = '<p>Error fetching results.</p>';
            }
        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = '<p>An error occurred during search.</p>';
        }
    });

    function displayResults(results) {
        searchResults.innerHTML = ''; // Clear previous results

        if (results.length === 0) {
            searchResults.innerHTML = '<p>No results found.</p>';
            return;
        }

        results.forEach(project => {
            const projectCard = document.createElement('div');
            projectCard.classList.add('project-card');

            projectCard.innerHTML = `
                <h3>${project.project_name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</h3>
                <p>County: ${project.county}</p>
                <p>Progress: ${project.progress}%</p>
                <p>Status: ${project.status}</p>
            `;

            // In script-search.js
            projectCard.addEventListener('click', () => {
                window.location.href = `/edit-data?id=${project.id}`; // Navigate to edit page
            });

            searchResults.appendChild(projectCard);
        });
    }

    
});