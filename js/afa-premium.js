// ============================================
// PREMIUM AFA PORTAL — afa-premium.js
// Handles premium registration, payments, and history
// ============================================

let afaPremiumPrice = 30;
let afaCurrentUser  = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }
    afaCurrentUser = user;

    const walletBalance = await getWallet();
    const walletDisplay = document.getElementById('afaWalletDisplay');
    if (walletDisplay) {
        walletDisplay.textContent = `₵${walletBalance.toFixed(2)}`;
    }

    await loadAfaPricing();
    await loadPremiumHistory();

  } catch (e) {
    console.error('AFA Premium init error:', e);
  }
});

async function getWallet() {
  const { data } = await supabase.from('users').select('wallet_balance').eq('id', afaCurrentUser.id).single();
  return parseFloat(data?.wallet_balance || 0);
}

async function loadAfaPricing() {
  try {
    const { data: userData } = await supabase.from('users').select('role').eq('id', afaCurrentUser.id).single();
    const userRole = userData?.role || 'client';

    const { data: prices } = await supabase.from('pricing').select('price').eq('role', userRole).eq('product', 'afa_premium').single();

    if (prices) {
        afaPremiumPrice = parseFloat(prices.price);
        document.querySelector('.premium-price-label').textContent = `₵${afaPremiumPrice.toFixed(2)}`;
    }
  } catch (e) {
    console.error('Failed to load AFA pricing:', e);
  }
}

async function loadPremiumHistory() {
  try {
    const { data: history, error } = await supabase
      .from('afa_registrations')
      .select('*')
      .eq('user_id', afaCurrentUser.id)
      .eq('tier', 'premium')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tbody = document.querySelector('#premiumHistoryTable tbody');
    tbody.innerHTML = '';

    if (!history || history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">No premium registrations found.</td></tr>';
      return;
    }

    history.forEach(item => {
      const dateStr = new Date(item.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
      
      let statusHtml = '';
      if (item.status === 'completed' || item.status === 'approved') {
        statusHtml = `<span class="status-badge status-completed"><span class="status-dot"></span>Completed</span>`;
      } else if (item.status === 'failed' || item.status === 'rejected') {
        statusHtml = `<span class="status-badge status-failed"><span class="status-dot"></span>Failed</span>`;
      } else {
        statusHtml = `<span class="status-badge status-pending"><span class="status-dot"></span>Pending</span>`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600; color:#475569;">${dateStr}</td>
        <td>${item.full_name}</td>
        <td>${item.phone}</td>
        <td><div style="font-size:12px; color:#64748b;">DOB: ${item.dob || 'N/A'}</div><div style="font-size:12px; color:#64748b;">${item.id_type}</div><div style="font-weight:600;">${item.id_number}</div></td>
        <td>${statusHtml}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error('Error loading premium history:', err);
    document.querySelector('#premiumHistoryTable tbody').innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">Failed to load history.</td></tr>';
  }
}

document.getElementById('premiumAfaForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const btn = this.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerText = 'Processing...';

  try {
    const walletBalance = await getWallet();
    const price = afaPremiumPrice;

    if (walletBalance < price) {
      alert(`Insufficient wallet balance. You need ₵${price.toFixed(2)} but have ₵${walletBalance.toFixed(2)}.`);
      btn.disabled = false;
      btn.innerText = 'Pay & Register Fast-Track';
      return;
    }

    const { error: insertErr } = await supabase
      .from('afa_registrations')
      .insert({
        user_id:   afaCurrentUser.id,
        full_name: document.getElementById('pName').value,
        phone:     document.getElementById('pPhone').value,
        id_type:   document.getElementById('pIdType').value,
        id_number: document.getElementById('pIdNumber').value,
        dob:       document.getElementById('pDob').value,
        tier:      'premium',
        status:    'pending'
      });

    if (insertErr) throw insertErr;

    const newBalance = parseFloat((walletBalance - price).toFixed(2));
    await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', afaCurrentUser.id);

    await supabase.from('transactions').insert({
      user_id:        afaCurrentUser.id,
      type:           'AFA Premium Registration',
      amount:         price,
      balance_before: walletBalance,
      balance_after:  newBalance,
      status:         'Completed'
    });

    if (window.sendSmsNotification) {
      window.sendSmsNotification(document.getElementById('pPhone').value, 'Welcome to Data4Ghana! Your Premium AFA Registration has been successfully completed.');
    }

    if (window.showSuccessPopup) {
      window.showSuccessPopup('AFA Registered!', `Your Premium AFA account has been configured. Wallet charged ₵${price.toFixed(2)}.`, () => {
        window.location.reload();
      });
    } else {
      alert('Premium AFA Registered!');
      window.location.reload();
    }

  } catch (err) {
    console.error('Premium AFA error:', err);
    alert('Registration failed: ' + err.message);
    btn.disabled = false;
    btn.innerText = 'Pay & Register Fast-Track';
  }
});
