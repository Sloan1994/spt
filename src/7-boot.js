/* ===== boot ===== */
function boot() {
  repairSwappedDrafts(); applyTheme(); renderNav(); bindEvents(); bindPTR(); render(false); registerSW();
  handleWhoopReturn(); syncWhoop();
  window.addEventListener('pageshow', () => { if (ui.tab === 'today') render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) return; if (ui.tab === 'today') render(); syncWhoop(); });
  window.addEventListener('error', e => console.error('Uncaught', e.message));
}
document.addEventListener('DOMContentLoaded', boot);
