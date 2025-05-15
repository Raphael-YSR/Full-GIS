document.addEventListener('DOMContentLoaded', () => {

    // --- Helper function to get ID from URL ---
    function getIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    // --- Helper function to display error messages ---
    function displayError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<p class="text-red-400">${message}</p>`;
        }
    }

    // --- Logic for Search Pages ---

    // Get references to the search input and results container (common IDs)
    const searchInput = document.getElementById('searchResetInput') || document.getElementById('searchAdminInput') || document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResults');

    // Determine which search page we are on
    const isResetSearchPage = document.getElementById('searchResetInput') !== null;
    const isSearchAdminPage = document.getElementById('searchAdminInput') !== null;
    const isSearchDeletePage = document.getElementById('searchInput') !== null;

    if (searchInput && searchResultsContainer) {
        searchInput.addEventListener('input', async (event) => {
            const query = event.target.value.trim();

            if (query.length < 2) { // Require at least 2 characters to search
                searchResultsContainer.innerHTML = ''; // Clear results if query is too short
                return;
            }

            let apiUrl = '';
            let resultType = ''; // 'admin' or 'project'

            if (isResetSearchPage || isSearchAdminPage) {
                apiUrl = `/api/admins/search?q=${encodeURIComponent(query)}`;
                resultType = 'admin';
            } else if (isSearchDeletePage) {
                apiUrl = `/api/search?q=${encodeURIComponent(query)}`; // Assuming /api/search is for projects
                resultType = 'project';
            } else {
                console.error('Unknown search page.');
                return;
            }

            try {
                const response = await fetch(apiUrl);

                if (response.ok) {
                    const results = await response.json();
                    if (resultType === 'admin') {
                        displayAdminSearchResults(results, searchResultsContainer, isResetSearchPage);
                    } else if (resultType === 'project') {
                         displayProjectSearchResults(results, searchResultsContainer);
                    }
                } else {
                    console.error(`Error fetching ${resultType} search results:`, response.status);
                    displayError('searchResults', `Error fetching ${resultType} results.`);
                }
            } catch (error) {
                console.error(`${resultType} Search error:`, error);
                displayError('searchResults', `An error occurred during ${resultType} search.`);
            }
        });
    }


    // Function to display search results for administrators
    function displayAdminSearchResults(admins, container, isReset) {
        container.innerHTML = ''; // Clear previous results

        if (admins.length === 0) {
            container.innerHTML = '<p class="text-gray-400">No administrators found matching your query.</p>';
            return;
        }

        admins.forEach(admin => {
            const adminCard = document.createElement('div');
            adminCard.classList.add('admin-card'); // Assuming you have .admin-card CSS

            // Display format: f_name l_name | department
            adminCard.innerHTML = `
                <p class="text-lg font-semibold">${admin.f_name} ${admin.l_name} <span class="text-gray-400 font-normal">| ${admin.department_name || 'N/A'}</span></p>
            `;

            // Add click listener to navigate to the appropriate action page
            adminCard.addEventListener('click', () => {
                if (isReset) {
                    window.location.href = `/reset-password?id=${admin.id}`;
                } else { // Must be search-admin for deletion
                    window.location.href = `/delete-admin?id=${admin.id}`;
                }
            });

            container.appendChild(adminCard);
        });
    }

    // Function to display search results for projects
    function displayProjectSearchResults(projects, container) {
        container.innerHTML = ''; // Clear previous results

        if (projects.length === 0) {
            container.innerHTML = '<p class="text-gray-400">No projects found matching your query.</p>';
            return;
        }

        projects.forEach(project => {
            const projectCard = document.createElement('div');
            projectCard.classList.add('project-card'); 

            // Display project details
            projectCard.innerHTML = `
                <p class="text-lg font-semibold">${project.project_name} <span class="text-gray-400 font-normal">| ${project.county || 'N/A'}</span></p>
                <p class="text-sm text-gray-400">Status: ${project.status || 'N/A'} | Progress: ${project.progress || 'N/A'}</p>
            `;

            // Add click listener to navigate to the delete project page
            projectCard.addEventListener('click', () => {
                window.location.href = `/delete-project?id=${project.id}`;
            });

            container.appendChild(projectCard);
        });
    }


    // --- Logic for Action Pages (Reset Password, Delete Admin, Delete Project) ---

    // --- Reset Password Page Logic ---
    if (document.getElementById('resetPasswordForm')) {
        const newPasswordInput = document.getElementById('newPassword');
        const passgenButton = document.getElementById('passgen');
        const adminIdInput = document.getElementById('adminId');
        const adminNameSpan = document.getElementById('adminName');
        const adminFullNameElement = document.getElementById('adminFullName');
        const adminEmailElement = document.getElementById('adminEmail');
        const adminDepartmentElement = document.getElementById('adminDepartment');
        const adminLastLoginElement = document.getElementById('adminLastLogin');

        // Modal elements
        const successModal = document.getElementById('successModal');
        const emailMessageElement = document.getElementById('emailMessage');
        const closeModalBtn = document.getElementById('closeModalBtn');

        // Function to generate a random password
        function generatePassword(length) {
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=';
            let password = '';

            // Ensure at least one uppercase, one lowercase, one number, and one special character
            password += characters.charAt(Math.floor(Math.random() * 26)); // lowercase
            password += characters.charAt(Math.floor(Math.random() * 26) + 26); // uppercase
            password += characters.charAt(Math.floor(Math.random() * 10) + 52); // number
            password += characters.charAt(Math.floor(Math.random() * 18) + 62); // special char

            // Fill the rest randomly
            for (let i = 4; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * characters.length);
                password += characters.charAt(randomIndex);
            }

            // Shuffle the password to avoid predictable pattern
            return password.split('').sort(() => 0.5 - Math.random()).join('');
        }

        // Load admin details from URL parameters
        async function loadAdminDetailsForReset() {
            const adminId = getIdFromUrl();

            if (!adminId) {
                alert('No administrator selected. Redirecting to search page.');
                window.location.href = '/reset-search';
                return;
            }

            adminIdInput.value = adminId;

            // Show loading state
            adminFullNameElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            adminEmailElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            adminDepartmentElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            adminLastLoginElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';


            try {
                const response = await fetch(`/api/admins/${adminId}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch administrator details (Status: ${response.status})`);
                }
                const admin = await response.json();

                if (!admin) {
                    throw new Error('Administrator not found');
                }

                // Update the UI with admin details
                adminNameSpan.textContent = `${admin.fname} ${admin.lname}`; // Use fname/lname from API
                adminFullNameElement.textContent = `${admin.fname} ${admin.lname}`;
                adminEmailElement.textContent = admin.email;
                adminDepartmentElement.textContent = admin.department_name || 'Not Assigned';
                adminLastLoginElement.textContent = admin.last_login ? new Date(admin.last_login).toLocaleString() : 'Never';

            } catch (error) {
                console.error('Error loading admin details for reset:', error);
                alert(`Failed to load administrator details: ${error.message}`);

                // Update the UI to show the error
                adminNameSpan.textContent = 'Error';
                adminFullNameElement.textContent = 'Error loading data';
                adminEmailElement.textContent = 'Error loading data';
                adminDepartmentElement.textContent = 'Error loading data';
                adminLastLoginElement.textContent = 'Error loading data';
            }
        }

        // Generate password button click handler
        if(passgenButton) {
            passgenButton.addEventListener('click', () => {
                const newPassword = generatePassword(12);
                if(newPasswordInput) newPasswordInput.value = newPassword;
            });
        }


        // Form submission handler
        const resetPasswordForm = document.getElementById('resetPasswordForm');
        if(resetPasswordForm) {
            resetPasswordForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                if (!newPasswordInput.value) {
                    alert('Please generate or enter a new password.');
                    return;
                }

                const adminId = adminIdInput.value;
                const newPassword = newPasswordInput.value;

                // Disable form during submission
                const submitButton = resetPasswordForm.querySelector('button[type="submit"]');
                if(submitButton) {
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> PROCESSING...';
                }


                try {
                    const response = await fetch(`/api/admins/${adminId}/reset-password`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ password: newPassword }),
                    });

                    const responseData = await response.json();

                    if (response.ok) {
                        // Get admin details for the email message
                        const adminName = adminFullNameElement.textContent;
                        const adminEmail = adminEmailElement.textContent;

                        // Create email message
                        const emailMessage = `Dear ${adminName},

We have successfully reset your password for the GIS Admin Dashboard.

Your new password is: ${newPassword}

You can now login with the new password.

Best regards,
GIS Admin Team`;

                        // Update modal with email message
                        if(emailMessageElement) emailMessageElement.textContent = emailMessage;

                        // Copy email message to clipboard
                        try {
                            await navigator.clipboard.writeText(emailMessage);
                            console.log('Email message copied to clipboard.');
                        } catch (err) {
                            console.error('Failed to copy email message:', err);
                            // Fallback for browsers that don't support clipboard API
                            // This fallback might not work in all contexts (e.g., if not triggered by user action)
                            const textArea = document.createElement("textarea");
                            textArea.value = emailMessage;
                            textArea.style.position = "fixed"; // Avoid scrolling to bottom
                            textArea.style.left = "-9999px";
                            textArea.style.top = "-9999px";
                            document.body.appendChild(textArea);
                            textArea.focus();
                            textArea.select();
                            try {
                                document.execCommand('copy');
                                console.log('Email message copied to clipboard using fallback.');
                            } catch (fallbackErr) {
                                console.error('Fallback copy failed:', fallbackErr);
                                alert('Failed to automatically copy the email message to your clipboard. Please copy it manually from the box.');
                            }
                             document.body.removeChild(textArea);
                        }

                        // Show success modal
                        if(successModal) successModal.classList.remove('hidden');

                        // Reset form
                        resetPasswordForm.reset();
                        // Generate new password for next use
                        if(passgenButton) passgenButton.click();
                    } else {
                        console.error('Error response:', responseData);
                        alert(`Error resetting password: ${responseData.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('An unexpected error occurred. Please try again.');
                } finally {
                    // Re-enable form button
                    if(submitButton) {
                         submitButton.disabled = false;
                         submitButton.innerHTML = 'RESET PASSWORD AND COPY TO CLIPBOARD';
                    }
                }
            });
        }


        // Close modal button
        if(closeModalBtn) {
            closeModalBtn.addEventListener('click', function() {
                if(successModal) successModal.classList.add('hidden');
            });
        }


        // Also close modal when clicking outside
        if(successModal) {
            successModal.addEventListener('click', function(event) {
                if (event.target === successModal) {
                    successModal.classList.add('hidden');
                }
            });
        }

        // Generate a random password when the page loads
        if(passgenButton) passgenButton.click();

        // Load admin details when on the reset password page
        loadAdminDetailsForReset();
    }


    // --- Delete Admin Page Logic ---
    if (document.getElementById('deleteAdminBtn')) {
        const adminDetailsContainer = document.getElementById('adminDetails');
        const deleteAdminButton = document.getElementById('deleteAdminBtn');

        // Load admin details for deletion
        async function loadAdminDetailsForDelete() {
            const adminId = getIdFromUrl();

            if (!adminId) {
                alert('No administrator selected. Redirecting to search page.');
                window.location.href = '/search-admin'; // Redirect back to search admin
                return;
            }

            // Show loading state
            if (adminDetailsContainer) {
                 adminDetailsContainer.innerHTML = '<div class="animate-pulse"><div class="h-4 bg-gray-700 rounded w-3/4 mb-2"></div><div class="h-3 bg-gray-700 rounded w-1/2"></div></div>';
            }


            try {
                const response = await fetch(`/api/admins/${adminId}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch administrator details (Status: ${response.status})`);
                }
                const admin = await response.json();

                if (!admin) {
                    throw new Error('Administrator not found');
                }

                // Display admin details for confirmation
                if (adminDetailsContainer) {
                    adminDetailsContainer.innerHTML = `
                        <h2 class="text-xl font-bold mb-2 font-marlin">${admin.fname} ${admin.lname}</h2>
                        <p class="text-gray-400 font-marlinsoftmedium">Email: ${admin.email}</p>
                        <p class="text-gray-400 font-marlinsoftmedium">Department: ${admin.department_name || 'Not Assigned'}</p>
                        <p class="text-gray-400 font-marlinsoftmedium">Last Login: ${admin.last_login ? new Date(admin.last_login).toLocaleString() : 'Never'}</p>
                    `;
                }

                // Store the admin ID on the delete button or elsewhere accessible for the click handler
                if (deleteAdminButton) {
                    deleteAdminButton.dataset.adminId = admin.id;
                }


            } catch (error) {
                console.error('Error loading admin details for delete:', error);
                alert(`Failed to load administrator details: ${error.message}`);
                 if (adminDetailsContainer) {
                    adminDetailsContainer.innerHTML = '<p class="text-red-400">Error loading administrator details.</p>';
                 }
            }
        }

        // Delete button click handler
        if (deleteAdminButton) {
            deleteAdminButton.addEventListener('click', async () => {
                const adminId = deleteAdminButton.dataset.adminId;

                if (!adminId) {
                    alert('Administrator ID not found.');
                    return;
                }

                // Optional: Add a final confirmation dialog
                if (!confirm('Are you absolutely sure you want to permanently delete this administrator? This action cannot be undone.')) {
                    return;
                }

                 // Disable button during deletion
                deleteAdminButton.disabled = true;
                deleteAdminButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> DELETING...';


                try {
                    const response = await fetch(`/api/admins/${adminId}`, {
                        method: 'DELETE',
                    });

                     const responseData = await response.json();

                    if (response.ok) {
                        alert(responseData.message || 'Administrator deleted successfully!');
                        window.location.href = '/search-admin'; // Redirect back to search after deletion
                    } else {
                        console.error('Error response:', responseData);
                        alert(`Error deleting administrator: ${responseData.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Delete admin error:', error);
                    alert('An unexpected error occurred during deletion. Please try again.');
                } finally {
                    // Re-enable button (if not redirected)
                    deleteAdminButton.disabled = false;
                    deleteAdminButton.innerHTML = 'DELETE ADMINISTRATOR';
                }
            });
        }


        // Load admin details when on the delete admin page
        loadAdminDetailsForDelete();
    }


    // --- Delete Project Page Logic ---
    if (document.getElementById('deleteProjectBtn')) {
        const projectDetailsContainer = document.getElementById('projectDetails');
        const deleteProjectButton = document.getElementById('deleteProjectBtn');

        // Load project details for deletion
        async function loadProjectDetailsForDelete() {
            const projectId = getIdFromUrl();

            if (!projectId) {
                alert('No project selected. Redirecting to search page.');
                window.location.href = '/search-delete'; // Redirect back to search delete
                return;
            }

             // Show loading state
            if (projectDetailsContainer) {
                 projectDetailsContainer.innerHTML = '<div class="animate-pulse"><div class="h-4 bg-gray-700 rounded w-3/4 mb-2"></div><div class="h-3 bg-gray-700 rounded w-1/2"></div></div>';
            }


            try {
                const response = await fetch(`/api/project/${projectId}`); // Use the existing project API
                if (!response.ok) {
                    throw new Error(`Failed to fetch project details (Status: ${response.status})`);
                }
                const project = await response.json();

                if (!project) {
                    throw new Error('Project not found');
                }

                // Display project details for confirmation
                if (projectDetailsContainer) {
                    projectDetailsContainer.innerHTML = `
                        <h2 class="text-xl font-bold mb-2 font-marlin">${project.project_name}</h2>
                        <p class="text-gray-400 font-marlinsoftmedium">County: ${project.county || 'N/A'}</p>
                        <p class="text-gray-400 font-marlinsoftmedium">Status: ${project.status || 'N/A'} 
                        <p class="text-gray-400 font-marlinsoftmedium">Type ID: ${project.project_type || 'N/A'}</p>
                        <p class="text-gray-400 font-marlinsoftmedium">Description: ${project.description || 'No description'}</p>
                        <p class="text-gray-400 font-marlinsoftmedium">People Served: ${project.people_served || 'N/A'}</p>
                        <p class="text-gray-400 font-marlinsoftmedium">Progress: ${project.progress || 'N/A'}</p>
                    `;
                }


                // Store the project ID on the delete button
                 if (deleteProjectButton) {
                    deleteProjectButton.dataset.projectId = project.id;
                 }


            } catch (error) {
                console.error('Error loading project details for delete:', error);
                alert(`Failed to load project details: ${error.message}`);
                if (projectDetailsContainer) {
                    projectDetailsContainer.innerHTML = '<p class="text-red-400">Error loading project details.</p>';
                 }
            }
        }

        // Delete button click handler
        if (deleteProjectButton) {
            deleteProjectButton.addEventListener('click', async () => {
                const projectId = deleteProjectButton.dataset.projectId;

                if (!projectId) {
                    alert('Project ID not found.');
                    return;
                }

                // Optional: Add a final confirmation dialog
                if (!confirm('Are you absolutely sure you want to permanently delete this project? This action cannot be undone.')) {
                    return;
                }

                 // Disable button during deletion
                deleteProjectButton.disabled = true;
                deleteProjectButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> DELETING...';


                try {
                    const response = await fetch(`/api/project/${projectId}`, { // Use the existing delete project API
                        method: 'DELETE',
                    });

                     const responseData = await response.json();

                    if (response.ok) {
                        alert(responseData.message || 'Project deleted successfully!');
                        window.location.href = '/search-delete'; // Redirect back to search after deletion
                    } else {
                         console.error('Error response:', responseData);
                        alert(`Error deleting project: ${responseData.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Delete project error:', error);
                    alert('An unexpected error occurred during deletion. Please try again.');
                } finally {
                    // Re-enable button (if not redirected)
                    deleteProjectButton.disabled = false;
                    deleteProjectButton.innerHTML = 'DELETE PROJECT';
                }
            });
        }


        // Load project details when on the delete project page
        loadProjectDetailsForDelete();
    }

    // Note: Other page-specific JS logic (like add-admin, add-data, edit-data)
    // should also be included in this file, wrapped in checks for elements
    // specific to those pages (e.g., if (document.getElementById('addAdminForm')) { ... }).
    // This ensures the code only runs on the relevant page.

});
