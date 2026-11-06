/**
 * Tiny store that lets a page announce its own title to the app header.
 *
 * iOS shows the page title twice: a large title inside the content and a
 * compact one in the navigation bar that fades in once the large title scrolls
 * under the bar. Pages stay decoupled from the layout through this store instead
 * of a context every page would have to thread through.
 */
export interface PageTitleState {
  /** null until a page mounts a <PageHeader>. */
  title: string | null;
  /** true once the large title has scrolled out from under the header bar. */
  collapsed: boolean;
}

const EMPTY_STATE: PageTitleState = { title: null, collapsed: false };

let state: PageTitleState = EMPTY_STATE;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePageTitle(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPageTitleSnapshot(): PageTitleState {
  return state;
}

/** Server render has no page mounted yet, so the header shows its route title. */
export function getPageTitleServerSnapshot(): PageTitleState {
  return EMPTY_STATE;
}

export function setPageTitle(title: string | null) {
  if (state.title === title && !state.collapsed) return;
  state = { title, collapsed: false };
  emit();
}

export function setPageTitleCollapsed(collapsed: boolean) {
  if (state.collapsed === collapsed) return;
  state = { ...state, collapsed };
  emit();
}
