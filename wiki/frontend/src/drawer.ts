// Drawer.ts: Collapsible drawer logic for the tree view
export function setupDrawer(drawerSelector: string) {
  const drawer = document.querySelector(drawerSelector) as HTMLElement | null;
  // Toggle button is now inside .drawer-border
  const toggle = drawer?.querySelector('.drawer-toggle') as HTMLElement | null;
  const container = document.getElementById('main-container');
  if (!drawer || !toggle || !container) return;

  function updateOverlay() {
    const isMobile = window.matchMedia('(max-width: 700px)').matches;
    // Since we've already checked for null values in the parent function,
    // we can safely use non-null assertion operator here
    const isOpen = !drawer!.classList.contains('drawer-collapsed');
    if (isMobile && isOpen) {
      container!.classList.add('drawer-overlay');
    } else {
      container!.classList.remove('drawer-overlay');
    }
  }

  toggle.addEventListener('click', () => {
    const collapsed = drawer.classList.toggle('drawer-collapsed');
    toggle.classList.toggle('drawer-collapsed', collapsed);
    toggle.classList.toggle('drawer-open', !collapsed);
    updateOverlay();
  });

  // Update overlay on resize
  window.addEventListener('resize', updateOverlay);
  // Initial state
  updateOverlay();
}

