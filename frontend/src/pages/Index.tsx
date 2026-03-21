"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  MessageCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Star,
  ChevronLeft,
  ChevronRight,
  LineChart,
  BarChart2,
  UserCheck,
  Send,
  Loader2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isWithinInterval,
  subWeeks,
  subMonths as subMonthsDate,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  startOfYear,
  endOfYear,
  subYears,
  eachWeekOfInterval,
  eachMonthOfInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { socket } from '@/lib/socket';
import { cn } from '@/lib/utils';

const API_BASE_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) 
  ? process.env.NEXT_PUBLIC_API_URL 
  : 'http://localhost:3001';

type TimeRange = 'week' | 'month' | 'quarter' | 'semester' | 'year';

interface ConnectionInfo {
  id: string;
  name: string;
  color: string;
  status: string;
  enabled: boolean;
}

interface ChatType {
  id: string;
  name: string;
  lastMessage?: string;
  unreadCount?: number;
  picUrl?: string;
  timestamp?: number;
  connectionId?: string;
  connectionName?: string;
  connectionColor?: string;
  [key: string]: any;
}

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color }: any) => (
  <div className="bg-white dark:!bg-slate-800 p-5 lg:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between">
    <div>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-2.5 lg:p-3 rounded-xl", color)}>
          <Icon size={20} className="text-white lg:w-5 lg:h-5" />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-[10px] lg:text-xs font-bold px-2 py-1 rounded-full",
          trend === 'up'
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
            : "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
        )}>
          {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trendValue}
        </div>
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-tight mb-1">{title}</h3>
    </div>
    <p className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white truncate" title={String(value)}>{value}</p>
  </div>
);

// Função auxiliar para obter o intervalo baseado no período selecionado
const getDateRange = (range: TimeRange, baseDate: Date) => {
  switch (range) {
    case 'week':
      return {
        start: startOfWeek(baseDate, { weekStartsOn: 1 }),
        end: endOfWeek(baseDate, { weekStartsOn: 1 })
      };
    case 'month':
      return {
        start: startOfMonth(baseDate),
        end: endOfMonth(baseDate)
      };
    case 'quarter':
      return {
        start: startOfQuarter(baseDate),
        end: endOfQuarter(baseDate)
      };
    case 'semester':
      // Semestre personalizado: 6 meses a partir do início do mês atual
      return {
        start: startOfMonth(subMonthsDate(baseDate, 5)),
        end: endOfMonth(baseDate)
      };
    case 'year':
      return {
        start: startOfYear(baseDate),
        end: endOfYear(baseDate)
      };
    default:
      return {
        start: startOfWeek(baseDate, { weekStartsOn: 1 }),
        end: endOfWeek(baseDate, { weekStartsOn: 1 })
      };
  }
};

const getPreviousDate = (range: TimeRange, currentDate: Date) => {
  switch (range) {
    case 'week': return subWeeks(currentDate, 1);
    case 'month': return subMonthsDate(currentDate, 1);
    case 'quarter': return subQuarters(currentDate, 1);
    case 'semester': return subMonthsDate(currentDate, 6);
    case 'year': return subYears(currentDate, 1);
    default: return subWeeks(currentDate, 1);
  }
};

