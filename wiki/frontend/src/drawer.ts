// Drawer.ts: Collapsible drawer logic for the tree view
export function setupDrawer(drawerSelector: string) {
  const drawer = document.querySelector(drawerSelector) as HTMLElement | null;
  // Toggle button is now inside .drawer-border
  const toggle = drawer?.querySelector('.drawer-toggle') as HTMLElement | null;
  const container = document.getElementById('main-container');
  const border = drawer?.querySelector('.drawer-border') as HTMLElement | null;
  const resizer = drawer?.querySelector('.drawer-resizer') as HTMLElement | null;
  const dragTargets = [border, resizer, drawer].filter(Boolean) as HTMLElement[];

  const MIN_WIDTH = 200; // px
  const DRAG_START_THRESHOLD = 10; // px movement before drag engages
  const DEFAULT_WIDTH = drawer?.getBoundingClientRect().width || 250;

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
    if (collapsed) {
      drawer.style.width = '';
      drawer.style.flex = '';
    } else {
      const storedW = localStorage.getItem('drawerWidth');
      if (storedW) {
        const newW = parseInt(storedW);
        drawer.style.width = `${newW}px`;
        drawer.style.flex = `0 0 ${newW}px`;
      }
    }
    updateOverlay();
  });

  // Restore stored width
  const stored = localStorage.getItem('drawerWidth');
  if (stored && !isNaN(parseInt(stored))) {
    const newW = parseInt(stored);
    drawer!.style.width = `${newW}px`;
    drawer!.style.flex = `0 0 ${newW}px`;
  }

  function clampWidth(w: number) {
    const cssMax = window.innerWidth * 0.5;
    const maxCss = cssMax - 16; // subtract border+overhang
    return Math.max(MIN_WIDTH, Math.min(maxCss, w));
  }

  function onDragStart(e: MouseEvent) {
    if (e.detail === 2) return; // let dblclick handler handle
    if (window.matchMedia('(max-width: 700px)').matches) return; // disable on mobile
    if (drawer!.classList.contains('drawer-collapsed')) return; // do not drag when collapsed
    const startX = e.clientX;
    const startWidth = drawer!.getBoundingClientRect().width;
    let moved = false;

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      if (!moved && Math.abs(delta) < DRAG_START_THRESHOLD) return; // still waiting for real drag
      if (!moved) {
        moved = true;
        ev.preventDefault();
        document.body.style.userSelect = 'none';
      }
      const newW = clampWidth(startWidth + delta);
      drawer!.style.width = `${newW}px`;
      drawer!.style.flex = `0 0 ${newW}px`;
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      if (moved) {
        const finalW = clampWidth(drawer!.getBoundingClientRect().width);
        localStorage.setItem('drawerWidth', String(finalW));
        drawer!.style.flex = `0 0 ${finalW}px`;
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  dragTargets.forEach(el => el.addEventListener('mousedown', onDragStart));

  // Double-click to snap widths
  function onDblClick(ev?: MouseEvent) {

    ev?.stopPropagation();
    ev?.preventDefault();
    if (drawer!.classList.contains('drawer-collapsed')) return;
    const current = drawer!.getBoundingClientRect().width;
    const maxW = clampWidth(window.innerWidth * 2);
    const isExpanded = current > DEFAULT_WIDTH + 20;

    if (isExpanded) {
      applyWidth(DEFAULT_WIDTH);
    } else {
      applyWidth(maxW);
    }
  }

  function applyWidth(w: number) {
    const clamped = clampWidth(w);
    drawer!.style.width = `${clamped}px`;
    drawer!.style.flex = `0 0 ${clamped}px`;
    localStorage.setItem('drawerWidth', String(clamped));
  }

  drawer.addEventListener('dblclick', onDblClick);
  toggle.addEventListener('dblclick', onDblClick);

  // Update overlay on resize
  window.addEventListener('resize', updateOverlay);
  // Initial state
  updateOverlay();
}
