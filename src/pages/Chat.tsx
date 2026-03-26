"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send, MessageSquare, ChevronLeft, CheckCircle, Loader2,
  ArrowRightLeft, ShieldAlert, Smile, Mic, X, Trash2,
  Plus, FileText, Image as ImageIcon, Camera,
  Bold, Italic, Strikethrough, Code, Quote, List as ListIcon, ListOrdered, Download,
  Reply, Check, Clock, UserPlus, Zap, Search, User, BarChart2, Calendar, Headphones,
  Tag, Tags, Lock, ChevronDown, Edit2, Palette, ZoomIn
} from "lucide-react";
import { cn } from "@/lib/utils";
import { socket } from "@/lib/socket";
import { toast } from "sonner";

const API_BASE_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) 
  ? process.env.NEXT_PUBLIC_API_URL 
  : 'http://localhost:3001';

// ============================================================================
// TEMA ESCURO
// ============================================================================
const useDarkTheme = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const saved = localStorage.getItem("theme");
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && systemDark)) root.classList.add("dark");
    else root.classList.remove("dark");
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) {
        if (e.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);
};

// ============================================================================
// VISUALIZADOR DE ÁUDIO
// ============================================================================
const AudioVisualizer = ({ stream }: { stream: MediaStream | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!stream || !canvasRef.current) return;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");
    let animationId: number;
    const draw = () => {
      if (!canvasCtx) return;
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        canvasCtx.fillStyle = `rgb(244, 63, 94)`;
        const y = (height - barHeight) / 2;
        canvasCtx.beginPath();
        canvasCtx.roundRect(x, y, barWidth - 2, barHeight || 2, 5);
        canvasCtx.fill();
        x += barWidth;
      }
    };
    draw();
    return () => { cancelAnimationFrame(animationId); audioContext.close(); };
  }, [stream]);
  return <canvas ref={canvasRef} width={180} height={30} className="mx-2" />;
};

