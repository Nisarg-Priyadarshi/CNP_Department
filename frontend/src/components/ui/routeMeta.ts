import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════════════════
   Route metadata — one source for the document title, the meta description and
   the labels the palette and the shortcuts sheet use. Reused, not re-invented:
   the names match the shell's own page titles.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RouteMeta {
  title: string;
  description?: string;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  '/dashboard': {
    title: 'Dashboard',
    description:
      'Your term at GSFC University: clubs joined, projects, events ahead and unread notices in one place.',
  },
  '/clubs': {
    title: 'Clubs',
    description:
      'Student Managed Clubs at GSFC University: members, faculty coordinators and join requests.',
  },
  '/projects': {
    title: 'Projects',
    description:
      'GUIITAR projects at GSFC University: teams, team leaders, status, materials and updates.',
  },
  '/events': {
    title: 'Events',
    description: 'Club events this semester: dates, venues and the clubs running them.',
  },
  '/notifications': {
    title: 'Notifications',
    description: 'Club, project and material request updates, newest first.',
  },
  '/inventory': {
    title: 'Inventory',
    description: 'Project inventory: stock levels, allocations and material capacity.',
  },
  '/material-requests': {
    title: 'Material requests',
    description: 'Material requests raised against project inventory, with their approval stage.',
  },
  '/profile': {
    title: 'Profile',
    description: 'Your CNP Department identity: role, department, semester and contact details.',
  },
};

/** Detail routes: the route carries an id, so the title names the collection. */
const DETAIL_META: Record<string, RouteMeta> = {
  clubs: {
    title: 'Club details',
    description: 'A club at GSFC University: its members, faculty coordinator, events and updates.',
  },
  projects: {
    title: 'Project details',
    description: 'A GUIITAR project: its team, team leader, materials and progress updates.',
  },
};

/** `g` sequences: the second key of every "go to" shortcut, keyed by path. */
export const GO_KEY: Record<string, string> = {
  '/dashboard': 'd',
  '/clubs': 'c',
  '/projects': 'p',
  '/events': 'e',
  '/notifications': 'n',
  '/inventory': 'i',
  '/material-requests': 'm',
  '/profile': 's',
};

export function routeMetaFor(pathname: string): RouteMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (ROUTE_META[path]) return ROUTE_META[path];

  const segments = path.split('/').filter(Boolean);
  const root = segments[0] ?? '';

  if (segments.length > 1 && DETAIL_META[root]) return DETAIL_META[root];

  const fallback = ROUTE_META[`/${root}`];
  if (fallback) return fallback;

  const title = root
    ? root.charAt(0).toUpperCase() + root.slice(1).replace(/-/g, ' ')
    : 'CNP Department';
  return { title };
}

/** `${title} · CNP Department`, plus the description on the meta tags we ship. */
export function useDocumentMeta(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const { title, description } = routeMetaFor(pathname);
    const fullTitle = `${title} · CNP Department`;
    document.title = fullTitle;

    const setMeta = (selector: string, attr: 'name' | 'property', value: string) => {
      if (!value) return;
      let tag = document.head.querySelector<HTMLMetaElement>(selector);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, selector.split('"')[1]);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', value);
    };

    if (description) {
      setMeta('meta[name="description"]', 'name', description);
      setMeta('meta[property="og:description"]', 'property', description);
    }
    setMeta('meta[property="og:title"]', 'property', fullTitle);
  }, [pathname]);
}
