"use client";

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Shield, 
  Trash2, 
  Pencil, 
  CheckSquare, 
  Square, 
  Eye, 
  EyeOff,
  Building2,
  Users,
  KeyRound,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';

// ==========================================================================
// FUNÇÕES DE SEGURANÇA AVANÇADA
// ==========================================================================
// Função para criar um hash forte da senha (SHA-256) com Salt
const encryptPassword = async (password: string) => {
  const encoder = new TextEncoder();
  // Um salt adiciona uma camada extra de imprevisibilidade ao hash
  const data = encoder.encode(password + "ZAPFLOW_SECURE_SALT_2026_X9#!");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// ==========================================================================
// TIPAGENS
// ==========================================================================
interface Department {
  id: string;
  name: string;
  company: string;
}

interface PermissionProfile {
  id: string;
  name: string;
  menus: {
    dashboard: boolean;
    chats: boolean;
    contacts: boolean;
    broadcasts: boolean;
    reports: boolean;
    settings: boolean;
    quickAnswers: boolean;
    connections: boolean;
    automations: boolean;
    management: boolean;
    resetBroadcastLimit: boolean; // NOVA PERMISSÃO
  };
}

interface User {
  id: string;
  name: string;
  displayName: string; 
  email: string;
  password?: string;
  departmentId: string;
  profileId: string;
  status: 'Ativo' | 'Offline';
}

const UsersPage = () => {
  const CURRENT_SESSION_ID = '1'; // Simulando que o Admin Master está logado

  // ==========================================================================
  // ESTADOS GERAIS E TEMA
  // ==========================================================================
  const [activeTab, setActiveTab] = useState<'equipe' | 'departamentos' | 'perfis'>('equipe');
  const [search, setSearch] = useState('');
  const [isLoaded, setIsLoaded] = useState(false); // Controle para evitar hidratação incorreta
  const [isDark, setIsDark] = useState(false);

  // LÓGICA DE TEMA AUTOMÁTICO FORÇADO NO ROOT E SINCRONIZADO
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

    // Aplica no momento em que a página/efeito carrega
    applyTheme(mediaQuery.matches);

    // Fica escutando caso o usuário mude o tema do SO
    const handler = (e: MediaQueryListEvent | MediaQueryList) => applyTheme(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // ==========================================================================
  // BANCO DE DADOS MOCKADO (ESTADOS COM LOCAL STORAGE)
  // ==========================================================================
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // CARREGAMENTO INICIAL DO LOCALSTORAGE
  useEffect(() => {
    const savedDepts = localStorage.getItem('zapflow_mock_departments');
    if (savedDepts) {
      setDepartments(JSON.parse(savedDepts));
    } else {
      setDepartments([
        { id: '1', name: 'Comercial', company: 'ConversaUp' },
        { id: '2', name: 'Suporte Técnico', company: 'ConversaUp' },
      ]);
    }

    const savedProfiles = localStorage.getItem('zapflow_mock_profiles');
    if (savedProfiles) {
      setProfiles(JSON.parse(savedProfiles));
    } else {
      setProfiles([
        { 
          id: '1', 
          name: 'Administrador Master', 
          menus: { dashboard: true, chats: true, contacts: true, broadcasts: true, reports: true, settings: true, quickAnswers: true, connections: true, automations: true, management: true, resetBroadcastLimit: true } 
        },
        { 
          id: '2', 
          name: 'Agente de Vendas', 
          menus: { dashboard: false, chats: true, contacts: true, broadcasts: false, reports: false, settings: false, quickAnswers: true, connections: false, automations: false, management: false, resetBroadcastLimit: false } 
        },
      ]);
    }

    const savedUsers = localStorage.getItem('zapflow_mock_users');
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    } else {
      setUsers([
        { id: '1', name: 'Admin Master', displayName: 'Suporte Master', email: 'admin@conversaup.com', departmentId: '2', profileId: '1', status: 'Ativo', password: 'hashed_password_mock' },
        { id: '2', name: 'Ricardo Silva', displayName: 'Ricardo', email: 'ricardo@conversaup.com', departmentId: '1', profileId: '2', status: 'Ativo', password: 'hashed_password_mock' },
      ]);
    }

    setIsLoaded(true);
  }, []);

  // SINCRONIZAÇÃO CONSTANTE COM O LOCALSTORAGE (SALVAMENTO AUTOMÁTICO)
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('zapflow_mock_departments', JSON.stringify(departments));
      localStorage.setItem('zapflow_mock_profiles', JSON.stringify(profiles));
      localStorage.setItem('zapflow_mock_users', JSON.stringify(users));

      // Garante que o usuário logado tem seu display name sincronizado se for alterado
      const currentUser = users.find(u => u.id === CURRENT_SESSION_ID);
      if (currentUser) {
        localStorage.setItem('user_display_name', currentUser.displayName);
        
        // Garante que as permissões do perfil atual do usuário logado estejam ativas no sistema
        const currentUserProfile = profiles.find(p => p.id === currentUser.profileId);
        if (currentUserProfile) {
          localStorage.setItem('user_permissions', JSON.stringify(currentUserProfile.menus));
          window.dispatchEvent(new Event('permissions_updated'));
        }
      }
    }
  }, [departments, profiles, users, isLoaded]);

  // ==========================================================================
  // CONTROLES DE MODAIS E FORMULÁRIOS
  // ==========================================================================
  
  // EQUIPE
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', displayName: '', email: '', password: '', departmentId: '', profileId: '' });

  // DEPARTAMENTOS
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', company: '' });

  // PERFIS
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const defaultMenus = { dashboard: false, chats: false, contacts: false, broadcasts: false, reports: false, settings: false, quickAnswers: false, connections: false, automations: false, management: false, resetBroadcastLimit: false };
  const [profileForm, setProfileForm] = useState({ name: '', menus: { ...defaultMenus } });

  // ==========================================================================
  // FUNÇÕES: EQUIPE
  // ==========================================================================
  const handleOpenUserCreate = () => {
    setEditingUserId(null);
    setUserForm({ name: '', displayName: '', email: '', password: '', departmentId: departments[0]?.id || '', profileId: profiles[0]?.id || '' });
    setIsUserModalOpen(true);
  };

  const handleOpenUserEdit = (user: User) => {
    setEditingUserId(user.id);
    setUserForm({ name: user.name, displayName: user.displayName, email: user.email, password: '', departmentId: user.departmentId, profileId: user.profileId });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.displayName || !userForm.departmentId || !userForm.profileId) {
      return toast.error("Preencha todos os campos obrigatórios.");
    }
    if (!editingUserId && !userForm.password) {
        return toast.error("Defina uma senha para o novo membro.");
    }

    let finalPassword = undefined;
    if (userForm.password) {
      finalPassword = await encryptPassword(userForm.password); // Aplica a criptografia
    }

    if (editingUserId) {
      setUsers(prev => prev.map(u => u.id === editingUserId ? { ...u, ...userForm, password: finalPassword || u.password } : u));
      toast.success("Membro atualizado com segurança!");
    } else {
      const newUser: User = { id: Date.now().toString(), ...userForm, password: finalPassword, status: 'Ativo' };
      setUsers(prev => [...prev, newUser]);
      toast.success("Membro adicionado com senha criptografada!");
    }
    setIsUserModalOpen(false);
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    const profile = profiles.find(p => p.id === user?.profileId);
    if (profile?.name === 'Administrador Master' && users.filter(u => u.profileId === profile.id).length === 1) {
      return toast.error("Impossível remover o último Administrador Master.");
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    toast.success("Membro removido.");
  };

  // ==========================================================================
  // FUNÇÕES: DEPARTAMENTOS
  // ==========================================================================
  const handleOpenDeptCreate = () => {
    setEditingDeptId(null);
    setDeptForm({ name: '', company: '' });
    setIsDeptModalOpen(true);
  };

  const handleOpenDeptEdit = (dept: Department) => {
    setEditingDeptId(dept.id);
    setDeptForm({ name: dept.name, company: dept.company });
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = () => {
    if (!deptForm.name || !deptForm.company) return toast.error("Preencha todos os campos.");
    
    if (editingDeptId) {
      setDepartments(prev => prev.map(d => d.id === editingDeptId ? { ...d, ...deptForm } : d));
      toast.success("Departamento atualizado!");
    } else {
      setDepartments(prev => [...prev, { id: Date.now().toString(), ...deptForm }]);
      toast.success("Departamento adicionado!");
    }
    setIsDeptModalOpen(false);
  };

  const handleDeleteDept = (id: string) => {
    if (users.some(u => u.departmentId === id)) return toast.error("Não é possível remover um departamento em uso.");
    setDepartments(prev => prev.filter(d => d.id !== id));
    toast.success("Departamento removido.");
  };

  // ==========================================================================
  // FUNÇÕES: PERFIS E PERMISSÕES EM TEMPO REAL
  // ==========================================================================
  const handleOpenProfileCreate = () => {
    setEditingProfileId(null);
    setProfileForm({ name: '', menus: { ...defaultMenus } });
    setIsProfileModalOpen(true);
  };

  const handleOpenProfileEdit = (profile: PermissionProfile) => {
    setEditingProfileId(profile.id);
    setProfileForm({ name: profile.name, menus: { ...profile.menus } });
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = () => {
    if (!profileForm.name) return toast.error("Preencha o nome do perfil.");
    
    if (editingProfileId) {
      setProfiles(prev => prev.map(p => p.id === editingProfileId ? { ...p, ...profileForm } : p));
      toast.success("Perfil atualizado!");
    } else {
      setProfiles(prev => [...prev, { id: Date.now().toString(), ...profileForm }]);
      toast.success("Perfil adicionado!");
    }
    setIsProfileModalOpen(false);
  };

  const handleDeleteProfile = (id: string) => {
    if (users.some(u => u.profileId === id)) return toast.error("Não é possível remover um perfil em uso.");
    setProfiles(prev => prev.filter(p => p.id !== id));
    toast.success("Perfil removido.");
  };

  const toggleMenuPermission = (menuKey: keyof typeof profileForm.menus) => {
    setProfileForm(prev => ({ ...prev, menus: { ...prev.menus, [menuKey]: !prev.menus[menuKey] } }));
  };

  // Previne a renderização incompleta durante a hidratação no Next.js
  if (!isLoaded) return null;

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================
  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
          
          {/* CABEÇALHO */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações</h1>
              <p className="text-slate-500 dark:text-slate-400">Gerencie sua equipe, departamentos e defina regras de acesso restrito.</p>
            </div>

            {activeTab === 'equipe' && (
              <button onClick={handleOpenUserCreate} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 w-full md:w-auto justify-center">
                <Plus size={20} /> Adicionar Membro
              </button>
            )}
            {activeTab === 'departamentos' && (
              <button onClick={handleOpenDeptCreate} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 w-full md:w-auto justify-center">
                <Plus size={20} /> Novo Departamento
              </button>
            )}
            {activeTab === 'perfis' && (
              <button onClick={handleOpenProfileCreate} className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 w-full md:w-auto justify-center">
                <Plus size={20} /> Criar Perfil
              </button>
            )}
          </div>

          {/* ABAS DE NAVEGAÇÃO */}
          <div className="flex space-x-6 border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto custom-scrollbar">
            <button onClick={() => setActiveTab('equipe')} className={cn("pb-3 flex items-center gap-2 font-bold whitespace-nowrap transition-colors relative", activeTab === 'equipe' ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}>
              <Users size={18} /> Equipe
              {activeTab === 'equipe' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full" />}
            </button>
            <button onClick={() => setActiveTab('departamentos')} className={cn("pb-3 flex items-center gap-2 font-bold whitespace-nowrap transition-colors relative", activeTab === 'departamentos' ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}>
              <Building2 size={18} /> Departamentos
              {activeTab === 'departamentos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
            </button>
            <button onClick={() => setActiveTab('perfis')} className={cn("pb-3 flex items-center gap-2 font-bold whitespace-nowrap transition-colors relative", activeTab === 'perfis' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}>
              <KeyRound size={18} /> Perfis de Permissões
              {activeTab === 'perfis' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />}
            </button>
          </div>

          {/* CONTAINER PRINCIPAL */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors">
            
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 transition-colors">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" />
              </div>
            </div>

            <div className="overflow-x-auto">
              
              {/* TABELA: EQUIPE */}
              {activeTab === 'equipe' && (
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="text-left text-xs font-bold text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
                      <th className="px-6 py-4">Membro</th>
                      <th className="px-6 py-4">Departamento</th>
                      <th className="px-6 py-4">Perfil de Acesso</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())).map((user) => {
                      const dept = departments.find(d => d.id === user.departmentId);
                      const profile = profiles.find(p => p.id === user.profileId);
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-100 dark:border-emerald-500/30 flex-shrink-0">{user.name.charAt(0)}</div>
                              <div className="flex flex-col min-w-0">
                                <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate">Exibição: {user.displayName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                              <Building2 size={16} className="text-slate-400 dark:text-slate-500" />
                              <span className="text-sm font-medium">{dept?.name || '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Shield size={16} className={profile?.name.includes('Master') ? "text-amber-500 dark:text-amber-400" : "text-indigo-400 dark:text-indigo-400"} />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{profile?.name || '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase", user.status === 'Ativo' ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400")}>{user.status}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenUserEdit(user)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg hover:border-blue-200 dark:hover:border-blue-500/30 transition-all shadow-sm"><Pencil size={16} /></button>
                                <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg hover:border-rose-200 dark:hover:border-rose-500/30 transition-all shadow-sm"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* TABELA: DEPARTAMENTOS */}
              {activeTab === 'departamentos' && (
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="text-left text-xs font-bold text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
                      <th className="px-6 py-4">Nome do Departamento</th>
                      <th className="px-6 py-4">Empresa</th>
                      <th className="px-6 py-4">Membros Vinculados</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {departments.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.company.toLowerCase().includes(search.toLowerCase())).map((dept) => {
                      const linkedUsers = users.filter(u => u.departmentId === dept.id).length;
                      return (
                        <tr key={dept.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{dept.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{dept.company}</td>
                          <td className="px-6 py-4">
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold px-2.5 py-1 rounded-full">{linkedUsers} membro(s)</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenDeptEdit(dept)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg hover:border-blue-200 dark:hover:border-blue-500/30 transition-all shadow-sm"><Pencil size={16} /></button>
                                <button onClick={() => handleDeleteDept(dept.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg hover:border-rose-200 dark:hover:border-rose-500/30 transition-all shadow-sm"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* TABELA: PERFIS */}
              {activeTab === 'perfis' && (
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="text-left text-xs font-bold text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
                      <th className="px-6 py-4">Nome do Perfil</th>
                      <th className="px-6 py-4">Módulos Liberados</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {profiles.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((profile) => {
                      const activeMenus = Object.values(profile.menus).filter(Boolean).length;
                      return (
                        <tr key={profile.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <KeyRound className="text-indigo-400 dark:text-indigo-400" size={18} />
                              <span className="font-bold text-slate-900 dark:text-slate-100">{profile.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1 flex-wrap max-w-sm">
                              {profile.menus.dashboard && <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/20">Dashboard</span>}
                              {profile.menus.chats && <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/20">Atendimentos</span>}
                              {profile.menus.contacts && <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/20">Contatos</span>}
                              {profile.menus.broadcasts && <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/20">Disparos</span>}
                              {profile.menus.reports && <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/20">Relatórios</span>}
                              {profile.menus.settings && <span className="text-[10px] bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded border border-amber-100 dark:border-amber-500/20">Configurações</span>}
                              {profile.menus.quickAnswers && <span className="text-[10px] bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold px-2 py-0.5 rounded border border-sky-100 dark:border-sky-500/20">Respostas Rápidas</span>}
                              {profile.menus.connections && <span className="text-[10px] bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold px-2 py-0.5 rounded border border-purple-100 dark:border-purple-500/20">Conexões</span>}
                              {profile.menus.management && <span className="text-[10px] bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold px-2 py-0.5 rounded border border-orange-100 dark:border-orange-500/20">Gestão</span>}
                              {profile.menus.automations && <span className="text-[10px] bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded border border-rose-100 dark:border-rose-500/20">Automação</span>}
                              {profile.menus.resetBroadcastLimit && <span className="text-[10px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold px-2 py-0.5 rounded border border-red-100 dark:border-red-500/20">Zerar Limites</span>}
                              
                              {activeMenus === 0 && <span className="text-xs text-slate-400 dark:text-slate-500 italic">Nenhum módulo</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenProfileEdit(profile)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg hover:border-blue-200 dark:hover:border-blue-500/30 transition-all shadow-sm"><Pencil size={16} /></button>
                                <button onClick={() => handleDeleteProfile(profile.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg hover:border-rose-200 dark:hover:border-rose-500/30 transition-all shadow-sm"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* MODAIS (Tags HTML nativas com Tailwind - Evita erros de importação) */}
        {/* ===================================================================== */}
        
        {/* MODAL: EQUIPE */}
        {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in transition-colors">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-800 transition-colors">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 transition-colors">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{editingUserId ? 'Editar Membro' : 'Novo Membro da Equipe'}</h2>
                <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20}/></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none block mb-1.5">Nome Completo *</label>
                        <input className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" value={userForm.name} onChange={(e: any) => setUserForm({...userForm, name: e.target.value})} placeholder="Ex: João Silva" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none block mb-1.5">Nome de Exibição *</label>
                        <input className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" value={userForm.displayName} onChange={(e: any) => setUserForm({...userForm, displayName: e.target.value})} placeholder="Ex: João" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none block mb-1.5">E-mail *</label>
                        <input type="email" className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" value={userForm.email} onChange={(e: any) => setUserForm({...userForm, email: e.target.value})} placeholder="joao@empresa.com" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none block mb-1.5">Senha Segura {editingUserId ? '(Opcional)' : '*'}</label>
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-10" value={userForm.password} onChange={(e: any) => setUserForm({...userForm, password: e.target.value})} placeholder={editingUserId ? "Nova senha" : "Defina a senha"} />
                            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                                {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Sua senha será criptografada ponta a ponta antes de salvar.</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none block mb-1.5">Departamento *</label>
                    <select value={userForm.departmentId} onChange={(e) => setUserForm({...userForm, departmentId: e.target.value})} className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-all">
                      <option value="" disabled>Selecione...</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none block mb-1.5">Perfil de Permissão *</label>
                    <select value={userForm.profileId} onChange={(e) => setUserForm({...userForm, profileId: e.target.value})} className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-all">
                      <option value="" disabled>Selecione...</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 transition-colors">
                <button type="button" className="px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" onClick={() => setIsUserModalOpen(false)}>Cancelar</button>
                <button type="button" className="px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg flex items-center gap-2" onClick={handleSaveUser}>
                  <Shield size={16} />
                  {editingUserId ? 'Salvar Alterações Seguras' : 'Adicionar Membro'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DEPARTAMENTO */}
        {isDeptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in transition-colors">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 transition-colors">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{editingDeptId ? 'Editar Departamento' : 'Novo Departamento'}</h2>
                <button onClick={() => setIsDeptModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none block mb-1.5">Nome do Departamento *</label>
                      <input className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" value={deptForm.name} onChange={(e: any) => setDeptForm({...deptForm, name: e.target.value})} placeholder="Ex: Suporte Financeiro" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none block mb-1.5">Empresa Associada *</label>
                      <input className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" value={deptForm.company} onChange={(e: any) => setDeptForm({...deptForm, company: e.target.value})} placeholder="Ex: Matriz LTDA" />
                  </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 transition-colors">
                <button type="button" className="px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" onClick={() => setIsDeptModalOpen(false)}>Cancelar</button>
                <button type="button" className="px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50 bg-blue-500 hover:bg-blue-600 text-white shadow-lg" onClick={handleSaveDept}>Salvar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: PERFIL DE PERMISSÃO */}
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in transition-colors">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-800 transition-colors">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 transition-colors">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{editingProfileId ? 'Editar Perfil' : 'Novo Perfil de Permissão'}</h2>
                <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={20}/></button>
              </div>
              <div className="p-6 overflow-y-auto">
                  <div className="space-y-1.5 mb-6">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-none block mb-1.5">Nome do Perfil *</label>
                      <input className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" value={profileForm.name} onChange={(e: any) => setProfileForm({...profileForm, name: e.target.value})} placeholder="Ex: Supervisor de Atendimento" />
                  </div>
                  
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">
                    <label className="text-indigo-600 dark:text-indigo-400 text-sm font-bold">Módulos Liberados no Sistema</label>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded font-bold">As alterações entram em vigor em tempo real.</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'dashboard', label: 'Dashboard Operacional', desc: 'Acesso a métricas gerais e gráficos.' },
                      { key: 'chats', label: 'Atendimentos (Chat)', desc: 'Permite responder e gerenciar conversas.' },
                      { key: 'contacts', label: 'Base de Contatos', desc: 'Visualização e gestão da agenda de clientes.' },
                      { key: 'broadcasts', label: 'Disparos em Massa', desc: 'Acesso à criação e envio de campanhas.' },
                      { key: 'reports', label: 'Relatórios', desc: 'Exportação e análise de dados profundos.' },
                      { key: 'quickAnswers', label: 'Respostas Rápidas', desc: 'Gestão de mensagens prontas e atalhos.' },
                      { key: 'management', label: 'Gestão', desc: 'Acompanhamento gerencial e auditoria da equipe.' },
                      { key: 'connections', label: 'Conexões', desc: 'Controle de instâncias e QR Codes.' },
                      { key: 'automations', label: 'Automação (Bot)', desc: 'Criação de fluxos e respostas de Chatbot.' },
                      { key: 'settings', label: 'Configurações (Admin)', desc: 'Gestão de equipe, departamentos e acessos.' },
                      { key: 'resetBroadcastLimit', label: 'Zerar Limite de Disparos', desc: 'Habilita o botão que zera o contador diário de envios.' } // NOVA PERMISSÃO AQUI!
                    ].map(module => (
                      <div key={module.key} onClick={() => toggleMenuPermission(module.key as any)} className={cn("flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all", profileForm.menus[module.key as keyof typeof profileForm.menus] ? "border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50")}>
                          <div className="pt-0.5">
                            {profileForm.menus[module.key as keyof typeof profileForm.menus] ? <CheckSquare className="text-indigo-600 dark:text-indigo-400" size={20}/> : <Square className="text-slate-300 dark:text-slate-600" size={20}/>}
                          </div>
                          <div className="flex flex-col">
                              <span className={cn("text-sm font-bold", profileForm.menus[module.key as keyof typeof profileForm.menus] ? "text-indigo-900 dark:text-indigo-200" : "text-slate-700 dark:text-slate-300")}>{module.label}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{module.desc}</span>
                          </div>
                      </div>
                    ))}
                  </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 transition-colors">
                <button type="button" className="px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" onClick={() => setIsProfileModalOpen(false)}>Cancelar</button>
                <button type="button" className="px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50 bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg" onClick={handleSaveProfile}>Salvar Perfil</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default UsersPage;