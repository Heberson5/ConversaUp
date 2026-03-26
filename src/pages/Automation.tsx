"use client";

import React, { useState, useCallback, useEffect, useRef, ErrorInfo, ReactNode } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  MiniMap, 
  applyEdgeChanges, 
  applyNodeChanges,
  Node, 
  Edge, 
  Connection as ReactFlowConnection,
  Panel,
  Handle,
  Position,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Plus, Save, Bot, Settings2, Trash2, ChevronRight, Users, List, 
  X, Power, Phone, ToggleLeft, ToggleRight, Smartphone, AlertCircle,
  ArrowLeft, CheckCircle2, Loader2, AlertTriangle, Workflow, PlayCircle,
  Undo2, Home, Calendar, Clock, Zap, MessageSquare, Tag, Brain,
  ExternalLink, RefreshCw, Copy, Filter, Database, GitBranch, Layers,
  Send, Bold, Italic, Strikethrough, Code, Quote, Image as ImageIcon,
  Mic, FileText, Smile, ChevronDown, ChevronUp, Sparkles,
  Pencil, Eye, Mail, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { io } from 'socket.io-client';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

interface WhatsAppConnection {
  id: string;
  name: string;
  phone?: string;
  status: string;
  enabled: boolean;
  color: string;
}

interface User {
  id: string;
  name: string;
  displayName: string;
  email: string;
  departmentId: string;
  profileId: string;
  status: string;
}

interface FlowData {
  id: string;
  name: string;
  isActive: boolean;
  nodes: Node[];
  edges: Edge[];
  updatedAt: number;
}

type NodeStatus = 'idle' | 'running' | 'success' | 'error';

interface DisparoRule {
  id: string;
  name: string;
  enabled: boolean;
  connectionId: string;
  assignedUserId: string;   // mantido para retrocompatibilidade
  assignedUserIds: string[]; // múltiplos agentes
  tagName: string;
  tagColor: string;
  messageTemplate: string;
  frequencyDays: number;
  customDays?: number;
  sendTime: string;         // horário padrão de envio "HH:MM" (ex: "09:00")
  weekDays: number[];       // dias da semana permitidos: 0=Dom,1=Seg,...,6=Sáb
  useAI: boolean;
  aiModel: 'deepseek' | 'gpt' | 'gemini' | 'none';
  lastRun?: number;
  scheduledQueue?: string[]; // chatIds agendados para o próximo disparo
}

interface AIConfig {
  enabled: boolean;
  defaultModel: 'deepseek' | 'gpt' | 'gemini';
  deepseekApiKey: string;
  openAiApiKey: string;
  geminiApiKey: string;
  systemPrompt: string;
}

interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  preview?: string;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

const fetchConnections = async (): Promise<WhatsAppConnection[]> => {
  try {
    const res = await fetch('http://localhost:3001/api/connections');
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar conexões:', error);
    return [];
  }
};

const getUsers = (): User[] => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('zapflow_mock_users');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
  return [
    { id: '1', name: 'Admin Master', displayName: 'Suporte Master', email: 'admin@conversaup.com', departmentId: '2', profileId: '1', status: 'Ativo' },
    { id: '2', name: 'Ricardo Silva', displayName: 'Ricardo', email: 'ricardo@conversaup.com', departmentId: '1', profileId: '2', status: 'Ativo' },
  ];
};

// Gera ID único robusto (não depende de Date.now sozinho)
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

// ============================================================================
// ERROR BOUNDARY
// ============================================================================
class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Erro no Automation:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl text-center max-w-md">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Ops! Algo deu errado</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Ocorreu um erro interno. Por favor, recarregue a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// COMPONENTES DE NÓS
// ============================================================================

const RootNode = ({ id, data, selected }: any) => {
  const isActive = data.isActive !== false;
  const selectedConnectionIds = data.selectedConnectionIds || [];
  const assignedUserIds = data.assignedUserIds || [];
  const allConnections = data.allConnections || [];
  const allUsers = data.allUsers || [];
  const connections = allConnections.filter((c: WhatsAppConnection) => selectedConnectionIds.includes(c.id));
  const users = allUsers.filter((u: User) => assignedUserIds.includes(u.id));
  const hasClosingMessage = data.closingMessage && data.closingMessage.trim() !== '';

  return (
    <div className={cn(
      "shadow-xl rounded-xl min-w-[300px] transition-all relative group bg-white dark:bg-slate-800 border-t-4",
      selected ? "ring-4 ring-indigo-500/20 border-x border-b border-indigo-500 border-t-indigo-600" : "border border-slate-200 dark:border-slate-700 border-t-indigo-500",
      !isActive && "opacity-60 grayscale"
    )}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", isActive ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500")}>
              <Bot size={16} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Início do Fluxo</span>
          </div>
          <div className="flex items-center gap-1">
            {!isActive && <span className="text-[9px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-500/30">Pausado</span>}
            <button 
              onClick={(e) => { e.stopPropagation(); if (data.onAddSubmenu) data.onAddSubmenu(id); }}
              className="p-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-md hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-500 transition-all opacity-0 group-hover:opacity-100"
              title="Adicionar novo bloco"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        
        <div className="font-bold text-base mb-2 truncate text-slate-800 dark:text-slate-100">{data.label || 'Saudação Inicial'}</div>
        
        <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="text-[10px] flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            <Smartphone size={12} className={isActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400"} />
            <span className="truncate">
              {selectedConnectionIds.length === 0 && 'Nenhuma conexão selecionada'}
              {connections.length > 0 && `${connections.length} conexão(ões)`}
            </span>
          </div>
          <div className="text-[10px] flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            <Users size={12} className="text-emerald-500" />
            <span className="truncate">{users.length} agente(s) vinculado(s)</span>
          </div>
          {hasClosingMessage && (
            <div className="text-[10px] flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
              <Mail size={12} className="text-amber-500" />
              <span className="truncate">Mensagem de encerramento configurada</span>
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500 border-2 border-white dark:border-slate-800" />
    </div>
  );
};

