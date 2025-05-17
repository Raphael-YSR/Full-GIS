document.addEventListener('DOMContentLoaded', () => {

    const projectId = getProjectIdFromUrl();
    const projectDetailsDiv = document.getElementById('projectDetails');
    const editProjectForm = document.getElementById('editProjectForm');
    let originalProjectData; 

    // Create popup container and add it to the body
    const popupContainer = document.createElement('div');
    popupContainer.className = 'fixed inset-0 flex items-center justify-center z-50 hidden';
    popupContainer.id = 'customPopup';

    popupContainer.innerHTML = `
        <div class="absolute inset-0 bg-black bg-opacity-30"></div>
        <div class="bg-black rounded-lg shadow-lg p-6 max-w-md w-full mx-4 relative z-10 font-marlinsoftmedium">
            <div class="flex items-center">
                <div class="flex items-center justify-center mr-4 flex-shrink-0 bg-green-100 rounded-full p-2">
                    <svg class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <div>
                    <p class="text-white" id="popupMessage"></p>
                </div>
            </div>
            <button id="closePopup" class="mt-4 w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                OK
            </button>
        </div>
    `;

    document.body.appendChild(popupContainer);

    // Set up event listener for the close button
    document.getElementById('closePopup').addEventListener('click', () => {
        popupContainer.classList.add('hidden');
        window.location.href = '/admin';
    });

    // Click outside to close
    popupContainer.addEventListener('click', (e) => {
        if (e.target === popupContainer || e.target === popupContainer.firstElementChild) {
            popupContainer.classList.add('hidden');
            window.location.href = '/admin';
        }
    });

    // Function to show the custom popup
    function showPopup(message, title = 'Success') {
        document.getElementById('popupMessage').textContent = message;
        popupContainer.classList.remove('hidden');
        window.location.href = '/admin';

        // Auto-close after 5 seconds
        setTimeout(() => {
            popupContainer.classList.add('hidden');
        }, 5000);
    }

    if (projectId) {
        fetchProjectDetails(projectId);
        populateDropdowns();
    } else {
        showPopup('Project ID not found in URL.', 'Error');
    }

    // Function to extract project ID from URL
    function getProjectIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    async function fetchProjectDetails(projectId) {
        try {
            const response = await fetch(`/api/project/${projectId}`);
            if (response.ok) {
                const project = await response.json();
                originalProjectData = project; // Store the data

                // Fetch related data (county name and project type name)
                const countyResponse = await fetch(`/api/counties`);
                const typeResponse = await fetch(`/api/types`);

                if (countyResponse.ok && typeResponse.ok) {
                    const counties = await countyResponse.json();
                    const types = await typeResponse.json();

                    // Find the matching county and type
                    const county = counties.find(c => c.id == project.county_id);
                    const projectType = types.find(t => t.id == project.project_type);

                    // Add the names to the project data
                    project.county_name = county ? county.county_name : 'Unknown';
                    project.type_name = projectType ? projectType.type : 'Unknown';

                    displayProjectDetails(project);
                    populateForm(project);
                } else {
                    // Still display with IDs if we can't get names
                    displayProjectDetails(project);
                    populateForm(project);
                }
            } else {
                showPopup('Error fetching project details.', 'Error');
            }
        } catch (error) {
            console.error('Error:', error);
            showPopup('An error occurred.', 'Error');
        }
    }

    function displayProjectDetails(project) {
        // Format the project details with county name and project type name
        projectDetailsDiv.innerHTML = `
            <h2 class="text-xl font-bold font-marlin mb-2">${project.project_name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</h2>
            <div class="grid grid-cols-4 gap-2 text-sm pl-2" >
            <div class="text-gray-400 font-marlinsoftmedium">County:</div>
            <div class="font-marlinsoftmedium">${project.county_name || 'ID: ' + project.county_id}</div>
            <div class="text-gray-400 font-marlinsoftmedium">Project Type:</div>
            <div class="font-marlinsoftmedium">${project.type_name || 'ID: ' + project.project_type}</div>
        </div>
        <div class="grid grid-cols-4 gap-2 text-sm mt-2 pl-2">
            <div class="text-gray-400 font-marlinsoftmedium">People Served:</div>
            <div class="font-marlinsoftmedium">${project.people_served || 'Not specified'}</div>
            <div class="text-gray-400 font-marlinsoftmedium">Progress:</div>
            <div class="font-marlinsoftmedium">${project.progress || '0'}%</div>
        </div>

        <div class="mt-2 text-xs text-gray-500 font-marlinsoftmedium">Last modified: ${new Date().toLocaleString()}</div>
    `;
    }

    function populateForm(project) {
        // Populate the form fields with the project data
        document.getElementById('progress').value = project.progress || '';
        // Ensure latitude and longitude are set to empty string if null/undefined
        document.getElementById('latitude').value = project.latitude != null ? project.latitude : '';
        document.getElementById('longitude').value = project.longitude != null ? project.longitude : '';
        document.getElementById('description').value = project.description || '';

        // We'll populate the status dropdown separately
        const statusSelect = document.getElementById('project_status');
        if (statusSelect && project.project_status) {
            // Find and select the right option by value
            for (let option of statusSelect.options) {
                if (option.value == project.project_status) {
                    option.selected = true;
                    break;
                }
            }
        }
    }

    async function populateDropdowns() {
        const statusSelect = document.getElementById('project_status');

        try {
            const statusData = await fetch('/api/statuses').then(res => res.json());

            statusData.forEach(status => {
                const option = document.createElement('option');
                option.value = status.id;
                option.textContent = status.status;
                statusSelect.appendChild(option);
            });

            // If we have the project data, select the current status
            if (originalProjectData && originalProjectData.project_status) {
                for (let option of statusSelect.options) {
                    if (option.value == originalProjectData.project_status) {
                        option.selected = true;
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching statuses:', error);
            showPopup('Error loading dropdown data. Please try again.', 'Error');
        }
    }

    editProjectForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!originalProjectData) {
            showPopup('Project data not loaded. Cannot update.', 'Error');
            return;
        }

        const formData = new FormData(editProjectForm);
        const projectData = {};
        formData.forEach((value, key) => {
            projectData[key] = value;
        });

        projectData.project_name = originalProjectData.project_name;
        projectData.county_id = originalProjectData.county_id;
        projectData.project_type = originalProjectData.project_type;
        projectData.people_served = originalProjectData.people_served; // People served is not required by server validation, but good to include

        try {
            const response = await fetch(`/api/project/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(projectData),
            });

            if (response.ok) {
                showPopup(`${projectData.project_name} has been updated successfully!`);
                 // Re-fetch details to show updated info after successful save
                fetchProjectDetails(projectId);
            } else {
                const errorData = await response.json();
                console.error('Update failed:', errorData); // Log the specific error from the server
                showPopup(`Error updating project: ${errorData.error || 'Unknown error'}`, 'Error');
            }
        } catch (error) {
            console.error('Error:', error);
            showPopup('An error occurred during update.', 'Error');
        }
    });


});
