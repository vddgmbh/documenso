import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Watch for `data-scroll-to-page` attribute changes on a container element.
 *
 * When set (by `validateFieldsInserted`, `handleOnNextFieldClick`, or similar),
 * scroll the virtual list to the requested page and clear the attribute.
 *
 * This is the communication bridge between field validation logic (which knows
 * which page to scroll to) and the virtual list (which knows how to scroll).
 */
export const useScrollToPage = (
  contentRef: RefObject<HTMLElement | null>,
  scrollToItem: (index: number, behavior?: ScrollBehavior) => void,
) => {
  const scrollToItemRef = useRef(scrollToItem);
  const observerRef = useRef<MutationObserver | null>(null);

  useLayoutEffect(() => {
    scrollToItemRef.current = scrollToItem;
  }, [scrollToItem]);

  const setupObserver = useCallback(() => {
    const el = contentRef.current;

    if (!el || observerRef.current) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-scroll-to-page') {
          const raw = el.getAttribute('data-scroll-to-page');

          if (raw) {
            const pageNumber = parseInt(raw, 10);

            if (!isNaN(pageNumber) && pageNumber >= 1) {
              scrollToItemRef.current(pageNumber - 1, 'auto');
            }

            el.removeAttribute('data-scroll-to-page');
          }
        }
      }
    });

    observer.observe(el, { attributes: true, attributeFilter: ['data-scroll-to-page'] });
    observerRef.current = observer;
  }, [contentRef]);

  useLayoutEffect(() => {
    setupObserver();

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [setupObserver]);
};
