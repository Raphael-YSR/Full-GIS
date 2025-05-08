document.addEventListener('DOMContentLoaded', () => {

    const searchInput = document.getElementById('projectSearchInput');
    const resultsContainer = document.getElementById('searchResultsContainer');
    let allProjectsData = []; // To store all project data with locations

    // 1. Fetch all project locations on load
    async function fetchAllProjects() {
        try {
            // Use the public API endpoint that includes coordinates
            const response = await fetch('/api/projects/locations');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allProjectsData = await response.json();
            // console.log(`Workspaced ${allProjectsData.length} projects for search.`);
        } catch (error) {
            console.error('Error fetching project locations for search:', error);
            resultsContainer.innerHTML = '<p class="search-error">Could not load project data.</p>';
        }
    }

    // 2. Function to display search results
    function displayResults(results) {
        resultsContainer.innerHTML = ''; // Clear previous results
        resultsContainer.style.display = results.length > 0 ? 'block' : 'none'; // Show/hide container

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No matching projects found.</p>';
            return;
        }

        results.forEach(project => {
            const resultItem = document.createElement('div');
            resultItem.classList.add('search-result-item'); // a class for styling

            // // Display project name
            resultItem.textContent = project.project_name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
 

            // Add click listener to zoom to project
            resultItem.addEventListener('click', () => {
                //console.log(`Zooming to: ${project.project_name} at [${project.lat}, ${project.lng}]`);
                const zoomLevel = 14; // Adjust zoom level as needed
                map.setView([project.lat, project.lng], zoomLevel);


                // Clear search input and results after clicking
                searchInput.value = '';
                resultsContainer.innerHTML = '';
                resultsContainer.style.display = 'none';
            });

            resultsContainer.appendChild(resultItem);
        });
    }

    // 3. Event listener for the search input
    searchInput.addEventListener('input', (event) => {
        const query = event.target.value.trim().toLowerCase();

        if (query.length < 1) { // Clear results if query is too short or empty
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            return;
        }

        // Filter the pre-fetched project data
        const filteredProjects = allProjectsData.filter(project => {
            // Check against project name and description (if available)
            const nameMatch = project.project_name?.toLowerCase().includes(query);
            return nameMatch;
        });

        displayResults(filteredProjects);
    });

    //Hide results if user clicks outside the search area
    document.addEventListener('click', (event) => {
        if (!resultsContainer.contains(event.target) && event.target !== searchInput) {
            resultsContainer.style.display = 'none';
        }
    });

    // Initial fetch of project data
    fetchAllProjects();

}); 