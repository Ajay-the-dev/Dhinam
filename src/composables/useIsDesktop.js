import { ref, onMounted, onBeforeUnmount } from 'vue';

// Keep in sync with the 'lg' breakpoint in src/styles/abstracts/_tokens.scss
const DESKTOP_QUERY = '(min-width: 992px)';

/** Reactive flag for desktop-width viewports, used to switch between full and short labels. */
export function useIsDesktop() {
  const mql = typeof window !== 'undefined' ? window.matchMedia(DESKTOP_QUERY) : null;
  const isDesktop = ref(mql ? mql.matches : true);
  const update = (e) => {
    isDesktop.value = e.matches;
  };

  onMounted(() => mql?.addEventListener('change', update));
  onBeforeUnmount(() => mql?.removeEventListener('change', update));

  return isDesktop;
}