const MenuNode = ({ id, data, selected }: any) => {
  const isActive = data.isActive !== false;
  const hasTransfer = data.connectionId && data.connectionId !== 'inherit';
  const connections = data.allConnections || [];
  const allUsers = data.allUsers || [];
  const assignedUserIds = data.assignedUserIds || [];
  const connectionName = hasTransfer ? connections.find((c: WhatsAppConnection) => c.id === data.connectionId)?.name : 'Mesma Conexão';
  const users = allUsers.filter((u: User) => assignedUserIds.includes(u.id));
  const options = data.options || [];
  const allowBack = data.allowBack || false;
  const allowHome = data.allowHome || false;
  const hasClosingMessage = data.closingMessage && data.closingMessage.trim() !== '';

  return (
    <div className={cn(
      "shadow-xl rounded-xl min-w-[300px] transition-all relative group bg-white dark:bg-slate-800 border-t-4",
      selected ? "ring-4 ring-emerald-500/20 border-x border-b border-emerald-500 border-t-emerald-500" : "border border-slate-200 dark:border-slate-700 border-t-emerald-400",
      !isActive && "opacity-60 grayscale bg-slate-50 dark:bg-slate-800/50"
    )}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800" />
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", isActive ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500")}>
              <List size={14} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Menu de Opções</span>
          </div>
          
          <div className="flex items-center gap-1">
            {!isActive && <span className="text-[9px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-500/30 mr-1">Inativo</span>}
            <button 
              onClick={(e) => { e.stopPropagation(); if (data.onAddSubmenu) data.onAddSubmenu(id); }}
              className="p-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-md hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 transition-all opacity-0 group-hover:opacity-100"
              title="Conectar novo caminho"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        
        <div className={cn("font-bold text-base mb-3 truncate", isActive ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-500 line-through")}>
          {data.label || 'Título do Menu'}
        </div>

        {(options.length > 0 || allowBack || allowHome) && (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700 p-2.5 mb-3 space-y-1.5">
            <div className="text-[9px] font-bold text-slate-400 uppercase mb-2">Opções para o cliente:</div>
            
            {options.map((opt: any, idx: number) => (
              <div key={idx} className="text-[11px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 w-5 h-5 rounded flex items-center justify-center font-bold text-[10px]">{idx + 1}</span>
                <span className="truncate">{opt.title}</span>
                {opt.agentId && (
                  <span className="ml-auto text-[9px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">
                    {data.allUsers?.find((u: User) => u.id === opt.agentId)?.displayName || 'Agente'}
                  </span>
                )}
              </div>
            ))}

            {allowBack && (
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 w-5 h-5 rounded flex items-center justify-center font-bold text-[10px]"><Undo2 size={10}/></span>
                <span className="truncate">Voltar ao menu anterior (0)</span>
              </div>
            )}
            
            {allowHome && (
              <div className="text-[11px] font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 w-5 h-5 rounded flex items-center justify-center font-bold text-[10px]"><Home size={10}/></span>
                <span className="truncate">Voltar ao início (#)</span>
              </div>
            )}
          </div>
        )}
        
        <div className="flex flex-col gap-2 mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
          <div className="flex items-center justify-between">
            <div className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
              <Users size={12} />
              {users.length} agente(s) vinculado(s)
            </div>
            {hasClosingMessage && <div className="w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_5px_rgba(245,158,11,0.5)]" title="Mensagem de encerramento configurada" />}
          </div>
          
          {hasTransfer && (
            <div className="text-[9px] flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-2 py-1.5 rounded border border-indigo-100 dark:border-indigo-500/20 mt-1 font-medium">
              <Phone size={10} />
              <span className="truncate max-w-[200px]">Transbordo: {connectionName}</span>
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800" />
    </div>
  );
};

const nodeTypes = {
  menuNode: MenuNode,
  rootNode: RootNode,
};

const STORAGE_KEY_FLOWS = 'zapflow_automation_flows';
const STORAGE_KEY_RULES = 'zapflow_disparo_rules';
const STORAGE_KEY_AI_CONFIG = 'zapflow_ai_config';
const STORAGE_KEY_RULE_RUNS = 'zapflow_rule_runs'; // { "ruleId_chatId": timestamp }
const STORAGE_KEY_AGENT_ASSIGNMENTS = 'chat_agent_assignments'; // { chatId: agentId }
const socket = io('http://localhost:3001');

// ============================================================================
// COMPONENTE PRINCIPAL (com ErrorBoundary)
// ============================================================================
const AutomationInner = () => {
  const [isDark, setIsDark] = useState(false);

  // Fluxos
  const [flows, setFlows] = useState<FlowData[]>([]);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);

  // Canvas
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [currentFlowName, setCurrentFlowName] = useState('Novo Fluxo');
  const [isCurrentFlowActive, setIsCurrentFlowActive] = useState(true);

  // Dados externos
  const [allConnections, setAllConnections] = useState<WhatsAppConnection[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<any[]>([]);

  // Regras de disparo
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [rules, setRules] = useState<DisparoRule[]>([]);
  const [editingRule, setEditingRule] = useState<DisparoRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<DisparoRule>>({
    name: '',
    enabled: true,
    connectionId: '',
    assignedUserId: '',
    assignedUserIds: [],
    tagName: '',
    tagColor: '#10b981',
    messageTemplate: '',
    frequencyDays: 30,
    customDays: undefined,
    sendTime: '09:00',
    weekDays: [1, 2, 3, 4, 5], // Seg–Sex por padrão
    useAI: false,
    aiModel: 'none'
  });

  // Configurações de IA
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [aiConfig, setAIConfig] = useState<AIConfig>({
    enabled: false,
    defaultModel: 'gpt',
    deepseekApiKey: '',
    openAiApiKey: '',
    geminiApiKey: '',
    systemPrompt: 'Você é um assistente de vendas. Use as últimas 10 mensagens do cliente para gerar uma mensagem personalizada e amigável, lembrando-o do contato e oferecendo ajuda. Inclua o nome do cliente e a data da última conversa.'
  });

  // Templates
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [flowTemplates, setFlowTemplates] = useState<FlowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null);

  // Simulação
  const [isSimulating, setIsSimulating] = useState(false);

  // Referências
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<{start: number, end: number} | null>(null);

  // Seletor de agentes (dropdown suspensa)
  const [agentSearch, setAgentSearch] = useState('');
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // TEMA
  // ==========================================================================
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

  // ==========================================================================
  // CARREGAR DADOS
  // ==========================================================================
  useEffect(() => {
    const savedFlows = localStorage.getItem(STORAGE_KEY_FLOWS);
    if (savedFlows) {
      try { setFlows(JSON.parse(savedFlows)); } catch (e) { console.error(e); }
    }

    const savedRules = localStorage.getItem(STORAGE_KEY_RULES);
    if (savedRules) {
      try { setRules(JSON.parse(savedRules)); } catch (e) { console.error(e); }
    }

    const savedAi = localStorage.getItem(STORAGE_KEY_AI_CONFIG);
    if (savedAi) {
      try { setAIConfig(JSON.parse(savedAi)); } catch (e) { console.error(e); }
    }

    fetchConnections().then(conns => setAllConnections(conns));
    setAllUsers(getUsers());

    const handleChats = (data: any[]) => { setChats(data); };
    socket.on('chats', handleChats);
    if (socket.connected) socket.emit('get_chats', { limit: 100 });
    else socket.once('connect', () => socket.emit('get_chats', { limit: 100 }));

    setFlowTemplates([
      {
        id: 'template1',
        name: 'Atendimento Comercial',
        description: 'Fluxo básico para atendimento comercial com menu de opções',
        nodes: [
          { id: 'root', type: 'rootNode', data: { label: 'Bem-vindo! Como posso ajudar?', isActive: true, selectedConnectionIds: [], assignedUserIds: [] }, position: { x: 250, y: 50 } },
          { id: 'menu1', type: 'menuNode', data: { label: 'Escolha uma opção', options: [{ title: 'Comprar' }, { title: 'Suporte' }], allowBack: false, allowHome: false, isActive: true, assignedUserIds: [] }, position: { x: 250, y: 300 } }
        ],
        edges: [{ id: 'e_root_menu1', source: 'root', target: 'menu1', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#94a3b8', strokeWidth: 2 } }],
        preview: '→ Saudação → Menu com opções (Comprar, Suporte)'
      },
      {
        id: 'template2',
        name: 'Suporte Técnico Avançado',
        description: 'Fluxo com transferência para setor técnico',
        nodes: [
          { id: 'root', type: 'rootNode', data: { label: 'Olá! Em que podemos ajudar?', isActive: true, selectedConnectionIds: [], assignedUserIds: [] }, position: { x: 250, y: 50 } },
          { id: 'menu1', type: 'menuNode', data: { label: 'Selecione o problema', options: [{ title: 'Não consigo acessar' }, { title: 'Erro no sistema' }], allowBack: false, allowHome: true, isActive: true, assignedUserIds: [] }, position: { x: 250, y: 300 } }
        ],
        edges: [],
        preview: '→ Saudação → Menu com opções de problemas → Voltar ao início'
      },
      {
        id: 'template3',
        name: 'Atendimento com Agentes Específicos',
        description: 'Cada opção do menu é direcionada a um agente diferente',
        nodes: [
          { id: 'root', type: 'rootNode', data: { label: 'Olá! Escolha o departamento', isActive: true, selectedConnectionIds: [], assignedUserIds: [] }, position: { x: 250, y: 50 } },
          { id: 'menu1', type: 'menuNode', data: { label: 'Departamentos', options: [{ title: 'Vendas', agentId: '2' }, { title: 'Suporte', agentId: '1' }], allowBack: false, allowHome: true, isActive: true, assignedUserIds: [] }, position: { x: 250, y: 300 } }
        ],
        edges: [],
        preview: '→ Saudação → Menu com opções de departamentos (cada um com agente específico)'
      }
    ]);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules)); } catch (err) { console.error(err); }
  }, [rules]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(aiConfig)); } catch (err) { console.error(err); }
  }, [aiConfig]);

  // ==========================================================================
  // FUNÇÕES DO CANVAS
  // ==========================================================================
  const addMenuOption = useCallback((parentId?: string) => {
    const id = `menu_${Date.now()}`;
    
    setNodes((nds) => {
      const parentNode = parentId ? nds.find(n => n.id === parentId) : null;
      const newNode: Node = {
        id,
        type: 'menuNode',
        data: { 
          label: 'Novo Menu', 
          agents: [], 
          options: [], 
          allowBack: false,
          allowHome: false,
          closingMessage: '',
          isActive: true,
          connectionId: 'inherit',
          assignedUserIds: [],
          allConnections: allConnections,
          allUsers: allUsers,
          onAddSubmenu: addMenuOption
        },
        position: { 
          x: parentNode ? parentNode.position.x : Math.random() * 400, 
          y: parentNode ? parentNode.position.y + 250 : Math.random() * 400,
        },
      };
      return [...nds, newNode];
    });

    if (parentId) {
      setEdges((eds) => addEdge({ 
        id: `e_${parentId}_${id}`, 
        source: parentId, 
        target: id, 
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: isDark ? '#64748b' : '#94a3b8' },
        style: { stroke: isDark ? '#64748b' : '#94a3b8', strokeWidth: 2 } 
      }, eds));
    }
  }, [isDark, allConnections, allUsers]);

  const handleCreateNewFlow = () => { setShowTemplateModal(true); };

  const handleCreateBlankFlow = () => {
    const newId = `flow_${Date.now()}`;
    const initialNodes = [{
      id: 'root',
      type: 'rootNode',
      data: { 
        label: '🚀 Saudação & Triagem Inicial', 
        welcomeText: 'Olá! Seja bem-vindo ao nosso atendimento.', 
        isActive: true,
        selectedConnectionIds: [],
        assignedUserIds: [],
        allConnections: allConnections,
        allUsers: allUsers,
        onAddSubmenu: addMenuOption,
        closingMessage: ''
      },
      position: { x: 250, y: 50 },
    }];
    
    setCurrentFlowId(newId);
    setCurrentFlowName(`Automação ${flows.length + 1}`);
    setIsCurrentFlowActive(true);
    setNodes(initialNodes);
    setEdges([]);
    setSelectedNodeId(null);
    setShowTemplateModal(false);
  };

  const handleApplyTemplate = (template: FlowTemplate) => {
    setNodes(template.nodes);
    setEdges(template.edges);
    setShowTemplateModal(false);
    const newId = `flow_${Date.now()}`;
    setCurrentFlowId(newId);
    setCurrentFlowName(`${template.name} (copiado)`);
    setIsCurrentFlowActive(true);
    toast.success(`Template "${template.name}" aplicado!`);
  };

  const handleOpenFlow = (flow: FlowData) => {
    setCurrentFlowId(flow.id);
    setCurrentFlowName(flow.name);
    setIsCurrentFlowActive(flow.isActive);
    
    const restoredNodes = flow.nodes.map(n => ({
      ...n,
      data: { 
        ...n.data, 
        onAddSubmenu: addMenuOption,
        allConnections: allConnections,
        allUsers: allUsers,
        status: 'idle', 
        errorMessage: null 
      }
    }));
    
    setNodes(restoredNodes);
    setEdges(flow.edges.map(e => ({ 
      ...e, 
      animated: false, 
      markerEnd: { type: MarkerType.ArrowClosed, color: isDark ? '#64748b' : '#94a3b8' },
      style: { stroke: isDark ? '#64748b' : '#94a3b8', strokeWidth: 2 } 
    })));
    setSelectedNodeId(null);
  };

  const handleSaveFlow = () => {
    if (!currentFlowId) return;

    const cleanNodes = nodes.map(n => ({ ...n, data: { ...n.data, status: 'idle', errorMessage: null } }));

    const updatedFlow: FlowData = {
      id: currentFlowId,
      name: currentFlowName,
      isActive: isCurrentFlowActive,
      nodes: cleanNodes,
      edges,
      updatedAt: Date.now()
    };

    let newFlows = [...flows];
    const existingIndex = newFlows.findIndex(f => f.id === currentFlowId);
    
    if (existingIndex >= 0) {
      newFlows[existingIndex] = updatedFlow;
    } else {
      newFlows.push(updatedFlow);
    }

    setFlows(newFlows);
    try {
      localStorage.setItem(STORAGE_KEY_FLOWS, JSON.stringify(newFlows));
    } catch (err) {
      console.error('Erro ao salvar fluxos:', err);
      toast.error('Não foi possível salvar o fluxo (espaço insuficiente).');
      return;
    }
    
    toast.success("Automação salva com sucesso!");
  };

  const handleDeleteFlow = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Deseja realmente excluir este fluxo de automação?")) {
      const newFlows = flows.filter(f => f.id !== id);
      setFlows(newFlows);
      try { localStorage.setItem(STORAGE_KEY_FLOWS, JSON.stringify(newFlows)); } catch (err) {}
      toast.info("Fluxo removido.");
    }
  };

  const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: ReactFlowConnection) => setEdges((eds) => addEdge({ 
    ...params, 
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: isDark ? '#64748b' : '#94a3b8' },
    style: { stroke: isDark ? '#64748b' : '#94a3b8', strokeWidth: 2 } 
  }, eds)), [isDark]);
  const onNodeClick = (_: any, node: Node) => setSelectedNodeId(node.id);

  const updateNodeData = (id: string, newData: any) => {
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, ...newData } } : node));
  };

  const deleteNode = (id: string) => {
    if (id === 'root') return toast.error("O nó de início não pode ser removido.");
    setNodes((nds) => nds.filter(n => n.id !== id));
    setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
  };

  // ==========================================================================
  // FUNÇÕES AUXILIARES PARA REGRAS
  // ==========================================================================

  // Obtém o ID do agente responsável por um chat
  const getAgentForChat = (chatId: string): string | null => {
    try {
      const assignments = JSON.parse(localStorage.getItem(STORAGE_KEY_AGENT_ASSIGNMENTS) || '{}');
      return assignments[chatId] || null;
    } catch {
      return null;
    }
  };

  // Registra qual agente está atendendo/atendeu um chat (deve ser chamado quando um agente assume)
  const assignAgentToChat = (chatId: string, agentId: string) => {
    try {
      const assignments = JSON.parse(localStorage.getItem(STORAGE_KEY_AGENT_ASSIGNMENTS) || '{}');
      assignments[chatId] = agentId;
      localStorage.setItem(STORAGE_KEY_AGENT_ASSIGNMENTS, JSON.stringify(assignments));
    } catch {}
  };

  const loadChatMessages = (chatId: string, connectionId?: string): Promise<any[]> => {
    return new Promise((resolve) => {
      const key = `chat_messages_${connectionId || 'default'}_${chatId}`;
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          resolve(JSON.parse(stored).slice(-10));
        } else {
          socket.emit("get_chat_messages", { chatId, connectionId, limit: 10 });
          socket.once("chat_messages", (data: any) => {
            if (data.chatId === chatId) resolve(data.messages || []);
            else resolve([]);
          });
          setTimeout(() => resolve([]), 5000);
        }
      } catch (e) { resolve([]); }
    });
  };

  const callAI = async (model: string, apiKey: string, prompt: string): Promise<string> => {
    try {
      if (model === 'gpt') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: prompt }], temperature: 0.7 })
        });
        const data = await res.json();
        return data.choices[0].message.content;
      } else if (model === 'deepseek') {
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }] })
        });
        const data = await res.json();
        return data.choices[0].message.content;
      } else if (model === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        return data.candidates[0].content.parts[0].text;
      }
      return "Erro: modelo não suportado";
    } catch (err) {
      console.error(err);
      return "Erro ao gerar mensagem com IA";
    }
  };

  // Retorna o próximo dia da semana válido (a partir de uma data) para a regra
  const getNextValidDate = (from: Date, weekDays: number[]): Date => {
    if (!weekDays || weekDays.length === 0) return from;
    const result = new Date(from);
    for (let i = 0; i < 7; i++) {
      if (weekDays.includes(result.getDay())) return result;
      result.setDate(result.getDate() + 1);
    }
    return from; // fallback: todos os dias desativados
  };

  const applyRuleToChat = async (rule: DisparoRule, chat: any): Promise<boolean> => {
    // 1. Conexão da regra ativa
    const connection = allConnections.find(c => c.id === rule.connectionId);
    if (!connection || connection.status !== 'connected' || !connection.enabled) return false;

    // 2. Chat tem a tag desta regra
    const tagId = `atag_${(rule.tagName || '').trim().toLowerCase().replace(/\s+/g, '_')}`;
    if (rule.tagName?.trim()) {
      try {
        const chatTagsRaw = localStorage.getItem('chat_tags_assignments') || '{}';
        const chatTagsMap: Record<string, string[]> = JSON.parse(chatTagsRaw);
        const tagsForChat = chatTagsMap[chat.id] || [];
        if (!tagsForChat.includes(tagId)) return false;
      } catch { return false; }
    }

    // 3. Agente responsável pelo chat deve estar na lista de agentes autorizados
    const chatAgentId = getAgentForChat(chat.id);
    if (!chatAgentId || !rule.assignedUserIds.includes(chatAgentId)) {
      // chat sem agente atribuído ou agente não autorizado
      return false;
    }

    // 4. Frequência — dias desde a última mensagem do chat
    const lastMessageTime = chat.timestamp ? new Date(chat.timestamp * 1000) : new Date(0);
    const requiredDays = rule.customDays && rule.customDays > 0 ? rule.customDays : rule.frequencyDays;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastMessageTime.getTime()) / (1000 * 3600 * 24));
    if (diffDays < requiredDays) return false;

    // 5. Verifica se a data de hoje é um dia de disparo válido
    const allowedWeekDays = rule.weekDays && rule.weekDays.length > 0 ? rule.weekDays : [0,1,2,3,4,5,6];
    const todayWeekDay = now.getDay();
    if (!allowedWeekDays.includes(todayWeekDay)) return false; // hoje não é dia de envio

    // 6. Horário de envio — só dispara a partir do horário programado
    const [sendHour, sendMin] = (rule.sendTime || '09:00').split(':').map(Number);
    const sendTimeToday = new Date(now);
    sendTimeToday.setHours(sendHour, sendMin, 0, 0);
    if (now < sendTimeToday) return false; // ainda não chegou o horário

    // 7. Anti-reenvio — verifica disparo recente para este chat
    try {
      const ruleRuns: Record<string, number> = JSON.parse(
        localStorage.getItem(STORAGE_KEY_RULE_RUNS) || '{}'
      );
      const runKey = `${rule.id}_${chat.id}`;
      const lastSent = ruleRuns[runKey] || 0;
      const daysSinceLastSent = Math.floor((Date.now() - lastSent) / (1000 * 3600 * 24));
      if (daysSinceLastSent < requiredDays) return false;
    } catch {}

    // 8. Monta a mensagem
    const messages = await loadChatMessages(chat.id, connection.id);
    const lastMessagesText = messages.map(m => m.body || m.text || '').join('\n');
    const clienteNome = chat.name || chat.pushname || chat.number || 'Cliente';
    const ultimaData = lastMessageTime.toLocaleDateString('pt-BR');

    let finalMessage = rule.messageTemplate
      .replace(/{{nome}}/gi, clienteNome)
      .replace(/{{ultima_data}}/gi, ultimaData)
      .replace(/{{data}}/gi, new Date().toLocaleDateString('pt-BR'))
      .replace(/{{hora}}/gi, new Date().toLocaleTimeString('pt-BR'));

    if (rule.useAI && rule.aiModel !== 'none') {
      let apiKey = '';
      if (rule.aiModel === 'gpt') apiKey = aiConfig.openAiApiKey;
      else if (rule.aiModel === 'deepseek') apiKey = aiConfig.deepseekApiKey;
      else if (rule.aiModel === 'gemini') apiKey = aiConfig.geminiApiKey;
      if (apiKey) {
        const prompt = `${aiConfig.systemPrompt}\n\nÚltimas mensagens do cliente:\n${lastMessagesText}\n\nNome: ${clienteNome}\nÚltima data: ${ultimaData}\n\nMensagem personalizada:`;
        const aiMessage = await callAI(rule.aiModel, apiKey, prompt);
        if (aiMessage && !aiMessage.includes('Erro')) finalMessage = aiMessage;
      }
    }

    // 9. Envia pela conexão definida na regra
    socket.emit('send_message', {
      to: chat.id,
      text: finalMessage,
      connectionId: rule.connectionId
    });

    // 10. Registra o disparo
    try {
      const ruleRuns: Record<string, number> = JSON.parse(
        localStorage.getItem(STORAGE_KEY_RULE_RUNS) || '{}'
      );
      ruleRuns[`${rule.id}_${chat.id}`] = Date.now();
      localStorage.setItem(STORAGE_KEY_RULE_RUNS, JSON.stringify(ruleRuns));
    } catch {}

    return true;
  };

  // ── Busca todos os chats do servidor com timeout e garantia de atualização ──
  const fetchAllChats = (): Promise<any[]> =>
    new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[Disparo] Timeout ao buscar chats, usando lista atual do estado.');
          resolve(chats);
        }
      }, 10000);

      socket.emit('get_chats', { limit: 5000 });
      const handler = (data: any[]) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const filtered = (data || []).filter((c: any) => !c.id.includes('status@'));
          console.log(`[Disparo] ${filtered.length} chats carregados.`);
          resolve(filtered);
        }
      };
      socket.once('chats', handler);
    });

  // ── Varredura: monta a fila "scheduledQueue" de cada regra ──
  const runDailyScan = async () => {
    console.log('[Disparo] Iniciando varredura das regras...');
    const activeRules = rules.filter(r => r.enabled);
    if (activeRules.length === 0) return;
    
    const allChats = await fetchAllChats();
    if (!allChats.length) {
      console.warn('[Disparo] Nenhum chat encontrado na varredura.');
      return;
    }

    const now = new Date();

    const updatedRules = activeRules.map(rule => {
      const requiredDays = rule.customDays && rule.customDays > 0 ? rule.customDays : rule.frequencyDays;
      const allowedWeekDays = rule.weekDays && rule.weekDays.length > 0 ? rule.weekDays : [0,1,2,3,4,5,6];
      const tagId = `atag_${(rule.tagName || '').trim().toLowerCase().replace(/\s+/g, '_')}`;

      // Carrega atribuições de tags
      let chatTagsMap: Record<string, string[]> = {};
      try { chatTagsMap = JSON.parse(localStorage.getItem('chat_tags_assignments') || '{}'); } catch {}

      // Carrega histórico de disparos
      let ruleRuns: Record<string, number> = {};
      try { ruleRuns = JSON.parse(localStorage.getItem(STORAGE_KEY_RULE_RUNS) || '{}'); } catch {}

      // Carrega atribuições de agentes
      let agentAssignments: Record<string, string> = {};
      try { agentAssignments = JSON.parse(localStorage.getItem(STORAGE_KEY_AGENT_ASSIGNMENTS) || '{}'); } catch {}

      // Calcula próxima data válida de disparo
      const nextValidDate = getNextValidDate(now, allowedWeekDays);
      const isToday = nextValidDate.toDateString() === now.toDateString();
      if (!isToday) {
        // Se o próximo dia válido não for hoje, não monta fila agora
        return { ...rule, scheduledQueue: [] };
      }

      const queue: string[] = [];
      allChats.forEach((chat: any) => {
        // 1. Tag obrigatória (se a regra tem uma tag definida)
        if (rule.tagName?.trim()) {
          const tagsForChat = chatTagsMap[chat.id] || [];
          if (!tagsForChat.includes(tagId)) return;
        }

        // 2. Agente responsável pelo chat deve estar na lista de agentes autorizados
        const chatAgentId = agentAssignments[chat.id];
        if (!chatAgentId || !rule.assignedUserIds.includes(chatAgentId)) return;

        // 3. Frequência: último contato >= X dias atrás
        const lastMsgTs = chat.timestamp ? new Date(chat.timestamp * 1000) : new Date(0);
        const diffDays = Math.floor((now.getTime() - lastMsgTs.getTime()) / (1000 * 3600 * 24));
        if (diffDays < requiredDays) return;

        // 4. Anti-reenvio
        const runKey = `${rule.id}_${chat.id}`;
        const lastSent = ruleRuns[runKey] || 0;
        const daysSinceLastSent = Math.floor((Date.now() - lastSent) / (1000 * 3600 * 24));
        if (daysSinceLastSent < requiredDays) return;

        queue.push(chat.id);
      });

      console.log(`[Disparo] Regra "${rule.name}" agendou ${queue.length} chats.`);
      return { ...rule, scheduledQueue: queue };
    });

    // Atualiza o estado das regras com as filas montadas
    setRules(prev =>
      prev.map(r => {
        const updated = updatedRules.find(u => u.id === r.id);
        return updated ? { ...r, scheduledQueue: updated.scheduledQueue } : r;
      })
    );
  };

  // ── Executa os disparos da fila agendada ──
  const executeAllRules = async (silent = false) => {
    const activeRules = rules.filter(r => r.enabled && r.scheduledQueue && r.scheduledQueue.length > 0);
    if (activeRules.length === 0) {
      if (!silent) toast.info("Nenhuma regra com fila para executar.");
      return;
    }
    if (!silent) toast.info("Iniciando execução das regras de disparo...");

    const allChats = await fetchAllChats();
    let totalSent = 0;

    for (const rule of activeRules) {
      const now = new Date();
      const allowedWeekDays = rule.weekDays && rule.weekDays.length > 0 ? rule.weekDays : [0,1,2,3,4,5,6];
      if (!allowedWeekDays.includes(now.getDay())) continue; // dia inválido

      const [sendHour, sendMin] = (rule.sendTime || '09:00').split(':').map(Number);
      const sendTimeToday = new Date(now);
      sendTimeToday.setHours(sendHour, sendMin, 0, 0);
      if (now < sendTimeToday) continue; // ainda não é o horário

      const queueIds = rule.scheduledQueue || [];
      const targetChats = allChats.filter(c => queueIds.includes(c.id));

      for (const chat of targetChats) {
        const sent = await applyRuleToChat(rule, chat);
        if (sent) {
          totalSent++;
          // Intervalo aleatório entre 37 e 82 segundos
          const delay = Math.floor(Math.random() * (82000 - 37000 + 1)) + 37000;
          await new Promise(r => setTimeout(r, delay));
        }
      }

      // Limpa fila após execução e atualiza lastRun
      setRules(prev =>
        prev.map(r =>
          r.id === rule.id
            ? { ...r, lastRun: Date.now(), scheduledQueue: [] }
            : r
        )
      );
    }

    if (!silent) {
      toast.success(
        totalSent > 0
          ? `${totalSent} mensagem(ns) enviada(s) com sucesso!`
          : "Nenhuma mensagem disparada (critérios não atendidos)."
      );
    } else if (totalSent > 0) {
      console.log(`[Disparo] ${totalSent} mensagem(ns) enviada(s) automaticamente.`);
    }
  };

  // ── Agendador automático ──────────────────────────────────────────────────
  useEffect(() => {
    if (rules.length === 0) return;

    // Varredura inicial (após 20 segundos para os chats carregarem)
    const initialScan = setTimeout(() => {
      runDailyScan();
    }, 20_000);

    // Varredura a cada 6 horas para manter as filas atualizadas
    const periodicScan = setInterval(() => {
      runDailyScan();
    }, 6 * 60 * 60 * 1000);

    // Varredura diária à meia-noite
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 10, 0);
    const msToMidnight = nextMidnight.getTime() - now.getTime();

    const midnightTimer = setTimeout(() => {
      runDailyScan();
      // Após a primeira, repete a cada 24h
      const daily = setInterval(runDailyScan, 24 * 60 * 60 * 1000);
      return () => clearInterval(daily);
    }, msToMidnight);

    // Verificação do horário de envio a cada 5 minutos
    const sendCheckInterval = setInterval(() => {
      executeAllRules(true);
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialScan);
      clearInterval(periodicScan);
      clearTimeout(midnightTimer);
      clearInterval(sendCheckInterval);
    };
  }, [rules]);

  // ── Abre o painel de regras sempre na listagem, nunca no form ──────────────
  const openRulesPanel = () => {
    setEditingRule(null);  // garante que o formulário não abre sozinho
    setShowRulesPanel(true);
  };

  // ── Fecha o painel e limpa sempre o estado de edição ──────────────────────
  const closeRulesPanel = () => {
    setShowRulesPanel(false);
    setEditingRule(null);
  };

  const handleOpenRuleModal = (rule?: DisparoRule) => {
    if (rule) {
      // Editando regra existente: carrega dados completos no formulário
      setEditingRule(rule);
      setRuleForm({ ...rule });
    } else {
      // Nova regra: id permanece vazio até o momento do salvar
      setEditingRule({
        id: '',
        name: '',
        enabled: true,
        connectionId: allConnections[0]?.id || '',
        assignedUserId: '',
        assignedUserIds: [],
        tagName: '',
        tagColor: '#10b981',
        messageTemplate: '',
        frequencyDays: 30,
        customDays: undefined,
        sendTime: '09:00',
        weekDays: [1, 2, 3, 4, 5],
        useAI: false,
        aiModel: 'none'
      });
      setRuleForm({
        name: '',
        enabled: true,
        connectionId: allConnections[0]?.id || '',
        assignedUserId: '',
        assignedUserIds: [],
        tagName: '',
        tagColor: '#10b981',
        messageTemplate: '',
        frequencyDays: 30,
        customDays: undefined,
        sendTime: '09:00',
        weekDays: [1, 2, 3, 4, 5],
        useAI: false,
        aiModel: 'none'
      });
    }
  };

  const handleSaveRule = () => {
    const hasUsers = (ruleForm.assignedUserIds && ruleForm.assignedUserIds.length > 0) || !!ruleForm.assignedUserId;
    const hasWeekDays = (ruleForm.weekDays && ruleForm.weekDays.length > 0);
    if (!ruleForm.name || !ruleForm.connectionId || !hasUsers || !ruleForm.messageTemplate) {
      toast.error("Preencha todos os campos obrigatórios (inclua ao menos um agente).");
      return;
    }
    if (!hasWeekDays) {
      toast.error("Selecione ao menos um dia da semana para o envio.");
      return;
    }

    if (editingRule && editingRule.id) {
      // UPDATE — usa o id original da regra que está sendo editada
      setRules(prev =>
        prev.map(r =>
          r.id === editingRule.id
            ? { ...r, ...ruleForm, id: editingRule.id }  // id original sempre preservado
            : r
        )
      );
    } else {
      // INSERT — gera id único e coloca POR ÚLTIMO para nunca ser sobrescrito
      const newId = generateId();
      const newRule: DisparoRule = {
        ...ruleForm as DisparoRule,
        id: newId,
      };
      setRules(prev => [...prev, newRule]);
    }

    closeRulesPanel();
    toast.success(editingRule?.id ? "Regra atualizada!" : "Regra criada!");
  };

  const handleDeleteRule = (id: string) => {
    if (!id) {
      toast.error("Esta regra não tem um ID válido e não pode ser excluída.");
      return;
    }
    if (confirm("Excluir esta regra?")) {
      setRules(prev => prev.filter(r => r.id !== id));
      toast.info("Regra removida.");
    }
  };

  const handleCancelEditRule = () => {
    setEditingRule(null);
    setAgentSearch('');
    setAgentDropdownOpen(false);
  };

  // Fecha o dropdown de agentes ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setAgentDropdownOpen(false);
      }
    };
    if (agentDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [agentDropdownOpen]);

  const handleTextareaActivity = () => {
    if (textareaRef.current) {
      selectionRef.current = { start: textareaRef.current.selectionStart, end: textareaRef.current.selectionEnd };
    }
  };

  const applyFormatting = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const currentText = ruleForm.messageTemplate || '';
    const selectedText = currentText.substring(start, end);
    const newText = currentText.substring(0, start) + prefix + selectedText + suffix + currentText.substring(end);
    setRuleForm({ ...ruleForm, messageTemplate: newText });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + prefix.length, end + prefix.length);
      }
    }, 10);
  };

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = selectionRef.current || { start: (ruleForm.messageTemplate || '').length, end: (ruleForm.messageTemplate || '').length };
    const newMsg = (ruleForm.messageTemplate || '').substring(0, pos.start) + `{{${tag}}}` + (ruleForm.messageTemplate || '').substring(pos.end);
    setRuleForm({ ...ruleForm, messageTemplate: newMsg });
    const newCursorPos = pos.start + tag.length + 4;
    selectionRef.current = { start: newCursorPos, end: newCursorPos };
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  // ==========================================================================
  // SIMULAÇÃO
  // ==========================================================================
  const simulateFlow = async () => {
    if (nodes.length === 0) return;
    setIsSimulating(true);
    setSelectedNodeId(null);
    toast.info("Iniciando simulação do fluxo...");

    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, status: 'idle', errorMessage: null } })));
    setEdges(eds => eds.map(e => ({ ...e, animated: false, style: { stroke: isDark ? '#64748b' : '#94a3b8', strokeWidth: 2 } })));

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const processNode = async (nodeId: string) => {
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'running' } } : n));
      await delay(1200);

      const node = nodes.find(n => n.id === nodeId);
      if (!node?.data.isActive) {
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', errorMessage: 'Nó inativo.' } } : n));
        return;
      }

      const shouldFail = nodeId !== 'root' && Math.random() < 0.15;
      if (shouldFail) {
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', errorMessage: 'Erro simulado.' } } : n));
        setEdges(eds => eds.map(e => e.target === nodeId ? { ...e, animated: true, style: { stroke: '#f43f5e', strokeWidth: 3 } } : e));
        return;
      }

      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'success' } } : n));
      
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      setEdges(eds => eds.map(e => outgoingEdges.find(oe => oe.id === e.id) 
        ? { ...e, animated: true, style: { stroke: '#10b981', strokeWidth: 3 } } 
        : e
      ));

      await delay(500);
      await Promise.all(outgoingEdges.map(e => processNode(e.target)));
      
      setEdges(eds => eds.map(e => outgoingEdges.find(oe => oe.id === e.id) 
        ? { ...e, animated: false, style: { stroke: isDark ? '#64748b' : '#94a3b8', strokeWidth: 2 } } 
        : e
      ));
    };

    await processNode('root');
    setIsSimulating(false);
    toast.success("Simulação concluída!");
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  // ==========================================================================
  // RENDER: TELA DE LISTAGEM DE FLUXOS
  // ==========================================================================
  if (!currentFlowId) {
    return (
      <AppLayout>
        <div className="h-full w-full flex flex-col transition-colors duration-300 bg-slate-50 dark:bg-slate-900">
          <div className="p-4 lg:p-8 max-w-6xl mx-auto w-full flex-1">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Workflow className="text-emerald-500" />
                  Suas Automações
                </h1>
                <p className="text-slate-500 dark:text-slate-400">Crie, gerencie e simule seus fluxos de atendimento de forma visual.</p>
              </div>
              
              <div className="flex items-center gap-4">
                <button onClick={openRulesPanel} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20">
                  <Zap size={18} /> Regras de Disparo
                </button>
                <button onClick={() => setShowAIConfig(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/20">
                  <Brain size={18} /> Configurar IA
                </button>
                <button onClick={handleCreateNewFlow} className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                  <Plus size={18} /> Novo Fluxo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {flows.map(flow => (
                <div key={flow.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-all group flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn("p-3 rounded-xl", flow.isActive ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500")}>
                      <Workflow size={24} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={(e) => handleDeleteFlow(e, flow.id)} className="p-2 text-slate-300 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all" title="Excluir fluxo">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{flow.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex-1">
                    {flow.nodes.length} blocos configurados • Atualizado em {new Date(flow.updatedAt).toLocaleDateString('pt-BR')}
                  </p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                    <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider", flow.isActive ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>
                      {flow.isActive ? 'Em Execução' : 'Inativo'}
                    </span>
                    <button onClick={() => handleOpenFlow(flow)} className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Abrir Canvas <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {flows.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  <Workflow size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
                  <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-2">Nenhum fluxo configurado</h3>
                  <p className="text-sm">Clique no botão "Novo Fluxo" para criar sua primeira automação.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Templates */}
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Layers size={20} className="text-amber-500" />
                  Escolha um Template ou Comece do Zero
                </h2>
                <button onClick={() => setShowTemplateModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {flowTemplates.map(template => (
                    <div key={template.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg transition bg-white dark:bg-slate-800/50">
                      <h3 className="font-bold text-lg mb-1 text-slate-800 dark:text-white">{template.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{template.description}</p>
                      <div className="bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md text-xs font-mono text-slate-600 dark:text-slate-300 mb-4">
                        {template.preview || 'Prévia não disponível'}
                      </div>
                      <button onClick={() => handleApplyTemplate(template)} className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2">
                        <Copy size={14} /> Usar este Template
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 text-center">
                  <button onClick={handleCreateBlankFlow} className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition">
                    Criar Fluxo em Branco
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Regras */}
        {showRulesPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Zap size={20} className="text-amber-500" />
                  {editingRule !== null
                    ? (editingRule.id ? 'Editar Regra de Disparo' : 'Nova Regra de Disparo')
                    : 'Regras de Disparo (Lembrete Pós-Atendimento)'}
                </h2>
                <button onClick={closeRulesPanel} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {editingRule !== null ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Nome da Regra *</label>
                        <input type="text" value={ruleForm.name} onChange={e => setRuleForm({...ruleForm, name: e.target.value})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Número WhatsApp (Conexão) *</label>
                        <select value={ruleForm.connectionId} onChange={e => setRuleForm({...ruleForm, connectionId: e.target.value})} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white">
                          {allConnections.filter(c => c.enabled && c.status === 'connected').map(conn => (
                            <option key={conn.id} value={conn.id}>{conn.name} ({conn.phone || 'Número'})</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1.5 flex items-center gap-1.5">
                          <Users size={12} className="text-emerald-500" />
                          Agentes com Acesso *
                        </label>
                        <div ref={agentDropdownRef} className="relative">
                          {/* Botão disparador — aparência de select */}
                          <button
                            type="button"
                            onClick={() => { setAgentDropdownOpen(o => !o); setAgentSearch(''); }}
                            className={cn(
                              "w-full flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-sm text-left transition-colors",
                              agentDropdownOpen
                                ? "border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-400/20"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                            )}
                          >
                            <span className={cn(
                              "flex-1 truncate",
                              (ruleForm.assignedUserIds || []).length === 0
                                ? "text-slate-400 dark:text-slate-500"
                                : "text-slate-700 dark:text-white"
                            )}>
                              {(ruleForm.assignedUserIds || []).length === 0
                                ? "Selecione os agentes..."
                                : (() => {
                                    const names = allUsers
                                      .filter(u => (ruleForm.assignedUserIds || []).includes(u.id))
                                      .map(u => u.displayName);
                                    return names.length <= 2
                                      ? names.join(', ')
                                      : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
                                  })()
                              }
                            </span>
                            {(ruleForm.assignedUserIds || []).length > 0 && (
                              <span className="flex-shrink-0 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                                {(ruleForm.assignedUserIds || []).length}
                              </span>
                            )}
                            <ChevronDown size={14} className={cn("text-slate-400 flex-shrink-0 transition-transform", agentDropdownOpen && "rotate-180")} />
                          </button>

                          {/* Painel suspenso */}
                          {agentDropdownOpen && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                              {/* Busca */}
                              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50">
                                <Search size={13} className="text-slate-400 flex-shrink-0" />
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Buscar agente..."
                                  value={agentSearch}
                                  onChange={e => setAgentSearch(e.target.value)}
                                  className="flex-1 text-xs bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                                />
                                {agentSearch
                                  ? <button onClick={() => setAgentSearch('')} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
                                  : null
                                }
                              </div>

                              {/* Selecionar/desmarcar todos */}
                              {allUsers.length > 1 && (
                                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allIds = allUsers.map(u => u.id);
                                      const allSelected = allIds.every(id => (ruleForm.assignedUserIds || []).includes(id));
                                      const next = allSelected ? [] : allIds;
                                      setRuleForm({ ...ruleForm, assignedUserIds: next, assignedUserId: next[0] || '' });
                                    }}
                                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium"
                                  >
                                    {allUsers.every(u => (ruleForm.assignedUserIds || []).includes(u.id))
                                      ? '✕ Desmarcar todos'
                                      : '✓ Selecionar todos'}
                                  </button>
                                </div>
                              )}

                              {/* Lista de opções */}
                              <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/40">
                                {allUsers
                                  .filter(u =>
                                    u.displayName.toLowerCase().includes(agentSearch.toLowerCase()) ||
                                    u.name.toLowerCase().includes(agentSearch.toLowerCase())
                                  )
                                  .map(user => {
                                    const checked = (ruleForm.assignedUserIds || []).includes(user.id);
                                    return (
                                      <label
                                        key={user.id}
                                        className={cn(
                                          "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors select-none",
                                          checked ? "bg-emerald-50 dark:bg-emerald-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                        )}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={e => {
                                            const current = ruleForm.assignedUserIds || [];
                                            const next = e.target.checked
                                              ? [...current, user.id]
                                              : current.filter(id => id !== user.id);
                                            setRuleForm({ ...ruleForm, assignedUserIds: next, assignedUserId: next[0] || '' });
                                          }}
                                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-0 flex-shrink-0"
                                        />
                                        <div className={cn(
                                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                                          checked ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                                        )}>
                                          {user.displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className={cn("text-sm font-medium truncate", checked ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200")}>
                                            {user.displayName}
                                          </p>
                                          <p className="text-[10px] text-slate-400 truncate">{user.name}</p>
                                        </div>
                                        {checked && <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />}
                                      </label>
                                    );
                                  })
                                }
                                {allUsers.filter(u =>
                                  u.displayName.toLowerCase().includes(agentSearch.toLowerCase()) ||
                                  u.name.toLowerCase().includes(agentSearch.toLowerCase())
                                ).length === 0 && (
                                  <p className="text-xs text-slate-400 text-center py-4">Nenhum agente encontrado</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Chips dos selecionados */}
                        {(ruleForm.assignedUserIds || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {allUsers.filter(u => (ruleForm.assignedUserIds || []).includes(u.id)).map(u => (
                              <span
                                key={u.id}
                                className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full"
                              >
                                {u.displayName}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (ruleForm.assignedUserIds || []).filter(id => id !== u.id);
                                    setRuleForm({ ...ruleForm, assignedUserIds: next, assignedUserId: next[0] || '' });
                                  }}
                                  className="hover:text-emerald-900 dark:hover:text-white transition-colors"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Etiqueta</label>
                          <input type="text" value={ruleForm.tagName} onChange={e => setRuleForm({...ruleForm, tagName: e.target.value})} placeholder="Ex: Follow-up" className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Cor</label>
                          <input type="color" value={ruleForm.tagColor} onChange={e => setRuleForm({...ruleForm, tagColor: e.target.value})} className="w-12 h-10 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                        </div>
                      </div>
                    </div>

                    {/* FREQUÊNCIA + HORÁRIO + DIAS DA SEMANA */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                        <Clock size={12} className="text-indigo-500" />
                        Agendamento de Disparo
                      </p>

                      {/* Intervalo de dias */}
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-2">
                          Intervalo mínimo entre disparos (dias desde a última conversa)
                        </label>
                        <div className="flex gap-3 items-center flex-wrap">
                          {[
                            { label: '30 dias', days: 30 },
                            { label: '60 dias', days: 60 },
                            { label: '90 dias', days: 90 },
                          ].map(opt => (
                            <label key={opt.days} className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all",
                              ruleForm.frequencyDays === opt.days && ruleForm.customDays === undefined
                                ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-medium"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            )}>
                              <input type="radio" name="freq" className="hidden"
                                checked={ruleForm.frequencyDays === opt.days && ruleForm.customDays === undefined}
                                onChange={() => setRuleForm({...ruleForm, frequencyDays: opt.days, customDays: undefined})} />
                              {opt.label}
                            </label>
                          ))}
                          <label className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all",
                            ruleForm.customDays !== undefined
                              ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-medium"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          )}>
                            <input type="radio" name="freq" className="hidden"
                              checked={ruleForm.customDays !== undefined}
                              onChange={() => setRuleForm({...ruleForm, frequencyDays: 0, customDays: 30})} />
                            Personalizado
                          </label>
                          {ruleForm.customDays !== undefined && (
                            <div className="flex items-center gap-1.5">
                              <input type="number" min="1" max="365" value={ruleForm.customDays}
                                onChange={e => setRuleForm({...ruleForm, customDays: parseInt(e.target.value) || 1})}
                                className="w-20 p-2 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-500/40 rounded-lg text-sm text-slate-800 dark:text-white text-center font-bold" />
                              <span className="text-xs text-slate-500">dias</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Horário de envio */}
                      <div className="flex items-center gap-6 flex-wrap">
                        <div>
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1.5 flex items-center gap-1">
                            <Clock size={11} className="text-emerald-500" /> Horário de envio
                          </label>
                          <input
                            type="time"
                            value={ruleForm.sendTime || '09:00'}
                            onChange={e => setRuleForm({...ruleForm, sendTime: e.target.value})}
                            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white font-mono focus:ring-2 focus:ring-emerald-400 outline-none"
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[200px]">
                          A varredura ocorre à meia-noite. Os disparos iniciam a partir deste horário com intervalo aleatório de 37–82 segundos entre cada envio.
                        </div>
                      </div>

                      {/* Dias da semana */}
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-2">
                          Dias da semana para envio
                          <span className="ml-1 text-[10px] text-slate-400">(se o dia não estiver marcado, dispara no próximo dia válido)</span>
                        </label>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { label: 'Dom', value: 0 },
                            { label: 'Seg', value: 1 },
                            { label: 'Ter', value: 2 },
                            { label: 'Qua', value: 3 },
                            { label: 'Qui', value: 4 },
                            { label: 'Sex', value: 5 },
                            { label: 'Sáb', value: 6 },
                          ].map(day => {
                            const active = (ruleForm.weekDays || []).includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                onClick={() => {
                                  const current = ruleForm.weekDays || [];
                                  const next = active
                                    ? current.filter(d => d !== day.value)
                                    : [...current, day.value].sort();
                                  setRuleForm({...ruleForm, weekDays: next});
                                }}
                                className={cn(
                                  "w-10 h-10 rounded-lg text-xs font-bold border transition-all",
                                  active
                                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                    : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-300"
                                )}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                        {(ruleForm.weekDays || []).length === 0 && (
                          <p className="text-[10px] text-amber-500 mt-1.5 flex items-center gap-1">
                            <AlertCircle size={10} /> Selecione ao menos um dia da semana.
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Mensagem (suporta tags: {"{{"} nome {"}}"},  {"{{"} ultima_data {"}}"})</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => insertTag('nome')} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-bold">+ Nome</button>
                          <button type="button" onClick={() => insertTag('ultima_data')} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-bold">+ Última Data</button>
                          <button type="button" onClick={() => insertTag('data')} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-bold">+ Data Atual</button>
                          <button type="button" onClick={() => insertTag('hora')} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-bold">+ Hora</button>
                        </div>
                      </div>
                      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                          <button onClick={() => applyFormatting('*', '*')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><Bold size={16} /></button>
                          <button onClick={() => applyFormatting('_', '_')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><Italic size={16} /></button>
                          <button onClick={() => applyFormatting('~', '~')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><Strikethrough size={16} /></button>
                          <button onClick={() => applyFormatting('`', '`')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><Code size={16} /></button>
                          <button onClick={() => applyFormatting('> ', '')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><Quote size={16} /></button>
                          <button onClick={() => applyFormatting('- ', '')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><List size={16} /></button>
                        </div>
                        <textarea
                          ref={textareaRef}
                          value={ruleForm.messageTemplate || ''}
                          onChange={(e) => setRuleForm({...ruleForm, messageTemplate: e.target.value})}
                          onBlur={handleTextareaActivity}
                          onClick={handleTextareaActivity}
                          onKeyUp={handleTextareaActivity}
                          rows={6}
                          className="w-full p-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm outline-none resize-y"
                          placeholder="Olá {{nome}}, tudo bem? Já faz {{ultima_data}} desde nosso último contato..."
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Brain size={18} className="text-purple-500" />
                          <span className="font-bold text-slate-700 dark:text-slate-300">Usar IA para personalizar mensagem</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={ruleForm.useAI} onChange={e => setRuleForm({...ruleForm, useAI: e.target.checked})} />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                      {ruleForm.useAI && (
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Modelo de IA</label>
                          <select value={ruleForm.aiModel} onChange={e => setRuleForm({...ruleForm, aiModel: e.target.value as any})} className="w-full p-2 bg-white dark:bg-slate-800 border rounded-lg text-sm text-slate-800 dark:text-white">
                            <option value="none">Desativar IA</option>
                            <option value="gpt">GPT (OpenAI)</option>
                            <option value="deepseek">DeepSeek</option>
                            <option value="gemini">Gemini</option>
                          </select>
                          <p className="text-[10px] text-slate-400 mt-1">Certifique-se de configurar as chaves de API no menu "Configurar IA".</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => handleOpenRuleModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold"
                      >
                        <Plus size={16} /> Nova Regra
                      </button>
                      <button
                        onClick={() => { runDailyScan(); toast.info("Varredura iniciada!"); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl font-bold"
                      >
                        <RefreshCw size={16} /> Forçar Varredura
                      </button>
                      <button
                        onClick={() => executeAllRules(false)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-bold"
                      >
                        <Send size={16} /> Executar Regras Agora
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {rules.map(rule => (
                        <div key={rule.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: rule.tagColor || '#10b981' }}></span>
                              <span className="font-bold text-slate-800 dark:text-white">{rule.name}</span>
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full", rule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500")}>
                                {rule.enabled ? 'Ativa' : 'Inativa'}
                              </span>
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              <div className="flex flex-wrap gap-1 items-center mt-0.5 mb-1">
                                <span className="text-slate-500 dark:text-slate-400 mr-1">Agentes:</span>
                                {(() => {
                                  const ids = (rule.assignedUserIds && rule.assignedUserIds.length > 0)
                                    ? rule.assignedUserIds
                                    : rule.assignedUserId ? [rule.assignedUserId] : [];
                                  const users = allUsers.filter(u => ids.includes(u.id));
                                  return users.length > 0
                                    ? users.map(u => (
                                        <span key={u.id} className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-medium">{u.displayName}</span>
                                      ))
                                    : <span className="text-slate-400">N/A</span>;
                                })()}
                              </div>
                              <p>Conexão: {allConnections.find(c => c.id === rule.connectionId)?.name || 'N/A'}</p>
                              <p>Intervalo: {rule.customDays ? `${rule.customDays} dias` : `${rule.frequencyDays} dias`} • Horário: {rule.sendTime || '09:00'}</p>
                              {(rule.weekDays && rule.weekDays.length > 0) && (
                                <p className="flex items-center gap-1 flex-wrap">
                                  <span>Dias:</span>
                                  {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
                                    .filter((_, i) => (rule.weekDays || []).includes(i))
                                    .map(d => (
                                      <span key={d} className="text-[9px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-bold">{d}</span>
                                    ))}
                                </p>
                              )}
                              <p className="text-xs truncate mt-1">Mensagem: {rule.messageTemplate?.substring(0, 50)}...</p>
                              {rule.useAI && <p className="text-xs text-purple-600 mt-1">🤖 IA ativa ({rule.aiModel})</p>}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleOpenRuleModal(rule)}
                              className="p-2 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                              title="Editar regra"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Excluir regra"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {rules.length === 0 && (
                        <div className="text-center py-8 text-slate-400">Nenhuma regra cadastrada. Clique em "Nova Regra" para criar.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé do formulário de edição */}
              {editingRule !== null && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                  <button
                    onClick={handleCancelEditRule}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button onClick={handleSaveRule} className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600">
                    {editingRule.id ? 'Salvar Alterações' : 'Criar Regra'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Configuração de IA */}
        {showAIConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Brain size={20} /> Configuração de IA</h2>
                <button onClick={() => setShowAIConfig(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">Habilitar IA no sistema</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={aiConfig.enabled} onChange={e => setAIConfig({...aiConfig, enabled: e.target.checked})} />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">Modelo Padrão</label>
                  <select value={aiConfig.defaultModel} onChange={e => setAIConfig({...aiConfig, defaultModel: e.target.value as any})} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-white">
                    <option value="gpt">GPT (OpenAI)</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">API Key OpenAI</label>
                  <input type="password" value={aiConfig.openAiApiKey} onChange={e => setAIConfig({...aiConfig, openAiApiKey: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-white" placeholder="sk-..." />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">API Key DeepSeek</label>
                  <input type="password" value={aiConfig.deepseekApiKey} onChange={e => setAIConfig({...aiConfig, deepseekApiKey: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-white" placeholder="sk-..." />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">API Key Gemini</label>
                  <input type="password" value={aiConfig.geminiApiKey} onChange={e => setAIConfig({...aiConfig, geminiApiKey: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-white" placeholder="..." />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">Prompt de Treinamento (Sistema)</label>
                  <textarea value={aiConfig.systemPrompt} onChange={e => setAIConfig({...aiConfig, systemPrompt: e.target.value})} rows={5} className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-white text-sm" />
                </div>
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                <button onClick={() => setShowAIConfig(false)} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">Fechar</button>
                <button onClick={() => { setShowAIConfig(false); toast.success("Configurações salvas!"); }} className="px-4 py-2 rounded-xl bg-purple-500 text-white font-bold">Salvar</button>
              </div>
            </div>
          </div>
        )}
      </AppLayout>
    );
  }

  // ==========================================================================
  // RENDER: CANVAS
  // ==========================================================================
  return (
    <AppLayout>
      <div className="h-full w-full flex flex-col overflow-hidden transition-colors duration-300 bg-slate-50 dark:bg-slate-900">
        
        <div className="p-3 lg:p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:justify-between md:items-center gap-4 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentFlowId(null)} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <input 
                value={currentFlowName} 
                onChange={(e) => setCurrentFlowName(e.target.value)}
                className="text-xl font-bold text-slate-900 dark:text-white bg-transparent outline-none hover:bg-slate-50 dark:hover:bg-slate-700 focus:bg-slate-50 dark:focus:bg-slate-700 px-2 py-1 rounded transition-colors"
                placeholder="Nome do Fluxo"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Status:</span>
              <button 
                onClick={() => setIsCurrentFlowActive(!isCurrentFlowActive)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                  isCurrentFlowActive 
                    ? "bg-emerald-100 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30" 
                    : "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700"
                )}
              >
                <Power size={12} />
                {isCurrentFlowActive ? 'ATIVO' : 'PAUSADO'}
              </button>
            </div>

            <button onClick={simulateFlow} disabled={isSimulating} className={cn("flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl font-bold border border-blue-200 dark:border-blue-500/20 transition-all text-sm", isSimulating && "opacity-50 cursor-not-allowed")}>
              {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              Testar Fluxo
            </button>

            <button onClick={handleSaveFlow} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 text-sm">
              <Save size={16} /> Salvar
            </button>
          </div>
        </div>

        {!isCurrentFlowActive && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-6 py-2 flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold animate-in slide-in-from-top-2">
            <AlertCircle size={14} /> Este fluxo está em rascunho/pausado. Ele não responderá mensagens reais até ser ativado e salvo.
          </div>
        )}

        <div className="flex-1 overflow-hidden relative w-full">
          <div className="absolute inset-0 z-0">
            <ReactFlow 
              nodes={nodes} 
              edges={edges} 
              onNodesChange={onNodesChange} 
              onEdgesChange={onEdgesChange} 
              onConnect={onConnect} 
              onNodeClick={onNodeClick} 
              nodeTypes={nodeTypes} 
              fitView
            >
              <Background color={isDark ? "#334155" : "#cbd5e1"} gap={20} size={2} />
              <Controls className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 fill-slate-700 dark:fill-slate-300" />
              <MiniMap nodeStrokeWidth={3} zoomable pannable nodeColor={(n) => n.type === 'rootNode' ? '#6366f1' : '#10b981'} style={{ backgroundColor: isDark ? '#1e293b' : '#fff', maskColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }} />
              <Panel position="top-left" className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 flex gap-2">
                <button onClick={() => addMenuOption()} className="flex items-center gap-2 px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-all">
                  <Plus size={14} /> Adicionar Bloco Solto
                </button>
              </Panel>
            </ReactFlow>
          </div>

          <div className={cn(
            "absolute right-0 top-0 bottom-0 w-full lg:w-[450px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-30 transition-transform duration-300 overflow-y-auto", 
            selectedNodeId && !isSimulating ? "translate-x-0" : "translate-x-full"
          )}>
            {selectedNode && (
              <div className="p-6 space-y-8 pb-24">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings2 size={18} className="text-emerald-500" />
                    Propriedades do Nó
                  </h3>
                  <button onClick={() => setSelectedNodeId(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 rounded-lg transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Status deste Bloco</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Se inativo, corta o fluxo aqui.</span>
                    </div>
                    <button 
                      onClick={() => updateNodeData(selectedNode.id, { isActive: !(selectedNode.data.isActive !== false) })}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        selectedNode.data.isActive !== false
                          ? "bg-emerald-100 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400" 
                          : "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {selectedNode.data.isActive !== false ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {selectedNode.data.isActive !== false ? 'LIGADO' : 'DESLIGADO'}
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 flex items-center gap-1">
                      <Mail size={12} className="text-amber-500" />
                      Mensagem de Encerramento (enviada quando o agente encerrar)
                    </label>
                    <textarea 
                      value={selectedNode.data.closingMessage || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { closingMessage: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm min-h-[80px] focus:ring-2 focus:ring-amber-500 outline-none resize-y text-slate-800 dark:text-slate-200"
                      placeholder="Ex: Obrigado pelo contato! Ficamos à disposição. Até mais."
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Essa mensagem será enviada automaticamente quando o atendente finalizar a conversa.</p>
                  </div>

                  {selectedNode.type === 'rootNode' ? (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 flex items-center gap-1">
                          <Smartphone size={12} /> Conexões de Entrada (podem ser várias)
                        </label>
                        <div className="space-y-2">
                          {allConnections.filter(c => c.enabled && c.status === 'connected').map(conn => (
                            <label key={conn.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <input 
                                type="checkbox" 
                                checked={(selectedNode.data.selectedConnectionIds || []).includes(conn.id)}
                                onChange={(e) => {
                                  const current = selectedNode.data.selectedConnectionIds || [];
                                  const newIds = e.target.checked ? [...current, conn.id] : current.filter((id: string) => id !== conn.id);
                                  updateNodeData(selectedNode.id, { selectedConnectionIds: newIds });
                                }}
                                className="w-4 h-4 rounded text-indigo-500"
                              />
                              <span className="text-slate-700 dark:text-slate-300">{conn.name} ({conn.phone})</span>
                            </label>
                          ))}
                          <label className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <input 
                              type="checkbox" 
                              checked={(selectedNode.data.selectedConnectionIds || []).length === allConnections.filter(c => c.enabled && c.status === 'connected').length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const allIds = allConnections.filter(c => c.enabled && c.status === 'connected').map(c => c.id);
                                  updateNodeData(selectedNode.id, { selectedConnectionIds: allIds });
                                } else {
                                  updateNodeData(selectedNode.id, { selectedConnectionIds: [] });
                                }
                              }}
                              className="w-4 h-4 rounded text-indigo-500"
                            />
                            <span className="font-bold text-slate-700 dark:text-slate-300">Selecionar todas</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 flex items-center gap-1">
                          <Users size={12} /> Agentes Responsáveis (para este fluxo)
                        </label>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {allUsers.map(user => (
                            <label key={user.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <input 
                                type="checkbox" 
                                checked={(selectedNode.data.assignedUserIds || []).includes(user.id)}
                                onChange={(e) => {
                                  const current = selectedNode.data.assignedUserIds || [];
                                  const newIds = e.target.checked ? [...current, user.id] : current.filter((id: string) => id !== user.id);
                                  updateNodeData(selectedNode.id, { assignedUserIds: newIds });
                                }}
                                className="w-4 h-4 rounded text-emerald-500"
                              />
                              <span className="text-slate-700 dark:text-slate-300">{user.displayName} ({user.name})</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Mensagem do Robô (saudação)</label>
                        <textarea 
                          value={selectedNode.data.welcomeText || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { welcomeText: e.target.value })}
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm min-h-[120px] focus:ring-2 focus:ring-indigo-500 outline-none resize-y text-slate-800 dark:text-slate-200"
                          placeholder="Ex: Olá! Bem-vindo à nossa empresa..."
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Título do Menu</label>
                        <input 
                          type="text" 
                          value={selectedNode.data.label || ''} 
                          onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })} 
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800 dark:text-slate-200" 
                        />
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          Navegação Padrão (Pelo Cliente)
                        </label>
                        
                        <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Undo2 size={16} className="text-amber-500" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Permitir "Voltar" (0)</span>
                          </div>
                          <input type="checkbox" checked={selectedNode.data.allowBack || false} onChange={(e) => updateNodeData(selectedNode.id, { allowBack: e.target.checked })} className="w-4 h-4 rounded text-amber-500" />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Home size={16} className="text-blue-500" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Permitir "Início" (#)</span>
                          </div>
                          <input type="checkbox" checked={selectedNode.data.allowHome || false} onChange={(e) => updateNodeData(selectedNode.id, { allowHome: e.target.checked })} className="w-4 h-4 rounded text-blue-500" />
                        </label>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between mb-3">
                          <span>Opções Livres do Menu</span>
                          <button 
                            onClick={() => {
                              const currentOpts = selectedNode.data.options || [];
                              updateNodeData(selectedNode.id, { options: [...currentOpts, { title: 'Nova Opção' }] });
                            }}
                            className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-[9px] hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition"
                          >
                            + Add Opção
                          </button>
                        </label>
                        
                        <div className="space-y-3">
                          {(selectedNode.data.options || []).map((opt: any, idx: number) => (
                            <div key={idx} className="flex flex-col gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 shrink-0 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                <input 
                                  value={opt.title} 
                                  onChange={(e) => {
                                    const newOpts = [...selectedNode.data.options];
                                    newOpts[idx].title = e.target.value;
                                    updateNodeData(selectedNode.id, { options: newOpts });
                                  }}
                                  className="flex-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200"
                                  placeholder="Título da opção"
                                />
                                <button 
                                  onClick={() => {
                                    const newOpts = selectedNode.data.options.filter((_: any, i: number) => i !== idx);
                                    updateNodeData(selectedNode.id, { options: newOpts });
                                  }}
                                  className="text-slate-300 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                              <div className="flex items-center gap-2 pl-8">
                                <Users size={12} className="text-indigo-500" />
                                <select
                                  value={opt.agentId || ''}
                                  onChange={(e) => {
                                    const newOpts = [...selectedNode.data.options];
                                    newOpts[idx].agentId = e.target.value;
                                    updateNodeData(selectedNode.id, { options: newOpts });
                                  }}
                                  className="text-xs p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                                >
                                  <option value="">Agente padrão do menu</option>
                                  {allUsers.map(user => (
                                    <option key={user.id} value={user.id}>{user.displayName}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                          {(!selectedNode.data.options || selectedNode.data.options.length === 0) && (
                            <p className="text-[10px] text-slate-400 italic">Nenhuma opção de número criada.</p>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                        <label className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase block mb-2 flex items-center gap-1">
                          <Phone size={12} /> Transbordo / Transferência
                        </label>
                        <select 
                          value={selectedNode.data.connectionId || 'inherit'}
                          onChange={(e) => updateNodeData(selectedNode.id, { connectionId: e.target.value })}
                          className="w-full p-3 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700 dark:text-slate-200"
                        >
                          <option value="inherit">🔄 Manter mesma conexão</option>
                          {allConnections.filter(c => c.enabled && c.status === 'connected').map(conn => (
                            <option key={conn.id} value={conn.id}>Transferir para: {conn.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Agentes para Direcionamento (padrão)</label>
                        <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                          {allUsers.map(user => (
                            <label key={user.id} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                              <input 
                                type="checkbox" 
                                checked={selectedNode.data.assignedUserIds?.includes(user.id)} 
                                onChange={(e) => {
                                  const current = selectedNode.data.assignedUserIds || [];
                                  const newIds = e.target.checked ? [...current, user.id] : current.filter((id: string) => id !== user.id);
                                  updateNodeData(selectedNode.id, { assignedUserIds: newIds });
                                }} 
                                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500 bg-white dark:bg-slate-900" 
                              />
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{user.displayName} ({user.name})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                    {selectedNode.type !== 'rootNode' && (
                      <button 
                        onClick={() => addMenuOption(selectedNode.id)} 
                        className="w-full py-3 flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all border border-emerald-100 dark:border-emerald-500/20 shadow-sm"
                      >
                        <Plus size={14} /> Conectar Novo Caminho / Submenu
                      </button>
                    )}
                    
                    {selectedNode.id !== 'root' && (
                      <button 
                        onClick={() => deleteNode(selectedNode.id)} 
                        className="w-full py-3 flex items-center justify-center gap-2 text-rose-500 dark:text-rose-400 font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all border border-rose-100 dark:border-rose-500/20"
                      >
                        <Trash2 size={14} /> Excluir este Bloco
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

// ============================================================================
// EXPORT COM ERROR BOUNDARY
// ============================================================================
const Automation = () => (
  <ErrorBoundary>
    <AutomationInner />
  </ErrorBoundary>
);

export default Automation;