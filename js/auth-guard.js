// js/auth-guard.js

(async function() {
  const { data: { user }, error } = await window.supabase.auth.getUser();

  if (error || !user) {
    console.warn("Unauthorized access - Redirecting to login...");
    window.location.href = "login.html";
    return;
  }

  // Optional: Role-based protection for admin pages
  const currentPage = window.location.pathname.split("/").pop();
  if (currentPage.startsWith("admin-")) {
    const { data: userData } = await window.supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['admin', 'super_agent'].includes(userData.role)) {
      console.error("Access Denied: Admin privileges required.");
      window.location.href = "dashboard.html"; // Redirect unauthorized admins to dashboard
    }
  }
})();
