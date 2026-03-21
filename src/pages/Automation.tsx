"use client";

import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  MiniMap, 
  applyEdgeChanges, 
  applyNodeChanges,
  Node, 
  Edge, 
  Connection,
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
  Undo2, Home
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { io } from 'socket.io-client';

// ============================================================================
// INTERFACES & TIPOS
// ============================================================================
interface FlowData {
  id: string;
  name: string;
  isActive: boolean;
  nodes: Node[];
  edges: Edge[];
  updatedAt: number;
}

type NodeStatus = 'idle' | 'running' | 'success' | 'error';

// ============================================================================
// DADOS E INTEGRAÇÕES
// ============================================================================
const MOCK_CONNECTIONS = [
  { id: 'conn_main_1', name: '+55 11 99999-1111 (Atendimento Geral)' },
  { id: 'conn_suporte', name: '+55 11 99999-2222 (Suporte Técnico)' },
];

const getConnections = () => {
  try {
    const stored = localStorage.getItem('zapflow_connections');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((c: any) => ({
          id: c.id,
          name: `${c.phone || c.number || ''} (${c.name})`
        }));
      }
    }
  } catch (e) {
    console.error("Erro ao ler conexões", e);
  }
  return MOCK_CONNECTIONS;
};

// ============================================================================
// NÓ CUSTOMIZADO: INÍCIO (RAIZ) - ESTILO TAKE BLIP
// ============================================================================
const RootNode = ({ id, data, selected }: any) => {
  const isActive = data.isActive !== false;
  const connections = getConnections();
  const connectionName = connections.find(c => c.id === data.mainConnectionId)?.name || 'Nenhuma conexão';
  const status: NodeStatus = data.status || 'idle';

  return (
    <div className={cn(
      "shadow-xl rounded-xl min-w-[280px] transition-all relative group bg-white dark:bg-slate-800 border-t-4",
      selected ? "ring-4 ring-indigo-500/20 border-x border-b border-indigo-500 border-t-indigo-600" : "border border-slate-200 dark:border-slate-700 border-t-indigo-500",
      !isActive && "opacity-60 grayscale",
      status === 'running' && "ring-4 ring-blue-500/50 border-blue-400 animate-pulse",
      status === 'success' && "border-emerald-500 ring-emerald-500/20",
      status === 'error' && "border-rose-500 ring-rose-500/20"
    )}>
      
      {status === 'running' && <div className="absolute -top-3 -right-3 bg-blue-500 text-white p-1 rounded-full"><Loader2 size={16} className="animate-spin" /></div>}
      {status === 'success' && <div className="absolute -top-3 -right-3 bg-emerald-500 text-white p-1 rounded-full"><CheckCircle2 size={16} /></div>}
      {status === 'error' && (
        <div className="absolute -top-3 -right-3 bg-rose-500 text-white p-1 rounded-full cursor-help" title={data.errorMessage || "Falha na execução"}>
          <AlertTriangle size={16} />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", isActive ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500")}>
              <Bot size={16} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Início do Fluxo</span>
          </div>
          {!isActive && <span className="text-[9px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-500/30">Pausado</span>}
        </div>
        
        <div className="font-bold text-base mb-2 truncate text-slate-800 dark:text-slate-100">{data.label || 'Saudação Inicial'}</div>
        
        <div className="flex flex-col gap-1.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="text-[10px] flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            <Smartphone size={12} className={isActive ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400"} />
            <span className="truncate">{connectionName}</span>
          </div>
        </div>

        {status === 'error' && data.errorMessage && (
          <div className="mt-3 text-[9px] bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 p-2 rounded border border-rose-200 dark:border-rose-500/20">
            Erro: {data.errorMessage}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500 border-2 border-white dark:border-slate-800" />
    </div>
  );
};

// ============================================================================
// NÓ CUSTOMIZADO: OPÇÕES DE MENU - ESTILO TAKE BLIP
// ============================================================================
const MenuNode = ({ id, data, selected }: any) => {
  const isActive = data.isActive !== false;
  const hasTransfer = data.connectionId && data.connectionId !== 'inherit';
  const connections = getConnections();
  const connectionName = hasTransfer ? connections.find(c => c.id === data.connectionId)?.name : 'Mesma Conexão';
  const status: NodeStatus = data.status || 'idle';
  const options = data.options || [];
  const allowBack = data.allowBack || false;
  const allowHome = data.allowHome || false;

  return (
    <div className={cn(
      "shadow-xl rounded-xl min-w-[280px] transition-all relative group bg-white dark:bg-slate-800 border-t-4",
      selected ? "ring-4 ring-emerald-500/20 border-x border-b border-emerald-500 border-t-emerald-500" : "border border-slate-200 dark:border-slate-700 border-t-emerald-400",
      !isActive && "opacity-60 grayscale bg-slate-50 dark:bg-slate-800/50",
      status === 'running' && "ring-4 ring-blue-500/30 border-blue-400 animate-pulse",
      status === 'success' && "border-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-500/10",
      status === 'error' && "border-rose-500 ring-4 ring-rose-50 dark:ring-rose-500/10"
    )}>
      
      {status === 'running' && <div className="absolute -top-3 -right-3 bg-blue-500 text-white p-1 rounded-full"><Loader2 size={16} className="animate-spin" /></div>}
      {status === 'success' && <div className="absolute -top-3 -right-3 bg-emerald-500 text-white p-1 rounded-full"><CheckCircle2 size={16} /></div>}
      {status === 'error' && (
        <div className="absolute -top-3 -right-3 bg-rose-500 text-white p-1 rounded-full cursor-help" title={data.errorMessage || "Falha ao processar menu"}>
          <AlertTriangle size={16} />
        </div>
      )}

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

        {/* LISTA DE OPÇÕES VISUAIS DO MENU */}
        {(options.length > 0 || allowBack || allowHome) && (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700 p-2.5 mb-3 space-y-1.5">
            <div className="text-[9px] font-bold text-slate-400 uppercase mb-2">Opções para o cliente:</div>
            
            {options.map((opt: any, idx: number) => (
              <div key={idx} className="text-[11px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 w-5 h-5 rounded flex items-center justify-center font-bold text-[10px]">{idx + 1}</span>
                <span className="truncate">{opt.title}</span>
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
              {data.agents?.length || 0} agentes vinculados
            </div>
            {data.closingMessage && <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_5px_rgba(52,211,153,0.5)]" title="Mensagem de encerramento configurada" />}
          </div>
          
          {hasTransfer && (
            <div className="text-[9px] flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-2 py-1.5 rounded border border-indigo-100 dark:border-indigo-500/20 mt-1 font-medium">
              <Phone size={10} />
              <span className="truncate max-w-[200px]">Transbordo: {connectionName}</span>
            </div>
          )}
        </div>

        {status === 'error' && data.errorMessage && (
          <div className="mt-3 text-[9px] bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 p-2 rounded border border-rose-200 dark:border-rose-500/20">
            Erro: {data.errorMessage}
          </div>
        )}
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
const socket = io('http://localhost:3001');

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const Automation = () => {
  const [isDark, setIsDark] = useState(false);

  // Estado de Múltiplos Fluxos
  const [flows, setFlows] = useState<FlowData[]>([]);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);

  // Estado do Canvas Atual
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [currentFlowName, setCurrentFlowName] = useState('Novo Fluxo');
  const [isCurrentFlowActive, setIsCurrentFlowActive] = useState(true);

  // Estado de Execução (Simulação n8n)
  const [isSimulating, setIsSimulating] = useState(false);

  // INICIALIZAÇÃO DE FLUXOS
  useEffect(() => {
    const savedFlows = localStorage.getItem(STORAGE_KEY_FLOWS);
    if (savedFlows) {
      try {
        setFlows(JSON.parse(savedFlows));
      } catch (e) {
        console.error("Erro ao fazer parse dos fluxos", e);
      }
    }
  }, []);

  // LÓGICA DE TEMA AUTOMÁTICO FORÇADO NO ROOT E SINCRONIZADO (SEM BOTÕES MANUAIS)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (systemIsDark: boolean) => {
      setIsDark(systemIsDark); // Atualiza estado para o Canvas ReactFlow e Cores Internas

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

  // Adiciona um novo menu ao Canvas
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
          allowBack: false, // Take Blip style default
          allowHome: false, // Take Blip style default
          closingMessage: '',
          isActive: true,
          connectionId: 'inherit',
          onAddSubmenu: addMenuOption
        },
        position: { 
          x: parentNode ? parentNode.position.x : Math.random() * 400, 
          y: parentNode ? parentNode.position.y + 250 : Math.random() * 400 
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
  }, [isDark]);

  // Cria um fluxo do zero
  const handleCreateNewFlow = () => {
    const newId = `flow_${Date.now()}`;
    const initialNodes = [
      {
        id: 'root',
        type: 'rootNode',
        data: { 
          label: '🚀 Saudação & Triagem Inicial', 
          welcomeText: 'Olá! Seja bem-vindo ao nosso atendimento.', 
          isActive: true,
          mainConnectionId: getConnections()[0]?.id,
          onAddSubmenu: addMenuOption 
        },
        position: { x: 250, y: 50 },
      }
    ];
    
    setCurrentFlowId(newId);
    setCurrentFlowName(`Automação ${flows.length + 1}`);
    setIsCurrentFlowActive(true);
    setNodes(initialNodes);
    setEdges([]);
    setSelectedNodeId(null);
  };

  // Abre um fluxo existente
  const handleOpenFlow = (flow: FlowData) => {
    setCurrentFlowId(flow.id);
    setCurrentFlowName(flow.name);
    setIsCurrentFlowActive(flow.isActive);
    
    // Injetar função de submenu de volta aos nós, pois o JSON.stringify remove funções
    const restoredNodes = flow.nodes.map(n => ({
      ...n,
      data: { ...n.data, onAddSubmenu: addMenuOption, status: 'idle', errorMessage: null }
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

  // Salva o fluxo atual
  const handleSaveFlow = () => {
    if (!currentFlowId) return;

    // Reseta status antes de salvar para não salvar sujeira visual
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
    localStorage.setItem(STORAGE_KEY_FLOWS, JSON.stringify(newFlows));
    
    // Atualiza socket apenas do fluxo ativo se ele estiver ativo
    if (isCurrentFlowActive) {
      socket.emit('update_flow', { flowId: currentFlowId, nodes: cleanNodes, edges });
    }
    
    toast.success("Automação salva com sucesso!");
  };

  // Exclui um fluxo
  const handleDeleteFlow = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Deseja realmente excluir este fluxo de automação?")) {
      const newFlows = flows.filter(f => f.id !== id);
      setFlows(newFlows);
      localStorage.setItem(STORAGE_KEY_FLOWS, JSON.stringify(newFlows));
      toast.info("Fluxo removido.");
    }
  };

  // Funções do React Flow
  const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ 
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

  // ============================================================================
  // SIMULADOR DE FLUXO (ESTILO N8N / TAKE BLIP)
  // ============================================================================
  const simulateFlow = async () => {
    if (nodes.length === 0) return;
    setIsSimulating(true);
    setSelectedNodeId(null); // Esconde painel
    toast.info("Iniciando simulação do fluxo...");

    // Resetar todos
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, status: 'idle', errorMessage: null } })));
    setEdges(eds => eds.map(e => ({ ...e, animated: false, style: { stroke: isDark ? '#64748b' : '#94a3b8', strokeWidth: 2 } })));

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const processNode = async (nodeId: string) => {
      // Set to running
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'running' } } : n));
      await delay(1200); // Tempo fingindo processamento

      const node = nodes.find(n => n.id === nodeId);
      if (!node?.data.isActive) {
        // Se inativo, falha intencional de simulação
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', errorMessage: 'O nó está inativo no momento.' } } : n));
        return;
      }

      // Sorteio aleatório de erro (10% de chance nos nós de menu para mostrar como o n8n faz)
      const shouldFail = nodeId !== 'root' && Math.random() < 0.15;

      if (shouldFail) {
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', errorMessage: 'Tempo limite esgotado ou resposta inválida.' } } : n));
        // Anima a aresta de entrada em vermelho
        setEdges(eds => eds.map(e => e.target === nodeId ? { ...e, animated: true, style: { stroke: '#f43f5e', strokeWidth: 3 } } : e));
        return; // Para a cascata aqui
      }

      // Sucesso
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status: 'success' } } : n));
      
      // Achar filhos
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      
      // Anima arestas de saída em verde e pulsa
      setEdges(eds => eds.map(e => outgoingEdges.find(oe => oe.id === e.id) 
        ? { ...e, animated: true, style: { stroke: '#10b981', strokeWidth: 3 } } 
        : e
      ));

      await delay(500); // Pequeno intervalo antes de ir pro próximo

      // Rodar filhos em paralelo
      await Promise.all(outgoingEdges.map(e => processNode(e.target)));
      
      // Desliga animação da aresta quando acaba
      setEdges(eds => eds.map(e => outgoingEdges.find(oe => oe.id === e.id) 
        ? { ...e, animated: false, style: { stroke: isDark ? '#64748b' : '#94a3b8', strokeWidth: 2 } } 
        : e
      ));
    };

    // Inicia pelo root
    await processNode('root');
    setIsSimulating(false);
    toast.success("Simulação concluída!");
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  // ============================================================================
  // TELA 1: LISTAGEM DE FLUXOS
  // ============================================================================
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
      </AppLayout>
    );
  }

  // ============================================================================
  // TELA 2: CANVAS (EDITOR DO FLUXO SELECIONADO)
  // ============================================================================
  return (
    <AppLayout>
      <div className="h-full w-full flex flex-col overflow-hidden transition-colors duration-300 bg-slate-50 dark:bg-slate-900">
        
        {/* CABEÇALHO DO CANVAS */}
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
            {/* TOGGLE STATUS DESTE FLUXO */}
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
                {isCurrentFlowActive ? <Power size={12} /> : <Power size={12} />}
                {isCurrentFlowActive ? 'ATIVO' : 'PAUSADO'}
              </button>
            </div>

            {/* BOTÃO SIMULAR */}
            <button 
              onClick={simulateFlow} 
              disabled={isSimulating}
              className={cn(
                "flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl font-bold border border-blue-200 dark:border-blue-500/20 transition-all text-sm",
                isSimulating ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:shadow-md"
              )}
            >
              {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              Testar Fluxo
            </button>

            <button onClick={handleSaveFlow} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 text-sm">
              <Save size={16} /> Salvar
            </button>
          </div>
        </div>

        {/* ALERTA SE O FLUXO ESTIVER DESATIVADO */}
        {!isCurrentFlowActive && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-6 py-2 flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold animate-in slide-in-from-top-2">
            <AlertCircle size={14} /> 
            Este fluxo está em rascunho/pausado. Ele não responderá mensagens reais até ser ativado e salvo.
          </div>
        )}

        <div className="flex-1 overflow-hidden relative w-full">
          
          {/* ÁREA DO REACT FLOW */}
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
                  <Plus size={14} />Adicionar Bloco Solto
                </button>
              </Panel>
            </ReactFlow>
          </div>

          {/* PAINEL LATERAL DE PROPRIEDADES (OVERLAY) */}
          <div className={cn(
            "absolute right-0 top-0 bottom-0 w-full lg:w-[400px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-30 transition-transform duration-300 overflow-y-auto", 
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
                  {/* CONFIGURAÇÃO COMUM: STATUS DO NÓ (ON/OFF) */}
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

                  {/* NÓ RAIZ */}
                  {selectedNode.type === 'rootNode' ? (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 flex items-center gap-1">
                          <Smartphone size={12} /> Conexão Principal (Gatilho)
                        </label>
                        <select 
                          value={selectedNode.data.mainConnectionId || getConnections()[0]?.id}
                          onChange={(e) => updateNodeData(selectedNode.id, { mainConnectionId: e.target.value })}
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700 dark:text-slate-200"
                        >
                          {getConnections().map(conn => (
                            <option key={conn.id} value={conn.id}>{conn.name}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-tight">Canal de WhatsApp que ativa este fluxo inicial.</p>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Mensagem do Robô</label>
                        <textarea 
                          value={selectedNode.data.welcomeText || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { welcomeText: e.target.value })}
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm min-h-[120px] focus:ring-2 focus:ring-indigo-500 outline-none resize-y text-slate-800 dark:text-slate-200"
                          placeholder="Ex: Olá! Bem-vindo à nossa empresa..."
                        />
                      </div>
                    </>
                  ) : (
                    
                  /* NÓ DE MENU / OPÇÕES */
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Título do Menu</label>
                        <input 
                          type="text" 
                          value={selectedNode.data.label || ''} 
                          onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })} 
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800 dark:text-slate-200" 
                          placeholder="Ex: Departamento Comercial"
                        />
                      </div>

                      {/* NAVEGAÇÃO PADRÃO (VOLTAR/INÍCIO) ESTILO TAKE BLIP */}
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          Navegação Padrão (Pelo Cliente)
                        </label>
                        
                        <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div className="flex items-center gap-2">
                            <Undo2 size={16} className="text-amber-500" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Permitir "Voltar" (0)</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={selectedNode.data.allowBack || false} 
                            onChange={(e) => updateNodeData(selectedNode.id, { allowBack: e.target.checked })} 
                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500" 
                          />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div className="flex items-center gap-2">
                            <Home size={16} className="text-blue-500" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Permitir "Início" (#)</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={selectedNode.data.allowHome || false} 
                            onChange={(e) => updateNodeData(selectedNode.id, { allowHome: e.target.checked })} 
                            className="w-4 h-4 rounded text-blue-500 focus:ring-blue-500" 
                          />
                        </label>
                      </div>

                      {/* LISTA DE OPÇÕES PARA O CLIENTE */}
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
                        
                        <div className="space-y-2">
                          {(selectedNode.data.options || []).map((opt: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="w-6 h-6 shrink-0 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                              <input 
                                value={opt.title} 
                                onChange={(e) => {
                                  const newOpts = [...selectedNode.data.options];
                                  newOpts[idx].title = e.target.value;
                                  updateNodeData(selectedNode.id, { options: newOpts });
                                }}
                                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-emerald-500 text-xs text-slate-800 dark:text-slate-200"
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
                          ))}
                          {(!selectedNode.data.options || selectedNode.data.options.length === 0) && (
                            <p className="text-[10px] text-slate-400 italic">Nenhuma opção de número criada.</p>
                          )}
                        </div>
                      </div>

                      {/* CONEXÃO / TRANSFERÊNCIA */}
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
                          {getConnections().map(conn => (
                            <option key={conn.id} value={conn.id}>Transferir para: {conn.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* AGENTES */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Agentes para Direcionamento</label>
                        <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                          {['Ricardo Agente', 'Juliana Vendas', 'Marcos Suporte'].map(agent => (
                            <label key={agent} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                              <input 
                                type="checkbox" 
                                checked={selectedNode.data.agents?.includes(agent)} 
                                onChange={(e) => {
                                  const currentAgents = selectedNode.data.agents || [];
                                  const newAgents = e.target.checked 
                                    ? [...currentAgents, agent] 
                                    : currentAgents.filter((a: string) => a !== agent);
                                  updateNodeData(selectedNode.id, { agents: newAgents });
                                }} 
                                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500 bg-white dark:bg-slate-900" 
                              />
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{agent}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* AÇÕES INFERIORES */}
                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                    <button 
                      onClick={() => addMenuOption(selectedNode.id)} 
                      className="w-full py-3 flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all border border-emerald-100 dark:border-emerald-500/20 shadow-sm"
                    >
                      <Plus size={14} /> Conectar Novo Caminho / Submenu
                    </button>
                    
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

export default Automation;