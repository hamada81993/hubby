'use client';

import React from 'react';
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
// Grouped so eighteen destinations read as four short lists.
const menuGroups: { en: string; ar: string; items: NavItem[] }[] = [
  {
    en: 'Operate',
    ar: 'التشغيل',
    items: [
      { icon: LayoutDashboard, key: 'dashboard', href: '/dashboard' },
      { icon: ShoppingBag, key: 'orders', href: '/orders' },
      { icon: Truck, key: 'shipping', href: '/shipments' },
      { icon: Undo2, key: 'returns', href: '/returns' },
      { icon: Users, key: 'customers', href: '/customers' },
    ],
  },
  {
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

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3.5 pb-4">
        {menuGroups.map((group) => (
          <div key={group.en} className="mt-4 first:mt-1">
            {isOpen && (
              <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                {locale === 'ar' ? group.ar : group.en}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isOpen ? undefined : t('nav.' + item.key)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "group flex h-10 items-center gap-2.5 rounded-xl px-3 text-[15px] transition-colors hover:bg-accent",
                      active ? "bg-accent font-bold text-foreground" : "font-medium text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon size={20} strokeWidth={1.75} className={cn("shrink-0", active && "text-primary")} />
                    {isOpen && <span className="truncate">{t('nav.' + item.key)}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
