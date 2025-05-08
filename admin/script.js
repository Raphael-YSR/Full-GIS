document.addEventListener('DOMContentLoaded', () => {
    //console.log('DOM content loaded.')
    const addProjectForm = document.getElementById('addProjectForm');

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
    });
    
    // Click outside to close
    popupContainer.addEventListener('click', (e) => {
        if (e.target === popupContainer || e.target === popupContainer.firstElementChild) {
            popupContainer.classList.add('hidden');
        }
    });

    // Function to show the custom popup
    function showPopup(message) {
        document.getElementById('popupMessage').textContent = message;
        popupContainer.classList.remove('hidden');
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            popupContainer.classList.add('hidden');
        }, 5000);
    }

    async function populateDropdowns() {
        //console.log('populateDropdowns called.');

        const countySelect = document.getElementById('county_id');
        const statusSelect = document.getElementById('project_status');
        const typeSelect = document.getElementById('project_type');

        try {
            const countyData = await fetch('/api/counties').then(res => res.json());
            const statusData = await fetch('/api/statuses').then(res => res.json());
            const typeData = await fetch('/api/types').then(res => res.json());

            countyData.forEach(county => {
                const option = document.createElement('option');
                option.value = county.id;
                option.textContent = county.county_name;
                countySelect.appendChild(option);
            });

            statusData.forEach(status => {
                const option = document.createElement('option');
                option.value = status.id;
                option.textContent = status.status;
                statusSelect.appendChild(option);
            });

            typeData.forEach(type => {
                const option = document.createElement('option');
                option.value = type.id;
                option.textContent = type.type;
                typeSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error fetching data:', error);
            showPopup('Error loading dropdown data. Please try again.');
        }
    }

    populateDropdowns();

    addProjectForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(addProjectForm);
        const projectData = {};
        formData.forEach((value, key) => {
            projectData[key] = value;
        });

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(projectData),
            });

            if (response.ok) {
                showPopup(`${projectData.project_name} has been added!`);
                addProjectForm.reset();
            } else {
                const errorData = await response.json();
                showPopup(`Error adding project: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error:', error);
            showPopup('An unexpected error occurred. Please try again.');
        }
    });
});