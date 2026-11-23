'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { 
  LayoutDashboard, 
  ShoppingBag,
  Undo2,
  Truck,
  Banknote,
  FileText,
  Users,
  Package, 
  Database, 
  Store as StoreIcon, 
  BarChart3,
  Coins,
  Workflow,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  ListChecks,
  Plug,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useI18n } from '@/i18n';
import { useTheme } from '@/components/providers/ThemeProvider';

type NavItem = { icon: typeof LayoutDashboard; key: string; href: string };
// One standalone entry, then four main entries that each open to their own pages.
const home: NavItem = { icon: LayoutDashboard, key: 'dashboard', href: '/dashboard' };
const menuGroups: { id: string; icon: typeof LayoutDashboard; en: string; ar: string; items: NavItem[] }[] = [
  {
    id: 'operate',
    icon: ShoppingBag,
    en: 'Operations',
    ar: 'العمليات',
    items: [
      { icon: ShoppingBag, key: 'orders', href: '/orders' },
      { icon: Truck, key: 'shipping', href: '/shipments' },
      { icon: Undo2, key: 'returns', href: '/returns' },
      { icon: Users, key: 'customers', href: '/customers' },
    ],
  },
  {
    id: 'catalogue',
    icon: Package,
    en: 'Catalogue',
    ar: 'الكتالوج',
    items: [
      { icon: Package, key: 'products', href: '/products' },
      { icon: ListChecks, key: 'listingQuality', href: '/listing-quality' },
      { icon: Database, key: 'inventory', href: '/inventory' },
      { icon: Building2, key: 'warehouse', href: '/warehouse' },
      { icon: ClipboardList, key: 'purchasing', href: '/purchasing' },
    ],
  },
  {
    id: 'money',
    icon: Coins,
    en: 'Money',
    ar: 'المالية',
    items: [
      { icon: Coins, key: 'profit', href: '/profit' },
      { icon: BarChart3, key: 'analytics', href: '/analytics' },
      { icon: Banknote, key: 'cod', href: '/cod' },
      { icon: FileText, key: 'invoices', href: '/invoices' },
    ],
  },
  {
    id: 'setup',
    icon: Settings,
    en: 'Set up',
    ar: 'الإعداد',
    items: [
      { icon: StoreIcon, key: 'stores', href: '/stores' },
      { icon: Plug, key: 'integrations', href: '/integrations' },
      { icon: Workflow, key: 'automation', href: '/automation' },
      { icon: CreditCard, key: 'billing', href: '/billing' },
      { icon: Settings, key: 'settings', href: '/settings' },
    ],
  },
];

export default function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (v: boolean) => void }) {
  const pathname = usePathname();
  const { t, dir, locale } = useI18n();
  const { theme } = useTheme();
  const { organizations, activeOrgId, setActiveOrgId } = useAuthStore();
  const activeOrg = organizations.find(o => o.id === activeOrgId);

  // Which main entries are open. The one holding the current page is always open;
  // the rest follow what the person last chose, remembered on this device.
  const current = menuGroups.find((g) => g.items.some((i) => pathname.startsWith(i.href)))?.id;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setOpen(JSON.parse(localStorage.getItem('hubby_nav') || '{}'));
    } catch {
      /* ignore storage errors (private mode) */
    }
  }, []);
  const toggle = (id: string) => {
    setOpen((state) => {
      const next = { ...state, [id]: !(state[id] ?? id === current) };
      try {
        localStorage.setItem('hubby_nav', JSON.stringify(next));
      } catch {
        /* ignore storage errors (private mode) */
      }
      return next;
    });
  };
  const link = (item: NavItem, sub: boolean) => {
    const active = pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={isOpen ? undefined : t('nav.' + item.key)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          "group flex items-center gap-2.5 rounded-xl px-3 transition-colors hover:bg-accent",
          sub && isOpen ? "h-9 text-sm" : "h-10 text-[15px]",
          active ? "bg-accent font-bold text-foreground" : "font-medium text-muted-foreground hover:text-foreground"
        )}
      >
        <item.icon size={sub && isOpen ? 17 : 20} strokeWidth={1.75} className={cn("shrink-0", active && "text-primary")} />
        {isOpen && <span className="truncate">{t('nav.' + item.key)}</span>}
      </Link>
    );
  };

  return (
    <aside className={cn(
      "sticky top-0 h-screen bg-background border-e border-border transition-all duration-300 flex flex-col",
      isOpen ? "w-[232px]" : "w-[72px]"
    )}>
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          {isOpen
            ? <Logo variant={theme === 'dark' ? 'dark' : 'color'} className="h-7 w-auto" />
            : <Logo variant="icon" className="h-8 w-8" />}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 hover:bg-accent rounded-lg"
          >
            {(isOpen ? dir === 'ltr' : dir === 'rtl') ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {isOpen && organizations.length > 0 && (
          <div className="px-2">
            <select 
              value={activeOrgId || ''} 
              onChange={(e) => setActiveOrgId(parseInt(e.target.value))}
              className="w-full bg-accent/50 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
            >
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3.5 pb-4 space-y-1">
        {link(home, false)}
        {menuGroups.map((group) => {
          const expanded = open[group.id] ?? group.id === current;
          const holdsCurrent = group.id === current;
          // Narrow sidebar: there is no room for a second level, so every page is one icon.
          if (!isOpen) {
            return <div key={group.id} className="space-y-1 border-t border-border pt-1">{group.items.map((item) => link(item, true))}</div>;
          }
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggle(group.id)}
                aria-expanded={expanded}
                aria-controls={`nav-${group.id}`}
                className={cn(
                  "flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[15px] transition-colors hover:bg-accent",
                  holdsCurrent ? "font-bold text-foreground" : "font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                <group.icon size={20} strokeWidth={1.75} className={cn("shrink-0", holdsCurrent && !expanded && "text-primary")} />
                <span className="flex-1 truncate text-start">{locale === 'ar' ? group.ar : group.en}</span>
                <ChevronDown size={16} className={cn("shrink-0 transition-transform", expanded && "rotate-180")} />
              </button>
              {expanded && (
                <div id={`nav-${group.id}`} className="ms-[22px] mt-1 space-y-1 border-s border-border ps-2">
                  {group.items.map((item) => link(item, true))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
