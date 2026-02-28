export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/updates', label: 'Updates' },
  { href: '/matches', label: 'Matches' },
  { href: '/history', label: 'History' },
  { href: '/honours', label: 'Honours' },
  { href: '/shop', label: 'Shop' },
  { href: '/contact', label: 'Contact' },
];
