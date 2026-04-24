'use client';
// web/src/components/admin/AdminLayout.tsx
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Leaf, LayoutDashboard, Users, UtensilsCrossed,
  MessageSquare, BarChart3, Brain, LogOut, Menu, X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { clsx } from 'clsx';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const NAV_ITEMS = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/patients', icon: Users, label: 'Pacientes' },
  { href: '/admin/meal-plans', icon: UtensilsCrossed, label: 'Plano Alimentar' },
  { href: '/admin/feedback', icon: MessageSquare, label: 'Feedback', badge: true },
  { href: '/admin/reports', icon: BarChart3, label: 'Relatórios' },
  { href: '/admin/ai', icon: Brain, label: 'IA Consultora' },
];

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-40 w-56 bg-[#0A2E20] flex flex-col transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        {/* Brand */}
        <div className="px-5 py-6 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <Leaf className="w-6 h-6 text-[#B8DECA]" />
            <span className="text-xl font-semibold text-white">
              Nutri<span className="text-[#B8DECA]">App</span>
            </span>
          </div>
          <div className="mt-1">
            <span className="text-[10px] bg-[#B8DECA]/15 text-[#B8DECA] px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase">
              Nutricionista
            </span>
          </div>
        </div>

        {/* User */}
        <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#3D6B52] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {user?.profile?.name?.split(' ').map((w) => w[0]).slice(0, 2).join('') ?? 'NU'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.profile?.name ?? 'Nutricionista'}</p>
            <p className="text-white/35 text-xs truncate">{user?.profile?.crnNumber ? `CRN · ${user.profile.crnNumber}` : user?.email}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          <div className="px-4 py-2">
            <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-1">Menu</p>
          </div>
          {NAV_ITEMS.map(({ href, icon: Icon, label, badge }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-l-2',
                  isActive
                    ? 'bg-[#B8DECA]/10 border-[#B8DECA] text-white font-semibold'
                    : 'border-transparent text-white/50 hover:bg-white/5 hover:text-white/80',
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="bg-[#B85C38] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    !
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout + LGPD */}
        <div className="px-5 py-4 border-t border-white/8">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm w-full transition-colors mb-3"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
          <p className="text-[10px] text-white/20 leading-relaxed">
            🔒 LGPD compliant · Dados criptografados · Uso profissional exclusivo
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-gray-500 hover:text-gray-800"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
