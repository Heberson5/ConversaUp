"use client";

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Download, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  MessageSquare,
  Users,
  Repeat,
  Star
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';
import { socket } from '@/lib/socket';

// ============================================================================
// DADOS INICIAIS (FALLBACK)
// ============================================================================
const initialChartData = [
  { name: '08:00', atendimentos: 12, espera: 45 },
  { name: '09:00', atendimentos: 14, espera: 30 },
  { name: '10:00', atendimentos: 34, espera: 120 },
  { name: '11:00', atendimentos: 38, espera: 125 },
  { name: '12:00', atendimentos: 45, espera: 180 },
  { name: '13:00', atendimentos: 49, espera: 170 },
  { name: '14:00', atendimentos: 56, espera: 90 },
  { name: '15:00', atendimentos: 45, espera: 100 },
  { name: '16:00', atendimentos: 42, espera: 60 },
  { name: '17:00', atendimentos: 35, espera: 70 },
  { name: '18:00', atendimentos: 28, espera: 30 },
  { name: '19:00', atendimentos: 15, espera: 20 },
  { name: '20:00', atendimentos: 5, espera: 8 },
  { name: '21:00', atendimentos: 0, espera: 0 },
  { name: '22:00', atendimentos: 0, espera: 0 },
  { name: '23:00', atendimentos: 0, espera: 0 },
  { name: '00:00', atendimentos: 0, espera: 0 },
];

const initialPieData = [
  { name: 'Vendas', value: 400, color: '#10b981' },
  { name: 'Suporte', value: 300, color: '#3b82f6' },
  { name: 'Financeiro', value: 200, color: '#f59e0b' },
  { name: 'Outros', value: 100, color: '#64748b' },
];

// ============================================================================
// COMPONENTES MENORES
// ============================================================================
const MetricCard = ({ label, value, subValue, icon: Icon, trend }: any) => (
  <div className="bg-white dark:bg-slate-800 p-5 lg:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
    <div className="flex items-center gap-4 mb-4">
      <div className="p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-slate-600 dark:text-slate-400 transition-colors">
        <Icon size={18} />
      </div>
      <span className="text-xs lg:text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">{value}</span>
      <span className={cn(
        "text-[10px] lg:text-xs font-bold flex items-center gap-0.5",
        trend === 'up' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}>
        {trend === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
        {subValue}
      </span>
    </div>
  </div>
);

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const Reports = () => {
  const [isDark, setIsDark] = useState(false);

  // Estados Dinâmicos em Tempo Real
  const [chartData, setChartData] = useState(initialChartData);
  const [pieData, setPieData] = useState(initialPieData);
  const [metrics, setMetrics] = useState({
    tempoAceite: "01:12m",
    csat: "94%",
    atendimentos: 842,
    transferidos: 45,
    trends: { tempo: 'down', csat: 'up', atendimentos: 'up', transferidos: 'down' },
    subValues: { tempo: "12%", csat: "2%", atendimentos: "18%", transferidos: "2%" }
  });

  // LÓGICA DE TEMA AUTOMÁTICO FORÇADO NO ROOT E SINCRONIZADO
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (systemIsDark: boolean) => {
      setIsDark(systemIsDark); // Atualiza estado interno para gráficos do Recharts

      if (systemIsDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    };

    // Aplica no momento em que a página/efeito carrega
    applyTheme(mediaQuery.matches);

    // Fica escutando caso o usuário mude o tema do SO
    const handler = (e: MediaQueryListEvent | MediaQueryList) => applyTheme(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // LÓGICA DE SINCRONIZAÇÃO EM TEMPO REAL (SOCKET)
  useEffect(() => {
    // 1. Recebe a carga completa de dados do Dashboard
    const handleDashboardData = (data: any) => {
      if (!data) return;
      if (data.metrics) setMetrics(prev => ({ ...prev, ...data.metrics }));
      if (data.chartData) setChartData(data.chartData);
      if (data.pieData) setPieData(data.pieData);
    };

    // 2. Eventos Incrementais (Para sensação instantânea sem precisar recarregar o gráfico todo)
    const handleNewAttendance = () => {
      setMetrics(prev => ({ ...prev, atendimentos: prev.atendimentos + 1 }));
    };

    const handleTransfer = () => {
      setMetrics(prev => ({ ...prev, transferidos: prev.transferidos + 1 }));
    };

    // Conecta os ouvintes do Socket
    socket.on('dashboard_update', handleDashboardData);
    socket.on('new_chat', handleNewAttendance);
    socket.on('ticket_created', handleNewAttendance);
    socket.on('chat_transferred', handleTransfer);

    // Solicita os dados atualizados ao servidor assim que a tela abre
    if (socket.connected) {
      socket.emit('get_dashboard_data');
    } else {
      socket.once('connect', () => socket.emit('get_dashboard_data'));
    }

    return () => {
      socket.off('dashboard_update', handleDashboardData);
      socket.off('new_chat', handleNewAttendance);
      socket.off('ticket_created', handleNewAttendance);
      socket.off('chat_transferred', handleTransfer);
    };
  }, []);

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Relatórios de Desempenho</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Análise detalhada de produtividade e satisfação.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                <Calendar size={16} />
                Hoje
              </button>
              <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 dark:bg-emerald-500 text-white hover:bg-slate-800 dark:hover:bg-emerald-600 rounded-xl text-xs font-bold transition-colors shadow-sm">
                <Download size={16} />
                PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <MetricCard label="Tempo de Aceite" value={metrics.tempoAceite} subValue={metrics.subValues.tempo} trend={metrics.trends.tempo} icon={Clock} />
            <MetricCard label="Satisfação (CSAT)" value={metrics.csat} subValue={metrics.subValues.csat} trend={metrics.trends.csat} icon={Star} />
            <MetricCard label="Atendimentos Únicos" value={metrics.atendimentos} subValue={metrics.subValues.atendimentos} trend={metrics.trends.atendimentos} icon={Users} />
            <MetricCard label="Transferidos" value={metrics.transferidos} subValue={metrics.subValues.transferidos} trend={metrics.trends.transferidos} icon={Repeat} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-4 lg:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
              <h3 className="text-base lg:text-lg font-bold text-slate-900 dark:text-white mb-6">Picos de Atendimento</h3>
              <div className="h-[250px] lg:h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10}} />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: isDark ? '1px solid #334155' : 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a'
                      }}
                      itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                    />
                    <Area type="monotone" dataKey="atendimentos" stroke="#10b981" fillOpacity={1} fill="url(#colorAt)" strokeWidth={3} />
                    <Area type="monotone" dataKey="espera" stroke="#f59e0b" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 lg:p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
              <h3 className="text-base lg:text-lg font-bold text-slate-900 dark:text-white mb-6">Distribuição por Fila</h3>
              <div className="h-[200px] lg:h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: isDark ? '1px solid #334155' : 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a'
                      }}
                      itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-slate-600 dark:text-slate-400">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;