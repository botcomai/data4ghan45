let allOrders = [];

async function fetchOrders() {
  const { data: { user } } = await supabase.auth.getUser()

  if(!user){
    window.location.href="login.html"
    return
  }

  let { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  allOrders = data || [];
  renderOrders(allOrders);
}

function getFriendlyRef(order, sequenceNum) {
  const prefix = (order.network || 'ORD').toUpperCase();
  if (sequenceNum) return `${prefix}-${sequenceNum}`;
  
  // Fallback for searches/filters
  const fullAsc = [...allOrders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const num = fullAsc.findIndex(o => o.id === order.id) + 1;
  return `${prefix}-${num || '?'}`;
}

function renderOrders(data) {
  let table = document.getElementById("ordersTable")
  table.innerHTML = ""

  if(!data || data.length === 0){
    table.innerHTML = `
    <tr class="empty">
      <td colspan="10">No orders found</td>
    </tr>
    `
    return
  }

  // Create a copy and reverse it to get ascending order for sequence calculation
  const ascendingOrders = [...data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  data.forEach((order) => {
    // Find the sequence number (1-based index in the full chronological list)
    // We search in allOrders (which is the full list) to ensure consistency across filters
    const fullAsc = [...allOrders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const sequenceNum = fullAsc.findIndex(o => o.id === order.id) + 1;

    let row = document.createElement("tr")
    
    // Convert status to a valid CSS class (e.g., "In transit" -> "in-transit")
    let statusClass = order.status ? order.status.toLowerCase().replace(/\s+/g, '-') : 'pending';
    if (statusClass === 'true') statusClass = 'completed';

    // Determine network badge class
    const net = (order.network || '').toLowerCase();
    let netClass = 'network-default';
    if (net.includes('mtn')) netClass = 'network-mtn';
    else if (net.includes('telecel') || net.includes('vodafone')) netClass = 'network-telecel';
    else if (net.includes('tigo') || net.includes('airtel')) netClass = 'network-tigo';
    else if (net.includes('bigtime') || net.includes('big')) netClass = 'network-bigtime';

    const isDelivered = order.status && (order.status.toLowerCase() === 'completed' || order.status.toString().toLowerCase() === 'true');
    const dateStr = new Date(order.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

    const statusLabel = isDelivered ? 'Successfully' : (order.status || 'Pending...');

    row.innerHTML = `
      <td style="font-weight:600; color:#475569;">${getFriendlyRef(order, sequenceNum)}</td>
      <td><span class="status ${statusClass}">${statusLabel}</span></td>
      <td>${order.phone || '-'}</td>
      <td style="font-weight:600;">${(order.bundle || order.plan || '-').toString().includes('GB') ? (order.bundle || order.plan) : (order.bundle || order.plan) + ' GB'}</td>
      <td style="font-weight:600; color:#059669; font-size:15px;">₵${order.price || order.amount || '0'}</td>
      <td><span class="network-badge ${netClass}">${order.network || '-'}</span></td>
      <td>${isDelivered ? '<span style="color:#059669; font-weight:700;">Yes</span>' : '<span style="color:#dc2626; font-weight:600;">✗ No</span>'}</td>
      <td style="color:#64748b;">${dateStr}</td>
    `
    table.appendChild(row)
  })
}


// ==========================================
// CHECK ORDER STATUS VIA DATA4GHANA API
// ==========================================
async function checkStatus(phone, reference, btnElement) {
  if (!phone && !reference) {
    alert("No phone number or reference available to check status.");
    return;
  }

  // Show loading state
  const originalText = btnElement.innerText;
  btnElement.innerText = "Checking...";
  btnElement.disabled = true;

  try {
    if (window.checkOrderStatus) {
      const result = await checkOrderStatus(phone || null, reference || null);
      
      if (result.success) {
        const statusData = result.data;
        let statusMsg = "Status: " + JSON.stringify(statusData, null, 2);
        
        // Try to extract meaningful status info
        if (statusData.status) {
          statusMsg = `Status: ${statusData.status}`;
          if (statusData.reference) statusMsg += `\nRef: ${statusData.reference}`;
          if (statusData.message) statusMsg += `\n${statusData.message}`;
        }

        alert(statusMsg);
        
        // If we got a status update, refresh the orders
        fetchOrders();
      } else {
        alert("Status check failed: " + (result.error || "Unknown error"));
      }
    } else {
      alert("API service not available. Please reload the page.");
    }
  } catch(err) {
    console.error("Status check error:", err);
    alert("Failed to check order status.");
  }

  // Restore button
  btnElement.innerText = originalText;
  btnElement.disabled = false;
}


function applyFilters() {
  const searchVal = document.getElementById("searchOrder").value.toLowerCase();
  const statusVal = document.getElementById("statusFilter").value;
  const dateVal = document.getElementById("dateFilter").value;
  const phoneVal = document.getElementById("phoneFilter").value;

  let filtered = allOrders.filter(order => {
    let match = true;
    
    // Search by ID or Product (Network/Bundle logic fallback)
      const friendlyRef = getFriendlyRef(order).toLowerCase();
      const searchTarget = `${friendlyRef} ${order.id} ${order.network} ${order.bundle} ${order.api_reference || ''}`.toLowerCase();
      match = match && searchTarget.includes(searchVal);
    
    // Filter by Exact Status
    if (statusVal) {
      match = match && (order.status && order.status.toLowerCase() === statusVal.toLowerCase());
    }
    
    // Filter by Exact Date Formatted
    if (dateVal) {
      if(order.created_at) {
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        match = match && (orderDate === dateVal);
      } else {
        match = false; // If no date on record, drop it from results
      }
    }
    
    // Filter by Phone
    if (phoneVal) {
      match = match && (order.phone && String(order.phone).includes(phoneVal));
    }
    
    return match;
  });

  renderOrders(filtered);
}

// Attach Event Listeners to all 4 inputs
document.getElementById("searchOrder").addEventListener("input", applyFilters);
document.getElementById("statusFilter").addEventListener("change", applyFilters);
document.getElementById("dateFilter").addEventListener("change", applyFilters);
document.getElementById("phoneFilter").addEventListener("input", applyFilters);

// Initial Load
fetchOrders()
