document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    const exportBtn = document.querySelector(".export-btn");
    const reportsTableBody = document.querySelector("#reportsTable tbody");

    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Role-based UI hiding
    if (user.role) {
        // Hide Access Control link for non-admins
        const accessControlLink = document.querySelector('a[href="access-control.html"]');
        if (accessControlLink && user.role !== 'admin') {
            accessControlLink.style.display = 'none';
        }
    }

    // Load reports data
    loadReports();

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
        });
    }

    // Export functionality
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            alert("Export functionality would be implemented here");
        });
    }

    async function loadReports() {
        try {
            const response = await fetch('http://localhost:5000/api/dashboard/reports', {
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
                document.querySelector('.main-content').innerHTML = '<div style="text-align: center; color: red; padding: 2rem;">Access denied: insufficient permissions</div>';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch reports');
            }

            const data = await response.json();
            displayReports(data);
        } catch (error) {
            console.error('Error loading reports:', error);
            document.querySelector('.main-content').innerHTML = '<div style="text-align: center; color: red; padding: 2rem;">Error loading data. Please try again.</div>';
        }
    }

    function displayReports(data) {
        const reportCards = document.querySelectorAll('.report-card');
        const inventoryCard = reportCards[0];
        const securityCard = reportCards[1];

        // Update inventory overview card
        const inventory = data.inventory_overview || {};
        if (inventoryCard) {
            const inventoryValues = inventoryCard.querySelectorAll('.metric-value');
            if (inventoryValues[0]) inventoryValues[0].textContent = inventory.total_assets ?? 0;
            if (inventoryValues[1]) inventoryValues[1].textContent = inventory.checked_out ?? 0;
            if (inventoryValues[2]) inventoryValues[2].textContent = inventory.available ?? 0;
            if (inventoryValues[3]) inventoryValues[3].textContent = inventory.under_maintenance ?? 0;
        }

        // Update security metrics card
        const security = data.security_metrics || {};
        if (securityCard) {
            const securityValues = securityCard.querySelectorAll('.metric-value');
            if (securityValues[0]) securityValues[0].textContent = security.active_alerts ?? 0;
            if (securityValues[1]) securityValues[1].textContent = security.resolved_this_month ?? 0;
            if (securityValues[2]) securityValues[2].textContent = security.system_uptime ?? 'N/A';
            if (securityValues[3]) securityValues[3].textContent = security.failed_access_attempts ?? 0;
        }

        // Update monthly activity table
        if (reportsTableBody && Array.isArray(data.monthly_activity)) {
            reportsTableBody.innerHTML = data.monthly_activity.map(activity => `
                <tr>
                    <td>${activity.month}</td>
                    <td>${activity.total_transactions}</td>
                    <td>${activity.check_outs}</td>
                    <td>${activity.check_ins}</td>
                    <td>${activity.security_incidents}</td>
                    <td>${activity.user_activity}</td>
                </tr>
            `).join('');
        }
    }
});