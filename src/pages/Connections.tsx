"use client";

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { CheckCircle2, Loader2, Info, LogOut, Plus, X, Edit2, Power } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { socket } from '@/lib/socket';

const API_BASE_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) 
  ? process.env.NEXT_PUBLIC_API_URL 
  : 'http://localhost:3001';

interface Connection {
  id: string;
  name: string;
  color: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'disabled';
  enabled: boolean;
  qrRawData?: string | null;
}

const Connections = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#00a884');

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
    const handler = (e: MediaQueryListEvent | MediaQueryList) => applyTheme(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Buscar lista inicial de conexões
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/connections`);
        const data = await res.json();
        setConnections(data.map((c: any) => ({ ...c, qrRawData: null })));
      } catch (error) {
        console.error('Erro ao buscar conexões:', error);
        toast.error('Não foi possível carregar as conexões.');
      }
    };
    fetchConnections();
  }, []);

  // Socket listeners
  useEffect(() => {
    const onConnectionStatus = ({ connectionId, status }: { connectionId: string; status: string }) => {
      setConnections(prev =>
        prev.map(conn =>
          conn.id === connectionId
            ? { ...conn, status: status as Connection['status'], qrRawData: status === 'connected' ? null : conn.qrRawData }
            : conn
        )
      );
    };

    const onConnectionQr = ({ connectionId, qr }: { connectionId: string; qr: string }) => {
      setConnections(prev =>
        prev.map(conn =>
          conn.id === connectionId ? { ...conn, qrRawData: qr, status: 'disconnected' } : conn
        )
      );
    };

    socket.on('connection:status', onConnectionStatus);
    socket.on('connection:qr', onConnectionQr);

    // Solicitar status atual de todas as conexões
    if (socket.connected) {
      socket.emit('check_status');
    } else {
      socket.on('connect', () => {
        socket.emit('check_status');
      });
    }

    return () => {
      socket.off('connection:status', onConnectionStatus);
      socket.off('connection:qr', onConnectionQr);
    };
  }, []);

  const handleAddConnection = async () => {
    if (!newName.trim()) {
      toast.error('O nome é obrigatório.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, color: newColor }),
      });
      if (!res.ok) throw new Error('Erro ao criar conexão');
      const newConn = await res.json();
      setConnections(prev => [...prev, { ...newConn, qrRawData: null, enabled: true }]);
      setShowAddModal(false);
      setNewName('');
      setNewColor('#00a884');
      toast.success('Conexão criada!');
    } catch (error) {
      console.error(error);
      toast.error('Falha ao criar conexão.');
    }
  };

  const handleEditConnection = async () => {
    if (!editingConnection) return;
    if (!newName.trim()) {
      toast.error('O nome é obrigatório.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/connections/${editingConnection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, color: newColor }),
      });
      if (!res.ok) throw new Error('Erro ao editar conexão');
      const updated = await res.json();
      setConnections(prev =>
        prev.map(c => (c.id === updated.id ? { ...c, name: updated.name, color: updated.color } : c))
      );
      setEditingConnection(null);
      setNewName('');
      setNewColor('#00a884');
      toast.success('Conexão atualizada!');
    } catch (error) {
      console.error(error);
      toast.error('Falha ao editar conexão.');
    }
  };

  const handleToggleEnabled = async (connection: Connection) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/connections/${connection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !connection.enabled }),
      });
      if (!res.ok) throw new Error('Erro ao alterar estado');
      const updated = await res.json();
      setConnections(prev =>
        prev.map(c => (c.id === updated.id ? { ...c, enabled: updated.enabled, status: updated.status } : c))
      );
      toast.success(updated.enabled ? 'Conexão ativada' : 'Conexão desativada');
    } catch (error) {
      console.error(error);
      toast.error('Falha ao alterar estado da conexão.');
    }
  };

  const handleLogout = async (connectionId: string) => {
    const conn = connections.find(c => c.id === connectionId);
    if (!conn) return;

    // Atualização otimista
    setConnections(prev =>
      prev.map(c => (c.id === connectionId ? { ...c, status: 'connecting', qrRawData: null } : c))
    );

    try {
      const res = await fetch(`${API_BASE_URL}/api/connections/${connectionId}/logout`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Erro no logout');
    } catch (error) {
      console.error('Falha ao desconectar:', error);
      toast.error(`Erro ao desconectar ${conn.name}.`);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Tem certeza que deseja remover esta conexão?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/connections/${connectionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao deletar');
      setConnections(prev => prev.filter(c => c.id !== connectionId));
      toast.success('Conexão removida.');
    } catch (error) {
      console.error(error);
      toast.error('Falha ao remover conexão.');
    }
  };

  const openEditModal = (conn: Connection) => {
    setEditingConnection(conn);
    setNewName(conn.name);
    setNewColor(conn.color);
  };

  const getStatusText = (status: string, enabled: boolean) => {
    if (!enabled) return 'Desativada';
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando...';
      case 'disconnected': return 'Desconectado';
      default: return status;
    }
  };

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 p-4 lg:p-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          {/* Cabeçalho */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <h1 className="text-[28px] font-light text-[#41525d] dark:text-white">
              Conexões WhatsApp
            </h1>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-xl text-sm font-bold transition shadow-md shadow-emerald-500/20"
            >
              <Plus size={18} />
              Nova Conexão
            </button>
          </div>

          {/* Lista de cards */}
          {connections.length === 0 ? (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
              <p>Nenhuma conexão cadastrada.</p>
              <p className="text-sm mt-2">Clique em "Nova Conexão" para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {connections.map(conn => (
                <div
                  key={conn.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-[#e9edef] dark:border-slate-700 overflow-hidden transition-colors"
                  style={{ borderTopColor: conn.color, borderTopWidth: 4 }}
                >
                  {/* Cabeçalho do card */}
                  <div className="p-4 flex justify-between items-center border-b border-[#e9edef] dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: conn.color }}
                      />
                      <h3 className="font-semibold text-slate-800 dark:text-white">
                        {conn.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(conn)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(conn)}
                        className={`p-2 rounded-lg transition ${
                          conn.enabled
                            ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        title={conn.enabled ? 'Desativar' : 'Ativar'}
                      >
                        <Power size={18} />
                      </button>
                      {conn.enabled && conn.status === 'connected' && (
                        <button
                          onClick={() => handleLogout(conn.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                          title="Desconectar"
                        >
                          <LogOut size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteConnection(conn.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                        title="Remover conexão"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Conteúdo do card */}
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Status:
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        !conn.enabled
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          : conn.status === 'connected'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : conn.status === 'connecting'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                      }`}>
                        {getStatusText(conn.status, conn.enabled)}
                      </span>
                    </div>

                    {conn.enabled ? (
                      conn.status === 'connected' ? (
                        <div className="flex flex-col items-center py-4">
                          <div className="w-20 h-20 bg-[#00a884] dark:bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                            <CheckCircle2 className="text-white w-10 h-10" />
                          </div>
                          <p className="text-lg font-light text-[#41525d] dark:text-white">
                            Conectado
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          {conn.qrRawData ? (
                            <div className="bg-white p-2 rounded-xl shadow-sm mb-4">
                              <QRCodeSVG
                                value={conn.qrRawData}
                                size={180}
                                level="H"
                                bgColor="#ffffff"
                                fgColor="#000000"
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center py-6">
                              <Loader2 className="animate-spin text-[#00a884] dark:text-emerald-500 mb-4" size={40} />
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {conn.status === 'connecting'
                                  ? 'Conectando...'
                                  : 'Aguardando QR Code...'}
                              </p>
                            </div>
                          )}
                          {conn.status === 'disconnected' && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
                              Escaneie o QR Code com o WhatsApp para conectar.
                            </p>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center py-8">
                        <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                          <Power size={32} className="text-slate-400 dark:text-slate-500" />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Conexão desativada
                        </p>
                        <button
                          onClick={() => handleToggleEnabled(conn)}
                          className="mt-4 text-xs text-[#00a884] hover:underline"
                        >
                          Clique para ativar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de adicionar conexão */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              Nova Conexão
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e9edef] dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="Ex: Comercial"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cor
                </label>
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="w-full h-10 p-1 border border-[#e9edef] dark:border-slate-600 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddConnection}
                className="px-4 py-2 bg-[#00a884] text-white rounded-lg hover:bg-[#008f6f] transition"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de editar conexão */}
      {editingConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
              Editar Conexão
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e9edef] dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cor
                </label>
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="w-full h-10 p-1 border border-[#e9edef] dark:border-slate-600 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingConnection(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditConnection}
                className="px-4 py-2 bg-[#00a884] text-white rounded-lg hover:bg-[#008f6f] transition"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Connections;