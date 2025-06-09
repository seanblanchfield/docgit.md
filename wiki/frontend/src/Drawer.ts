// Drawer.ts: Collapsible drawer logic for the tree view
export function setupDrawer(drawerSelector: string, toggleSelector: string) {
  const drawer = document.querySelector(drawerSelector) as HTMLElement | null;
  const toggle = document.querySelector(toggleSelector) as HTMLElement | null;
  const container = document.getElementById('main-container');
  if (!drawer || !toggle || !container) return;

  function updateOverlay() {
    const isMobile = window.matchMedia('(max-width: 700px)').matches;
    const isOpen = !drawer.classList.contains('drawer-collapsed');
    if (isMobile && isOpen) {
      container.classList.add('drawer-overlay');
    } else {
      container.classList.remove('drawer-overlay');
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

