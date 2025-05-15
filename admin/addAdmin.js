document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded.');
    const addAdminForm = document.getElementById('addAdminForm');
    const passwordInput = document.getElementById('password');
    const passgenLink = document.getElementById('passgen');
    const departmentSelect = document.getElementById('department_id');
    const copiedTextSpan = document.getElementById('copiedText');
    
    // Modal elements
    const successModal = document.getElementById('successModal');
    const adminDetailsElement = document.getElementById('adminDetails');
    const copyDetailsBtn = document.getElementById('copyDetailsBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    // Current admin data for modal
    let currentAdminData = {};

    // Function to generate a random password
    function generatePassword(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            password += characters.charAt(randomIndex);
        }
        return password;
    }

    // Function to populate the department dropdown
    async function populateDept() {
        //console.log('populateDept called.');

        try {
            const departmentData = await fetch('/api/departments').then(res => res.json());

            // Clear any existing options except the placeholder
            while (departmentSelect.options.length > 1) {
                departmentSelect.remove(1);
            }

            // Add new options
            departmentData.forEach(department => {
                const option = document.createElement('option');
                option.value = department.id;
                option.textContent = department.department_name;
                departmentSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error fetching departments:', error);
            alert('Error loading department data. Please try again.');
        }
    }

    // Call populateDept when the DOM is loaded
    populateDept();

    // Event listener for the "GENERATE PASSWORD" link
    passgenLink.addEventListener('click', (event) => {
        event.preventDefault();
        const newPassword = generatePassword(12); 
        passwordInput.value = newPassword;

    });


    // Add admin form submission logic
    addAdminForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(addAdminForm);
        const adminData = {};
        formData.forEach((value, key) => {
            adminData[key] = value;
        });

        try {
            const response = await fetch('/api/admins', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(adminData),
            });

            if (response.ok) {
                // Store the current admin data for the modal
                currentAdminData = {
                    f_name: adminData.f_name,
                    l_name: adminData.l_name,
                    email: adminData.email,
                    password: adminData.password
                };
                
                // Update admin details in modal
                const detailsText = `${currentAdminData.f_name} ${currentAdminData.l_name}\nEMAIL: ${currentAdminData.email}\nPASSWORD: ${currentAdminData.password}`;
                adminDetailsElement.textContent = detailsText;
                
                // Show success modal
                successModal.style.display = 'flex';
                
                // Reset form
                addAdminForm.reset();
            } else {
                const errorData = await response.json();
                alert(`Error adding admin: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An unexpected error occurred. Please try again.');
        }
    });

    // Copy admin details from modal
    copyDetailsBtn.addEventListener('click', async function() {
        try {
            const detailsText = adminDetailsElement.textContent;
            await navigator.clipboard.writeText(detailsText);
            copyDetailsBtn.innerHTML = '<i class="fas fa-check mr-2"></i> COPIED!';
            
            setTimeout(() => {
                copyDetailsBtn.innerHTML = '<i class="fas fa-copy mr-2"></i> COPY';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy admin details:', err);
            
            // Fallback
            const range = document.createRange();
            range.selectNode(adminDetailsElement);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            window.getSelection().removeAllRanges();
            
            copyDetailsBtn.innerHTML = '<i class="fas fa-check mr-2"></i> COPIED!';
            setTimeout(() => {
                copyDetailsBtn.innerHTML = '<i class="fas fa-copy mr-2"></i> COPY';
            }, 2000);
        }
    });

    // Close modal button
    closeModalBtn.addEventListener('click', function() {
        successModal.style.display = 'none';
    });

    // Also close modal when clicking outside
    successModal.addEventListener('click', function(event) {
        if (event.target === successModal) {
            successModal.style.display = 'none';
        }
    });
});