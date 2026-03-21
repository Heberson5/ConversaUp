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
  Reply, Check, Clock, UserPlus, Zap, Search, User, BarChart2, Calendar, Headphones
} from "lucide-react";
import { cn } from "@/lib/utils";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { Recorder } from 'opus-recorder';

const API_BASE_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) 
  ? process.env.NEXT_PUBLIC_API_URL 
  : 'http://localhost:3001';

const opusRecorderRef = useRef<any>(null);
const recordingStreamRef = useRef<MediaStream | null>(null);

// ============================================================================
// TEMA ESCURO
// ============================================================================
const useDarkTheme = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const saved = localStorage.getItem("theme");
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (saved === "dark" || (!saved && systemDark)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

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
          <input
            type="text"
            placeholder="Pesquisar emoji..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 text-sm bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        <div className="grid grid-cols-8 gap-1">
          {filtered.map((emoji, i) => (
            <button
              key={i}
              onClick={() => onEmojiSelect(emoji)}
              className="text-2xl w-full aspect-square flex items-center justify-center hover:bg-slate-100 dark:hover:bg-[#202c33] rounded-lg transition active:scale-90"
            >
              {emoji}
            </button>
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

  const deleteReply = (index: number) => {
    saveReplies(replies.filter((_, i) => i !== index));
  };

  const editReply = (index: number) => {
    setNewReply(replies[index]);
    setEditingIndex(index);
  };

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
        <input
          type="text"
          value={newReply}
          onChange={e => setNewReply(e.target.value)}
          placeholder="Nova resposta..."
          className="flex-1 px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-[#202c33] text-slate-900 dark:text-white"
          onKeyDown={e => e.key === 'Enter' && addReply()}
        />
        <button onClick={addReply} className="px-3 py-1 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600">
          {editingIndex !== null ? 'Salvar' : 'Adicionar'}
        </button>
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
  const [accepted, setAccepted] = useState<string[]>([]);
  const [closed, setClosed] = useState<{id: string; closedAt: number}[]>([]);
  const [transferred, setTransferred] = useState<{id: string; transferredAt: number}[]>([]);

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedContactRef = useRef<ChatType | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  // ==========================================================================
  // CACHE DE MENSAGENS (PERSISTENTE EM LOCALSTORAGE)
  // ==========================================================================
  const messagesCache = useRef<Record<string, MessageType[]>>({});
  const loadingChats = useRef<Set<string>>(new Set());

  const sanitizeForStorage = (msg: MessageType): MessageType => {
    if (msg.hasMedia) {
      const { body, ...rest } = msg;
      return { ...rest, body: undefined, mediaStored: false };
    }
    return msg;
  };

  const loadFromLocalStorage = (chatId: string, connectionId?: string): MessageType[] | null => {
    const key = `chat_messages_${connectionId || 'default'}_${chatId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const msgs = JSON.parse(stored);
        return msgs.map((m: any) => ({ ...m, mediaLoading: false, mediaLoaded: false }));
      }
    } catch (e) {
      console.error("Erro ao ler localStorage:", e);
    }
    return null;
  };

  const saveToLocalStorage = (chatId: string, connectionId: string | undefined, messages: MessageType[]) => {
    const key = `chat_messages_${connectionId || 'default'}_${chatId}`;
    try {
      const limitedMessages = messages.slice(-200);
      const sanitized = limitedMessages.map(sanitizeForStorage);
      localStorage.setItem(key, JSON.stringify(sanitized));
    } catch (e) {
      console.error("Erro ao salvar localStorage:", e);
      if (e.name === 'QuotaExceededError') {
        try {
          const keys = Object.keys(localStorage);
          const chatKeys = keys.filter(k => k.startsWith('chat_messages_'));
          for (const k of chatKeys) {
            localStorage.removeItem(k);
            const limited = messages.slice(-100);
            const sanitized = limited.map(sanitizeForStorage);
            localStorage.setItem(key, JSON.stringify(sanitized));
            break;
          }
        } catch (e2) {
          console.error("Falha ao liberar espaço no localStorage", e2);
        }
      }
    }
  };

  useEffect(() => {
    if (chats.length === 0) return;
    chats.forEach(chat => {
      if (!messagesCache.current[chat.id]) {
        const stored = loadFromLocalStorage(chat.id, chat.connectionId);
        if (stored) {
          messagesCache.current[chat.id] = stored;
        }
      }
    });
  }, [chats]);

  // ==========================================================================
  // ESTADO PARA CONEXÕES E FILTRO
  // ==========================================================================
  const [availableConnections, setAvailableConnections] = useState<ConnectionInfo[]>([]);
  const [selectedConnectionFilter, setSelectedConnectionFilter] = useState<string>('all');
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, {status: string, enabled: boolean}>>({});

  // ==========================================================================
  // Nome do agente logado
  // ==========================================================================
  const [agentName, setAgentName] = useState<string>("Agente");
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('user_display_name');
      if (storedName) setAgentName(storedName);
    }
  }, []);

  // ==========================================================================
  // NOTIFICAÇÕES DO NAVEGADOR
  // ==========================================================================
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const showNotification = (title: string, body: string, icon?: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: icon || "/favicon.ico" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, { body, icon: icon || "/favicon.ico" });
        }
      });
    }
  };

  // ==========================================================================
  // Buscar conexões disponíveis e ouvir atualizações de status
  // ==========================================================================
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/connections`);
        const data = await res.json();
        setAvailableConnections(data);
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

  // ==========================================================================
  // Persistência do contato selecionado (apenas dados essenciais)
  // ==========================================================================
  useEffect(() => {
    if (selectedContact) {
      try {
        const contactToSave = {
          id: selectedContact.id,
          name: selectedContact.name,
          connectionId: selectedContact.connectionId,
          connectionName: selectedContact.connectionName,
          connectionColor: selectedContact.connectionColor,
        };
        localStorage.setItem('zap_selected_contact', JSON.stringify(contactToSave));
      } catch (error) {
        console.error('Erro ao salvar contato selecionado:', error);
        if (error.name === 'QuotaExceededError') {
          try {
            localStorage.removeItem('zap_selected_contact');
          } catch (e) {}
        }
      }
    } else {
      localStorage.removeItem('zap_selected_contact');
    }
  }, [selectedContact]);

  // ==========================================================================
  // Carregar dados iniciais
  // ==========================================================================
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rawClosed = JSON.parse(localStorage.getItem('zap_closed') || '[]');
      const rawTransferred = JSON.parse(localStorage.getItem('zap_transferred') || '[]');
      const now = Date.now();
      setClosed(rawClosed.filter((item: any) => now - (item.closedAt || 0) < 7 * 86400000));
      setTransferred(rawTransferred.filter((item: any) => now - (item.transferredAt || 0) < 7 * 86400000));
      setAccepted(JSON.parse(localStorage.getItem('zap_accepted') || '[]'));

      const savedContact = localStorage.getItem('zap_selected_contact');
      if (savedContact) {
        try {
          const contact = JSON.parse(savedContact);
          setSelectedContact(contact);
          selectedContactRef.current = contact;
        } catch (e) {}
      }
    }
  }, []);

  // ==========================================================================
  // Processar newContact do location.state
  // ==========================================================================
  useEffect(() => {
    if (location.state?.newContact) {
      const contact = location.state.newContact;
      const safeContact = {
        ...contact,
        name: contact.name || contact.number || 'Contato',
      };

      setChats(prev => 
        prev.some(c => c.id === safeContact.id) ? prev : [{ ...safeContact, unreadCount: 0 }, ...prev]
      );

      setClosed(prev => prev.filter(item => item.id !== safeContact.id));
      setTransferred(prev => prev.filter(item => item.id !== safeContact.id));
      setAccepted(prev => prev.includes(safeContact.id) ? prev : [...prev, safeContact.id]);

      const timer = setTimeout(() => {
        setSelectedContact(safeContact);
        selectedContactRef.current = safeContact;
      }, 100);

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
      if (selectedContactRef.current?.id === data.id) {
        setSelectedContact(prev => prev ? { ...prev, picUrl: data.picUrl } : null);
      }
    };
    socket.on('profile_pic_update', handleProfilePicUpdate);
    return () => socket.off('profile_pic_update', handleProfilePicUpdate);
  }, []);

  const [loadError, setLoadError] = useState<string | null>(null);
  const getProfilePic = (c: any) => c?.picUrl || c?.profilePicUrl || null;

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

  // ==========================================================================
  // Formatação de texto com links clicáveis
  // ==========================================================================
  const formatWhatsAppText = (text: string) => {
    if (!text) return "";

    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    formatted = formatted.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline break-all">$1</a>'
    );

    formatted = formatted.replace(
      /```([\s\S]*?)```/g,
      (match, code) => {
        const escaped = code
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<pre class="bg-black/10 dark:bg-white/10 p-2 rounded my-1 text-[13px] font-mono whitespace-pre-wrap overflow-x-auto border border-black/10 dark:border-white/10">${escaped}</pre>`;
      }
    );

    formatted = formatted.replace(
      /`([^`\n]+)`/g,
      '<code class="bg-black/10 dark:bg-white/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-[13px] font-mono border border-black/5 dark:border-white/5">$1</code>'
    );

    formatted = formatted.replace(/\*([^\*\n]+)\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/_([^\_\n]+)_/g, '<em>$1</em>');
    formatted = formatted.replace(/~([^~\n]+)~/g, '<del>$1</del>');

    formatted = formatted.replace(
      /^&gt; (.*$)/gm,
      '<blockquote class="border-l-4 border-current opacity-80 pl-2.5 ml-1 my-1.5 py-0.5 italic bg-black/5 dark:bg-white/5 rounded-r-md">$1</blockquote>'
    );

    formatted = formatted.replace(/\n/g, '<br />');

    return formatted;
  };

  // ==========================================================================
  // Construir URL de dados para mídia
  // ==========================================================================
  const getMediaSrc = useCallback((m: MessageType): string | null => {
    if (m.body && typeof m.body === 'string') {
      if (m.body.startsWith('data:')) return m.body;
      if (m.body.length > 0) {
        const mime = m.mimetype || 'application/octet-stream';
        return `data:${mime};base64,${m.body}`;
      }
    }
    return m.url || null;
  }, []);

  // ==========================================================================
  // Buscar mídia sob demanda (COM CONNECTION ID)
  // ==========================================================================
  const fetchMedia = useCallback((messageId: string, chatId: string, connectionId?: string) => {
    console.log(`🔍 fetchMedia chamado para mensagem ${messageId} do chat ${chatId} (conexão ${connectionId})`);
    return new Promise((resolve, reject) => {
      socket.emit("get_media", { chatId, messageId, connectionId }, (response: any) => {
        if (response.success) {
          console.log(`✅ fetchMedia sucesso para ${messageId}`, response);
          resolve(response);
        } else {
          console.error(`❌ fetchMedia erro para ${messageId}:`, response.error);
          reject(response.error);
        }
      });
    });
  }, []);

  // ==========================================================================
  // Atualizar mensagem no estado com mídia baixada e persistir no localStorage
  // ==========================================================================
  const updateMessageWithMedia = useCallback((chatId: string, messageId: string, mediaData: any) => {
    console.log(`📦 updateMessageWithMedia: chat ${chatId}, msg ${messageId}`, mediaData);
    
    if (messagesCache.current[chatId]) {
      messagesCache.current[chatId] = messagesCache.current[chatId].map(msg => 
        msg.id === messageId ? { 
          ...msg, 
          body: mediaData.media, 
          mimetype: mediaData.mimetype, 
          filename: mediaData.filename, 
          mediaLoaded: true 
        } : msg
      );
      const conn = selectedContactRef.current;
      saveToLocalStorage(chatId, conn?.connectionId, messagesCache.current[chatId]);
    }
    
    if (selectedContactRef.current?.id === chatId) {
      setChatMessages(prev => 
        prev.map(msg => msg.id === messageId ? { 
          ...msg, 
          body: mediaData.media, 
          mimetype: mediaData.mimetype, 
          filename: mediaData.filename, 
          mediaLoaded: true 
        } : msg)
      );
    }
  }, []);

  // ==========================================================================
  // Detecção de mensagens da pesquisa (para ocultar do agente)
  // ==========================================================================
  const isSurveyMessage = (msg: MessageType): boolean => {
    if (msg.body === "❌ Por favor, responda apenas com um número de 1 a 5.") return true;
    if (msg.body && /^[1-5]$/.test(msg.body.trim())) return true;
    return false;
  };

  // ==========================================================================
  // Renderizar conteúdo da mensagem (modificado para ocultar pesquisa)
  // ==========================================================================
  const renderMessageContent = (m: MessageType) => {
    const isImage = m.type === 'image' || m.mimetype?.startsWith('image/');
    const isVideo = m.type === 'video' || m.mimetype?.startsWith('video/');
    const isAudio = m.type === 'ptt' || m.type === 'audio' || m.mimetype?.startsWith('audio/');
    const isDoc = m.type === 'document' || m.mimetype?.startsWith('application/');
    
    const src = getMediaSrc(m);

    if (m.hasMedia && !m.mediaLoaded && !src && selectedContact) {
      console.log(`🖼️ renderMessageContent: solicitando mídia para msg ${m.id}`);
      if (!m.mediaLoading) {
        m.mediaLoading = true;
        fetchMedia(m.id!, selectedContact.id, selectedContact.connectionId)
          .then((mediaData: any) => {
            updateMessageWithMedia(selectedContact.id, m.id!, mediaData);
          })
          .catch(err => {
            console.error("Erro ao carregar mídia", err);
            updateMessageWithMedia(selectedContact.id, m.id!, { media: null, mimetype: m.mimetype, filename: m.filename });
          });
      }
      // Placeholders
      if (isImage) {
        return (
          <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 h-[150px] w-[200px] rounded-lg text-slate-400 dark:text-slate-500 flex-col gap-2 border border-slate-200 dark:border-slate-700">
            <Loader2 className="animate-spin" size={24} />
            <span className="text-[10px] uppercase font-bold opacity-70">Carregando...</span>
          </div>
        );
      }
      if (isVideo) {
        return (
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 w-[220px]">
            <Loader2 className="animate-spin" size={20}/>
            <span className="text-xs font-medium">Carregando vídeo...</span>
          </div>
        );
      }
      if (isAudio) {
        return (
          <div className="flex items-center gap-2 min-w-[240px] mt-1 mb-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-slate-100 dark:border-slate-700">
            <div className={cn("p-2.5 rounded-full text-white shrink-0 flex items-center justify-center", m.fromMe ? "bg-emerald-500" : "bg-slate-500 dark:bg-slate-600")}>
              <Mic size={18}/>
            </div>
            <div className="flex-1 px-1">
              <Loader2 className="animate-spin" size={16} />
            </div>
          </div>
        );
      }
      if (isDoc) {
        return (
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="bg-white dark:bg-slate-900 p-2 rounded text-rose-500 shadow-sm"><FileText size={24}/></div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">{m.filename || "Carregando..."}</p>
              <Loader2 className="animate-spin" size={14} />
            </div>
          </div>
        );
      }
    }

    if (isImage) {
      return (
        <div className="mb-1 relative group flex flex-col w-fit max-w-full">
          {src ? (
            <img 
              src={src} 
              alt="Foto" 
              className="rounded-lg max-w-full h-auto object-contain max-h-[300px] cursor-pointer" 
              onClick={() => window.open(src, '_blank')} 
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 h-[150px] w-[200px] rounded-lg text-slate-400 dark:text-slate-500 flex-col gap-2 border border-slate-200 dark:border-slate-700">
              <ImageIcon size={32} className="opacity-50"/>
              <span className="text-[10px] uppercase font-bold opacity-70">Foto (Histórico)</span>
            </div>
          )}
          {m.caption && (
            <div 
              className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap px-1" 
              dangerouslySetInnerHTML={{ __html: formatWhatsAppText(m.caption) }} 
            />
          )}
        </div>
      );
    }
    if (isVideo) {
      return (
        <div className="mb-1 flex flex-col w-fit max-w-full">
          {src ? (
            <video 
              src={src} 
              controls 
              preload="metadata"
              className="rounded-lg max-w-full max-h-[300px] object-contain" 
            />
          ) : (
            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 w-[220px]">
              <Camera size={20}/>
              <span className="text-xs font-medium">Vídeo (Histórico)</span>
            </div>
          )}
          {m.caption && (
            <div 
              className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap px-1" 
              dangerouslySetInnerHTML={{ __html: formatWhatsAppText(m.caption) }} 
            />
          )}
        </div>
      );
    }
    if (isAudio) {
      const src = getMediaSrc(m);
      return (
        <div className="flex items-center gap-2 min-w-[240px] mt-1 mb-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-slate-100 dark:border-slate-700">
          <div className={cn("p-2.5 rounded-full text-white shrink-0 flex items-center justify-center", m.fromMe ? "bg-emerald-500" : "bg-slate-500 dark:bg-slate-600")}>
            <Mic size={18}/>
          </div>
          <div className="flex-1 px-1">
            {src ? (
              <audio src={src} controls controlsList="nodownload" className="h-8 w-full max-w-[200px]" />
            ) : (
              <div className="text-xs text-slate-400 dark:text-slate-500 italic pl-1">Áudio não carregado</div>
            )}
          </div>
        </div>
      );
    }
    if (isDoc) {
      return (
        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer relative overflow-hidden mt-1 mb-1 border border-slate-200 dark:border-slate-700 group">
          <div className="bg-white dark:bg-slate-900 p-2 rounded text-rose-500 shadow-sm"><FileText size={24}/></div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">{m.filename || "Arquivo"}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{m.mimetype?.split('/')[1] || 'DOC'}</p>
          </div>
          {src ? (
            <a href={src} download={m.filename || 'download'} className="p-2 text-slate-400 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition">
              <Download size={20}/>
            </a>
          ) : (
            <span className="text-[9px] bg-slate-300 dark:bg-slate-700 px-1 rounded text-white">?</span>
          )}
        </div>
      );
    }
    return <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatWhatsAppText(m.body || m.text || "") }} />;
  };

  // ==========================================================================
  // Refs para estados usados nos listeners (para evitar dependências)
  // ==========================================================================
  const acceptedRef = useRef(accepted);
  const closedRef = useRef(closed);
  const transferredRef = useRef(transferred);
  const chatsRef = useRef(chats);

  useEffect(() => {
    acceptedRef.current = accepted;
    closedRef.current = closed;
    transferredRef.current = transferred;
    chatsRef.current = chats;
  }, [accepted, closed, transferred, chats]);

  // ==========================================================================
  // Socket listeners (definidos uma única vez)
  // ==========================================================================
  useEffect(() => {
    socket.emit("get_chats");

    const handleChats = (data: ChatType[]) => {
      const filtered = (data || []).filter(c => !c.id.includes('status@'));
      setChats(prev => {
        const prevIds = new Set(prev.map(p => p.id));
        const novos = filtered.filter(f => !prevIds.has(f.id));
        const updated = prev.map(p => {
          const found = filtered.find(f => f.id === p.id);
          return found ? { ...p, ...found } : p;
        });
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
          if (conn && conn.id === chatKey) {
            saveToLocalStorage(chatKey, conn.connectionId, messagesCache.current[chatKey]);
          } else {
            const chat = chatsRef.current.find(c => c.id === chatKey);
            if (chat) saveToLocalStorage(chatKey, chat.connectionId, messagesCache.current[chatKey]);
          }
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

            const isInAccepted = acceptedRef.current.includes(chatKey);
            const isInClosed = closedRef.current.some(item => item.id === chatKey);
            const isInTransferred = transferredRef.current.some(item => item.id === chatKey);

            if (!isInAccepted && !isInClosed && !isInTransferred) {
              showNotification(`Nova conversa na fila`, `${senderName}: ${preview}`);
            } else if (isInAccepted && !isSelected) {
              showNotification(senderName, preview);
            }
          }
        }
      }
    };

    const handleMessageAck = (data: { id: string; chatId: string; ack: number }) => {
      console.log("ACK recebido:", data);
      if (selectedContactRef.current && data.chatId === selectedContactRef.current.id) {
        setChatMessages(prev =>
          prev.map(msg => (msg.id === data.id ? { ...msg, ack: data.ack } : msg))
        );
        if (messagesCache.current[data.chatId]) {
          messagesCache.current[data.chatId] = messagesCache.current[data.chatId].map(msg =>
            msg.id === data.id ? { ...msg, ack: data.ack } : msg
          );
          const conn = selectedContactRef.current;
          if (conn) saveToLocalStorage(data.chatId, conn.connectionId, messagesCache.current[data.chatId]);
        }
      }
    };

    const handleChatUpdated = (updatedChat: any) => {
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

    socket.on("chats", handleChats);
    socket.on("chat_messages_error", (data: any) => {
      if (data.chatId === selectedContactRef.current?.id) {
        setLoadError(data.error || "Erro ao carregar mensagens");
        setIsLoadingMessages(false);
      }
      loadingChats.current.delete(data.chatId);
    });
    socket.on("chat_messages", (data: any) => {
      let msgs = data?.messages || [];
      const chatId = data.chatId;
      if (chatId) {
        const uniqueMessages = msgs.reduce((acc: MessageType[], curr: MessageType) => {
          if (!acc.some(msg => msg.id === curr.id)) {
            acc.push(curr);
          }
          return acc;
        }, []);
        const msgsWithFlags = uniqueMessages.map((msg: any) => ({ ...msg, mediaLoading: false, mediaLoaded: false }));
        messagesCache.current[chatId] = msgsWithFlags;
        const conn = chatsRef.current.find(c => c.id === chatId);
        if (conn) saveToLocalStorage(chatId, conn.connectionId, msgsWithFlags);
        if (selectedContactRef.current?.id === chatId) {
          setChatMessages(msgsWithFlags);
          setIsLoadingMessages(false);
          socket.emit("mark_chat_as_read", chatId);
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c));
        }
        loadingChats.current.delete(chatId);
      }
    });
    socket.on("receive_message", handleNewMessage);
    socket.on("message_ack_update", handleMessageAck);
    socket.on("chat_updated", handleChatUpdated);

    return () => {
      socket.off("chats", handleChats);
      socket.off("receive_message", handleNewMessage);
      socket.off("message_ack_update", handleMessageAck);
      socket.off("chat_updated", handleChatUpdated);
      socket.off("chat_messages_error");
      socket.off("chat_messages");
    };
  }, []); // Executa apenas uma vez

  // ==========================================================================
  // Carregar mensagens em segundo plano para todos os chats ativos
  // ==========================================================================
  useEffect(() => {
    if (chats.length === 0) return;
    const timeoutId = setTimeout(() => {
      chats.forEach(chat => {
        const chatId = chat.id;
        if (loadingChats.current.has(chatId) || messagesCache.current[chatId]) return;
        loadingChats.current.add(chatId);
        socket.emit("get_chat_messages", { chatId, connectionId: chat.connectionId });
      });
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [chats]);

  // ==========================================================================
  // Carregar mensagens ao selecionar contato (sempre do servidor para garantir atualização)
  // ==========================================================================
  useEffect(() => {
    if (selectedContact) {
      setIsBlockedByAdmin(false);
      setLoadError(null);
      const chatId = selectedContact.id;
      const connectionId = selectedContact.connectionId;
      setChatMessages([]);
      setIsLoadingMessages(true);
      if (!loadingChats.current.has(chatId)) {
        loadingChats.current.add(chatId);
        socket.emit("get_chat_messages", { chatId, connectionId });
      }
    } else {
      setChatMessages([]);
      setIsLoadingMessages(false);
    }
  }, [selectedContact]);

  useEffect(() => {
    if (scrollRef.current && !isLoadingMessages) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isLoadingMessages]);

  // ==========================================================================
  // Ações do usuário
  // ==========================================================================
  const applyFormatting = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newText = message.substring(0, start) + prefix + message.substring(start, end) + suffix + message.substring(end);
    setMessage(newText);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 10);
  };

  const handleSendMessage = () => {
    if (!message.trim() || !selectedContact || isBlockedByAdmin) return;
    const formattedMessage = `*${agentName}*\n\n${message}`;

    const tempMsg = {
      id: Date.now().toString(),
      body: formattedMessage,
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 0,
      sender: 'agent',
      quotedMsg: replyingTo || undefined,
      mediaLoading: false,
      mediaLoaded: false,
      connectionId: selectedContact.connectionId
    };
    setChatMessages(prev => [...prev, tempMsg]);

    console.log("📤 Enviando mensagem de texto:", {
      to: selectedContact.id,
      text: formattedMessage,
      connectionId: selectedContact.connectionId
    });

    socket.emit("send_message", {
      to: selectedContact.id,
      text: formattedMessage,
      quotedMsgId: replyingTo?.id,
      quotedMsg: replyingTo,
      connectionId: selectedContact.connectionId
    });

    setMessage("");
    setReplyingTo(null);
    setIsEmojiOpen(false);
    setIsQuickRepliesOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      
      const tempMsg = {
        id: Date.now().toString(),
        body: base64,
        mimetype: file.type,
        filename: file.name,
        type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document',
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000),
        ack: 0,
        sender: 'agent',
        hasMedia: true,
        mediaLoading: false,
        mediaLoaded: true,
        connectionId: selectedContact.connectionId
      };
      setChatMessages(prev => [...prev, tempMsg]);

      socket.emit("send_message", { 
        to: selectedContact.id, 
        text: "", 
        file: base64, 
        filename: file.name, 
        mimetype: file.type,
        connectionId: selectedContact.connectionId
      });
      toast.success("Arquivo enviado!");
      setIsAttachmentOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

// ==========================================================================
// ENVIO DE ÁUDIO (com detecção de MIME type)
// ==========================================================================
const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingStreamRef.current = stream;
    setRecordingStream(stream);

    const options = {
      stream: stream,
      encoderPath: '/encoderWorker.min.js',
      encoderSampleRate: 48000,
      numberOfChannels: 1,
      bitRate: 64000,
      bufferSize: 4096,
      mimeType: 'audio/ogg'
    };
    opusRecorderRef.current = new Recorder(options);
    
    audioChunks.current = [];
    opusRecorderRef.current.ondataavailable = (blob: Blob) => {
      audioChunks.current.push(blob);
    };
    
    opusRecorderRef.current.start();
    setIsRecording(true);
    setRecordingTime(0);
    recordingInterval.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
  } catch (err) {
    console.error(err);
    toast.error("Erro ao acessar o microfone ou iniciar gravação.");
  }
};

