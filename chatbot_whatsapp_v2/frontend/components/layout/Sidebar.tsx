import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  QrCode, 
  Bot, 
  BarChart3, 
  Users, 
  LogOut,
  Contact2,
  BarChartHorizontal,
  Send,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

const currentUser = { role: 'master' as const };

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['master', 'admin', 'agent'] },
  { icon: MessageSquare, label: 'Atendimentos', path: '/chat', roles: ['master', 'admin', 'agent'] },
  { icon: Zap, label: 'Respostas Rápidas', path: '/quick-replies', roles: ['master', 'admin', 'agent'] },
  { icon: BarChartHorizontal, label: 'Gestão', path: '/management', roles: ['master', 'admin'] },
  { icon: Send, label: 'Disparos', path: '/broadcast', roles: ['master', 'admin'] },
  { icon: Contact2, label: 'Contatos', path: '/contacts', roles: ['master', 'admin', 'agent'] },
  { icon: QrCode, label: 'Conexões', path: '/connections', roles: ['master', 'admin'] },
  { icon: Bot, label: 'Automação', path: '/automation', roles: ['master', 'admin'] },
  { icon: BarChart3, label: 'Relatórios', path: '/reports', roles: ['master', 'admin'] },
  { icon: Users, label: 'Equipe', path: '/users', roles: ['master', 'admin'] },
];

interface SidebarProps { onClose?: () => void; }

export const SidebarContent = ({ onClose }: SidebarProps) => {
  const location = useLocation();
  const filteredMenu = menuItems.filter(item => item.roles.includes(currentUser.role));

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
          <MessageSquare size={20} className="text-white" />
        </div>
        <span className="font-bold text-xl tracking-tight">ConversaUp</span>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {filteredMenu.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              location.pathname === item.path 
                ? "bg-emerald-500/10 text-emerald-400" 
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <item.icon size={20} className={cn(
              "transition-colors",
              location.pathname === item.path ? "text-emerald-400" : "text-slate-500 group-hover:text-white"
            )} />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="px-4 py-2 mb-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Logado como</p>
          <p className="text-xs font-medium text-emerald-400 capitalize">{currentUser.role}</p>
        </div>
        <button className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all">
          <LogOut size={20} />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
};

export const Sidebar = () => (
  <div className="hidden lg:flex w-64 flex-col h-screen border-r border-slate-800">
    <SidebarContent />
  </div>
);