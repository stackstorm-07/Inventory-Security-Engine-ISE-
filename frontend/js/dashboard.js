document.addEventListener("DOMContentLoaded", () => {
  
  // 1. FAKE DATA FOR THE PRESENTATION
  const fakeInventoryData = [
    { id: "ITM-001", name: "MacBook Pro 16-inch", category: "Electronics", stock: 45, status: "In Stock" },
    { id: "ITM-002", name: "Ergonomic Office Chairs", category: "Furniture", stock: 4, status: "Low Stock" },
    { id: "ITM-003", name: "Wireless Mechanical Keyboards", category: "Electronics", stock: 112, status: "In Stock" },
    { id: "ITM-004", name: "Printer Ink Cartridges", category: "Supplies", stock: 0, status: "Out of Stock" },
    { id: "ITM-005", name: "Logitech Webcams", category: "Electronics", stock: 28, status: "In Stock" }
  ];

  const tableBody = document.getElementById("inventoryTableBody");

  // 2. INJECT FAKE DATA INTO THE TABLE
  if (tableBody) {
    fakeInventoryData.forEach(item => {
      
      let statusClass = "status-good";
      if (item.status === "Low Stock" || item.status === "Out of Stock") {
        statusClass = "status-low";
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.id}</td>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td>${item.stock}</td>
        <td class="${statusClass}">${item.status}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  // 3. LOGOUT BUTTON
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      window.location.href = "login.html";
    });
  }

});