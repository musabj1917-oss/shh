import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Injects web-specific styles for desktop/browser UX:
 * - cursor: pointer on pressables, buttons, links
 * - smooth hover transitions and subtle brightness
 * - accessible focus-visible rings with the active theme accent
 * - thin scrollbars for obsidian/dark aesthetic
 * - text selection on message bubbles
 */
export function injectWebStyles(accentColor = '#FFD60A') {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const styleId = 'haiku-web-global-styles';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    /* Cursor pointer on interactive elements */
    [role="button"],
    button,
    a,
    [data-focusable="true"],
    [tabindex="0"] {
      cursor: pointer !important;
    }

    /* Button hover transitions */
    [role="button"] {
      transition: opacity 0.15s ease, filter 0.15s ease, transform 0.1s ease;
    }
    [role="button"]:hover {
      filter: brightness(1.08);
    }

    /* Accessible focus-visible rings */
    *:focus-visible {
      outline: 2px solid ${accentColor} !important;
      outline-offset: 2px !important;
    }

    /* Thin styled scrollbars for dark theme */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.18);
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.35);
    }
    * {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
    }

    /* Text selection on message bubbles */
    .haiku-selectable,
    [data-selectable="true"] {
      user-select: text !important;
      -webkit-user-select: text !important;
    }
  `;
}

/**
 * Initializes web metadata for PWA installability and document title
 */
export function initWebMetadata() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  document.title = 'Haiku Messenger — Private, Ephemeral, Connected';

  // Theme color meta tag
  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.setAttribute('name', 'theme-color');
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute('content', '#0A0A0A');

  // Favicon link tag
  let linkIcon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!linkIcon) {
    linkIcon = document.createElement('link');
    linkIcon.setAttribute('rel', 'icon');
    document.head.appendChild(linkIcon);
  }
  linkIcon.setAttribute('type', 'image/png');
  linkIcon.setAttribute('href', '/assets/icons/haiku/icon-haiku.png');

  // Web manifest link tag
  let linkManifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!linkManifest) {
    linkManifest = document.createElement('link');
    linkManifest.setAttribute('rel', 'manifest');
    document.head.appendChild(linkManifest);
  }
  linkManifest.setAttribute('href', '/manifest.json');
}

/**
 * Hook to listen for Escape (Esc) key on web to close modals, viewers, and sheets
 */
export function useEscapeKey(callback: () => void, enabled = true) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [callback, enabled]);
}