// Substitua stopAndSendRecording
const stopAndSendRecording = () => {
  if (opusRecorderRef.current) {
    opusRecorderRef.current.onstop = () => {
      // Concatena todos os blobs em um único Blob OGG
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/ogg' });
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        
        const tempMsg = {
          id: Date.now().toString(),
          body: base64,
          mimetype: 'audio/ogg',
          type: 'ptt',
          sender: 'agent',
          timestamp: Math.floor(Date.now() / 1000),
          fromMe: true,
          ack: 0,
          hasMedia: true,
          mediaLoading: false,
          mediaLoaded: true,
          connectionId: selectedContact!.connectionId
        };
        setChatMessages(prev => [...prev, tempMsg]);

        console.log("📤 Enviando áudio OGG:", {
          to: selectedContact!.id,
          file: base64.substring(0, 50) + "...",
          mimetype: 'audio/ogg',
          isPtt: true,
          connectionId: selectedContact!.connectionId
        });

        socket.emit("send_message", {
          to: selectedContact!.id,
          text: "",
          file: base64,
          mimetype: 'audio/ogg',
          filename: `ptt-${Date.now()}.ogg`,
          isPtt: true,
          connectionId: selectedContact!.connectionId
        });
        toast.success("Áudio enviado!");
      };
      reader.readAsDataURL(audioBlob);
      
      // Limpeza
      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
      setRecordingStream(null);
    };
    opusRecorderRef.current.stop();
  }
  cleanupRecording();
};

  const cancelRecording = () => {
    if (opusRecorderRef.current) {
      opusRecorderRef.current.stop();
    }
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    setRecordingStream(null);
    cleanupRecording();
  };

  const cleanupRecording = () => {
    setIsRecording(false);
    if (recordingInterval.current) clearInterval(recordingInterval.current);
    setRecordingTime(0);
    audioChunks.current = [];
    opusRecorderRef.current = null;
    recordingStreamRef.current = null;
  };

  // ==========================================================================
  // ENVIO DE CONTATO (como texto, não nova conversa)
  // =========================================================================
  const handleSendContact = (contact: { name: string; number: string; id: string }) => {
    if (!selectedContact) return;
    const messageText = `*Contato:* ${contact.name}\n*Número:* ${contact.number}`;
    const tempMsg = {
      id: Date.now().toString(),
      body: messageText,
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 0,
      sender: 'agent',
      connectionId: selectedContact.connectionId
    };
    setChatMessages(prev => [...prev, tempMsg]);

    console.log("📤 Enviando contato como texto:", {
      to: selectedContact.id,
      text: messageText,
      connectionId: selectedContact.connectionId
    });

    socket.emit("send_message", {
      to: selectedContact.id,
      text: messageText,
      connectionId: selectedContact.connectionId
    });
    setIsContactModalOpen(false);
    toast.success("Contato enviado!");
  };

  // ==========================================================================
  // Fechamento de modais ao clicar fora
  // ==========================================================================
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (isAttachmentOpen && !target.closest('.attachment-container') && !target.closest('.attachment-picker-container')) {
        setIsAttachmentOpen(false);
      }
      if (isEmojiOpen && !target.closest('.emoji-container') && !target.closest('.emoji-picker-container')) {
        setIsEmojiOpen(false);
      }
      if (isQuickRepliesOpen && !target.closest('.quick-replies-container') && !target.closest('.quick-replies-trigger')) {
        setIsQuickRepliesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAttachmentOpen, isEmojiOpen, isQuickRepliesOpen]);

  // ==========================================================================
  // Filtro por conexão (apenas conexões ativas: enabled e connected)
  // ==========================================================================
  const filteredChats = chats.filter(c => 
    selectedConnectionFilter === 'all' || c.connectionId === selectedConnectionFilter
  );

  const waiting = filteredChats.filter(c => 
    !c.id.includes('@g.us') && 
    (c.unreadCount || 0) > 0 && 
    !accepted.includes(c.id) && 
    !closed.some(item => item.id === c.id) && 
    !transferred.some(item => item.id === c.id)
  );
  const active = filteredChats.filter(c => 
    !c.id.includes('@g.us') && 
    accepted.includes(c.id) && 
    !closed.some(item => item.id === c.id) && 
    !transferred.some(item => item.id === c.id)
  );
  const done = filteredChats.filter(c => 
    !c.id.includes('@g.us') && 
    closed.some(item => item.id === c.id)
  );
  const trans = filteredChats.filter(c => 
    !c.id.includes('@g.us') && 
    transferred.some(item => item.id === c.id)
  );

  const isViewOnly = selectedContact && (closed.some(item => item.id === selectedContact.id) || transferred.some(item => item.id === selectedContact.id));

  const resumeChat = (id: string) => {
    setClosed(prev => prev.filter(item => item.id !== id));
    setAccepted(prev => [...prev, id]);
    const chat = chats.find(c => c.id === id);
    if (chat) setSelectedContact(chat);
    toast.success("Atendimento retomado!");
  };

  const addReaction = (msgId: string, emoji: string) => {
    setMessageReactions(prev => {
      const current = prev[msgId] || [];
      if (current.some(r => r.emoji === emoji && r.from === "agent")) return prev;
      return { ...prev, [msgId]: [...current, { emoji, from: "agent" }] };
    });
    setShowReactionPickerFor(null);
    toast.success(`Reação ${emoji} enviada`);
  };

  const saveContact = () => {
    if (!selectedContact) return;
    socket.emit("save_contact", { id: selectedContact.id, name: contactForm.name || selectedContact.name, company: contactForm.company, email: contactForm.email, notes: contactForm.notes });
    setSelectedContact(prev => prev ? { ...prev, name: contactForm.name || prev.name } : null);
    setIsContactPanelOpen(false);
    toast.success("Contato salvo e sincronizado com agenda do WhatsApp!");
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraModalOpen(true);
      setIsAttachmentOpen(false);
    } catch (err) {
      toast.error("Não foi possível acessar a câmera");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !selectedContact) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    socket.emit("send_message", { 
      to: selectedContact.id, 
      text: "", 
      file: base64, 
      filename: `photo-${Date.now()}.png`, 
      mimetype: 'image/png',
      connectionId: selectedContact.connectionId
    });
    toast.success("Foto enviada!");
    closeCamera();
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraModalOpen(false);
  };

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-1px)] overflow-hidden">
       
        {/* SIDEBAR */}
        <div className={cn("w-full lg:w-80 border-r flex flex-col bg-white dark:bg-[#111b21]", selectedContact && "hidden lg:flex")}>
          <div className="p-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b font-bold text-slate-700 dark:text-[#d1d7db] flex items-center justify-between">
            Atendimentos
          </div>

          {/* FILTRO POR CONEXÃO (APENAS ATIVAS) */}
          <div className="p-2 bg-white dark:bg-[#111b21] border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Filtrar:</span>
            <button
              onClick={() => setSelectedConnectionFilter('all')}
              className={`text-xs px-2 py-1 rounded-full border ${
                selectedConnectionFilter === 'all'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Todas
            </button>
            {availableConnections
              .filter(conn => connectionStatuses[conn.id]?.enabled && connectionStatuses[conn.id]?.status === 'connected')
              .map(conn => (
                <button
                  key={conn.id}
                  onClick={() => setSelectedConnectionFilter(conn.id)}
                  className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${
                    selectedConnectionFilter === conn.id
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: conn.color }} />
                  {conn.name}
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
                {active.filter(c => c.unreadCount && c.unreadCount > 0).length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                    {active.filter(c => c.unreadCount && c.unreadCount > 0).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="done" className="text-[10px] font-bold text-slate-700 dark:text-slate-300 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">Fim</TabsTrigger>
              <TabsTrigger value="trans" className="text-[10px] font-bold text-slate-700 dark:text-slate-300 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400">Trans.</TabsTrigger>
            </TabsList>
           
            <div className="flex-1 overflow-y-auto min-h-0 p-2 custom-scrollbar bg-white dark:bg-[#111b21]">
              <TabsContent value="waiting" className="m-0 space-y-2">
                {waiting.length === 0 && <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">Fila vazia.</div>}
                {waiting.map(c => (
                  <div key={c.id} className="p-3 bg-white dark:bg-[#202c33] border rounded-lg border-emerald-100 dark:border-emerald-900 shadow-sm relative hover:bg-slate-50 dark:hover:bg-[#2a3942] transition">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-slate-500 dark:text-slate-400">
                        {getProfilePic(c) ? <img src={getProfilePic(c)} className="w-full h-full object-cover" /> : (c.name ? c.name[0] : '?')}
                      </div>
                      <div className="text-sm font-bold truncate flex-1 text-slate-800 dark:text-white flex items-center gap-2">
                        {c.connectionColor && (
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.connectionColor }} title={c.connectionName} />
                        )}
                        {c.name}
                      </div>
                      {c.unreadCount && c.unreadCount > 0 && <div className="bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{c.unreadCount}</div>}
                    </div>
                    <button 
                      onClick={() => { 
                        setAccepted(p => [...p, c.id]); 
                        acceptedRef.current = [...acceptedRef.current, c.id];
                        setSelectedContact(c);
                        selectedContactRef.current = c;
                        setChats(prev => prev.map(chat => chat.id === c.id ? { ...chat, unreadCount: 0 } : chat));
                        socket.emit("mark_chat_as_read", c.id);
                      }} 
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 transition text-white text-xs font-bold rounded-md"
                    >
                      ACEITAR
                    </button>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="active" className="m-0 space-y-1">
                {active.map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (selectedContact?.id === c.id) {
                        setSelectedContact(null);
                        selectedContactRef.current = null;
                      } else {
                        setSelectedContact(c);
                        selectedContactRef.current = c;
                        setChats(prev => prev.map(chat => chat.id === c.id ? { ...chat, unreadCount: 0 } : chat));
                        socket.emit("mark_chat_as_read", c.id);
                      }
                    }}
                    className={cn("p-3 flex items-center gap-3 cursor-pointer rounded-xl hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors relative", selectedContact?.id === c.id && "bg-[#f0f2f5] dark:bg-[#202c33]")}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-slate-500 dark:text-slate-400">
                      {getProfilePic(c) ? <img src={getProfilePic(c)} className="w-full h-full object-cover" /> : (c.name ? c.name[0] : '?')}
                    </div>
                    <div className="min-w-0 flex-1 border-b border-slate-100 dark:border-slate-700 pb-2">
                      <div className="flex justify-between items-center mb-1">
                        <div className="text-sm font-semibold truncate text-slate-900 dark:text-white flex items-center gap-2">
                          {c.connectionColor && (
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.connectionColor }} title={c.connectionName} />
                          )}
                          {c.name}
                        </div>
                        {c.timestamp && <div className="text-[10px] text-slate-400 dark:text-[#8696a0]">{new Date(c.timestamp * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>}
                      </div>
                      <div className="text-[13px] text-slate-500 dark:text-slate-400 truncate">{c.lastMessage}</div>
                    </div>
                    {c.unreadCount && c.unreadCount > 0 && (
                      <div className="absolute right-4 top-10 bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm animate-in zoom-in-50">{c.unreadCount}</div>
                    )}
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="done" className="m-0 space-y-1">
                {done.map(c => (
                  <div key={c.id} className="p-3 border-b border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between bg-white dark:bg-[#111b21]">
                    <span className="flex items-center gap-2">
                      {c.connectionColor && (
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.connectionColor }} title={c.connectionName} />
                      )}
                      {c.name}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); resumeChat(c.id); }} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1 rounded-md">Retomar</button>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="trans" className="m-0 space-y-1">
                {trans.map(c => (
                  <div key={c.id} className="p-3 border-b border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 opacity-70 bg-white dark:bg-[#111b21] flex items-center gap-2">
                    {c.connectionColor && (
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.connectionColor }} title={c.connectionName} />
                    )}
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
              <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center justify-between z-10 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedContact(null)} className="lg:hidden p-2 text-slate-500 dark:text-[#8696a0]"><ChevronLeft size={24}/></button>
                  <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden">
                    {getProfilePic(selectedContact) ? (
                      <img src={getProfilePic(selectedContact)} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                        {selectedContact?.name ? selectedContact.name[0] : '?'}
                      </div>
                    )}
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
                <div className="flex gap-2">
                  <button onClick={() => setIsTransferring(true)} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:bg-slate-200 dark:hover:bg-[#2a3942] rounded-full transition" title="Transferir"><ArrowRightLeft size={20}/></button>
                  <button onClick={() => {
                    socket.emit("end_chat", { chatId: selectedContact.id });
                    setClosed(p => [...p, { id: selectedContact.id, closedAt: Date.now() }]);
                    setAccepted(p => p.filter(id => id !== selectedContact.id));
                    setSelectedContact(null);
                  }} className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-full transition" title="Finalizar">
                    <CheckCircle size={20}/>
                  </button>
                </div>
              </div>

              {/* LISTA DE MENSAGENS */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-0">
                {isLoadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-60">
                    <Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400 mb-2" size={32} />
                  </div>
                ) : loadError ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <p className="text-rose-500 dark:text-rose-400 mb-4">{loadError}</p>
                    <button
                      onClick={() => {
                        if (selectedContact) {
                          setIsLoadingMessages(true);
                          setLoadError(null);
                          socket.emit("get_chat_messages", {
                            chatId: selectedContact.id,
                            connectionId: selectedContact.connectionId,
                          });
                        }
                      }}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : (
                  chatMessages.map((m, idx) => {
                    const senderType = getMessageSender(m);
                    const reactionsForMsg = messageReactions[m.id || ""] || [];
                    const uniqueKey = m.id || `msg-${idx}`;
                    const isSurvey = isSurveyMessage(m);
                    
                    if (isSurvey) {
                      return (
                        <div key={uniqueKey} className="w-fit max-w-[90%] lg:max-w-[65%] p-1 rounded-lg bg-[#fff3c4] dark:bg-[#4d3c00] mx-auto text-amber-900 dark:text-amber-100 font-medium text-center shadow-md rounded-xl border border-amber-200 dark:border-amber-700/50 px-3 py-2">
                          <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-300 mb-1 flex items-center justify-center gap-1">
                            <ShieldAlert size={12} /> Nota do sistema
                          </div>
                          Mensagem bloqueada (conteúdo da pesquisa não exibido)
                        </div>
                      );
                    }
                    
                    return (
                      <React.Fragment key={uniqueKey}>
                        <div className={cn("w-fit max-w-[90%] lg:max-w-[65%] p-1 rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] relative flex flex-col group",
                          senderType === 'agent' ? "bg-[#d9fdd3] dark:bg-[#005c4b] ml-auto rounded-tr-none text-[#111b21] dark:text-[#e9edef]" :
                          senderType === 'system_note' ? "bg-[#fff3c4] dark:bg-[#4d3c00] max-w-[95%] lg:max-w-[70%] mx-auto text-amber-900 dark:text-amber-100 font-medium text-center shadow-md rounded-xl border border-amber-200 dark:border-amber-700/50 px-3 py-2" :
                          "bg-white dark:bg-[#202c33] mr-auto rounded-tl-none text-[#111b21] dark:text-[#e9edef]"
                        )}>
                          {senderType !== 'system_note' && (
                            <button onClick={() => setReplyingTo(m)} className={cn("absolute top-0 w-8 h-8 flex items-center justify-center bg-black/20 dark:bg-white/20 text-white dark:text-slate-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-sm", senderType === 'agent' ? "-left-10" : "-right-10")}>
                              <Reply size={16}/>
                            </button>
                          )}
                          {m.quotedMsg && (
                            <div className="bg-black/5 dark:bg-white/5 rounded-md p-2 mb-1 border-l-4 border-[#00a884] text-xs cursor-pointer opacity-80 flex flex-col mx-1 mt-1 bg-opacity-10">
                              <span className="font-bold text-[#00a884] mb-0.5">{m.quotedMsg.sender === 'agent' ? "Você" : selectedContact.name}</span>
                              <span className="line-clamp-2 text-slate-600 dark:text-slate-400">{m.quotedMsg.body || "Mídia"}</span>
                            </div>
                          )}
                          <div className="px-2 pt-1 pb-4 min-w-[80px]">
                            {renderMessageContent(m)}
                          </div>
                          {reactionsForMsg.length > 0 && (
                            <div className="flex gap-1 px-2 pb-1 -mt-1">
                              {reactionsForMsg.map((r, i) => (
                                <span key={i} className="bg-black/10 dark:bg-white/10 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                  {r.emoji}
                                </span>
                              ))}
                            </div>
                          )}
                          {senderType !== 'system_note' && (
                            <div className="absolute bottom-1 right-2 flex items-center gap-1">
                              <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">{getMessageTime(m)}</span>
                              {m.fromMe && <span className="text-[#53bdeb] ml-0.5">{renderMessageStatus(m.ack || 0)}</span>}
                            </div>
                          )}
                          {!isViewOnly && (
                            <button onClick={() => setShowReactionPickerFor(m.id || "")} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all text-slate-400 dark:text-slate-500 hover:text-[#00a884]">
                              <Smile size={16} />
                            </button>
                          )}
                          {showReactionPickerFor === m.id && (
                            <div className="reaction-picker absolute top-8 right-2 bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 flex gap-1 z-50">
                              {["👍","❤️","😂","😮","😢","😡"].map(emoji => (
                                <button key={emoji} onClick={() => addReaction(m.id!, emoji)} className="text-2xl hover:scale-125 transition">{emoji}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })
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
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg text-left">
                                  <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center"><FileText size={18} className="text-white" /></div>
                                  <span className="text-sm">Documento</span>
                                </button>
                                <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg text-left">
                                  <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center"><ImageIcon size={18} className="text-white" /></div>
                                  <span className="text-sm">Fotos e vídeos</span>
                                </button>
                                <button onClick={openCamera} className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg text-left">
                                  <div className="w-8 h-8 bg-pink-500 rounded flex items-center justify-center"><Camera size={18} className="text-white" /></div>
                                  <span className="text-sm">Câmera</span>
                                </button>
                                <button onClick={startRecording} className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg text-left">
                                  <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center"><Headphones size={18} className="text-white" /></div>
                                  <span className="text-sm">Áudio</span>
                                </button>
                                <button onClick={() => { setIsContactModalOpen(true); setIsAttachmentOpen(false); }} className="flex items-center gap-3 hover:bg-slate-800 p-2 rounded-lg text-left">
                                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center"><User size={18} className="text-white" /></div>
                                  <span className="text-sm">Contato</span>
                                </button>
                              </div>
                            )}
                          </div>
                          <button onClick={() => setIsQuickRepliesOpen(!isQuickRepliesOpen)} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#111b21] dark:hover:text-white transition quick-replies-trigger" title="Respostas rápidas">
                            <Zap size={24} />
                          </button>
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
                            <button onClick={() => setIsEmojiOpen(!isEmojiOpen)} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#111b21] dark:hover:text-white transition emoji-container" title="Emoji">
                              <Smile size={24} />
                            </button>
                            <textarea ref={textareaRef} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey) {e.preventDefault(); handleSendMessage();}}} placeholder="Digite uma mensagem..." rows={1} className="flex-1 bg-transparent px-2 py-[10px] outline-none text-[15px] resize-none custom-scrollbar text-slate-900 dark:text-white" style={{ minHeight: '40px', maxHeight: '120px' }} />
                          </div>
                        </div>
                        <div className="mb-1 flex-shrink-0">
                          {message.trim() ? (
                            <button onClick={handleSendMessage} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-emerald-600 dark:hover:text-emerald-400 transition"><Send size={24}/></button>
                          ) : (
                            <button onClick={startRecording} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#111b21] dark:hover:text-white transition rounded-full"><Mic size={24}/></button>
                          )}
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

      {/* MODAIS (transferência, contato, câmera, selecionar contato) - mantidos iguais */}
      {isTransferring && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111b21] rounded-2xl w-full max-w-xs p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4 font-bold text-slate-800 dark:text-white">Transferir para: <button onClick={() => setIsTransferring(false)}><X size={18}/></button></div>
            <div className="space-y-2">
              {['Comercial', 'Suporte', 'Financeiro'].map(u => (
                <button key={u} onClick={() => { setTransferred(p => [...p, { id: selectedContact!.id, transferredAt: Date.now() }]); setAccepted(accepted.filter(id => id !== selectedContact!.id)); setSelectedContact(null); setIsTransferring(false); toast.success('Transferido!'); }} className="w-full p-3 text-left border rounded-xl hover:bg-slate-50 dark:hover:bg-[#202c33] flex items-center gap-3 transition text-slate-900 dark:text-white">
                  <UserPlus size={18} className="text-indigo-500"/> {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isContactPanelOpen && selectedContact && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-[#111b21] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Informações do contato</h3>
              <button onClick={() => setIsContactPanelOpen(false)} className="text-slate-500 dark:text-slate-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-xs text-slate-500 dark:text-[#8696a0] mb-1">Nome</label>
                <input type="text" value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-[#8696a0] mb-1">Telefone</label>
                <p className="font-mono text-sm text-slate-700 dark:text-slate-300">{selectedContact.id.replace("@c.us", "")}</p>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-[#8696a0] mb-1">Empresa</label>
                <input type="text" value={contactForm.company} onChange={e => setContactForm({...contactForm, company: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-[#8696a0] mb-1">E-mail</label>
                <input type="email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-[#8696a0] mb-1">Notas</label>
                <textarea value={contactForm.notes} onChange={e => setContactForm({...contactForm, notes: e.target.value})} className="w-full bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white h-24 resize-y" />
              </div>
              <button onClick={saveContact} className="w-full bg-[#00a884] hover:bg-[#018e6f] text-white py-3 rounded-xl font-bold transition">Salvar e sincronizar com agenda do WhatsApp</button>
            </div>
          </div>
        </div>
      )}

      {isCameraModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-[#111b21] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Câmera</h3>
              <button onClick={closeCamera} className="text-slate-500 dark:text-slate-400"><X size={20} /></button>
            </div>
            <div className="relative bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full h-[400px] object-cover" />
            </div>
            <div className="p-4 flex justify-center gap-4">
              <button onClick={capturePhoto} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition">
                <Camera size={20} /> Capturar Foto
              </button>
              <button onClick={closeCamera} className="bg-slate-500 hover:bg-slate-600 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition">Cancelar</button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}

      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111b21] w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="bg-[#00a884] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><User size={20}/> Selecionar Contato</h3>
              <button onClick={() => setIsContactModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20}/></button>
            </div>
            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Pesquisar contato..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto h-72 custom-scrollbar">
              {filteredModalContacts.map((contact, i) => (
                <div key={i} onClick={() => handleSendContact(contact)} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-[#202c33] cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                    <User size={24}/>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{contact.name}</div>
                    <div className="text-sm text-slate-500 dark:text-[#8696a0]">{contact.number}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Chat;