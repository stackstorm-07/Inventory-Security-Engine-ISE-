document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    const tableBody = document.querySelector("#accessControlTable tbody");
    const complaintsTableBody = document.querySelector("#complaintsTable tbody");
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const showCreateUserBtn = document.getElementById('showCreateUserBtn');
    const cancelCreateUserBtn = document.getElementById('cancelCreateUserBtn');
    const createUserBox = document.getElementById('createUserBox');
    const createUserForm = document.getElementById('createUserForm');
    const createUserMessage = document.getElementById('createUserMessage');
    const complaintManager = document.getElementById('complaintManager');
    const complaintStatusSelect = document.getElementById('complaintStatusSelect');
    const complaintStaffSelect = document.getElementById('complaintStaffSelect');
    const updateComplaintBtn = document.getElementById('updateComplaintBtn');
    const cancelComplaintBtn = document.getElementById('cancelComplaintBtn');
    let currentComplaintId = null;

    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    let staffMembers = [];

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Role-based UI hiding (though this page is admin-only, keeping consistent)
    if (user.role) {
        // All navigation should be visible for admins on this page
        // No hiding needed as this is an admin-only page
    }

    // Tab switching functionality
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId + '-tab').classList.add('active');

            // Load data for the active tab
            if (tabId === 'users') {
                loadAccessControl();
            } else if (tabId === 'complaints') {
                loadComplaints();
            }
        });
    });

    // Load initial data (users tab is active by default)
    loadAccessControl();

    if (showCreateUserBtn) {
        showCreateUserBtn.addEventListener('click', () => {
            if (createUserBox) {
                createUserBox.style.display = 'block';
            }
        });
    }

    if (cancelCreateUserBtn) {
        cancelCreateUserBtn.addEventListener('click', () => {
            if (createUserBox) {
                createUserBox.style.display = 'none';
            }
            if (createUserMessage) {
                createUserMessage.textContent = '';
                createUserMessage.className = 'create-user-message';
            }
            if (createUserForm) createUserForm.reset();
        });
    }

    if (createUserForm) {
        createUserForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const full_name = document.getElementById('createFullName').value.trim();
            const username = document.getElementById('createUsername').value.trim();
            const email = document.getElementById('createEmail').value.trim();
            const phone = document.getElementById('createPhone').value.trim();
            const role = document.getElementById('createRole').value;
            const password = document.getElementById('createPassword').value;

            if (!full_name || !username || !email || !role || !password) {
                displayCreateUserMessage('Please complete all fields.', 'error');
                return;
            }

            try {
                const response = await fetch('http://localhost:5000/api/dashboard/access-control', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ full_name, username, email, phone, role, password })
                });

                if (response.ok) {
                    displayCreateUserMessage('User created successfully.', 'success');
                    createUserForm.reset();
                    loadAccessControl();
                } else {
                    const errorData = await response.json();
                    displayCreateUserMessage(errorData.error || 'Failed to create user.', 'error');
                }
            } catch (error) {
                console.error('Error creating user:', error);
                displayCreateUserMessage('Failed to create user. Please try again.', 'error');
            }
        });
    }

    if (updateComplaintBtn) {
        updateComplaintBtn.addEventListener('click', () => {
            if (!currentComplaintId) return;
            const status = complaintStatusSelect.value;
            const assignedStaffId = complaintStaffSelect.value ? parseInt(complaintStaffSelect.value, 10) : null;
            updateComplaint(currentComplaintId, status, assignedStaffId);
        });
    }

    if (cancelComplaintBtn) {
        cancelComplaintBtn.addEventListener('click', () => {
            closeComplaintManager();
        });
    }

    function openComplaintManager(complaintId, currentStatus, currentAssignedId) {
        currentComplaintId = complaintId;
        if (complaintStatusSelect) {
            complaintStatusSelect.value = currentStatus;
        }
        if (complaintStaffSelect) {
            complaintStaffSelect.innerHTML = '<option value="">Unassigned</option>';
            if (staffMembers.length) {
                staffMembers.forEach(st => {
                    const selected = st.id === currentAssignedId ? 'selected' : '';
                    complaintStaffSelect.innerHTML += `<option value="${st.id}" ${selected}>${escapeHtml(st.full_name)} (${escapeHtml(st.username)})</option>`;
                });
            } else {
                complaintStaffSelect.innerHTML += '<option value="" disabled>No active staff members found</option>';
            }
        }
        if (complaintManager) {
            complaintManager.classList.remove('hidden');
            complaintManager.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function closeComplaintManager() {
        currentComplaintId = null;
        if (complaintManager) {
            complaintManager.classList.add('hidden');
        }
    }

    function hideComplaintManager() {
        if (complaintManager) {
            complaintManager.classList.add('hidden');
        }
    }

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
        });
    }

    async function loadAccessControl() {
        try {
            const response = await fetch('http://localhost:5000/api/dashboard/access-control', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "login.html";
                return;
            }

            if (response.status === 403) {
                tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: red;">Access denied: insufficient permissions</td></tr>';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch access control data');
            }

            const users = await response.json();
            displayUsers(users);
        } catch (error) {
            console.error('Error loading access control data:', error);
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: red;">Error loading data. Please try again.</td></tr>';
        }
    }

    function displayUsers(users) {
        if (!users || users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No users found.</td></tr>';
            return;
        }

        tableBody.innerHTML = users.map(user => {
            const userId = `USR-${String(user.id).padStart(3, '0')}`;
            const roleClass = `role-${user.role}`;
            const statusClass = user.is_active === 1 ? 'status-active' : 'status-inactive';
            const createdAt = user.created_at ? new Date(user.created_at).toLocaleString() : 'Unknown';

            return `
                <tr>
                    <td>${userId}</td>
                    <td>${user.full_name}</td>
                    <td>${user.email}</td>
                    <td><span class="role-badge ${roleClass}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span></td>
                    <td><span class="${statusClass}">${user.is_active === 1 ? 'Active' : 'Inactive'}</span></td>
                    <td>${user.is_2fa_enabled === 1 ? 'Enabled' : 'Disabled'}</td>
                    <td>${createdAt}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editUser(${user.id}, '${user.role}', ${user.is_2fa_enabled}, ${user.is_active})">Edit</button>
                        <button class="action-btn" onclick="revokeUser(${user.id})">Revoke</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Global functions for button clicks
    window.editUser = (userId, currentRole, current2FA, currentActive) => {
        const newRole = prompt('Enter new role (admin/staff/viewer):', currentRole);
        if (!newRole || !['admin', 'staff', 'viewer'].includes(newRole)) {
            alert('Invalid role. Must be admin, staff, or viewer.');
            return;
        }

        const new2FA = prompt('Enable 2FA? (1 for yes, 0 for no):', current2FA);
        if (new2FA === null || !['0', '1'].includes(new2FA)) {
            alert('Invalid input. Enter 0 or 1.');
            return;
        }

        updateUser(userId, newRole, parseInt(new2FA), 1);
    };

    window.revokeUser = (userId) => {
        if (!confirm('Are you sure you want to revoke this user\'s access?')) return;
        updateUser(userId, 'viewer', 0, 0);
    };

    async function updateUser(userId, role, is2FAEnabled, isActive) {
        try {
            const response = await fetch(`http://localhost:5000/api/dashboard/access-control/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role, is_2fa_enabled: is2FAEnabled, is_active: isActive })
            });

            if (response.ok) {
                loadAccessControl(); // Reload users
            } else {
                alert('Failed to update user');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Error updating user');
        }
    }

    async function loadComplaints() {
        try {
            const response = await fetch('http://localhost:5000/api/dashboard/complaints', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch complaints');
            }

            const complaints = await response.json();
            displayComplaints(complaints);
            closeComplaintManager();

        } catch (error) {
            console.error('Error loading complaints:', error);
            complaintsTableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error loading complaints. Please try again.</td></tr>';
        }
    }

    function displayComplaints(complaints) {
        if (!complaints || complaints.length === 0) {
            complaintsTableBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No complaints found.</td></tr>';
            return;
        }

        complaintsTableBody.innerHTML = complaints.map(complaint => {
            const createdAt = complaint.created_at ? new Date(complaint.created_at).toLocaleString() : 'Unknown';
            const statusClass = `status-${complaint.status.toLowerCase().replace(' ', '-')}`;
            const priorityClass = `priority-${complaint.priority.toLowerCase()}`;

            return `
                <tr>
                    <td>${complaint.id}</td>
                    <td>${escapeHtml(complaint.submitted_by)}</td>
                    <td>${escapeHtml(complaint.title)}</td>
                    <td><span class="category-badge">${complaint.category.replace('_', ' ')}</span></td>
                    <td><span class="priority-badge ${priorityClass}">${complaint.priority}</span></td>
                    <td><span class="status-badge ${statusClass}">${complaint.status.replace('_', ' ')}</span></td>
                    <td>${complaint.assigned_staff || 'Unassigned'}</td>
                    <td>${createdAt}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="manageComplaint(${complaint.id}, '${complaint.status}', ${complaint.assigned_staff_id || 'null'})">Manage</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function loadStaffMembers() {
        try {
            const response = await fetch('http://localhost:5000/api/dashboard/staff-members', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                console.warn('Could not load staff members for assignment.');
                staffMembers = [];
                return;
            }
            staffMembers = await response.json();
        } catch (error) {
            console.error('Error loading staff members:', error);
            staffMembers = [];
        }
    }

    // Global function for complaint management
    window.manageComplaint = async (complaintId, currentStatus, currentAssigned) => {
        if (!staffMembers.length) {
            await loadStaffMembers();
        }

        openComplaintManager(complaintId, currentStatus, currentAssigned);
    };

    async function updateComplaint(complaintId, status, assignedStaffId) {
        try {
            const response = await fetch(`http://localhost:5000/api/dashboard/complaints/${complaintId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status, assigned_staff_id: assignedStaffId })
            });

            if (response.ok) {
                loadComplaints(); // Reload complaints
                closeComplaintManager();
                alert('Complaint updated successfully');
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert('Failed to update complaint: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating complaint:', error);
            alert('Error updating complaint');
        }
    }

    function displayCreateUserMessage(message, type) {
        if (!createUserMessage) return;
        createUserMessage.textContent = message;
        createUserMessage.className = `create-user-message ${type}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});