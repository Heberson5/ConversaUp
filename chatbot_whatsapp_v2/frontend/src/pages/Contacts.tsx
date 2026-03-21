"use client";

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Search, UserPlus, MessageSquare, Phone, User, Loader2, RefreshCw, Filter, LayoutGrid, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { socket } from '@/lib/socket';

const API_BASE_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) 
  ? process.env.NEXT_PUBLIC_API_URL 
  : 'http://localhost:3001';

// ============================================================================
// TIPOS
// ============================================================================
interface ConnectionInfo {
  id: string;
  name: string;
  color: string;
  status: string;
  enabled: boolean;
}

interface ContactType {
  id: string;
  name: string;
  number: string;
  picUrl?: string;
  connectionId?: string;
  connectionName?: string;
  connectionColor?: string;
  [key: string]: any;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const Contacts = () => {
  const [contacts, setContacts] = useState<ContactType[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'az' | 'za' | 'recent'>('az');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // ==========================================================================
  // ESTADO PARA CONEXÕES E FILTRO
  // ==========================================================================
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [selectedConnectionFilter, setSelectedConnectionFilter] = useState<string>('all');
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, {status: string, enabled: boolean}>>({});

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
      setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, status, enabled } : c));
    };
    socket.on('connection:status', handleConnectionStatus);
    return () => { socket.off('connection:status', handleConnectionStatus); };
  }, []);

  // ==========================================================================
  // TEMA AUTOMÁTICO
  // ==========================================================================
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    };
    handleThemeChange(mediaQuery);
    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  // ==========================================================================
  // RECEBER CONTATOS DO SOCKET (JÁ DEVEM VIR COM INFORMAÇÃO DA CONEXÃO)
  // ==========================================================================
  useEffect(() => {
    const handleContacts = (data: ContactType[]) => {
      if (Array.isArray(data)) {
        const processed = data
          .filter(c => (c.number && String(c.number).startsWith('55')) || (c.id && String(c.id).startsWith('55')))
          .map(c => ({
            ...c,
            id: c.id?.includes('@') ? c.id : `${c.number}@s.whatsapp.net`,
            number: String(c.number || c.id || '').replace('@c.us', '').replace('@s.whatsapp.net', '')
          }));
        setContacts(processed);
        setIsLoading(false);
      }
    };

    socket.on('contacts', handleContacts);
    socket.emit('get_contacts');

    const timeout = setTimeout(() => setIsLoading(false), 8000);
    return () => {
      socket.off('contacts', handleContacts);
      clearTimeout(timeout);
    };
  }, []);

  // ==========================================================================
  // EXTRAIR FOTO DE PERFIL
  // ==========================================================================
  const getProfilePic = (c: ContactType) => {
    return c.picUrl || c.profilePicUrl || c.picture || c.avatar || c.profilePic || c.photo || c.image || null;
  };

  // ==========================================================================
  // FILTRO E ORDENAÇÃO
  // ==========================================================================
  const filteredContacts = contacts
    .filter(c => {
      // Filtro por conexão
      if (selectedConnectionFilter !== 'all' && c.connectionId !== selectedConnectionFilter) return false;
      // Filtro por texto
      const name = c.name || '';
      const number = c.number || '';
      return name.toLowerCase().includes(search.toLowerCase()) || number.includes(search);
    })
    .sort((a, b) => {
      if (sortBy === 'az') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'za') return (b.name || '').localeCompare(a.name || '');
      return 0;
    });

  // ==========================================================================
  // FORÇAR ATUALIZAÇÃO
  // ==========================================================================
  const forceRefresh = () => {
    setIsLoading(true);
    socket.emit('get_contacts');
    setTimeout(() => setIsLoading(false), 8000);
  };

  // ==========================================================================
  // ABRIR CHAT (PASSANDO A CONEXÃO DO CONTATO)
  // ==========================================================================
  const handleOpenChat = (contact: ContactType) => {
    const targetId = contact.id?.includes('@') ? contact.id : `${contact.number}@s.whatsapp.net`;
    const profilePic = getProfilePic(contact);
    
    const contactData = {
      id: targetId,
      name: contact.name || contact.number,
      picUrl: profilePic,
      connectionId: contact.connectionId,
      connectionName: contact.connectionName,
      connectionColor: contact.connectionColor
    };

    localStorage.setItem('zap_pending_chat', JSON.stringify(contactData));
    navigate('/chat', { 
      state: { 
        contactId: targetId,
        newContact: contactData
      } 
    });
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="p-4 lg:p-8 max-w-6xl mx-auto">
          
          {/* Cabeçalho */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Contatos</h1>
              <p className="text-slate-500 dark:text-slate-400">Gerencie seus contatos do WhatsApp.</p>
            </div>
            <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition-all">
              <UserPlus size={20} /> Novo Contato
            </button>
          </div>

          {/* Seletor de Conexão (Filtro) */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filtrar por conexão:</span>
            <button
              onClick={() => setSelectedConnectionFilter('all')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                selectedConnectionFilter === 'all'
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
                  onClick={() => setSelectedConnectionFilter(conn.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                    selectedConnectionFilter === conn.id
                      ? "text-white shadow-md"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                  style={selectedConnectionFilter === conn.id ? { backgroundColor: conn.color } : {}}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: conn.color }} />
                  {conn.name}
                </button>
              ))}
          </div>

          {/* Área Principal */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
            
            {/* Barra de Filtros e Buscas */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row items-center justify-between gap-4">
              
              <div className="flex items-center gap-3 w-full max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input 
                    type="text" placeholder="Buscar por nome ou número..." 
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm transition-colors">
                  {filteredContacts.length} {filteredContacts.length === 1 ? 'contato' : 'contatos'}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Botões de visualização */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button onClick={() => setViewMode('grid')} className={cn("p-1.5 rounded-md transition-colors", viewMode === 'grid' ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}>
                    <LayoutGrid size={16} />
                  </button>
                  <button onClick={() => setViewMode('list')} className={cn("p-1.5 rounded-md transition-colors", viewMode === 'list' ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}>
                    <List size={16} />
                  </button>
                </div>

                {/* Dropdown de ordenação */}
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 transition-colors">
                  <Filter size={16} className="text-slate-400 dark:text-slate-500" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="text-sm bg-transparent outline-none text-slate-600 dark:text-slate-300 cursor-pointer dark:bg-slate-900">
                    <option value="az">Nome (A-Z)</option>
                    <option value="za">Nome (Z-A)</option>
                  </select>
                </div>
                
                {/* Botão de atualizar */}
                <button onClick={forceRefresh} className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-500 dark:hover:text-emerald-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors shadow-sm" title="Recarregar Contatos">
                  <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
                </button>
              </div>
            </div>

            {/* Listagem de Contatos */}
            {isLoading ? (
              <div className="p-20 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-emerald-500" size={40} />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Sincronizando contatos em segundo plano...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-20 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 transition-colors"><User size={32} /></div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300 text-lg">Nenhum contato encontrado</h3>
              </div>
            ) : (
              <div className={cn("p-4", viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-2")}>
                {filteredContacts.map((contact, idx) => {
                  const pic = getProfilePic(contact);
                  const connectionColor = contact.connectionColor || '#00a884';
                  const lightColor = `${connectionColor}20`; // 20% opacidade
                  const cardStyle = {
                    borderColor: connectionColor,
                    backgroundColor: lightColor,
                  };
                  return (
                    <div 
                      key={contact.id || idx} 
                      className={cn(
                        "p-4 rounded-2xl border hover:border-emerald-200 dark:hover:border-emerald-500/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10 transition-all group flex items-center justify-between",
                        viewMode === 'grid' ? "flex-col items-start gap-4" : ""
                      )}
                      style={cardStyle}
                    >
                      <div className="flex items-center gap-4 w-full">
                        {/* Foto do contato */}
                        {pic ? (
                          <img src={pic} alt={contact.name} className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-bold flex-shrink-0 transition-colors">
                            {contact.name ? contact.name.charAt(0).toUpperCase() : <User size={24} />}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{contact.name || 'Sem nome'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><Phone size={12} /> +{contact.number}</p>
                          {/* Exibe o nome da conexão em um chip pequeno */}
                          {contact.connectionName && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: connectionColor }} />
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">{contact.connectionName}</span>
                            </div>
                          )}
                        </div>
                        {viewMode === 'list' && (
                          <button onClick={() => handleOpenChat(contact)} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500 dark:hover:bg-emerald-500 hover:text-white dark:hover:text-white shadow-sm transition-all">
                            <MessageSquare size={18} />
                          </button>
                        )}
                      </div>
                      {viewMode === 'grid' && (
                        <button onClick={() => handleOpenChat(contact)} className="w-full mt-4 p-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 dark:hover:bg-emerald-600 hover:text-white dark:hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all">
                          <MessageSquare size={14} /> Enviar Mensagem
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Contacts;