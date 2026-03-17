export interface NavItem {
  href: string;
  label: string;
}

/** Primary nav items shown in the desktop header bar */
export const NAV_ITEMS: NavItem[] = [
  { href: '/updates', label: 'Updates' },
  { href: '/matches', label: 'Matches' },
  { href: '/history', label: 'History' },
  { href: '/sponsors', label: 'Sponsors' },
];

/** Full nav items shown in the burger menu and footer */
export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  { href: '/donate', label: 'Donate' },
  { href: '/honours', label: 'Honours' },
  { href: '/rules', label: 'Rules' },
  { href: '/contact', label: 'Contact' },
];
