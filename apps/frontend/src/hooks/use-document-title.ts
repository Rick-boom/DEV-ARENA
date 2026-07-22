import { useEffect } from 'react';
import { APP } from '@/constants/app.js';

/**
 * Sets the document title per route. Titles matter for orientation in
 * browser history and tab lists, and screen readers announce them on
 * navigation — a single-page app has to do this by hand.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${APP.NAME}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