const Index = () => {
  const [chats, setChats] = useState<ChatType[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [accepted, setAccepted] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [surveyData, setSurveyData] = useState([
    { name: 'Excelente (5)', value: 0, color: '#10b981' },
    { name: 'Bom (4)', value: 0, color: '#3b82f6' },
    { name: 'Regular (3)', value: 0, color: '#f59e0b' },
    { name: 'Ruim (2)', value: 0, color: '#ef4444' },
    { name: 'Muito Ruim (1)', value: 0, color: '#7f1d1d' }
  ]);
  const [isDark, setIsDark] = useState(false);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('all');
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, {status: string, enabled: boolean}>>({});

  // Tema automático
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (systemIsDark: boolean) => {
      setIsDark(systemIsDark);
      if (systemIsDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    };

    applyTheme(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Buscar conexões disponíveis
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/connections`);
        const data = await res.json();
        setConnections(data);
        const statusMap: Record<string, {status: string, enabled: boolean}> = {};
        data.forEach((c: any) => { statusMap[c.id] = { status: c.status, enabled: c.enabled }; });
        setConnectionStatuses(statusMap);
      } catch (error) {
        console.error('Erro ao buscar conexões:', error);
      }
    };
    fetchConnections();

    const handleConnectionStatus = ({ connectionId, status, enabled }: { connectionId: string; status: string; enabled: boolean }) => {
      setConnectionStatuses(prev => ({ ...prev, [connectionId]: { status, enabled } }));
    };
    socket.on('connection:status', handleConnectionStatus);
    return () => { socket.off('connection:status', handleConnectionStatus); };
  }, []);

  // Recupera contatos aceitos do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const acc = JSON.parse(localStorage.getItem('zap_accepted') || '[]');
      setAccepted(acc);
    }
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const acc = JSON.parse(localStorage.getItem('zap_accepted') || '[]');
      setAccepted(acc);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Carrega todos os dados ao conectar
  useEffect(() => {
    const handleStatus = (serverStatus: string) => {
      if (serverStatus === 'connected') setStatus('connected');
      else if (serverStatus === 'disconnected') setStatus('disconnected');
    };

    const handleChats = (data: ChatType[]) => {
      setChats(data || []);
      setLoading(false);
    };

    const handleChatUpdated = (updatedChat: ChatType) => {
      setChats(prev => {
        const index = prev.findIndex(c => c.id === updatedChat.id);
        if (index >= 0) {
          const newChats = [...prev];
          newChats[index] = { ...newChats[index], ...updatedChat };
          return newChats;
        } else {
          return [updatedChat, ...prev];
        }
      });
    };

    const handleSurveyResponses = (data: any) => {
      setSurveyData(data);
    };

    socket.on('whatsapp_status', handleStatus);
    socket.on('chats', handleChats);
    socket.on('chat_updated', handleChatUpdated);
    socket.on('survey_responses', handleSurveyResponses);

    if (socket.connected) {
      socket.emit('check_status');
      socket.emit('get_chats');  // alterado para get_chats em vez de get_all_chats
      socket.emit('get_all_survey_responses');
    } else {
      socket.once('connect', () => {
        socket.emit('check_status');
        socket.emit('get_chats');
        socket.emit('get_all_survey_responses');
      });
    }

    return () => {
      socket.off('whatsapp_status', handleStatus);
      socket.off('chats', handleChats);
      socket.off('chat_updated', handleChatUpdated);
      socket.off('survey_responses', handleSurveyResponses);
    };
  }, []);

  // Filtra chats: período, conexão, e exclui grupos
  const filteredChats = useMemo(() => {
    const { start, end } = getDateRange(timeRange, selectedDate);
    return chats.filter(chat => {
      // Excluir grupos
      if (chat.id.includes('@g.us')) return false;
      if (!chat.timestamp) return false;
      const chatDate = new Date(chat.timestamp * 1000);
      if (!isWithinInterval(chatDate, { start, end })) return false;
      if (selectedConnection !== 'all' && chat.connectionId !== selectedConnection) return false;
      return true;
    });
  }, [chats, selectedDate, timeRange, selectedConnection]);

  const totalChats = filteredChats.length;
  const waitingChats = filteredChats.filter(c => (c.unreadCount || 0) > 0 && !accepted.includes(c.id)).length;
  const activeChats = filteredChats.filter(c => accepted.includes(c.id)).length;
  const agentsOnline = status === 'connected' ? '1 / 1' : '0 / 1';

  const averageRating = useMemo(() => {
    let total = 0;
    let count = 0;
    surveyData.forEach((item, index) => {
      const rating = 5 - index;
      total += rating * item.value;
      count += item.value;
    });
    return count > 0 ? (total / count).toFixed(1) : '0.0';
  }, [surveyData]);

  // Gera os dados do gráfico principal (volume, sent, received)
  const getChartData = () => {
    const { start, end } = getDateRange(timeRange, selectedDate);
    const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (daysInRange <= 35) {
      // Agrupa por dia
      const days = eachDayOfInterval({ start, end });
      const volumes = Array(days.length).fill(0);

      filteredChats.forEach(chat => {
        if (chat.timestamp) {
          const chatDate = new Date(chat.timestamp * 1000);
          const dayIndex = days.findIndex(d => format(d, 'yyyy-MM-dd') === format(chatDate, 'yyyy-MM-dd'));
          if (dayIndex !== -1) volumes[dayIndex]++;
        }
      });

      return days.map((date, index) => {
        const volume = volumes[index];
        // Simulação de mensagens (baseada no volume e data)
        const seed = date.getDate();
        const sent = Math.floor(volume * 3.5) + (volume > 0 ? (seed % 5) + 2 : 0);
        const received = Math.floor(volume * 2.8) + (volume > 0 ? (seed % 4) + 1 : 0);

        return {
          name: format(date, 'dd/MM'),
          fullDate: date,
          volume,
          sent,
          received
        };
      });
    } else if (daysInRange <= 180) {
      // Agrupa por semana
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      const volumes = Array(weeks.length).fill(0);

      filteredChats.forEach(chat => {
        if (chat.timestamp) {
          const chatDate = new Date(chat.timestamp * 1000);
          const weekIndex = weeks.findIndex(weekStart =>
            chatDate >= weekStart && chatDate <= endOfWeek(weekStart, { weekStartsOn: 1 })
          );
          if (weekIndex !== -1) volumes[weekIndex]++;
        }
      });

      return weeks.map((weekStart, index) => {
        const volume = volumes[index];
        const seed = weekStart.getDate();
        const sent = Math.floor(volume * 3.5) + (volume > 0 ? (seed % 5) + 2 : 0);
        const received = Math.floor(volume * 2.8) + (volume > 0 ? (seed % 4) + 1 : 0);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

        return {
          name: `Sem ${format(weekStart, 'dd/MM')}`,
          fullDate: weekStart,
          volume,
          sent,
          received
        };
      });
    } else {
      // Agrupa por mês
      const months = eachMonthOfInterval({ start, end });
      const volumes = Array(months.length).fill(0);

      filteredChats.forEach(chat => {
        if (chat.timestamp) {
          const chatDate = new Date(chat.timestamp * 1000);
          const monthIndex = months.findIndex(monthStart =>
            chatDate >= monthStart && chatDate <= endOfMonth(monthStart)
          );
          if (monthIndex !== -1) volumes[monthIndex]++;
        }
      });

      return months.map((monthStart, index) => {
        const volume = volumes[index];
        const seed = monthStart.getDate();
        const sent = Math.floor(volume * 3.5) + (volume > 0 ? (seed % 5) + 2 : 0);
        const received = Math.floor(volume * 2.8) + (volume > 0 ? (seed % 4) + 1 : 0);

        return {
          name: format(monthStart, 'MMM/yy', { locale: ptBR }),
          fullDate: monthStart,
          volume,
          sent,
          received
        };
      });
    }
  };

  const chartData = getChartData();
  const totalSent = chartData.reduce((acc, curr) => acc + curr.sent, 0);
  const totalReceived = chartData.reduce((acc, curr) => acc + curr.received, 0);

  // Navegação entre períodos
  const goToPrevious = () => {
    setSelectedDate(prev => getPreviousDate(timeRange, prev));
  };

  const goToNext = () => {
    setSelectedDate(prev => {
      switch (timeRange) {
        case 'week': return new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000);
        case 'month': return addMonths(prev, 1);
        case 'quarter': return addMonths(prev, 3);
        case 'semester': return addMonths(prev, 6);
        case 'year': return addMonths(prev, 12);
        default: return prev;
      }
    });
  };

  const goToCurrent = () => {
    setSelectedDate(new Date());
  };

  const periodLabel = useMemo(() => {
    const { start, end } = getDateRange(timeRange, selectedDate);
    if (timeRange === 'week') {
      return `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
    } else if (timeRange === 'month') {
      return format(selectedDate, 'MMMM yyyy', { locale: ptBR }).replace(/^./, str => str.toUpperCase());
    } else if (timeRange === 'quarter') {
      return `${format(start, 'dd/MM')} a ${format(end, 'dd/MM/yyyy')}`;
    } else if (timeRange === 'semester') {
      return `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
    } else {
      return format(selectedDate, 'yyyy');
    }
  }, [timeRange, selectedDate]);

  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-8 dark:bg-slate-900 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Carregando todas as conversas...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 dark:bg-slate-900 min-h-screen">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Dashboard Operacional</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Monitoramento em tempo real e satisfação do cliente.</p>
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-2",
            status === 'connected'
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : status === 'connecting'
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full",
              status === 'connected' ? "bg-emerald-500 animate-pulse" :
              status === 'connecting' ? "bg-amber-500" : "bg-rose-500"
            )} />
            {status === 'connected' ? "Conectado" : status === 'connecting' ? "Conectando" : "Desconectado"}
          </div>
        </div>

        {/* Seletor de Conexão */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filtrar por conexão:</span>
          <button
            onClick={() => setSelectedConnection('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              selectedConnection === 'all'
                ? "bg-emerald-500 text-white shadow-md"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            Todas
          </button>
          {connections
            .filter(conn => connectionStatuses[conn.id]?.enabled && connectionStatuses[conn.id]?.status === 'connected')
            .map(conn => (
              <button
                key={conn.id}
                onClick={() => setSelectedConnection(conn.id)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                  selectedConnection === conn.id
                    ? "bg-emerald-500 text-white shadow-md"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: conn.color }} />
                {conn.name}
              </button>
            ))}
        </div>

        {/* CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6 mb-8">
          <StatCard title="Total Atendimentos" value={totalChats} icon={MessageCircle} trend="up" trendValue="+12%" color="bg-slate-700" />
          <StatCard title="Aguardando Aceite" value={waitingChats} icon={Clock} trend="down" trendValue="-5%" color="bg-amber-500" />
          <StatCard title="Em Atendimento" value={activeChats} icon={UserCheck} trend="up" trendValue="+8%" color="bg-emerald-500" />
          <StatCard title="Mensagens (Env / Rec)" value={`${totalSent} / ${totalReceived}`} icon={Send} trend="up" trendValue="+15%" color="bg-blue-500" />
          <StatCard title="Satisfação Média" value={averageRating} icon={Star} trend="up" trendValue="+0.2" color="bg-yellow-500" />
          <StatCard title="Agentes Online" value={agentsOnline} icon={Users} trend="up" trendValue="+0" color="bg-indigo-500" />
        </div>

        {/* GRÁFICO PRINCIPAL + PIE CHART */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 mb-8">
          <div className="xl:col-span-2 bg-white dark:!bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Volume de Atendimentos</h3>

                {/* Seletor de intervalo */}
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg ml-2">
                  <button
                    onClick={() => setTimeRange('week')}
                    className={cn("px-3 py-1 text-xs font-medium rounded-md transition",
                      timeRange === 'week'
                        ? "bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => setTimeRange('month')}
                    className={cn("px-3 py-1 text-xs font-medium rounded-md transition",
                      timeRange === 'month'
                        ? "bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    Mês
                  </button>
                  <button
                    onClick={() => setTimeRange('quarter')}
                    className={cn("px-3 py-1 text-xs font-medium rounded-md transition",
                      timeRange === 'quarter'
                        ? "bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    Trim.
                  </button>
                  <button
                    onClick={() => setTimeRange('semester')}
                    className={cn("px-3 py-1 text-xs font-medium rounded-md transition",
                      timeRange === 'semester'
                        ? "bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    Sem.
                  </button>
                  <button
                    onClick={() => setTimeRange('year')}
                    className={cn("px-3 py-1 text-xs font-medium rounded-md transition",
                      timeRange === 'year'
                        ? "bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    Ano
                  </button>
                </div>

                {/* Tipo de gráfico */}
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg ml-2">
                  <button
                    onClick={() => setChartType('area')}
                    className={cn("p-1.5 rounded-md transition",
                      chartType === 'area'
                        ? "bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400"
                        : "text-slate-400 dark:text-slate-500"
                    )}
                    title="Gráfico em Linha"
                  >
                    <LineChart size={16} />
                  </button>
                  <button
                    onClick={() => setChartType('bar')}
                    className={cn("p-1.5 rounded-md transition",
                      chartType === 'bar'
                        ? "bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400"
                        : "text-slate-400 dark:text-slate-500"
                    )}
                    title="Gráfico em Barras"
                  >
                    <BarChart2 size={16} />
                  </button>
                </div>
              </div>

              {/* Navegação de período */}
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevious}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                  title="Período anterior"
                >
                  <ChevronLeft size={18} className="text-slate-600 dark:text-slate-300" />
                </button>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[180px] text-center capitalize">
                  {periodLabel}
                </span>
                <button
                  onClick={goToNext}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                  title="Próximo período"
                >
                  <ChevronRight size={18} className="text-slate-600 dark:text-slate-300" />
                </button>
                <button
                  onClick={goToCurrent}
                  className="px-3 py-1 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition"
                >
                  Atual
                </button>
              </div>
            </div>

            <div className="h-[300px] transition-all duration-700 ease-in-out">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart
                    key={`area-chart-main-${timeRange}-${selectedDate.getTime()}-${selectedConnection}`}
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: isDark ? '1px solid #334155' : 'none',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a'
                      }}
                      labelStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                      labelFormatter={(label) => `Período: ${label}`}
                    />
                    <Area
                      name="Atendimentos"
                      type="monotone"
                      dataKey="volume"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorVolume)"
                      strokeWidth={3}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={2000}
                      animationEasing="ease-in-out"
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    key={`bar-chart-main-${timeRange}-${selectedDate.getTime()}-${selectedConnection}`}
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: isDark ? '1px solid #334155' : 'none',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a'
                      }}
                      labelStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                      labelFormatter={(label) => `Período: ${label}`}
                      cursor={{ fill: isDark ? '#334155' : '#f1f5f9' }}
                    />
                    <Bar
                      name="Atendimentos"
                      dataKey="volume"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={2000}
                      animationEasing="ease-in-out"
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:!bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-6">Pesquisa de Satisfação</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart key={`pie-chart-${timeRange}-${selectedDate.getTime()}`}>
                  <Pie
                    data={surveyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    isAnimationActive={true}
                    animationDuration={2000}
                    animationEasing="ease-in-out"
                    stroke="none"
                  >
                    {surveyData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => `${Number(value).toFixed(1)}%`}
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
            <div className="space-y-2 mt-6">
              {surveyData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-slate-600 dark:text-slate-400">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{item.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GRÁFICOS DE MENSAGENS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <div className="bg-white dark:!bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-6">Mensagens Enviadas</h3>
            <div className="h-[250px] transition-all duration-700 ease-in-out">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart
                    key={`area-chart-sent-${timeRange}-${selectedDate.getTime()}-${selectedConnection}`}
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: isDark ? '1px solid #334155' : 'none',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a'
                      }}
                      labelStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                      labelFormatter={(label) => `Período: ${label}`}
                    />
                    <Area
                      name="Mensagens Enviadas"
                      type="monotone"
                      dataKey="sent"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorSent)"
                      strokeWidth={3}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={2000}
                      animationEasing="ease-in-out"
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    key={`bar-chart-sent-${timeRange}-${selectedDate.getTime()}-${selectedConnection}`}
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: isDark ? '1px solid #334155' : 'none',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a'
                      }}
                      labelStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                      labelFormatter={(label) => `Período: ${label}`}
                      cursor={{ fill: isDark ? '#334155' : '#f1f5f9' }}
                    />
                    <Bar
                      name="Mensagens Enviadas"
                      dataKey="sent"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={2000}
                      animationEasing="ease-in-out"
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:!bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-6">Mensagens Recebidas</h3>
            <div className="h-[250px] transition-all duration-700 ease-in-out">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart
                    key={`area-chart-received-${timeRange}-${selectedDate.getTime()}-${selectedConnection}`}
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: isDark ? '1px solid #334155' : 'none',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a'
                      }}
                      labelStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                      labelFormatter={(label) => `Período: ${label}`}
                    />
                    <Area
                      name="Mensagens Recebidas"
                      type="monotone"
                      dataKey="received"
                      stroke="#8b5cf6"
                      fillOpacity={1}
                      fill="url(#colorReceived)"
                      strokeWidth={3}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={2000}
                      animationEasing="ease-in-out"
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    key={`bar-chart-received-${timeRange}-${selectedDate.getTime()}-${selectedConnection}`}
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: isDark ? '1px solid #334155' : 'none',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        color: isDark ? '#f8fafc' : '#0f172a'
                      }}
                      labelStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                      labelFormatter={(label) => `Período: ${label}`}
                      cursor={{ fill: isDark ? '#334155' : '#f1f5f9' }}
                    />
                    <Bar
                      name="Mensagens Recebidas"
                      dataKey="received"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={2000}
                      animationEasing="ease-in-out"
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;