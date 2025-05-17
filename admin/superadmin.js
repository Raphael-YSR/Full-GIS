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

    // --- Helper function to show modal ---
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    // --- Helper function to hide modal ---
    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // --- Helper function to copy text to clipboard ---
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true; // Indicate success
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed"; // Avoid scrolling to bottom
            textArea.style.left = "-9999px";
            textArea.style.top = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true; // Indicate success
            } catch (fallbackErr) {
                console.error('Fallback copy failed:', fallbackErr);
                document.body.removeChild(textArea);
                return false; // Indicate failure
            }
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
            adminCard.classList.add('admin-card');

            // Display format: f_name l_name | department
            adminCard.innerHTML = `
                <p class="text-base font-semibold">${admin.f_name} ${admin.l_name} <span class="text-gray-400 font-normal">| ${admin.department_name || 'N/A'}</span></p>
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

            // Display project details (County, Status, Type Name) - uses project_type_name from API search result
            projectCard.innerHTML = `
                <p class="text-lg font-semibold">${project.project_name}</p>
                <p class="text-sm text-gray-400">County: ${project.county || 'N/A'} | Status: ${project.status || 'N/A'} | Type: ${project.project_type_name || 'N/A'}</p> `;

            // Add click listener to navigate to the delete project page
            projectCard.addEventListener('click', () => {
                window.location.href = `/delete-project?id=${project.id}`;
            });

            container.appendChild(projectCard);
        });
    }


    // --- Logic for Action Pages (Reset Password, Delete Admin, Delete Project, Add Admin) ---

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
                // Use alert for error indication
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

                        // Create email message (Email Ready Format)
                        const emailMessage = `Subject: GIS Admin Dashboard Password Reset

Dear ${adminName},

Your password for the GIS Admin Dashboard has been successfully reset.

Your new password is: ${newPassword}

You can now access the dashboard here: [Link to dashboard login page - replace with actual link]

