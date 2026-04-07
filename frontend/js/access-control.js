document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    const tableBody = document.querySelector("#accessControlTable tbody");
    const complaintsTableBody = document.querySelector("#complaintsTable tbody");
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

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

    // Global function for complaint management
    window.manageComplaint = (complaintId, currentStatus, currentAssigned) => {
        const newStatus = prompt('Enter new status (pending/in_progress/resolved/closed):', currentStatus);
        if (!newStatus || !['pending', 'in_progress', 'resolved', 'closed'].includes(newStatus)) {
            alert('Invalid status. Must be pending, in_progress, resolved, or closed.');
            return;
        }

        const assignedStaffId = prompt('Enter assigned staff ID (leave empty to unassign):', currentAssigned || '');
        const finalAssignedId = assignedStaffId && assignedStaffId.trim() ? parseInt(assignedStaffId) : null;

        updateComplaint(complaintId, newStatus, finalAssignedId);
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
                alert('Complaint updated successfully');
            } else {
                const errorData = await response.json();
                alert('Failed to update complaint: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating complaint:', error);
            alert('Error updating complaint');
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});