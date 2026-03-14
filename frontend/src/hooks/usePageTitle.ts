import { useEffect } from 'react';

/**
 * Hook to set the page title dynamically
 * @param title - The title to set for the page
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);
}