Best regards,
The GIS Admin Team`;

                        // Update modal with email message
                        if(emailMessageElement) emailMessageElement.textContent = emailMessage;

                        // Copy email message to clipboard
                        const copySuccess = await copyToClipboard(emailMessage);
                        if (!copySuccess) {
                             alert('Failed to automatically copy the email message to your clipboard. Please copy it manually from the box.');
                        }


                        // Show success modal
                        showModal('successModal');

                        // Reset form
                        resetPasswordForm.reset();
                        // Generate new password for next use
                        if(passgenButton) passgenButton.click();
                    } else {
                        console.error('Error response:', responseData);
                        // Use alert for error indication
                        alert(`Error resetting password: ${responseData.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Error:', error);
                     // Use alert for error indication
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
                hideModal('successModal');
                // Decide where to redirect after closing modal, maybe back to search or dashboard
                // window.location.href = '/superadmin';
            });
        }


        // Also close modal when clicking outside
        if(successModal) {
            successModal.addEventListener('click', function(event) {
                if (event.target === successModal) {
                    hideModal('successModal');
                    // Decide where to redirect after closing modal
                    // window.location.href = '/superadmin';
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
                        // Use alert for success indication
                        alert(responseData.message || 'Administrator deleted successfully!');
                        window.location.href = '/search-admin'; // Redirect back to search after deletion
                    } else {
                        console.error('Error response:', responseData);
                        // Use alert for error indication
                        alert(`Error deleting administrator: ${responseData.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Delete admin error:', error);
                     // Use alert for error indication
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

                // Display project details for confirmation - UPDATED TO SHOW NAMES
                if (projectDetailsContainer) {
                    projectDetailsContainer.innerHTML = `
                        <h2 class="text-xl font-bold mb-2 font-marlin">${project.project_name}</h2>
                        <p class="text-gray-400 font-marlinsoftmedium">County: ${project.county || 'N/A'}</p>
                        <p class="text-gray-400 font-marlinsoftmedium">Status: ${project.status || 'N/A'}</p>
                        <p class="text-gray-400 font-marlinsoftmedium">Type: ${project.project_type_name || 'N/A'}</p>
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
                        // Use alert for success indication
                        alert(responseData.message || 'Project deleted successfully!');
                        window.location.href = '/search-delete'; // Redirect back to search after deletion
                    } else {
                         console.error('Error response:', responseData);
                         // Use alert for error indication
                        alert(`Error deleting project: ${responseData.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Delete project error:', error);
                     // Use alert for error indication
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

     // --- Add Admin Page Logic ---
     if (document.getElementById('addAdminForm')) {
        const addAdminForm = document.getElementById('addAdminForm');
        const departmentSelect = document.getElementById('department_id');
        const passgenButton = document.getElementById('passgen');
        const passwordInput = document.getElementById('password'); // Assuming the password input has this ID

        // Modal elements for Add Admin success
        const successModal = document.getElementById('successModal');
        const adminDetailsPre = document.getElementById('adminDetails');
        const copyDetailsBtn = document.getElementById('copyDetailsBtn');
        const closeModalBtn = document.getElementById('closeModalBtn'); // Assuming the close button in this modal also has this ID


        // Function to generate a random password (reused from reset password)
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


        // Function to populate the department dropdown (Using logic from addAdmin.js)
        async function populateDept() {

            try {
                const departmentData = await fetch('/api/departments').then(res => res.json());

                if (departmentSelect) {
                    // Clear any existing options except the placeholder
                    while (departmentSelect.options.length > 1) {
                        departmentSelect.remove(1);
                    }

                    // Add new options
                    departmentData.forEach(department => {
                        const option = document.createElement('option');
                        option.value = department.id;
                        // Use department_name as per the original addAdmin.js logic
                        option.textContent = department.department_name;
                        departmentSelect.appendChild(option);
                    });
                }

            } catch (error) {
                console.error('Error fetching departments:', error);
                // Optionally display an error message in the select or elsewhere
                 if (departmentSelect) {
                     departmentSelect.innerHTML = '<option value="" disabled selected>Error loading departments</option>';
                 }
                 alert('Error loading department data. Please try again.'); // Keep alert as in original addAdmin.js
            }
        }


         // Generate password button click handler
        if(passgenButton && passwordInput) {
            passgenButton.addEventListener('click', (event) => {
                 event.preventDefault(); // Prevent form submission if button is inside form
                const newPassword = generatePassword(12);
                passwordInput.value = newPassword;
            });
        }


        // Form submission handler
        if(addAdminForm) {
            addAdminForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                const formData = new FormData(addAdminForm);
                const adminData = Object.fromEntries(formData.entries());

                 // Ensure password is included, especially if generated
                if (!adminData.password) {
                     adminData.password = passwordInput.value;
                }


                // Disable form during submission
                const submitButton = addAdminForm.querySelector('button[type="submit"]');
                if(submitButton) {
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> ADDING & COPYING...';
                }

                try {
                    const response = await fetch('/api/admins', { // Assuming the API endpoint for adding admins is /api/admins
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(adminData),
                    });

                    const responseData = await response.json();

                    if (response.ok) {
                        const newAdmin = responseData.admin;
                        const generatedPassword = adminData.password; // Use the password that was sent

                        // Create email message (Email Ready Format)
                        const emailMessage = `Subject: Your GIS Admin Dashboard Account

Dear ${newAdmin.f_name} ${newAdmin.l_name},

Your account for the GIS Admin Dashboard has been created.

Your username is your email address: ${newAdmin.email}
Your password is: ${generatedPassword}

You can now access the dashboard here: [Link to dashboard login page - replace with actual link]

If you have any questions, please contact the system administrator.

Best regards,
The GIS Admin Team`;

                        // Update modal with admin details/email message
                        if(adminDetailsPre) adminDetailsPre.textContent = emailMessage;

                        // Copy email message to clipboard immediately after successful add and before showing modal
                        const copySuccess = await copyToClipboard(emailMessage);
                         if (!copySuccess) {
                             alert('Failed to automatically copy the email message to your clipboard. Please copy it manually from the box.');
                        }


                        // Show success modal
                        showModal('successModal');

                        // Reset form
                        addAdminForm.reset();
                         // Generate a new password for the next admin
                        if(passgenButton) passgenButton.click();


                    } else {
                        console.error('Error response:', responseData);
                         // Use alert for error indication
                        alert(`Error adding administrator: ${responseData.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    console.error('Add admin error:', error);
                     // Use alert for error indication
                    alert('An unexpected error occurred. Please try again.');
                } finally {
                    // Re-enable form button
                    if(submitButton) {
                         submitButton.disabled = false;
                         submitButton.innerHTML = 'ADD ADMIN & COPY TO CLIPBOARD';
                    }
                }
            });
        }

        // Close modal button for Add Admin modal
        if(closeModalBtn && successModal && adminDetailsPre) { // Check if these elements exist (specific to add-admin modal)
             closeModalBtn.addEventListener('click', function() {
                hideModal('successModal');
                 // Decide where to redirect after closing modal, maybe stay on page or go to dashboard
                // window.location.href = '/superadmin'; // Keeping on the page as per previous turn's implicit behavior
            });

             // Also close modal when clicking outside
            successModal.addEventListener('click', function(event) {
                if (event.target === successModal) {
                    hideModal('successModal');
                     // Decide where to redirect after closing modal
                    // window.location.href = '/superadmin'; // Keeping on the page as per previous turn's implicit behavior
                }
            });

             // Add event listener for the copy button inside the modal (if user clicks it manually)
             if (copyDetailsBtn) {
                 copyDetailsBtn.addEventListener('click', async () => {
                     const textToCopy = adminDetailsPre.textContent;
                     const copySuccess = await copyToClipboard(textToCopy);
                      if (copySuccess) {
                         // Optionally provide feedback that copy was successful
                         alert('Email message copied to clipboard!');
                     } else {
                         alert('Failed to copy email message.');
                     }
                 });
             }
        }


        // Load departments when on the add admin page
        populateDept();
        // Generate a random password when the page loads
         if(passgenButton) passgenButton.click();
     }


});