// ============================================================================
// EMOJI PICKER
// ============================================================================
const EmojiPicker = ({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const emojiList = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🫣","🤭","🫢","🫡","🤫","🫠","🤥","😶","🫥","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","😵‍💫","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"];
  const filtered = searchTerm ? emojiList.filter(e => e.includes(searchTerm)) : emojiList;
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111b21] text-slate-900 dark:text-[#d1d7db] rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
      <div className="p-2 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Pesquisar emoji..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-2 py-1.5 text-sm bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        <div className="grid grid-cols-8 gap-1">
          {filtered.map((emoji, i) => (
            <button key={i} onClick={() => onEmojiSelect(emoji)} className="text-2xl w-full aspect-square flex items-center justify-center hover:bg-slate-100 dark:hover:bg-[#202c33] rounded-lg transition active:scale-90">{emoji}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// QUICK REPLIES
// ============================================================================
const QuickReplies = ({ onSelect }: { onSelect: (text: string) => void }) => {
  const [replies, setReplies] = useState<string[]>(() => {
    const saved = localStorage.getItem('quick_replies');
    return saved ? JSON.parse(saved) : ["Olá, como posso ajudar?", "Aguarde um momento, por favor.", "Obrigado pelo contato!", "Estarei transferindo para o setor responsável.", "Ok, entendi."];
  });
  const [newReply, setNewReply] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const saveReplies = (newReplies: string[]) => {
    setReplies(newReplies);
    localStorage.setItem('quick_replies', JSON.stringify(newReplies));
  };
  const addReply = () => {
    if (!newReply.trim()) return;
    if (editingIndex !== null) {
      const updated = [...replies];
      updated[editingIndex] = newReply;
      saveReplies(updated);
      setEditingIndex(null);
    } else {
      saveReplies([...replies, newReply]);
    }
    setNewReply('');
  };
  const deleteReply = (index: number) => saveReplies(replies.filter((_, i) => i !== index));
  const editReply = (index: number) => { setNewReply(replies[index]); setEditingIndex(index); };
  return (
    <div className="absolute bottom-[80px] left-4 bg-white dark:bg-[#111b21] rounded-xl shadow-2xl w-[320px] max-h-[400px] flex flex-col z-50 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-5 origin-bottom-left quick-replies-container" onClick={(e) => e.stopPropagation()}>
      <div className="p-3 bg-slate-50 dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800 font-bold text-sm flex justify-between items-center text-slate-900 dark:text-[#d1d7db]">
        <span>Respostas Rápidas</span>
        <button onClick={() => { setEditingIndex(null); setNewReply(''); }} className="text-xs text-emerald-600 hover:underline">Novo</button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {replies.map((reply, index) => (
          <div key={index} className="group flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-[#202c33] rounded-lg mb-1">
            <button onClick={() => onSelect(reply)} className="flex-1 text-left text-sm truncate text-slate-800 dark:text-[#d1d7db]">{reply}</button>
            <div className="hidden group-hover:flex gap-1">
              <button onClick={() => editReply(index)} className="text-xs text-blue-600 hover:underline px-1">Editar</button>
              <button onClick={() => deleteReply(index)} className="text-xs text-rose-600 hover:underline px-1">Remover</button>
            </div>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 flex gap-2">
        <input type="text" value={newReply} onChange={e => setNewReply(e.target.value)} placeholder="Nova resposta..." className="flex-1 px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-[#202c33] text-slate-900 dark:text-white" onKeyDown={e => e.key === 'Enter' && addReply()} />
        <button onClick={addReply} className="px-3 py-1 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600">{editingIndex !== null ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL DE IMAGEM COM ZOOM
// ============================================================================
const ImageModal = ({ src, onClose }: { src: string; onClose: () => void }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(Math.max(0.5, prev + delta), 4));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale === 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-[95vw] max-h-[95vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <img
          ref={imgRef}
          src={src}
          alt="Visualização"
          className="cursor-grab active:cursor-grabbing transition-transform"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transformOrigin: 'center',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
        >
          <X size={24} />
        </button>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
          Rolar para zoom | Arrastar para mover
        </div>
      </div>
    </div>
  );
};

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

interface MessageType {
  id?: string;
  body?: string;
  type?: string;
  mimetype?: string;
  caption?: string;
  fromMe?: boolean;
  timestamp?: any;
  ack?: number;
  quotedMsg?: any;
  url?: string;
  filename?: string;
  hasMedia?: boolean;
  mediaError?: boolean;
  mediaLoading?: boolean;
  mediaLoaded?: boolean;
  connectionId?: string;
  connectionName?: string;
  connectionColor?: string;
  [key: string]: any;
}

// ============================================================================
// TIPOS DE TAGS
// ============================================================================
interface TagItem {
  id: string;
  name: string;
  color: string;
}

// Tags vêm das regras de disparo salvas em Automation
const STORAGE_KEY_AUTOMATION_RULES = 'zapflow_disparo_rules';
const STORAGE_KEY_CHAT_TAGS = 'chat_tags_assignments';

// Resolve o ID do usuário logado a partir das chaves disponíveis no localStorage.
// Tenta em ordem: 'user_id' → busca por display name em 'zapflow_mock_users' → 'user_profile_id'.
const resolveCurrentUserId = (): string => {
  try {
    const directId = localStorage.getItem('user_id');
    if (directId) return directId;

    const displayName = localStorage.getItem('user_display_name');
    if (displayName) {
      const rawUsers = localStorage.getItem('zapflow_mock_users');
      const users: Array<{ id: string; name: string; displayName: string }> = rawUsers
        ? JSON.parse(rawUsers)
        : [
            { id: '1', name: 'Admin Master', displayName: 'Suporte Master' },
            { id: '2', name: 'Ricardo Silva', displayName: 'Ricardo' },
          ];
      const match = users.find(
        u => u.displayName === displayName || u.name === displayName
      );
      if (match) return match.id;
    }

    const profileId = localStorage.getItem('user_profile_id');
    if (profileId) return profileId;
  } catch {}
  return '';
};

// Lê regras de Automation e extrai tags acessíveis ao usuário atual.
const getTagsFromAutomationRules = (userId?: string): TagItem[] => {
  if (!userId) return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_AUTOMATION_RULES);
    if (!saved) return [];
    const rules: Array<{
      tagName?: string;
      tagColor?: string;
      assignedUserIds?: string[];
      assignedUserId?: string;
    }> = JSON.parse(saved);
    const seen = new Set<string>();
    const tags: TagItem[] = [];
    rules.forEach(rule => {
      const ids: string[] =
        rule.assignedUserIds && rule.assignedUserIds.length > 0
          ? rule.assignedUserIds
          : rule.assignedUserId
          ? [rule.assignedUserId]
          : [];
      if (!ids.includes(userId)) return;
      const name = rule.tagName?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        tags.push({
          id: `atag_${name.toLowerCase().replace(/\s+/g, '_')}`,
          name,
          color: rule.tagColor || '#10b981',
        });
      }
    });
    return tags;
  } catch {
    return [];
  }
};

// ============================================================================
// COMPONENTE TAG BADGE
// ============================================================================
const TagBadge = ({ tag, onRemove, canRemove }: { tag: TagItem; onRemove?: () => void; canRemove?: boolean }) => (
  <span
    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white select-none"
    style={{ backgroundColor: tag.color }}
  >
    {tag.name}
    {canRemove && onRemove && (
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="ml-0.5 hover:opacity-70 transition-opacity"
      >
        <X size={10} />
      </button>
    )}
  </span>
);

// ============================================================================
// COMPONENTE TAG MANAGER (painel de gerenciamento de tags globais)
// ============================================================================
const TagManagerModal = ({
  tags,
  onSave,
  onClose,
}: {
  tags: TagItem[];
  onSave: (tags: TagItem[]) => void;
  onClose: () => void;
}) => {
  const [localTags, setLocalTags] = useState<TagItem[]>(tags);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#10b981');

  const addTag = () => {
    if (!newName.trim()) return;
    const newTag: TagItem = { id: `tag_${Date.now()}`, name: newName.trim(), color: newColor };
    setLocalTags(prev => [...prev, newTag]);
    setNewName('');
    setNewColor('#10b981');
  };

  const removeTag = (id: string) => setLocalTags(prev => prev.filter(t => t.id !== id));
  const updateColor = (id: string, color: string) => setLocalTags(prev => prev.map(t => t.id === id ? { ...t, color } : t));
  const updateName = (id: string, name: string) => setLocalTags(prev => prev.map(t => t.id === id ? { ...t, name } : t));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-[#111b21] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Tags size={18} className="text-emerald-500" />
            Gerenciar Lista de Tags
          </h3>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-2">
          {localTags.map(tag => (
            <div key={tag.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-[#202c33] rounded-lg border border-slate-100 dark:border-slate-700">
              <input
                type="color"
                value={tag.color}
                onChange={e => updateColor(tag.id, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                title="Alterar cor"
              />
              <input
                type="text"
                value={tag.name}
                onChange={e => updateName(tag.id, e.target.value)}
                className="flex-1 text-sm bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name || 'Tag'}
              </span>
              <button onClick={() => removeTag(tag.id)} className="text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#202c33]"
              title="Cor da nova tag"
            />
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Nome da nova tag..."
              className="flex-1 text-sm bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button onClick={addTag} className="px-3 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 font-bold flex items-center gap-1">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              Cancelar
            </button>
            <button onClick={() => { onSave(localTags); onClose(); }} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600">
              Salvar Tags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE TAG SELECTOR (dropdown para atribuir tags a um chat)
// ============================================================================
const TagSelector = ({
  allTags,
  selectedTagIds,
  canManage,
  canEdit,
  onToggle,
  onOpenManager,
  onClose,
}: {
  allTags: TagItem[];
  selectedTagIds: string[];
  canManage: boolean;
  canEdit: boolean;
  onToggle: (tagId: string) => void;
  onOpenManager: () => void;
  onClose: () => void;
}) => {
  return (
    <div
      className="absolute right-0 top-[44px] bg-white dark:bg-[#111b21] rounded-xl shadow-2xl w-[280px] z-50 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-top-2 tag-selector-container"
      onClick={e => e.stopPropagation()}
    >
      <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-1.5">
          <Tags size={14} className="text-emerald-500" />
          Tags do Atendimento
        </span>
        {!canEdit && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <Lock size={10} /> Somente leitura
          </span>
        )}
      </div>

      <div className="p-2 max-h-[260px] overflow-y-auto custom-scrollbar">
        {allTags.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-4">Nenhuma tag cadastrada.</p>
        )}
        {allTags.map(tag => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              disabled={!canEdit}
              onClick={() => canEdit && onToggle(tag.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-all text-left",
                canEdit ? "hover:bg-slate-50 dark:hover:bg-[#202c33] cursor-pointer" : "cursor-default opacity-70",
                isSelected ? "bg-slate-50 dark:bg-[#202c33]" : ""
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded flex items-center justify-center border-2 transition-all flex-shrink-0",
                  isSelected ? "border-transparent" : "border-slate-300 dark:border-slate-600"
                )}
                style={isSelected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
              >
                {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
              {isSelected && (
                <span className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Ativa</span>
              )}
            </button>
          );
        })}
      </div>

      {canManage && (
        <div className="p-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onOpenManager}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#202c33] rounded-lg transition font-medium"
          >
            <Edit2 size={12} className="text-slate-400" />
            Gerenciar lista de tags
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const Chat = () => {
  useDarkTheme();

  const location = useLocation();
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState<ChatType[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatType | null>(null);
  const [chatMessages, setChatMessages] = useState<MessageType[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isBlockedByAdmin, setIsBlockedByAdmin] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isQuickRepliesOpen, setIsQuickRepliesOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null);
  const [accepted, setAccepted] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('zap_accepted') || '[]'); } catch { return []; }
  });
  const [closed, setClosed] = useState<{id: string; connectionId?: string; closedAt: number}[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('zap_closed') || '[]');
      return raw.filter((item: any) => Date.now() - (item.closedAt || 0) < 7 * 86400000);
    } catch { return []; }
  });
  const [transferred, setTransferred] = useState<{id: string; connectionId?: string; transferredAt: number}[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('zap_transferred') || '[]');
      return raw.filter((item: any) => Date.now() - (item.transferredAt || 0) < 7 * 86400000);
    } catch { return []; }
  });
  const [messageReactions, setMessageReactions] = useState<Record<string, Array<{emoji: string; from: string}>>>({});
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", company: "", email: "", notes: "" });
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [contactSearch, setContactSearch] = useState('');
  const mockContacts = [
    { name: 'João Silva (Cliente VIP)', number: '+55 11 99999-1111', id: '5511999991111@c.us' },
    { name: 'Maria Souza (Suporte Técnico)', number: '+55 11 98888-2222', id: '5511988882222@c.us' },
    { name: 'Financeiro Corp.', number: '+55 11 3333-4444', id: '551133334444@c.us' },
    { name: 'Carlos Andrade (Logística)', number: '+55 11 97777-3333', id: '5511977773333@c.us' },
    { name: 'Ana Paula (Fornecedor)', number: '+55 11 96666-5555', id: '5511966665555@c.us' },
    { name: 'Lucas Mendes (Diretoria)', number: '+55 11 95555-6666', id: '5511955556666@c.us' }
  ];
  const filteredModalContacts = mockContacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.number.includes(contactSearch));

  // Estado para o modal de imagem
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // ==========================================================================
  // SISTEMA DE TAGS
  // ==========================================================================
  const [currentUserId, setCurrentUserId] = useState<string>('');
  useEffect(() => {
    const uid = resolveCurrentUserId();
    setCurrentUserId(uid);
    if (uid) setAllTags(getTagsFromAutomationRules(uid));
  }, []);

  const [allTags, setAllTags] = useState<TagItem[]>(() => {
    if (typeof window === 'undefined') return [];
    const uid = resolveCurrentUserId();
    return uid ? getTagsFromAutomationRules(uid) : [];
  });

  const refreshTagsFromAutomation = () => {
    const uid = currentUserId || resolveCurrentUserId();
    if (uid) setAllTags(getTagsFromAutomationRules(uid));
  };

  const [chatTags, setChatTags] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHAT_TAGS);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const canEditTags = allTags.length > 0;
  const showTagButton = allTags.length > 0;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_CHAT_TAGS, JSON.stringify(chatTags)); } catch {}
  }, [chatTags]);

  const toggleTagOnChat = (chatId: string, tagId: string) => {
    if (!canEditTags) return;
    setChatTags(prev => {
      const current = prev[chatId] || [];
      const updated = current.includes(tagId)
        ? current.filter(id => id !== tagId)
        : [...current, tagId];
      return { ...prev, [chatId]: updated };
    });
  };

  const getTagsForChat = (chatId: string): TagItem[] => {
    const ids = chatTags[chatId] || [];
    return allTags.filter(t => ids.includes(t.id));
  };

  // ==========================================================================
  // AUXILIARES
  // ==========================================================================
  const scrollRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // CARREGAMENTO AUTOMÁTICO DE HISTÓRICO
  // ==========================================================================
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allHistoryLoaded, setAllHistoryLoaded] = useState<Record<string, boolean>>({});
  const autoLoadRef = useRef<Record<string, boolean>>({});
  const BATCH_SIZE = 200;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedContactRef = useRef<ChatType | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  const messagesCache = useRef<Record<string, MessageType[]>>({});
  const loadingChats = useRef<Set<string>>(new Set());

  const sanitizeForStorage = (msg: MessageType): MessageType => {
    if (msg.hasMedia) { const { body, ...rest } = msg; return { ...rest, body: undefined, mediaStored: false }; }
    return msg;
  };

  const loadFromLocalStorage = (chatId: string, connectionId?: string): MessageType[] | null => {
    const key = `chat_messages_${connectionId || 'default'}_${chatId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) { const msgs = JSON.parse(stored); return msgs.map((m: any) => ({ ...m, mediaLoading: false, mediaLoaded: false })); }
    } catch (e) { console.error("Erro ao ler localStorage:", e); }
    return null;
  };

  const saveToLocalStorage = (chatId: string, connectionId: string | undefined, messages: MessageType[]) => {
    const key = `chat_messages_${connectionId || 'default'}_${chatId}`;
    try {
      const limitedMessages = messages.slice(-200);
      const sanitized = limitedMessages.map(sanitizeForStorage);
      localStorage.setItem(key, JSON.stringify(sanitized));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('chat_messages_'));
          for (const k of keys) {
            localStorage.removeItem(k);
            localStorage.setItem(key, JSON.stringify(messages.slice(-100).map(sanitizeForStorage)));
            break;
          }
        } catch {}
      }
    }
  };

  useEffect(() => {
    if (chats.length === 0) return;
    chats.forEach(chat => {
      if (!messagesCache.current[chat.id]) {
        const stored = loadFromLocalStorage(chat.id, chat.connectionId);
        if (stored) messagesCache.current[chat.id] = stored;
      }
    });
  }, [chats]);

  const [availableConnections, setAvailableConnections] = useState<ConnectionInfo[]>([]);
  const [selectedConnectionFilter, setSelectedConnectionFilter] = useState<string>('all');
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, {status: string, enabled: boolean}>>({});

  const [agentName, setAgentName] = useState<string>("Agente");
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('user_display_name');
      if (storedName) setAgentName(storedName);
    }
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }, []);

  const showNotification = (title: string, body: string, icon?: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") new Notification(title, { body, icon: icon || "/favicon.ico" });
  };

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/connections`);
        const data = await res.json();
        setAvailableConnections(data);
        const statusMap: Record<string, {status: string, enabled: boolean}> = {};
        data.forEach((c: any) => { statusMap[c.id] = { status: c.status, enabled: c.enabled }; });
        setConnectionStatuses(statusMap);
      } catch (error) { console.error('Erro ao buscar conexões:', error); }
    };
    fetchConnections();
    const handleConnectionStatus = ({ connectionId, status, enabled }: any) => {
      setConnectionStatuses(prev => ({ ...prev, [connectionId]: { status, enabled } }));
    };
    socket.on('connection:status', handleConnectionStatus);
    return () => { socket.off('connection:status', handleConnectionStatus); };
  }, []);

  useEffect(() => {
    if (selectedContact) {
      try {
        const contactToSave = { id: selectedContact.id, name: selectedContact.name, connectionId: selectedContact.connectionId, connectionName: selectedContact.connectionName, connectionColor: selectedContact.connectionColor };
        localStorage.setItem('zap_selected_contact', JSON.stringify(contactToSave));
      } catch (error: any) {
        if (error.name === 'QuotaExceededError') try { localStorage.removeItem('zap_selected_contact'); } catch {}
      }
    } else { localStorage.removeItem('zap_selected_contact'); }
  }, [selectedContact]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedContact = localStorage.getItem('zap_selected_contact');
      if (savedContact) { try { const contact = JSON.parse(savedContact); setSelectedContact(contact); selectedContactRef.current = contact; } catch {} }
    }
  }, []);

  useEffect(() => {
    if (location.state?.newContact) {
      const contact = location.state.newContact;
      const safeContact = { ...contact, name: contact.name || contact.number || 'Contato' };
      setChats(prev => prev.some(c => c.id === safeContact.id) ? prev : [{ ...safeContact, unreadCount: 0 }, ...prev]);
      setClosed(prev => prev.filter(item => !(item.id === safeContact.id && (!item.connectionId || item.connectionId === safeContact.connectionId))));
      setTransferred(prev => prev.filter(item => !(item.id === safeContact.id && (!item.connectionId || item.connectionId === safeContact.connectionId))));
      setAccepted(prev => { const key = `${safeContact.id}_${safeContact.connectionId || 'default'}`; return prev.includes(key) || prev.includes(safeContact.id) ? prev : [...prev, key]; });
      const timer = setTimeout(() => { setSelectedContact(safeContact); selectedContactRef.current = safeContact; }, 100);
      window.history.replaceState({}, document.title);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  useEffect(() => { localStorage.setItem('zap_accepted', JSON.stringify(accepted)); }, [accepted]);
  useEffect(() => { localStorage.setItem('zap_closed', JSON.stringify(closed)); }, [closed]);
  useEffect(() => { localStorage.setItem('zap_transferred', JSON.stringify(transferred)); }, [transferred]);
  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);

  useEffect(() => {
    const handleProfilePicUpdate = (data: { id: string; picUrl: string }) => {
      if (!data?.id || !data?.picUrl) return;
      setChats(prev => prev.map(c => c.id === data.id ? { ...c, picUrl: data.picUrl } : c));
      if (selectedContactRef.current?.id === data.id) setSelectedContact(prev => prev ? { ...prev, picUrl: data.picUrl } : null);
    };
    socket.on('profile_pic_update', handleProfilePicUpdate);
    return () => socket.off('profile_pic_update', handleProfilePicUpdate);
  }, []);

  const profilePicRequested = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (chats.length === 0) return;
    chats.forEach(chat => {
      if (!chat.picUrl && !chat.profilePicUrl && !profilePicRequested.current.has(chat.id)) {
        profilePicRequested.current.add(chat.id);
        socket.emit("get_profile_pic", { chatId: chat.id, connectionId: chat.connectionId });
      }
    });
  }, [chats]);

  const [loadError, setLoadError] = useState<string | null>(null);
  const getProfilePic = (c: any) => c?.picUrl || c?.profilePicUrl || null;

  const ck = (c: any) => `${c.id}_${c.connectionId || 'default'}`;
  const isAccepted = (c: any) => accepted.includes(ck(c)) || accepted.includes(c.id);
  const isInClosed = (c: any) => closed.some(item => item.id === c.id && (!item.connectionId || item.connectionId === c.connectionId));
  const isInTransferred = (c: any) => transferred.some(item => item.id === c.id && (!item.connectionId || item.connectionId === c.connectionId));

  const getMessageSender = (m: any) => {
    if (m.sender === 'system_note') return 'system_note';
    if (m.fromMe || m.sender === 'agent' || m.sender === 'me') return 'agent';
    return 'client';
  };

  const getMessageTime = (m: any) => {
    let ts = m.timestamp || m.createdAt || m.time;
    if (!ts) return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (String(ts).length === 10) ts = Number(ts) * 1000;
    return new Date(Number(ts)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const formatAudioTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderMessageStatus = (ack: number) => {
    if (ack === 3 || ack === 4) return <div className="text-[#53bdeb]"><Check size={16} className="absolute ml-[5px]" /><Check size={16} /></div>;
    if (ack === 2) return <div className="text-slate-400 dark:text-[#8696a0]"><Check size={16} className="absolute ml-[5px]" /><Check size={16} /></div>;
    if (ack === 1) return <div className="text-slate-400 dark:text-[#8696a0]"><Check size={16} /></div>;
    return <div className="text-slate-400 dark:text-[#8696a0]"><Clock size={14} /></div>;
  };

  const formatWhatsAppText = (text: string) => {
    if (!text) return "";
    let formatted = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline break-all">$1</a>');
    formatted = formatted.replace(/```([\s\S]*?)```/g, (match, code) => {
      const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<pre class="bg-black/10 dark:bg-white/10 p-2 rounded my-1 text-[13px] font-mono whitespace-pre-wrap overflow-x-auto border border-black/10 dark:border-white/10">${escaped}</pre>`;
    });
    formatted = formatted.replace(/`([^`\n]+)`/g, '<code class="bg-black/10 dark:bg-white/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-[13px] font-mono border border-black/5 dark:border-white/5">$1</code>');
    formatted = formatted.replace(/\*([^\*\n]+)\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/_([^\_\n]+)_/g, '<em>$1</em>');
    formatted = formatted.replace(/~([^~\n]+)~/g, '<del>$1</del>');
    formatted = formatted.replace(/^&gt; (.*$)/gm, '<blockquote class="border-l-4 border-current opacity-80 pl-2.5 ml-1 my-1.5 py-0.5 italic bg-black/5 dark:bg-white/5 rounded-r-md">$1</blockquote>');
    formatted = formatted.replace(/\n/g, '<br />');
    return formatted;
  };

  const getMediaSrc = useCallback((m: MessageType): string | null => {
    if (m.body && typeof m.body === 'string') {
      if (m.body.startsWith('data:')) return m.body;
      if (m.body.length > 0) return `data:${m.mimetype || 'application/octet-stream'};base64,${m.body}`;
    }
    return m.url || null;
  }, []);

  const fetchMedia = useCallback((messageId: string, chatId: string, connectionId?: string) => {
    return new Promise((resolve, reject) => {
      socket.emit("get_media", { chatId, messageId, connectionId }, (response: any) => {
        if (response.success) resolve(response); else reject(response.error);
      });
    });
  }, []);

  const updateMessageWithMedia = useCallback((chatId: string, messageId: string, mediaData: any) => {
    if (messagesCache.current[chatId]) {
      messagesCache.current[chatId] = messagesCache.current[chatId].map(msg =>
        msg.id === messageId ? { ...msg, body: mediaData.media, mimetype: mediaData.mimetype, filename: mediaData.filename, mediaLoaded: true } : msg
      );
      const conn = selectedContactRef.current;
      saveToLocalStorage(chatId, conn?.connectionId, messagesCache.current[chatId]);
    }
    if (selectedContactRef.current?.id === chatId) {
      setChatMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, body: mediaData.media, mimetype: mediaData.mimetype, filename: mediaData.filename, mediaLoaded: true } : msg));
    }
  }, []);

  const isSurveyMessage = (msg: MessageType): boolean => {
    if (msg.body === "❌ Por favor, responda apenas com um número de 1 a 5.") return true;
    if (msg.body && /^[1-5]$/.test(msg.body.trim())) return true;
    return false;
  };

  const renderMessageContent = (m: MessageType) => {
    const isImage = m.type === 'image' || m.mimetype?.startsWith('image/');
    const isVideo = m.type === 'video' || m.mimetype?.startsWith('video/');
    const isAudio = m.type === 'ptt' || m.type === 'audio' || m.mimetype?.startsWith('audio/');
    const isDoc = m.type === 'document' || m.mimetype?.startsWith('application/');
    const src = getMediaSrc(m);
    if (m.hasMedia && !m.mediaLoaded && !src && selectedContact) {
      if (!m.mediaLoading) {
        m.mediaLoading = true;
        fetchMedia(m.id!, selectedContact.id, selectedContact.connectionId)
          .then((mediaData: any) => updateMessageWithMedia(selectedContact.id, m.id!, mediaData))
          .catch(() => updateMessageWithMedia(selectedContact.id, m.id!, { media: null, mimetype: m.mimetype, filename: m.filename }));
      }
      if (isImage) return <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 h-[150px] w-[200px] rounded-lg text-slate-400 flex-col gap-2 border border-slate-200 dark:border-slate-700"><Loader2 className="animate-spin" size={24} /><span className="text-[10px] uppercase font-bold opacity-70">Carregando...</span></div>;
      if (isAudio) return <div className="flex items-center gap-2 min-w-[240px] mt-1 mb-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-slate-100 dark:border-slate-700"><div className={cn("p-2.5 rounded-full text-white shrink-0", m.fromMe ? "bg-emerald-500" : "bg-slate-500")}><Mic size={18}/></div><Loader2 className="animate-spin" size={16} /></div>;
      if (isDoc) return <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700"><div className="bg-white dark:bg-slate-900 p-2 rounded text-rose-500 shadow-sm"><FileText size={24}/></div><div className="flex-1 overflow-hidden"><p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">{m.filename || "Carregando..."}</p><Loader2 className="animate-spin" size={14} /></div></div>;
    }
    if (isImage) {
      const imageSrc = src;
      return (
        <div className="mb-1 relative group flex flex-col w-fit max-w-full">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Foto"
              className="rounded-lg max-w-full h-auto object-contain max-h-[300px] cursor-pointer hover:opacity-90 transition"
              onClick={() => setSelectedImage(imageSrc)}
            />
          ) : (
            <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 h-[150px] w-[200px] rounded-lg text-slate-400 flex-col gap-2 border border-slate-200 dark:border-slate-700">
              <ImageIcon size={32} className="opacity-50" />
              <span className="text-[10px] uppercase font-bold opacity-70">Foto (Histórico)</span>
            </div>
          )}
          {m.caption && (
            <div className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap px-1" dangerouslySetInnerHTML={{ __html: formatWhatsAppText(m.caption) }} />
          )}
        </div>
      );
    }
    if (isVideo) return <div className="mb-1 flex flex-col w-fit max-w-full">{src ? <video src={src} controls preload="metadata" className="rounded-lg max-w-full max-h-[300px] object-contain" /> : <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 w-[220px]"><Camera size={20}/><span className="text-xs font-medium">Vídeo (Histórico)</span></div>}{m.caption && <div className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap px-1" dangerouslySetInnerHTML={{ __html: formatWhatsAppText(m.caption) }} />}</div>;
    if (isAudio) { const s = getMediaSrc(m); return <div className="flex items-center gap-2 min-w-[240px] mt-1 mb-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-slate-100 dark:border-slate-700"><div className={cn("p-2.5 rounded-full text-white shrink-0", m.fromMe ? "bg-emerald-500" : "bg-slate-500 dark:bg-slate-600")}><Mic size={18}/></div><div className="flex-1 px-1">{s ? <audio src={s} controls controlsList="nodownload" className="h-8 w-full max-w-[200px]" /> : <div className="text-xs text-slate-400 italic pl-1">Áudio não carregado</div>}</div></div>; }
    if (isDoc) { return <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer mt-1 mb-1 border border-slate-200 dark:border-slate-700 group"><div className="bg-white dark:bg-slate-900 p-2 rounded text-rose-500 shadow-sm"><FileText size={24}/></div><div className="flex-1 overflow-hidden"><p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">{m.filename || "Arquivo"}</p><p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{m.mimetype?.split('/')[1] || 'DOC'}</p></div>{src ? <a href={src} download={m.filename || 'download'} className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"><Download size={20}/></a> : <span className="text-[9px] bg-slate-300 dark:bg-slate-700 px-1 rounded text-white">?</span>}</div>; }
    return <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatWhatsAppText(m.body || m.text || "") }} />;
  };

  const acceptedRef = useRef(accepted);
  const closedRef = useRef(closed);
  const transferredRef = useRef(transferred);
  const chatsRef = useRef(chats);
  useEffect(() => { acceptedRef.current = accepted; closedRef.current = closed; transferredRef.current = transferred; chatsRef.current = chats; }, [accepted, closed, transferred, chats]);

  useEffect(() => {
    socket.emit("get_chats");
    const handleChats = (data: ChatType[]) => {
      const filtered = (data || []).filter(c => !c.id.includes('status@'));
      setChats(prev => {
        const ckey = (c: any) => `${c.id}_${c.connectionId || ''}`;
        const prevKeys = new Set(prev.map(p => ckey(p)));
        const novos = filtered.filter(f => !prevKeys.has(ckey(f)));
        const updated = prev.map(p => { const found = filtered.find(f => ckey(f) === ckey(p)); return found ? { ...p, ...found } : p; });
        return [...updated, ...novos];
      });
    };
    const handleNewMessage = (data: any) => {
      const chatKey = data.chatId || data.from || data.to;
      if (chatKey) {
        const msgWithFlags = { ...data, mediaLoading: false, mediaLoaded: false };
        if (!messagesCache.current[chatKey]) messagesCache.current[chatKey] = [];
        if (!msgWithFlags.id || !messagesCache.current[chatKey].some(m => m.id === msgWithFlags.id)) {
          messagesCache.current[chatKey].push(msgWithFlags);
          messagesCache.current[chatKey].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          const conn = selectedContactRef.current;
          if (conn && conn.id === chatKey) saveToLocalStorage(chatKey, conn.connectionId, messagesCache.current[chatKey]);
          else { const chat = chatsRef.current.find(c => c.id === chatKey); if (chat) saveToLocalStorage(chatKey, chat.connectionId, messagesCache.current[chatKey]); }
        }
        const isSelected = selectedContactRef.current?.id === chatKey;
        if (isSelected) {
          setChatMessages([...messagesCache.current[chatKey]]);
          socket.emit("mark_chat_as_read", chatKey);
          setChats(prev => prev.map(c => c.id === chatKey ? { ...c, unreadCount: 0 } : c));
        } else {
          setChats(prev => prev.map(c => c.id === chatKey && !data.fromMe ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c));
          if (!data.fromMe) {
            const chat = chatsRef.current.find(c => c.id === chatKey);
            const senderName = chat?.name || "Contato";
            const preview = data.body || (data.hasMedia ? "📎 Mídia" : "Nova mensagem");
            const isInAccepted = acceptedRef.current.some(k => k === chatKey || k.startsWith(chatKey + '_'));
            const isInClosed = closedRef.current.some(item => item.id === chatKey);
            const isInTransferred = transferredRef.current.some(item => item.id === chatKey);
            if (!isInAccepted && !isInClosed && !isInTransferred) showNotification(`Nova conversa na fila`, `${senderName}: ${preview}`);
            else if (isInAccepted && !isSelected) showNotification(senderName, preview);
          }
        }
      }
    };
    const handleMessageAck = (data: { id: string; chatId: string; ack: number }) => {
      if (selectedContactRef.current && data.chatId === selectedContactRef.current.id) {
        setChatMessages(prev => prev.map(msg => msg.id === data.id ? { ...msg, ack: data.ack } : msg));
        if (messagesCache.current[data.chatId]) {
          messagesCache.current[data.chatId] = messagesCache.current[data.chatId].map(msg => msg.id === data.id ? { ...msg, ack: data.ack } : msg);
          const conn = selectedContactRef.current;
          if (conn) saveToLocalStorage(data.chatId, conn.connectionId, messagesCache.current[data.chatId]);
        }
      }
    };
    const handleChatUpdated = (updatedChat: any) => {
      setChats(prev => { const index = prev.findIndex(c => c.id === updatedChat.id); if (index >= 0) { const newChats = [...prev]; newChats[index] = { ...newChats[index], ...updatedChat }; return newChats; } else { return [updatedChat, ...prev]; } });
    };
    socket.on("chats", handleChats);
    socket.on("chat_messages_error", (data: any) => {
      if (data.chatId === selectedContactRef.current?.id) {
        setLoadError(data.error || "Erro ao carregar mensagens");
        setIsLoadingMessages(false);
        setIsLoadingMore(false);
      }
      autoLoadRef.current[data.chatId] = false;
    });

    socket.on("chat_messages", (data: any) => {
      const msgs: MessageType[] = data?.messages || [];
      const chatId: string = data.chatId;
      const isAutoLoad: boolean = data.autoLoad === true;

      if (!chatId) return;

      const msgsWithFlags = msgs
        .map((msg: any) => ({ ...msg, mediaLoading: false, mediaLoaded: false }))
        .filter((msg: any, _: any, self: any[]) => self.findIndex((m: any) => m.id === msg.id) === _);

      if (isAutoLoad) {
        const existing = messagesCache.current[chatId] || [];
        const existingIds = new Set(existing.map((m: MessageType) => m.id));
        const brandNew = msgsWithFlags.filter((m: MessageType) => !existingIds.has(m.id));

        autoLoadRef.current[chatId] = false;

        if (brandNew.length === 0) {
          setAllHistoryLoaded(prev => ({ ...prev, [chatId]: true }));
          setIsLoadingMore(false);
          return;
        }

        const merged = [...brandNew, ...existing].sort(
          (a: MessageType, b: MessageType) => (a.timestamp || 0) - (b.timestamp || 0)
        );
        messagesCache.current[chatId] = merged;

        const conn = chatsRef.current.find((c: ChatType) => c.id === chatId);
        if (conn) saveToLocalStorage(chatId, conn.connectionId, merged);

        if (selectedContactRef.current?.id === chatId) {
          const scrollEl = scrollRef.current;
          const prevScrollHeight = scrollEl?.scrollHeight || 0;
          const prevScrollTop = scrollEl?.scrollTop || 0;

          setChatMessages([...merged]);

          requestAnimationFrame(() => {
            if (scrollEl) {
              scrollEl.scrollTop = prevScrollTop + (scrollEl.scrollHeight - prevScrollHeight);
            }
          });
        }

        setIsLoadingMore(false);

        if (brandNew.length >= BATCH_SIZE / 2) {
          const oldestTs = merged[0]?.timestamp;
          if (oldestTs) {
            setTimeout(() => {
              if (!autoLoadRef.current[chatId]) {
                autoLoadRef.current[chatId] = true;
                setIsLoadingMore(true);
                const contact = selectedContactRef.current;
                socket.emit("get_chat_messages", {
                  chatId,
                  connectionId: contact?.connectionId,
                  limit: BATCH_SIZE,
                  before: oldestTs,
                  autoLoad: true,
                });
              }
            }, 600);
          }
        } else {
          setAllHistoryLoaded(prev => ({ ...prev, [chatId]: true }));
        }

      } else {
        const uniqueMessages = msgsWithFlags.reduce((acc: MessageType[], curr: MessageType) => {
          if (!acc.some((msg: MessageType) => msg.id === curr.id)) acc.push(curr);
          return acc;
        }, []);

        uniqueMessages.sort((a: MessageType, b: MessageType) => (a.timestamp || 0) - (b.timestamp || 0));
        messagesCache.current[chatId] = uniqueMessages;

        const conn = chatsRef.current.find((c: ChatType) => c.id === chatId);
        if (conn) saveToLocalStorage(chatId, conn.connectionId, uniqueMessages);

        if (selectedContactRef.current?.id === chatId) {
          setChatMessages(uniqueMessages);
          setIsLoadingMessages(false);
          socket.emit("mark_chat_as_read", chatId);
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c));

          if (uniqueMessages.length >= BATCH_SIZE / 2) {
            const oldestTs = uniqueMessages[0]?.timestamp;
            if (oldestTs && !autoLoadRef.current[chatId]) {
              autoLoadRef.current[chatId] = true;
              setIsLoadingMore(true);
              setTimeout(() => {
                socket.emit("get_chat_messages", {
                  chatId,
                  connectionId: selectedContactRef.current?.connectionId,
                  limit: BATCH_SIZE,
                  before: oldestTs,
                  autoLoad: true,
                });
              }, 800);
            }
          } else {
            setAllHistoryLoaded(prev => ({ ...prev, [chatId]: true }));
          }
        }
        autoLoadRef.current[chatId] = false;
      }
    });
    socket.on("receive_message", handleNewMessage);
    socket.on("message_ack_update", handleMessageAck);
    socket.on("chat_updated", handleChatUpdated);
    return () => { socket.off("chats", handleChats); socket.off("receive_message", handleNewMessage); socket.off("message_ack_update", handleMessageAck); socket.off("chat_updated", handleChatUpdated); socket.off("chat_messages_error"); socket.off("chat_messages"); };
  }, []);

  useEffect(() => {
    if (chats.length === 0) return;
    const timeoutId = setTimeout(() => {
      chats.forEach(chat => {
        if (loadingChats.current.has(chat.id) || messagesCache.current[chat.id]) return;
        loadingChats.current.add(chat.id);
        socket.emit("get_chat_messages", { chatId: chat.id, connectionId: chat.connectionId });
      });
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [chats]);

  useEffect(() => {
    if (selectedContact) {
      setIsBlockedByAdmin(false);
      setLoadError(null);
      setChatMessages([]);
      setIsLoadingMessages(true);
      setIsLoadingMore(false);
      setIsTagSelectorOpen(false);
      autoLoadRef.current[selectedContact.id] = false;

      loadingChats.current.add(selectedContact.id);
      socket.emit("get_chat_messages", {
        chatId: selectedContact.id,
        connectionId: selectedContact.connectionId,
        limit: BATCH_SIZE,
      });
    } else {
      setChatMessages([]);
      setIsLoadingMessages(false);
      setIsLoadingMore(false);
    }
  }, [selectedContact?.id]);

  // Scroll para o fundo na carga inicial
  const didScrollToBottom = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!isLoadingMessages && chatMessages.length > 0 && selectedContact) {
      const chatId = selectedContact.id;
      if (!didScrollToBottom.current[chatId]) {
        didScrollToBottom.current[chatId] = true;
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        });
      }
    }
  }, [isLoadingMessages, selectedContact?.id]);

  useEffect(() => {
    if (selectedContact?.id) didScrollToBottom.current[selectedContact.id] = false;
  }, [selectedContact?.id]);

  const applyFormatting = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newText = message.substring(0, start) + prefix + message.substring(start, end) + suffix + message.substring(end);
    setMessage(newText);
    setTimeout(() => { textareaRef.current?.focus(); textareaRef.current?.setSelectionRange(start + prefix.length, end + prefix.length); }, 10);
  };

  const handleSendMessage = () => {
    if (!message.trim() || !selectedContact || isBlockedByAdmin) return;
    const formattedMessage = `*${agentName}*\n\n${message}`;
    const tempMsg = { id: Date.now().toString(), body: formattedMessage, fromMe: true, timestamp: Math.floor(Date.now() / 1000), ack: 0, sender: 'agent', quotedMsg: replyingTo || undefined, mediaLoading: false, mediaLoaded: false, connectionId: selectedContact.connectionId };
    setChatMessages(prev => [...prev, tempMsg]);
    socket.emit("send_message", { to: selectedContact.id, text: formattedMessage, quotedMsgId: replyingTo?.id, quotedMsg: replyingTo, connectionId: selectedContact.connectionId });
    setMessage(""); setReplyingTo(null); setIsEmojiOpen(false); setIsQuickRepliesOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      const tempMsg = { id: Date.now().toString(), body: base64, mimetype: file.type, filename: file.name, type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document', fromMe: true, timestamp: Math.floor(Date.now() / 1000), ack: 0, sender: 'agent', hasMedia: true, mediaLoading: false, mediaLoaded: true, connectionId: selectedContact.connectionId };
      setChatMessages(prev => [...prev, tempMsg]);
      socket.emit("send_message", { to: selectedContact.id, text: "", file: base64, filename: file.name, mimetype: file.type, connectionId: selectedContact.connectionId });
      toast.success("Arquivo enviado!"); setIsAttachmentOpen(false);
    };
    reader.readAsDataURL(file); e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStream(stream);
      mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/ogg' });
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.start();
      setIsRecording(true); setRecordingTime(0);
      recordingInterval.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (err) { toast.error("Sem permissão de microfone."); }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/ogg' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          const tempMsg = { id: Date.now().toString(), body: base64, mimetype: 'audio/ogg', type: 'ptt', sender: 'agent', timestamp: Math.floor(Date.now()/1000), fromMe: true, ack: 0, hasMedia: true, mediaLoading: false, mediaLoaded: true, connectionId: selectedContact!.connectionId };
          setChatMessages(prev => [...prev, tempMsg]);
          socket.emit("send_message", { to: selectedContact!.id, text: "", file: base64, mimetype: 'audio/ogg', filename: `ptt-${Date.now()}.ogg`, isPtt: true, connectionId: selectedContact!.connectionId });
          toast.success("Áudio enviado!");
        };
        reader.readAsDataURL(audioBlob);
        recordingStream?.getTracks().forEach(track => track.stop()); setRecordingStream(null);
      };
      mediaRecorder.current.stop();
    }
    setIsRecording(false); if (recordingInterval.current) clearInterval(recordingInterval.current); setRecordingTime(0); audioChunks.current = [];
  };

  const cancelRecording = () => {
    if (mediaRecorder.current) { mediaRecorder.current.onstop = null; mediaRecorder.current.stop(); }
    recordingStream?.getTracks().forEach(track => track.stop()); setRecordingStream(null);
    setIsRecording(false); if (recordingInterval.current) clearInterval(recordingInterval.current); setRecordingTime(0); audioChunks.current = [];
  };

  const handleSendContact = (contact: { name: string; number: string; id: string }) => {
    if (!selectedContact) return;
    const messageText = `*Contato:* ${contact.name}\n*Número:* ${contact.number}`;
    const tempMsg = { id: Date.now().toString(), body: messageText, fromMe: true, timestamp: Math.floor(Date.now() / 1000), ack: 0, sender: 'agent', connectionId: selectedContact.connectionId };
    setChatMessages(prev => [...prev, tempMsg]);
    socket.emit("send_message", { to: selectedContact.id, text: messageText, connectionId: selectedContact.connectionId });
    setIsContactModalOpen(false); toast.success("Contato enviado!");
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (isAttachmentOpen && !target.closest('.attachment-container') && !target.closest('.attachment-picker-container')) setIsAttachmentOpen(false);
      if (isEmojiOpen && !target.closest('.emoji-container') && !target.closest('.emoji-picker-container')) setIsEmojiOpen(false);
      if (isQuickRepliesOpen && !target.closest('.quick-replies-container') && !target.closest('.quick-replies-trigger')) setIsQuickRepliesOpen(false);
      if (isTagSelectorOpen && !target.closest('.tag-selector-container') && !target.closest('.tag-selector-trigger')) setIsTagSelectorOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAttachmentOpen, isEmojiOpen, isQuickRepliesOpen, isTagSelectorOpen]);

  const filteredChats = chats.filter(c => selectedConnectionFilter === 'all' || c.connectionId === selectedConnectionFilter);
  const waiting = filteredChats.filter(c => !c.id.includes('@g.us') && (c.unreadCount || 0) > 0 && !isAccepted(c) && !isInClosed(c) && !isInTransferred(c));
  const active = filteredChats.filter(c => !c.id.includes('@g.us') && isAccepted(c) && !isInClosed(c) && !isInTransferred(c));
  const done = filteredChats.filter(c => !c.id.includes('@g.us') && isInClosed(c));
  const trans = filteredChats.filter(c => !c.id.includes('@g.us') && isInTransferred(c));

  const isViewOnly = selectedContact && (isInClosed(selectedContact) || isInTransferred(selectedContact));

  const resumeChat = (id: string, connectionId?: string) => {
    setClosed(prev => prev.filter(item => !(item.id === id && (!item.connectionId || item.connectionId === connectionId))));
    setAccepted(prev => [...prev, `${id}_${connectionId || 'default'}`]);
    const chat = chats.find(c => c.id === id && (!connectionId || c.connectionId === connectionId));
    if (chat) setSelectedContact(chat);
    toast.success("Atendimento retomado!");
  };

  const addReaction = (msgId: string, emoji: string) => {
    setMessageReactions(prev => { const current = prev[msgId] || []; if (current.some(r => r.emoji === emoji && r.from === "agent")) return prev; return { ...prev, [msgId]: [...current, { emoji, from: "agent" }] }; });
    setShowReactionPickerFor(null);
  };

  const saveContact = () => {
    if (!selectedContact) return;
    socket.emit("save_contact", { id: selectedContact.id, name: contactForm.name || selectedContact.name, company: contactForm.company, email: contactForm.email, notes: contactForm.notes });
    setSelectedContact(prev => prev ? { ...prev, name: contactForm.name || prev.name } : null);
    setIsContactPanelOpen(false);
    toast.success("Contato salvo!");
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraModalOpen(true); setIsAttachmentOpen(false);
    } catch { toast.error("Não foi possível acessar a câmera"); }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !selectedContact) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d'); ctx?.drawImage(videoRef.current, 0, 0);
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    socket.emit("send_message", { to: selectedContact.id, text: "", file: base64, filename: `photo-${Date.now()}.png`, mimetype: 'image/png', connectionId: selectedContact.connectionId });
    toast.success("Foto enviada!"); closeCamera();
  };

  const closeCamera = () => { if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); setCameraStream(null); } setIsCameraModalOpen(false); };

  const currentChatTagIds = selectedContact ? (chatTags[selectedContact.id] || []) : [];

  // ==========================================================================
  // FUNÇÃO PARA AGRUPAR MENSAGENS POR DATA
  // ==========================================================================
  const formatMessageDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Agrupa mensagens por data
  const groupedMessages: { date: string; messages: MessageType[] }[] = [];
  if (chatMessages.length > 0) {
    let currentGroup = { date: formatMessageDate(chatMessages[0].timestamp * 1000), messages: [] as MessageType[] };
    for (const msg of chatMessages) {
      const msgDate = formatMessageDate(msg.timestamp * 1000);
      if (msgDate !== currentGroup.date) {
        groupedMessages.push(currentGroup);
        currentGroup = { date: msgDate, messages: [] };
      }
      currentGroup.messages.push(msg);
    }
    groupedMessages.push(currentGroup);
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-1px)] overflow-hidden">

        {/* SIDEBAR */}
        <div className={cn("w-full lg:w-80 border-r flex flex-col bg-white dark:bg-[#111b21]", selectedContact && "hidden lg:flex")}>
          <div className="p-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b font-bold text-slate-700 dark:text-[#d1d7db] flex items-center justify-between">
            Atendimentos
            {showTagButton && (
              <span
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 px-2 py-1 rounded-lg"
                title={`${allTags.length} tag(s) disponível(is) para você`}
              >
                <Tags size={14} />
                <span className="hidden xl:inline">{allTags.length} tags</span>
              </span>
            )}
          </div>

          {/* FILTRO POR CONEXÃO */}
          <div className="p-2 bg-white dark:bg-[#111b21] border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Filtrar:</span>
            <button onClick={() => setSelectedConnectionFilter('all')} className={`text-xs px-2 py-1 rounded-full border ${selectedConnectionFilter === 'all' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>Todas</button>
            {availableConnections.filter(conn => connectionStatuses[conn.id]?.enabled && connectionStatuses[conn.id]?.status === 'connected').map(conn => (
              <button key={conn.id} onClick={() => setSelectedConnectionFilter(conn.id)} className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${selectedConnectionFilter === conn.id ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: conn.color }} />{conn.name}
              </button>
            ))}
          </div>

          <Tabs defaultValue="active" className="flex-1 flex flex-col bg-white dark:bg-[#111b21] min-h-0">
            <TabsList className="grid grid-cols-4 mx-2 mt-2 bg-slate-100 dark:bg-[#202c33] h-10 p-1 rounded-lg flex-shrink-0">
              <TabsTrigger value="waiting" className="text-[10px] font-bold relative text-slate-700 dark:text-slate-300 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">
                Fila
                {waiting.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{waiting.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="active" className="text-[10px] font-bold relative text-slate-700 dark:text-slate-300 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">
                Ativos
                {active.filter(c => c.unreadCount && c.unreadCount > 0).length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{active.filter(c => c.unreadCount && c.unreadCount > 0).length}</span>}
              </TabsTrigger>
              <TabsTrigger value="done" className="text-[10px] font-bold text-slate-700 dark:text-slate-300 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">Fim</TabsTrigger>
              <TabsTrigger value="trans" className="text-[10px] font-bold text-slate-700 dark:text-slate-300 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">Trans.</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto min-h-0 p-2 custom-scrollbar bg-white dark:bg-[#111b21]">
              <TabsContent value="waiting" className="m-0 space-y-2">
                {waiting.length === 0 && <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">Fila vazia.</div>}
                {waiting.map(c => (
                  <div key={`${c.id}_${c.connectionId || 'default'}`} className="p-3 bg-white dark:bg-[#202c33] border rounded-lg border-emerald-100 dark:border-emerald-900 shadow-sm relative hover:bg-slate-50 dark:hover:bg-[#2a3942] transition">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-slate-500 dark:text-slate-400">
                        {getProfilePic(c) ? <img src={getProfilePic(c)} className="w-full h-full object-cover" /> : (c.name ? c.name[0] : '?')}
                      </div>
                      <div className="text-sm font-bold truncate flex-1 text-slate-800 dark:text-white flex items-center gap-2">
                        {c.connectionColor && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.connectionColor }} title={c.connectionName} />}
                        {c.name}
                      </div>
                      {c.unreadCount && c.unreadCount > 0 && <div className="bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{c.unreadCount}</div>}
                    </div>
                    {getTagsForChat(c.id).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {getTagsForChat(c.id).map(tag => <TagBadge key={tag.id} tag={tag} />)}
                      </div>
                    )}
                    <button onClick={() => { const key = ck(c); setAccepted(p => [...p, key]); acceptedRef.current = [...acceptedRef.current, key]; setSelectedContact(c); selectedContactRef.current = c; setChats(prev => prev.map(chat => chat.id === c.id ? { ...chat, unreadCount: 0 } : chat)); socket.emit("mark_chat_as_read", c.id); }} className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 transition text-white text-xs font-bold rounded-md">ACEITAR</button>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="active" className="m-0 space-y-1">
                {active.map(c => (
                  <div
                    key={`${c.id}_${c.connectionId || 'default'}`}
                    onClick={() => {
                      if (selectedContact?.id === c.id && selectedContact?.connectionId === c.connectionId) { setSelectedContact(null); selectedContactRef.current = null; }
                      else { setSelectedContact(c); selectedContactRef.current = c; setChats(prev => prev.map(chat => chat.id === c.id ? { ...chat, unreadCount: 0 } : chat)); socket.emit("mark_chat_as_read", c.id); }
                    }}
                    className={cn("p-3 flex flex-col cursor-pointer rounded-xl hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors relative", selectedContact?.id === c.id && selectedContact?.connectionId === c.connectionId && "bg-[#f0f2f5] dark:bg-[#202c33]")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                        {getProfilePic(c) ? <img src={getProfilePic(c)} className="w-full h-full object-cover" /> : (c.name ? c.name[0] : '?')}
                      </div>
                      <div className="min-w-0 flex-1 border-b border-slate-100 dark:border-slate-700 pb-2">
                        <div className="flex justify-between items-center mb-1">
                          <div className="text-sm font-semibold truncate text-slate-900 dark:text-white flex items-center gap-2">
                            {c.connectionColor && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.connectionColor }} title={c.connectionName} />}
                            {c.name}
                          </div>
                          {c.timestamp && <div className="text-[10px] text-slate-400 dark:text-[#8696a0]">{new Date(c.timestamp * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>}
                        </div>
                        <div className="text-[13px] text-slate-500 dark:text-slate-400 truncate">{c.lastMessage}</div>
                      </div>
                      {c.unreadCount && c.unreadCount > 0 && <div className="absolute right-4 top-10 bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">{c.unreadCount}</div>}
                    </div>
                    {getTagsForChat(c.id).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 pl-[52px]">
                        {getTagsForChat(c.id).map(tag => <TagBadge key={tag.id} tag={tag} />)}
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="done" className="m-0 space-y-1">
                {done.map(c => (
                  <div key={`${c.id}_${c.connectionId || 'default'}`} className="p-3 border-b border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 flex flex-col gap-1 bg-white dark:bg-[#111b21]">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                          {getProfilePic(c) ? <img src={getProfilePic(c)} className="w-full h-full object-cover" /> : (c.name ? c.name[0] : '?')}
                        </div>
                        {c.connectionColor && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.connectionColor }} title={c.connectionName} />}
                        {c.name}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); resumeChat(c.id, c.connectionId); }} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1 rounded-md">Retomar</button>
                    </div>
                    {getTagsForChat(c.id).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {getTagsForChat(c.id).map(tag => <TagBadge key={tag.id} tag={tag} />)}
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="trans" className="m-0 space-y-1">
                {trans.map(c => (
                  <div key={`${c.id}_${c.connectionId || 'default'}`} className="p-3 border-b border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 opacity-70 bg-white dark:bg-[#111b21] flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                      {getProfilePic(c) ? <img src={getProfilePic(c)} className="w-full h-full object-cover" /> : (c.name ? c.name[0] : '?')}
                    </div>
                    {c.connectionColor && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.connectionColor }} title={c.connectionName} />}
                    {c.name}
                  </div>
                ))}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* ÁREA DE CHAT */}
        <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative w-full h-full" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: "contain", backgroundRepeat: "repeat" }}>
          {selectedContact ? (
            <>
              {/* HEADER */}
              <div className="h-auto min-h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-2 flex flex-col gap-1.5 z-10 shadow-sm flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedContact(null)} className="lg:hidden p-2 text-slate-500 dark:text-[#8696a0]"><ChevronLeft size={24}/></button>
                    <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                      {getProfilePic(selectedContact) ? <img src={getProfilePic(selectedContact)} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">{selectedContact?.name ? selectedContact.name[0] : '?'}</div>}
                    </div>
                    <div className="flex flex-col cursor-pointer" onClick={() => { setIsContactPanelOpen(true); setContactForm({ name: selectedContact.name, company: "", email: "", notes: "" }); }}>
                      <span className="font-semibold text-base text-[#111b21] dark:text-[#e9edef]">{selectedContact.name}</span>
                      {selectedContact.connectionName && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedContact.connectionColor }} />
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{selectedContact.connectionName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 items-center">
                    {showTagButton && (
                      <div className="relative">
                        <button
                          onClick={() => {
                            if (!isTagSelectorOpen) refreshTagsFromAutomation();
                            setIsTagSelectorOpen(!isTagSelectorOpen);
                          }}
                          className={cn(
                            "tag-selector-trigger p-2 rounded-full transition flex items-center gap-1.5",
                            isTagSelectorOpen
                              ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200 dark:hover:bg-[#2a3942]"
                          )}
                          title="Tags do atendimento"
                        >
                          <Tag size={20} />
                          {currentChatTagIds.length > 0 && (
                            <span className="text-[10px] font-bold bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                              {currentChatTagIds.length}
                            </span>
                          )}
                        </button>

                        {isTagSelectorOpen && (
                          <TagSelector
                            allTags={allTags}
                            selectedTagIds={currentChatTagIds}
                            canManage={false}
                            canEdit={canEditTags}
                            onToggle={(tagId) => toggleTagOnChat(selectedContact.id, tagId)}
                            onOpenManager={() => {}}
                            onClose={() => setIsTagSelectorOpen(false)}
                          />
                        )}
                      </div>
                    )}

                    <button onClick={() => setIsTransferring(true)} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200 dark:hover:bg-[#2a3942] rounded-full transition" title="Transferir"><ArrowRightLeft size={20}/></button>
                    <button
                      onClick={() => {
                        socket.emit("end_chat", { chatId: selectedContact.id });
                        setClosed(p => [...p, { id: selectedContact.id, connectionId: selectedContact.connectionId, closedAt: Date.now() }]);
                        setAccepted(p => p.filter(id => id !== ck(selectedContact) && id !== selectedContact.id));
                        setSelectedContact(null);
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-full transition" title="Finalizar"
                    >
                      <CheckCircle size={20}/>
                    </button>
                  </div>
                </div>

                {currentChatTagIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-[52px]">
                    {getTagsForChat(selectedContact.id).map(tag => (
                      <TagBadge
                        key={tag.id}
                        tag={tag}
                        canRemove={canEditTags}
                        onRemove={() => toggleTagOnChat(selectedContact.id, tag.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* LISTA DE MENSAGENS COM SEPARADORES DE DATA */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
                {/* Indicador de histórico sendo carregado */}
                {isLoadingMore && (
                  <div className="flex justify-center py-3">
                    <div className="flex items-center gap-2 bg-white/80 dark:bg-[#202c33]/80 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                      <Loader2 size={11} className="animate-spin" />
                      Carregando histórico...
                    </div>
                  </div>
                )}
                {/* Início da conversa */}
                {!isLoadingMore && allHistoryLoaded[selectedContact.id] && chatMessages.length > 0 && (
                  <div className="flex justify-center py-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-600 bg-white/70 dark:bg-[#202c33]/70 px-3 py-1 rounded-full">
                      Início da conversa
                    </span>
                  </div>
                )}
                {isLoadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-60"><Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400 mb-2" size={32} /></div>
                ) : loadError ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <p className="text-rose-500 dark:text-rose-400 mb-4">{loadError}</p>
                    <button onClick={() => { if (selectedContact) { setIsLoadingMessages(true); setLoadError(null); socket.emit("get_chat_messages", { chatId: selectedContact.id, connectionId: selectedContact.connectionId }); } }} className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition">Tentar novamente</button>
                  </div>
                ) : (
                  groupedMessages.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-2">
                      <div className="flex justify-center my-2">
                        <div className="text-[10px] font-medium bg-white/70 dark:bg-[#202c33]/70 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                          {group.date}
                        </div>
                      </div>
                      {group.messages.map((m, idx) => {
                        const senderType = getMessageSender(m);
                        const reactionsForMsg = messageReactions[m.id || ""] || [];
                        const uniqueKey = m.id || `msg-${groupIdx}-${idx}`;
                        const isSurvey = isSurveyMessage(m);
                        if (isSurvey) return (
                          <div key={uniqueKey} className="w-fit max-w-[90%] lg:max-w-[65%] p-1 rounded-lg bg-[#fff3c4] dark:bg-[#4d3c00] mx-auto text-amber-900 dark:text-amber-100 font-medium text-center shadow-md rounded-xl border border-amber-200 dark:border-amber-700/50 px-3 py-2 mb-2">
                            <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-300 mb-1 flex items-center justify-center gap-1"><ShieldAlert size={12} /> Nota do sistema</div>
                            Mensagem bloqueada (conteúdo da pesquisa não exibido)
                          </div>
                        );
                        return (
                          <div key={uniqueKey} className={cn("w-fit max-w-[90%] lg:max-w-[65%] p-1 rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] relative flex flex-col group mb-2",
                            senderType === 'agent' ? "bg-[#d9fdd3] dark:bg-[#005c4b] ml-auto rounded-tr-none text-[#111b21] dark:text-[#e9edef]" :
                            senderType === 'system_note' ? "bg-[#fff3c4] dark:bg-[#4d3c00] max-w-[95%] lg:max-w-[70%] mx-auto text-amber-900 dark:text-amber-100 font-medium text-center shadow-md rounded-xl border border-amber-200 dark:border-amber-700/50 px-3 py-2" :
                            "bg-white dark:bg-[#202c33] mr-auto rounded-tl-none text-[#111b21] dark:text-[#e9edef]"
                          )}>
                            {senderType !== 'system_note' && <button onClick={() => setReplyingTo(m)} className={cn("absolute top-0 w-8 h-8 flex items-center justify-center bg-black/20 dark:bg-white/20 text-white dark:text-slate-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-sm", senderType === 'agent' ? "-left-10" : "-right-10")}><Reply size={16}/></button>}
                            {m.quotedMsg && <div className="bg-black/5 dark:bg-white/5 rounded-md p-2 mb-1 border-l-4 border-[#00a884] text-xs cursor-pointer opacity-80 flex flex-col mx-1 mt-1"><span className="font-bold text-[#00a884] mb-0.5">{m.quotedMsg.sender === 'agent' ? "Você" : selectedContact.name}</span><span className="line-clamp-2 text-slate-600 dark:text-slate-400">{m.quotedMsg.body || "Mídia"}</span></div>}
                            <div className="px-2 pt-1 pb-4 min-w-[80px]">{renderMessageContent(m)}</div>
                            {reactionsForMsg.length > 0 && <div className="flex gap-1 px-2 pb-1 -mt-1">{reactionsForMsg.map((r, i) => <span key={i} className="bg-black/10 dark:bg-white/10 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">{r.emoji}</span>)}</div>}
                            {senderType !== 'system_note' && <div className="absolute bottom-1 right-2 flex items-center gap-1"><span className="text-[10px] text-[#667781] dark:text-[#8696a0]">{getMessageTime(m)}</span>{m.fromMe && <span className="text-[#53bdeb] ml-0.5">{renderMessageStatus(m.ack || 0)}</span>}</div>}
                            {!isViewOnly && <button onClick={() => setShowReactionPickerFor(m.id || "")} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all text-slate-400 dark:text-slate-500 hover:text-[#00a884]"><Smile size={16} /></button>}
                            {showReactionPickerFor === m.id && <div className="reaction-picker absolute top-8 right-2 bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 flex gap-1 z-50">{["👍","❤️","😂","😮","😢","😡"].map(emoji => <button key={emoji} onClick={() => addReaction(m.id!, emoji)} className="text-2xl hover:scale-125 transition">{emoji}</button>)}</div>}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* INPUT AREA */}
              {!isViewOnly ? (
                <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-2 flex flex-col gap-2 relative z-20 flex-shrink-0">
                  {isEmojiOpen && (
                    <div className="absolute bottom-[80px] left-4 bg-white dark:bg-[#111b21] rounded-xl shadow-2xl w-[360px] h-[450px] flex flex-col z-50 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-5 origin-bottom-left emoji-picker-container" onClick={(e) => e.stopPropagation()}>
                      <EmojiPicker onEmojiSelect={(emoji) => setMessage(p => p + emoji)} />
                    </div>
                  )}
                  {isQuickRepliesOpen && <QuickReplies onSelect={(text) => { setMessage(p => p + text); setIsQuickRepliesOpen(false); }} />}
                  {replyingTo && (
                    <div className="flex items-center justify-between bg-white dark:bg-[#2a3942] p-2 rounded-lg border-l-4 border-[#00a884] animate-in slide-in-from-bottom-2 shadow-sm">
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-bold text-[#00a884]">Respondendo a {replyingTo.fromMe ? 'Você' : selectedContact.name}</span>
                        <span className="text-xs text-slate-500 dark:text-[#8696a0] truncate max-w-[300px]">{replyingTo.body || replyingTo.caption || "Mídia"}</span>
                      </div>
                      <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><X size={16} className="text-slate-500 dark:text-slate-400"/></button>
                    </div>
                  )}
                  <div className="flex items-end gap-3">
                    {isRecording ? (
                      <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center px-4 h-[44px] shadow-sm justify-between animate-in slide-in-from-right-4">
                        <button onClick={cancelRecording} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-2 rounded-full transition"><Trash2 size={20} /></button>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                          <span className="text-slate-700 dark:text-white font-medium font-mono text-sm tracking-widest mr-2">{formatAudioTime(recordingTime)}</span>
                          <AudioVisualizer stream={recordingStream} />
                        </div>
                        <button onClick={stopAndSendRecording} className="bg-emerald-500 text-white hover:bg-emerald-600 p-2 rounded-full transition shadow-md"><Send size={18} className="ml-0.5" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="mb-1 flex gap-1">
                          <div className="attachment-container relative">
                            <button onClick={() => setIsAttachmentOpen(!isAttachmentOpen)} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#111b21] dark:hover:text-white transition"><Plus size={26} strokeWidth={2.5} /></button>
                            {isAttachmentOpen && (
                              <div className="absolute bottom-[60px] left-0 bg-[#111b21] text-white rounded-2xl shadow-2xl p-3 flex flex-col gap-1 w-[220px] border border-slate-700 animate-in slide-in-from-bottom-2 z-50 attachment-picker-container" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg text-left"><div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center"><FileText size={18} className="text-white" /></div><span className="text-sm">Documento</span></button>
                                <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg text-left"><div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center"><ImageIcon size={18} className="text-white" /></div><span className="text-sm">Fotos e vídeos</span></button>
                                <button onClick={openCamera} className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg text-left"><div className="w-8 h-8 bg-pink-500 rounded flex items-center justify-center"><Camera size={18} className="text-white" /></div><span className="text-sm">Câmera</span></button>
                                <button onClick={startRecording} className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg text-left"><div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center"><Headphones size={18} className="text-white" /></div><span className="text-sm">Áudio</span></button>
                                <button onClick={() => { setIsContactModalOpen(true); setIsAttachmentOpen(false); }} className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg text-left"><div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center"><User size={18} className="text-white" /></div><span className="text-sm">Contato</span></button>
                              </div>
                            )}
                          </div>
                          <button onClick={() => setIsQuickRepliesOpen(!isQuickRepliesOpen)} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#111b21] dark:hover:text-white transition quick-replies-trigger" title="Respostas rápidas"><Zap size={24} /></button>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" />
                        <input type="file" ref={imageInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />
                        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-xl shadow-sm border border-transparent focus-within:border-emerald-500/30 flex flex-col relative transition-colors overflow-hidden">
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#2a3942] px-2 py-1 border-b border-slate-100 dark:border-slate-700 overflow-x-auto custom-scrollbar">
                            <button onClick={() => applyFormatting('*', '*')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400" title="Negrito"><Bold size={14}/></button>
                            <button onClick={() => applyFormatting('_', '_')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400" title="Itálico"><Italic size={14}/></button>
                            <button onClick={() => applyFormatting('~', '~')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400" title="Tachado"><Strikethrough size={14}/></button>
                            <button onClick={() => applyFormatting('```', '```')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400" title="Código"><Code size={14}/></button>
                            <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            <button onClick={() => applyFormatting('> ', '')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400" title="Citação"><Quote size={14}/></button>
                            <button onClick={() => applyFormatting('- ', '')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400" title="Lista"><ListIcon size={14}/></button>
                            <button onClick={() => applyFormatting('1. ', '')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400" title="Lista Num."><ListOrdered size={14}/></button>
                          </div>
                          <div className="flex items-end px-2 py-1 min-h-[44px]">
                            <button onClick={() => setIsEmojiOpen(!isEmojiOpen)} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#111b21] dark:hover:text-white transition emoji-container" title="Emoji"><Smile size={24} /></button>
                            <textarea ref={textareaRef} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Digite uma mensagem..." rows={1} className="flex-1 bg-transparent px-2 py-[10px] outline-none text-[15px] resize-none custom-scrollbar text-slate-900 dark:text-white" style={{ minHeight: '40px', maxHeight: '120px' }} />
                          </div>
                        </div>
                        <div className="mb-1 flex-shrink-0">
                          {message.trim() ? <button onClick={handleSendMessage} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-emerald-600 dark:hover:text-emerald-400 transition"><Send size={24}/></button> : <button onClick={startRecording} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#111b21] dark:hover:text-white transition rounded-full"><Mic size={24}/></button>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-6 text-center text-sm text-slate-500 dark:text-[#8696a0]">
                  Conversa encerrada • Apenas visualização permitida
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#0b141a] border-l border-slate-200 dark:border-slate-800">
              <MessageSquare size={80} className="text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">Selecione um atendimento para começar</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE TRANSFERÊNCIA */}
      {isTransferring && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111b21] rounded-2xl w-full max-w-xs p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4 font-bold text-slate-800 dark:text-white">Transferir para: <button onClick={() => setIsTransferring(false)}><X size={18}/></button></div>
            <div className="space-y-2">
              {['Comercial', 'Suporte', 'Financeiro'].map(u => (
                <button key={u} onClick={() => { setTransferred(p => [...p, { id: selectedContact!.id, connectionId: selectedContact!.connectionId, transferredAt: Date.now() }]); setAccepted(accepted.filter(id => id !== ck(selectedContact!) && id !== selectedContact!.id)); setSelectedContact(null); setIsTransferring(false); toast.success('Transferido!'); }} className="w-full p-3 text-left border rounded-xl hover:bg-slate-50 dark:hover:bg-[#202c33] flex items-center gap-3 transition text-slate-900 dark:text-white">
                  <UserPlus size={18} className="text-indigo-500"/> {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL INFORMAÇÕES DO CONTATO */}
      {isContactPanelOpen && selectedContact && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-[#111b21] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center"><h3 className="font-bold text-lg text-slate-900 dark:text-white">Informações do contato</h3><button onClick={() => setIsContactPanelOpen(false)} className="text-slate-500 dark:text-slate-400"><X size={20} /></button></div>
            <div className="p-6 space-y-6">
              <div><label className="block text-xs text-slate-500 dark:text-[#8696a0] mb-1">Nome</label><input type="text" value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" /></div>
              <div><label className="block text-xs text-slate-500 dark:text-[#8696a0] mb-1">Telefone</label><p className="font-mono text-sm text-slate-700 dark:text-slate-300">{selectedContact.id.replace("@c.us", "")}</p></div>
              <div><label className="block text-xs text-slate-500 dark:text-[#8696a0] mb-1">Empresa</label><input type="text" value={contactForm.company} onChange={e => setContactForm({...contactForm, company: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" /></div>
              <div><label className="block text-xs text-slate-500 dark:text-[#8696a0] mb-1">E-mail</label><input type="email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" /></div>
              <div><label className="block text-xs text-slate-500 dark:text-[#8696a0] mb-1">Notas</label><textarea value={contactForm.notes} onChange={e => setContactForm({...contactForm, notes: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white h-24 resize-y" /></div>
              <button onClick={saveContact} className="w-full bg-[#00a884] hover:bg-[#018e6f] text-white py-3 rounded-xl font-bold transition">Salvar e sincronizar com agenda do WhatsApp</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CÂMERA */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-[#111b21] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center"><h3 className="font-bold text-lg text-slate-900 dark:text-white">Câmera</h3><button onClick={closeCamera} className="text-slate-500 dark:text-slate-400"><X size={20} /></button></div>
            <div className="relative bg-black"><video ref={videoRef} autoPlay playsInline className="w-full h-[400px] object-cover" /></div>
            <div className="p-4 flex justify-center gap-4">
              <button onClick={capturePhoto} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition"><Camera size={20} /> Capturar Foto</button>
              <button onClick={closeCamera} className="bg-slate-500 hover:bg-slate-600 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition">Cancelar</button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      {/* MODAL SELECIONAR CONTATO */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111b21] w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="bg-[#00a884] p-4 text-white flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><User size={20}/> Selecionar Contato</h3><button onClick={() => setIsContactModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20}/></button></div>
            <div className="p-3 border-b border-slate-200 dark:border-slate-800"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Pesquisar contato..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none" /></div></div>
            <div className="flex-1 overflow-y-auto h-72 custom-scrollbar">
              {filteredModalContacts.map((contact, i) => (
                <div key={i} onClick={() => handleSendContact(contact)} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-[#202c33] cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400"><User size={24}/></div>
                  <div><div className="font-bold text-slate-900 dark:text-white">{contact.name}</div><div className="text-sm text-slate-500 dark:text-[#8696a0]">{contact.number}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMAGEM COM ZOOM */}
      {selectedImage && (
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </AppLayout>
  );
};

export default Chat;