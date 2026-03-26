"use client";

import { socket } from '@/lib/socket';
import React, { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Send, FileUp, Users, MessageSquare, Image as ImageIcon, X, Play, CheckCircle2, 
  Loader2, Calendar, Clock, Plus, Trash2, ClipboardPaste, Pause, Square, AlertCircle, 
  RefreshCw, Settings, Smartphone, Eraser, ChevronDown, ChevronUp,
  Bold, Italic, Strikethrough, Code, Quote, List as ListIcon, ListOrdered, Smile, Zap,
  ShieldCheck, ShieldAlert, AlertTriangle, Download, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { io, Socket } from 'socket.io-client';

// ============================================================================
// INDEXEDDB HELPERS (Solução para remover o limite de QuotaExceededError)
// ============================================================================
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ZapflowEngineDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('engine_state')) {
        db.createObjectStore('engine_state');
      }
    };
  });
};

const saveToDB = async (key: string, value: any) => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('engine_state', 'readwrite');
      const store = transaction.objectStore('engine_state');
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Erro ao salvar no IndexedDB:', error);
  }
};

const loadFromDB = async (key: string): Promise<any> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('engine_state', 'readonly');
      const store = transaction.objectStore('engine_state');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Erro ao carregar do IndexedDB:', error);
    return null;
  }
};

// ============================================================================
// INTERFACES
// ============================================================================
interface SendLog {
  number: string;
  status: 'success' | 'error' | 'skipped';
  time: string;
  reason?: string;
}

interface Connection {
  id: string;
  name: string;
  color: string;
  status: string;
  enabled: boolean;
}

// ============================================================================
// ENGINE (Lógica de Disparo)
// ============================================================================
class BroadcastEngine {
  listeners: (() => void)[] = [];
  socket: Socket | null = null;

  message = '';
  contacts: any[] = [];
  columns: string[] = ['Número', 'Nome'];
  status: 'idle' | 'sending' | 'paused' | 'stopped' = 'idle';
  isWaitingSchedule = false;
  isBatchPausing = false; 
  
  logs: SendLog[] = [];
  broadcastStartTime: string | null = null;
  broadcastEndTime: string | null = null;
  
  mediaFile: string | null = null;      
  mediaBase64: string | null = null;    
  mediaMimeType: string | null = null;
  mediaFileName: string | null = null;
  mediaPayloadFormat: 'buffer' | 'base64_keys' | 'wwebjs' | 'evolution' = 'buffer';

  sendMode: 'safe' | 'unsafe' | null = null;

  scheduleStart: string = '';
  scheduleEnd: string = '';
  workingHours: Record<number, { enabled: boolean; start: string; end: string }> = {
    0: { enabled: false, start: '08:00', end: '12:00' }, 
    1: { enabled: true, start: '08:00', end: '18:00' },  
    2: { enabled: true, start: '08:00', end: '18:00' },  
    3: { enabled: true, start: '08:00', end: '18:00' },  
    4: { enabled: true, start: '08:00', end: '18:00' },  
    5: { enabled: true, start: '08:00', end: '18:00' },  
    6: { enabled: false, start: '08:00', end: '12:00' }, 
  };

  successCount = 0;
  failCount = 0;
  currentIndex = 0;
  
  minInterval = 5;
  maxInterval = 15;
  numberSuffix = '@c.us';

  selectedConnectionIds: string[] = [];
  currentConnectionIndex = 0;
  retryAttempts = 3;

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  notify() {
    this.listeners.forEach(l => l());
    this.saveState();
  }

  saveState() {
    if (typeof window !== 'undefined') {
      const stateObj = {
        message: this.message,
        contacts: this.contacts,
        columns: this.columns,
        status: this.status === 'sending' ? 'paused' : this.status,
        successCount: this.successCount,
        failCount: this.failCount,
        currentIndex: this.currentIndex,
        minInterval: this.minInterval,
        maxInterval: this.maxInterval,
        numberSuffix: this.numberSuffix,
        mediaPayloadFormat: this.mediaPayloadFormat,
        sendMode: this.sendMode,
        scheduleStart: this.scheduleStart,
        scheduleEnd: this.scheduleEnd,
        workingHours: this.workingHours,
        logs: this.logs,
        broadcastStartTime: this.broadcastStartTime,
        broadcastEndTime: this.broadcastEndTime,
        selectedConnectionIds: this.selectedConnectionIds,
        currentConnectionIndex: this.currentConnectionIndex,
        retryAttempts: this.retryAttempts,
      };

      saveToDB('zapflow_engine_state', stateObj).catch(() => {
        try {
          localStorage.setItem('zapflow_engine_state_fallback', JSON.stringify({
            ...stateObj,
            logs: this.logs.slice(0, 50),
            contacts: []
          }));
        } catch(e) { }
      });
    }
  }

  async loadState() {
    if (typeof window !== 'undefined') {
      let data = await loadFromDB('zapflow_engine_state');
      
      if (!data) {
        const saved = localStorage.getItem('zapflow_engine_state');
        if (saved) {
          data = JSON.parse(saved);
          localStorage.removeItem('zapflow_engine_state');
        }
      }

      if (data) {
        this.message = data.message || '';
        this.contacts = data.contacts || [];
        this.columns = data.columns || ['Número', 'Nome'];
        this.status = data.status === 'stopped' ? 'idle' : (data.status || 'idle');
        this.successCount = data.successCount || 0;
        this.failCount = data.failCount || 0;
        this.currentIndex = data.currentIndex || 0;
        this.minInterval = data.minInterval || 5;
        this.maxInterval = data.maxInterval || 15;
        this.numberSuffix = data.numberSuffix !== undefined ? data.numberSuffix : '@c.us';
        this.mediaPayloadFormat = data.mediaPayloadFormat || 'buffer';
        this.sendMode = data.sendMode || null;
        this.scheduleStart = data.scheduleStart || '';
        this.scheduleEnd = data.scheduleEnd || '';
        if (data.workingHours) this.workingHours = data.workingHours;
        if (data.logs) this.logs = data.logs;
        if (data.broadcastStartTime) this.broadcastStartTime = data.broadcastStartTime;
        if (data.broadcastEndTime) this.broadcastEndTime = data.broadcastEndTime;
        if (data.selectedConnectionIds) this.selectedConnectionIds = data.selectedConnectionIds;
        if (data.currentConnectionIndex) this.currentConnectionIndex = data.currentConnectionIndex;
        if (data.retryAttempts) this.retryAttempts = data.retryAttempts;
        
        this.isWaitingSchedule = false;
        this.isBatchPausing = false;
        this.listeners.forEach(l => l());
      }
    }
  }

  reset() {
    this.status = 'idle';
    this.message = '';
    this.contacts = [];
    this.logs = [];
    this.successCount = 0;
    this.failCount = 0;
    this.currentIndex = 0;
    this.mediaFile = null;
    this.mediaBase64 = null;
    this.mediaMimeType = null;
    this.mediaFileName = null;
    this.sendMode = null;
    this.isWaitingSchedule = false;
    this.isBatchPausing = false;
    this.scheduleStart = '';
    this.scheduleEnd = '';
    this.broadcastStartTime = null;
    this.broadcastEndTime = null;
    this.notify();
  }

  removeDuplicates() {
    const unique = [];
    const seen = new Set();
    for (const contact of this.contacts) {
      if (!seen.has(contact.targetNumber)) {
        seen.add(contact.targetNumber);
        unique.push(contact);
      }
    }
    const removedCount = this.contacts.length - unique.length;
    this.contacts = unique;
    this.notify();
    return removedCount;
  }

  setSelectedConnectionIds(ids: string[]) {
    this.selectedConnectionIds = ids;
    this.currentConnectionIndex = 0;
    this.notify();
  }

  checkIfAllowedTime(): boolean {
    const now = new Date();
    if (this.scheduleStart && now < new Date(this.scheduleStart)) return false;
    if (this.scheduleEnd && now > new Date(this.scheduleEnd)) {
      this.status = 'idle'; 
      this.isWaitingSchedule = false;
      return false;
    }
    const day = now.getDay();
    const wh = this.workingHours[day as keyof typeof this.workingHours];
    if (!wh.enabled) return false;
    const hm = now.toTimeString().slice(0,5);
    return hm >= wh.start && hm <= wh.end;
  }

  private sendWithAck(payload: any): Promise<any> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ error: 'Socket desconectado' });
      
      let responded = false;
      const timeout = setTimeout(() => {
        if (!responded) {
          responded = true;
          resolve({ error: 'Timeout: O servidor ou API de WhatsApp demorou muito para responder.' });
        }
      }, 15000); 

      this.socket.emit("send_message", payload, (response: any) => {
        if (!responded) {
          responded = true;
          clearTimeout(timeout);
          resolve(response || { success: true });
        }
      });
    });
  }

  private async sendWithRetry(basePayload: any): Promise<any> {
    const baseNumber = basePayload.to;
    const variations = [
      `${baseNumber.replace(/@.*$/, '')}@c.us`,
      `${baseNumber.replace(/@.*$/, '')}@s.whatsapp.net`,
      baseNumber.replace(/@.*$/, '')
    ];
    const uniqueVariations = [...new Set(variations)];

    let lastError: any = null;
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      const target = uniqueVariations[attempt % uniqueVariations.length];
      const payload = { ...basePayload, to: target };
      console.log(`[Retry] Tentativa ${attempt + 1}/${this.retryAttempts} para ${target}`);
      const response = await this.sendWithAck(payload);
      if (response.success !== false && !response.error) {
        return response;
      }
      lastError = response.error;
      if (attempt < this.retryAttempts - 1) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
    throw new Error(lastError || 'Falha após todas as tentativas');
  }

  async start() {
    if (this.status === 'sending' || this.contacts.length === 0) return;
    
    this.status = 'sending';
    if (!this.broadcastStartTime) {
      this.broadcastStartTime = new Date().toLocaleString('pt-BR');
    }
    this.broadcastEndTime = null;
    this.notify();

    if (!this.socket) this.socket = socket;
    if (this.socket && !this.socket.connected) {
      await new Promise(resolve => {
        this.socket?.once('connect', resolve);
        setTimeout(resolve, 2000); 
      });
    }

    let existingNumbers: string[] = [];
    if (this.sendMode === 'safe') {
      try {
        toast.info("Modo Seguro Ativo: Mapeando histórico de conversas...");
        const chats: any[] = await new Promise((resolve) => {
          this.socket?.once("chats", resolve);
          this.socket?.emit("get_chats");
        });
        existingNumbers = chats.map(c => c.number);
      } catch (e) {
        console.error("Erro ao obter lista de chats para o Modo Seguro:", e);
      }
    }

    if (this.currentIndex >= this.contacts.length) {
      this.currentIndex = 0;
      this.successCount = 0;
      this.failCount = 0;
      this.logs = [];
    }

    for (let i = this.currentIndex; i < this.contacts.length; i++) {
      
      while (this.status === 'sending' || this.status === 'paused') {
        if (this.status === 'paused') {
          if (this.isWaitingSchedule) { this.isWaitingSchedule = false; this.notify(); }
          await new Promise(res => setTimeout(res, 1000));
          continue;
        }
        const allowed = this.checkIfAllowedTime();
        if (!allowed && this.status === 'sending') {
          if (!this.isWaitingSchedule) {
            this.isWaitingSchedule = true;
            this.notify();
          }
          await new Promise(res => setTimeout(res, 5000));
          continue;
        }
        if (allowed && this.isWaitingSchedule) {
          this.isWaitingSchedule = false;
          this.notify();
        }
        break; 
      }
      if (this.status === 'idle') break; 

      if (i > 0 && i % 80 === 0) {
        const batchDelay = Math.floor(Math.random() * (360 - 180 + 1)) + 180;
        console.log(`⏱️ Lote de 80 envios atingido. Pausa longa de ${batchDelay} segundos...`);
        this.isBatchPausing = true;
        this.notify();
        for (let ms = 0; ms < batchDelay * 10; ms++) {
          if (this.status === 'idle') break;
          while (this.status === 'paused') await new Promise(r => setTimeout(r, 500));
          await new Promise(r => setTimeout(r, 100));
        }
        this.isBatchPausing = false;
        this.notify();
      }
      if (this.status === 'idle') break;

      const delay = Math.floor(Math.random() * (this.maxInterval - this.minInterval + 1)) + this.minInterval;
      console.log(`⏱️ Aguardando intervalo de segurança: ${delay} segundos...`);
      for (let ms = 0; ms < delay * 10; ms++) {
        if (this.status === 'idle') break;
        while (this.status === 'paused') await new Promise(r => setTimeout(r, 500));
        await new Promise(r => setTimeout(r, 100));
      }
      if (this.status === 'idle') break;

      const contact = this.contacts[i];
      let finalMsg = this.message;
      this.columns.forEach(col => {
        finalMsg = finalMsg.replace(new RegExp(`{{${col}}}`, 'g'), contact[col] || '');
      });
      const now = new Date();
      finalMsg = finalMsg.replace(/{{Data}}/g, now.toLocaleDateString('pt-BR'));
      finalMsg = finalMsg.replace(/{{Hora}}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      finalMsg = finalMsg.replace(/\{\{([^}]+)\}\}/g, (match, content) => {
        if (content.includes('|')) {
          const options = content.split('|').map((s: string) => s.trim());
          return options[Math.floor(Math.random() * options.length)];
        }
        return match; 
      });

      let num = contact.targetNumber.replace(/\D/g, '');
      if (num.startsWith('55') && num.length >= 12) num = num.substring(2);
      if (num.length === 11 && num[2] === '9') {
        const ddd = parseInt(num.substring(0, 2));
        if (ddd > 27) num = num.substring(0, 2) + num.substring(3); 
      } else if (num.length === 10) {
        const ddd = parseInt(num.substring(0, 2));
        if (ddd <= 27) num = num.substring(0, 2) + '9' + num.substring(2); 
      }

      const numberOnly = `55${num}`;
      const formattedTarget = `${numberOnly}${this.numberSuffix}`;

      if (this.sendMode === 'safe') {
        if (!existingNumbers.includes(numberOnly)) {
          console.log(`🛡️ Contato ignorado (Sem histórico prévio): ${numberOnly}`);
          this.logs.unshift({ 
            number: formattedTarget, 
            status: 'skipped', 
            time: new Date().toLocaleTimeString('pt-BR'), 
            reason: 'Ignorado (Modo Seguro - Sem conversa anterior)' 
          });
          this.currentIndex = i + 1;
          this.notify();
          continue; 
        }
      }
      
      if (this.socket && this.socket.connected) {
        try {
          if (this.mediaBase64 && this.mediaFile) {
            const mime = this.mediaMimeType || "application/octet-stream";
            const isAudio = mime.startsWith('audio/');
            
            let mediaPayloadObj: any = {};
            let bufferData: ArrayBuffer | null = null;

            if (this.mediaPayloadFormat === 'buffer') {
              try {
                const binaryString = window.atob(this.mediaBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let j = 0; j < binaryString.length; j++) {
                  bytes[j] = binaryString.charCodeAt(j);
                }
                bufferData = bytes.buffer; 
              } catch (e) {
                console.error("Falha ao criar Buffer binário:", e);
              }
            }

            if (this.mediaPayloadFormat === 'buffer' && bufferData) {
              if (mime.startsWith('image/')) mediaPayloadObj = { image: bufferData };
              else if (mime.startsWith('video/')) mediaPayloadObj = { video: bufferData };
              else if (isAudio) mediaPayloadObj = { audio: bufferData };
              else mediaPayloadObj = { document: bufferData };
              mediaPayloadObj.mimetype = mime;
              mediaPayloadObj.fileName = this.mediaFileName;
            } 
            else if (this.mediaPayloadFormat === 'base64_keys') {
              if (mime.startsWith('image/')) mediaPayloadObj = { image: this.mediaBase64 };
              else if (mime.startsWith('video/')) mediaPayloadObj = { video: this.mediaBase64 };
              else if (isAudio) mediaPayloadObj = { audio: this.mediaBase64 };
              else mediaPayloadObj = { document: this.mediaBase64 };
              mediaPayloadObj.mimetype = mime;
              mediaPayloadObj.fileName = this.mediaFileName;
            }
            else if (this.mediaPayloadFormat === 'wwebjs') {
              mediaPayloadObj = { file: this.mediaFile, fileName: this.mediaFileName, mimetype: mime };
            } 
            else if (this.mediaPayloadFormat === 'evolution') {
              mediaPayloadObj = { media: { data: this.mediaBase64, mimetype: mime, filename: this.mediaFileName } };
            } 

            if (isAudio) {
              if (finalMsg.trim()) {
                await this.sendWithRetry({ to: formattedTarget, text: finalMsg });
                await new Promise(r => setTimeout(r, 1500));
              }
              const audioPayload = { to: formattedTarget, ptt: true, ...mediaPayloadObj };
              await this.sendWithRetry(audioPayload);
            } else {
              const fullPayload = { to: formattedTarget, text: finalMsg, caption: finalMsg, ...mediaPayloadObj };
              await this.sendWithRetry(fullPayload);
            }
          } else {
            const payload = { to: formattedTarget, text: finalMsg };
            await this.sendWithRetry(payload);
          }

          this.successCount++;
          this.logs.unshift({ number: formattedTarget, status: 'success', time: new Date().toLocaleTimeString('pt-BR') });
          
          if (typeof window !== 'undefined') {
            const todayStr = new Date().toLocaleDateString('pt-BR'); 
            let stats;
            try {
              stats = JSON.parse(localStorage.getItem('zapflow_broadcast_stats') || '{}');
            } catch (e) { stats = {}; }
            if (stats.date !== todayStr) stats = { date: todayStr, count: 0 };
            stats.count = (stats.count || 0) + 1;
            localStorage.setItem('zapflow_broadcast_stats', JSON.stringify(stats));
          }
        } catch (err) {
          console.error("Erro no disparo capturado e forçado na interface:", err);
          this.failCount++;
          this.logs.unshift({ number: formattedTarget, status: 'error', time: new Date().toLocaleTimeString('pt-BR'), reason: 'Falha na conexão/API' });
        }
      } else {
        this.failCount++;
        this.logs.unshift({ number: formattedTarget, status: 'error', time: new Date().toLocaleTimeString('pt-BR'), reason: 'Sem conexão de rede' });
      }

      this.currentIndex = i + 1;
      this.notify();
    }

    if (this.status !== 'idle') {
      this.status = 'idle';
      this.broadcastEndTime = new Date().toLocaleString('pt-BR');
      this.notify();
      toast.success("Disparos concluídos com sucesso (ou atingiu o horário limite).");
    }
  }

  pause() {
    if (this.status === 'sending') {
      this.status = 'paused';
      this.notify();
    }
  }

  resume() {
    if (this.status === 'paused') {
      this.status = 'sending';
      this.notify();
    }
  }

  stop() {
    this.status = 'idle'; 
    this.broadcastEndTime = new Date().toLocaleString('pt-BR');
    this.notify();
  }
}

const engine = new BroadcastEngine();

if (typeof window !== 'undefined') {
  engine.loadState();
}

interface ManualContact {
  number: string;
  name: string;
}

const Broadcast = () => {
  const [, setTick] = useState(0);
  const [manualContacts, setManualContacts] = useState<ManualContact[]>([{ number: '', name: '' }]);
  const [media, setMedia] = useState<{ file: File, preview: string, type: string } | null>(null);
  const [importType, setImportType] = useState<'manual' | 'file'>('manual');
  const [sentToday, setSentToday] = useState(0);
  
  const [isMaster, setIsMaster] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [dontShowWarningToday, setDontShowWarningToday] = useState(false);

  const [availableConnections, setAvailableConnections] = useState<Connection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [selectedConnIds, setSelectedConnIds] = useState<string[]>(engine.selectedConnectionIds);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<{start: number, end: number} | null>(null);

  const emojiCategories = {
    "Pessoas": ["😀","😃","😄","😁","😆","😅","😂","🤣","☺️","😊","😇","🙂","🙃","😉","😌","😍","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","👋","🤚","🖐","✋","🖖","👌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","🤲","🤝","🙏","💪","🦵","🦶","👂","👃","🧠","🦷","🦴","👀","👁","👅","👄","💋","🩸"],
    "Animais": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🕷","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🐈","🐓","🦃","🦚","🦜","🦢","🦩","🕊","🐇","🦝","🦨","🦡","🦦","🦥","🐁","🐀","🐿","🦔","🐾","🐉","🐲","🌵","🎄","🌲","🌳","🌴","🪵","🌱","🌿","☘️","🍀","🎍","🪴","🎋","🍃","🍂","🍁","🍄","🐚","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻"],
    "Comida": ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶","🌽","🥕","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🥙","🌮","🌯","🥗","🥘","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","☕️","🍵","🧃","🥤","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🍽","🥣","🥡","🥢","🧂"],
    "Atividades": ["⚽️","🏀","🏈","⚾️","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳️","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸","🥌","🎿","⛷","🏂","🪂","🏋️‍♀️","🏋️","🤺","🤼‍♀️","🤼","🤸‍♀️","🤸","⛹️‍♀️","⛹️","🤾‍♀️","🤾","🏌️‍♀️","🏌️","🏇","🧘‍♀️","🧘","🏄‍♀️","🏄","🤽‍♀️","🤽","🚣‍♀️","🚣","🧗‍♀️","🧗","🚵‍♀️","🚵","🚴‍♀️","🚴","🏆","🥇","🥈","🥉","🏅","🎖","🏵","🎗","🎫","🎟","🎪","🤹","🎭","🩰","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺","🪗","🎸","🪕","🎻","🎲","♟","🎯","🎳","🎮","🎰","🧩"]
  };

  const fetchConnections = async () => {
    setLoadingConnections(true);
    try {
      const API_BASE_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) 
        ? process.env.NEXT_PUBLIC_API_URL 
        : 'http://localhost:3001';
      const res = await fetch(`${API_BASE_URL}/api/connections`);
      if (!res.ok) throw new Error('Erro ao carregar conexões');
      const data = await res.json();
      const active = data.filter((c: Connection) => c.enabled && c.status === 'connected');
      setAvailableConnections(active);
      const validSelected = engine.selectedConnectionIds.filter(id => active.some(c => c.id === id));
      if (validSelected.length !== engine.selectedConnectionIds.length) {
        engine.setSelectedConnectionIds(validSelected);
        setSelectedConnIds(validSelected);
      }
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível carregar as conexões ativas.');
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleConnectionToggle = (connId: string) => {
    let newSelection: string[];
    if (selectedConnIds.includes(connId)) {
      newSelection = selectedConnIds.filter(id => id !== connId);
    } else {
      newSelection = [...selectedConnIds, connId];
    }
    setSelectedConnIds(newSelection);
    engine.setSelectedConnectionIds(newSelection);
    if (engine.sendMode === 'safe' && newSelection.length !== 1) {
      engine.sendMode = 'unsafe';
      engine.notify();
      toast.warning("Modo Seguro requer exatamente uma conexão. Alterado para Modo Inseguro.");
    }
  };

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
    
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const savedWarningDate = localStorage.getItem('zapflow_broadcast_warning_date');
    if (savedWarningDate !== todayStr) setShowWarningModal(true);
    
    try {
      let foundMaster = false;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        const data = localStorage.getItem(key);
        if (data) {
          const rawData = data.toLowerCase();
          if (key.toLowerCase().includes('user') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('session') || key.toLowerCase().includes('perfil')) {
            if (rawData.includes('master') || rawData.includes('admin') || rawData.includes('administrador')) {
              foundMaster = true;
              break;
            }
          }
        }
      }
      if (!foundMaster) {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i) || '';
          const data = sessionStorage.getItem(key);
          if (data) {
            const rawData = data.toLowerCase();
            if (key.toLowerCase().includes('user') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('session') || key.toLowerCase().includes('perfil')) {
              if (rawData.includes('master') || rawData.includes('admin') || rawData.includes('administrador')) {
                foundMaster = true;
                break;
              }
            }
          }
        }
      }
      setIsMaster(foundMaster);
    } catch (e) {
      console.error("Erro ao validar permissões Master:", e);
    }
    
    const unsubscribe = engine.subscribe(() => {
      setTick(t => t + 1);
      let stats;
      try {
        stats = JSON.parse(localStorage.getItem('zapflow_broadcast_stats') || '{}');
      } catch (e) { stats = { count: 0 }; }
      setSentToday(stats.count || 0);
    });
    
    const checkDateAndReset = () => {
      try {
        const raw = localStorage.getItem('zapflow_broadcast_stats');
        const today = new Date().toLocaleDateString('pt-BR');
        let stats = { date: today, count: 0 };
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.date === today) stats.count = parsed.count || 0;
          else localStorage.setItem('zapflow_broadcast_stats', JSON.stringify({ date: today, count: 0 }));
        } else {
          localStorage.setItem('zapflow_broadcast_stats', JSON.stringify(stats));
        }
        setSentToday(stats.count);
      } catch (e) {
        const today = new Date().toLocaleDateString('pt-BR');
        localStorage.setItem('zapflow_broadcast_stats', JSON.stringify({ date: today, count: 0 }));
        setSentToday(0);
      }
    };
    
    checkDateAndReset();
    const interval = setInterval(checkDateAndReset, 60000);
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.emoji-container')) setIsEmojiOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    fetchConnections();
    const connectionsInterval = setInterval(fetchConnections, 30000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
      clearInterval(connectionsInterval);
      document.removeEventListener('mousedown', handleClickOutside);
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  const cleanNumber = (num: any) => {
    let cleaned = String(num).replace(/\D/g, '');
    if (!cleaned) return '';
    while (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (!cleaned) return '';
    return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);
      if (data.length > 0) {
        const cols = Object.keys(data[0]);
        const processedData = data.map(item => {
          const firstColKey = cols[0];
          return { 
            ...item, 
            [firstColKey]: cleanNumber(item[firstColKey]), 
            targetNumber: cleanNumber(item[firstColKey]) 
          };
        });
        engine.contacts = processedData;
        engine.columns = cols;
        engine.currentIndex = 0;
        engine.successCount = 0;
        engine.failCount = 0;
        engine.logs = [];
        engine.notify();
        setImportType('file');
        toast.success(`${processedData.length} contatos importados!`);
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type) {
      toast.error("Formato de ficheiro não reconhecido pelo sistema.");
      e.target.value = '';
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("O ficheiro excedeu o limite de 16MB.");
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const fullResult = reader.result as string;
      engine.mediaFile = fullResult;
      engine.mediaBase64 = fullResult.split(',')[1];
      engine.mediaMimeType = file.type;
      engine.mediaFileName = file.name;
      engine.notify();
    };
    reader.readAsDataURL(file);
    const preview = URL.createObjectURL(file);
    setMedia({ file, preview, type: file.type });
    e.target.value = '';
  };

  const addManualRow = () => setManualContacts([...manualContacts, { number: '', name: '' }]);
  const removeManualRow = (index: number) => {
    const newRows = manualContacts.filter((_, i) => i !== index);
    setManualContacts(newRows.length ? newRows : [{ number: '', name: '' }]);
  };
  const updateManualContact = (index: number, field: keyof ManualContact, value: string) => {
    const newRows = [...manualContacts];
    newRows[index][field] = value;
    setManualContacts(newRows);
  };
  const handleManualImport = () => {
    const validContacts = manualContacts
      .filter(c => c.number.trim())
      .map(c => ({
        'Número': cleanNumber(c.number),
        'Nome': c.name,
        targetNumber: cleanNumber(c.number)
      }));
    if (validContacts.length > 0) {
      engine.contacts = validContacts;
      engine.columns = ['Número', 'Nome'];
      engine.currentIndex = 0;
      engine.successCount = 0;
      engine.failCount = 0;
      engine.logs = [];
      engine.notify();
      setImportType('manual');
      toast.success(`${validContacts.length} contatos carregados!`);
    } else {
      toast.error("Preencha pelo menos um número válido.");
    }
  };
  const handleRemoveDuplicates = () => {
    const removedCount = engine.removeDuplicates();
    if (removedCount > 0) toast.success(`${removedCount} contatos duplicados foram removidos!`);
    else toast.info("A fila já está limpa. Nenhum contacto duplicado encontrado.");
  };

  const handleTextareaActivity = () => {
    if (textareaRef.current) {
      selectionRef.current = { start: textareaRef.current.selectionStart, end: textareaRef.current.selectionEnd };
    }
  };
  const applyFormatting = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const currentText = engine.message;
    const selectedText = currentText.substring(start, end);
    const newText = currentText.substring(0, start) + prefix + selectedText + suffix + currentText.substring(end);
    engine.message = newText;
    engine.notify();
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + prefix.length, end + prefix.length);
      }
    }, 10);
  };
  const insertText = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = selectionRef.current || { start: engine.message.length, end: engine.message.length };
    engine.message = engine.message.substring(0, pos.start) + text + engine.message.substring(pos.end);
    engine.notify();
    const newCursorPos = pos.start + text.length;
    selectionRef.current = { start: newCursorPos, end: newCursorPos };
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };
  const insertTag = (tag: string) => insertText(`{{${tag}}}`);
  const scrollToCategory = (catName: string) => {
    const container = document.getElementById("emoji-scroll-container");
    const el = document.getElementById(`emoji-cat-${catName}`);
    if (el && container) container.scrollTo({ top: el.offsetTop - 45, behavior: 'smooth' });
  };

  const startBroadcast = () => {
    if (engine.contacts.length === 0) return toast.error("Importe uma planilha ou confirme a lista manual primeiro!");
    if (!engine.message && !engine.mediaFile) return toast.error("Escreva uma mensagem ou anexe um ficheiro antes de enviar!");
    if (!engine.sendMode) return toast.error("Selecione o Modo Seguro ou Inseguro antes de iniciar o disparo!");
    if (engine.selectedConnectionIds.length === 0) return toast.error("Selecione pelo menos uma conexão ativa!");
    toast.success("Fila iniciada! Respeitando as regras de envio e horários definidos...");
    engine.start();
  };

  const handleReset = () => {
    if (confirm("Tem certeza que deseja limpar a sessão e zerar os contadores?")) {
      engine.reset();
      setManualContacts([{ number: '', name: '' }]);
      setMedia(null);
      toast.info("Sessão limpa!");
    }
  };
  const handleResetDailyLimit = () => {
    if (!isMaster) return;
    if (confirm("Deseja realmente ZERAR o contador de envios diários de volta para 0?")) {
      const todayStr = new Date().toLocaleDateString('pt-BR');
      const stats = { date: todayStr, count: 0 };
      localStorage.setItem('zapflow_broadcast_stats', JSON.stringify(stats));
      setSentToday(0);
      toast.success("Limite diário zerado com sucesso!");
    }
  };

  const exportToExcel = () => {
    if (engine.logs.length === 0) return toast.error("Nenhum dado para exportar.");
    const wsData = [
      ["Relatório de Disparos em Massa"],
      ["Início dos Envios:", engine.broadcastStartTime || "N/A"],
      ["Fim / Último Registro:", engine.broadcastEndTime || (engine.status !== 'idle' ? "Em andamento..." : "N/A")],
      [],
      ["Número Destino", "Status Final", "Horário"]
    ];
    engine.logs.forEach(log => {
      wsData.push([
        log.number.split('@')[0], 
        log.status === 'success' ? 'Enviado' : log.status === 'skipped' ? 'Ignorado' : 'Falha', 
        log.time
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Histórico");
    XLSX.writeFile(wb, "Relatorio_Envios.xlsx");
    toast.success("Relatório Excel exportado!");
  };

  const exportToPDF = () => {
    if (engine.logs.length === 0) return toast.error("Nenhum dado para exportar.");
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return toast.error("Pop-ups bloqueados. Permita pop-ups no seu navegador para exportar o PDF.");
    const totalLogs = engine.logs.length;
    const successCount = engine.logs.filter(l => l.status === 'success').length;
    const failCount = totalLogs - successCount; 
    const successPct = totalLogs > 0 ? ((successCount / totalLogs) * 100).toFixed(1) : "0.0";
    const failPct = totalLogs > 0 ? ((failCount / totalLogs) * 100).toFixed(1) : "0.0";
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Disparos</title>
        <style>
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; background: #fff; margin: 0; }
          h1 { color: #0f172a; font-size: 24px; text-align: center; margin-bottom: 5px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          .dashboard-header { display: flex; gap: 20px; margin-bottom: 30px; margin-top: 20px; }
          .meta-info { flex: 1; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px; display: flex; flex-direction: column; justify-content: center; }
          .meta-info p { margin: 5px 0; }
          .chart-card { width: 250px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .pie-chart {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: conic-gradient(#10b981 0% ${successPct}%, #ef4444 ${successPct}% 100%);
            margin-bottom: 15px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }
          .legend { display: flex; flex-direction: column; gap: 8px; font-size: 13px; width: 100%; }
          .legend-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .legend-label { display: flex; align-items: center; gap: 6px; font-weight: 600; }
          .dot { width: 12px; height: 12px; border-radius: 50%; }
          .dot.success { background-color: #86b910; }
          .dot.fail { background-color: #ef4444; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
          th { background-color: #f2f1f9; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .status-success { color: #059669; font-weight: bold; }
          .status-error { color: #e11d48; font-weight: bold; }
          .status-skipped { color: #e11d48; font-weight: bold; }
          @media print {
            body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .meta-info, .chart-card { border: 1px solid #cbd5e1; }
          }
        </style>
      </head>
      <body>
        <h1>Relatório de Disparos em Massa</h1>
        <div class="dashboard-header">
          <div class="meta-info">
            <p><strong>Início dos Envios:</strong> ${engine.broadcastStartTime || "N/A"}</p>
            <p><strong>Fim / Último Registro:</strong> ${engine.broadcastEndTime || (engine.status !== 'idle' ? "Em andamento..." : "N/A")}</p>
            <p><strong>Total Processado:</strong> ${totalLogs} contatos</p>
          </div>
          <div class="chart-card">
            <div class="pie-chart"></div>
            <div class="legend">
               <div class="legend-item"><span class="legend-label"><div class="dot success"></div> Enviados</span><span><strong>${successPct}%</strong> (${successCount})</span></div>
               <div class="legend-item"><span class="legend-label"><div class="dot fail"></div> Falhas</span><span><strong>${failPct}%</strong> (${failCount})</span></div>
            </div>
          </div>
        </div>
         <table>
          <thead>
            <tr><th>Número Destino</th><th>Status Final</th><th>Horário</th></tr>
          </thead>
          <tbody>
            ${engine.logs.map(log => `
              <tr>
                <td style="font-family: monospace;">${log.number.split('@')[0]}</td>
                <td class="status-${log.status}">${log.status === 'success' ? 'Enviado' : log.status === 'skipped' ? 'Ignorado' : 'Falha'}</td>
                <td>${log.time}</td>
              </tr>
            `).join('')}
          </tbody>
         </table>
        <script>window.onload = () => { window.print(); };</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const total = engine.contacts.length;
  const successPct = total > 0 ? (engine.successCount / total) * 100 : 0;
  const failPct = total > 0 ? ((engine.failCount + engine.logs.filter(l => l.status === 'skipped').length) / total) * 100 : 0;
  const isBusy = engine.status === 'sending' || engine.status === 'paused';
  const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        {showWarningModal && (
          <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800">
              <div className="bg-rose-500 p-6 flex flex-col items-center justify-center text-white">
                <AlertTriangle size={48} className="mb-4 text-rose-100 drop-shadow-md" />
                <h2 className="text-xl font-bold text-center">Aviso Importante de Risco</h2>
              </div>
              <div className="p-6 space-y-4 text-slate-600 dark:text-slate-400">
                <p className="font-medium text-slate-800 dark:text-slate-200">O envio de mensagens em massa não solicitadas (SPAM) fere diretamente as políticas e Termos de Serviço do WhatsApp.</p>
                <p className="text-sm">Nós <strong className="text-rose-600 dark:text-rose-400 underline">não nos responsabilizamos</strong> por eventuais bloqueios, restrições ou o banimento definitivo do seu número de WhatsApp. O uso desta ferramenta de disparos é de sua <strong className="text-slate-800 dark:text-slate-200">inteira responsabilidade</strong>.</p>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 text-sm mt-4">
                  <span className="font-bold text-slate-700 dark:text-slate-200 block mb-2 flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-500"/> Dicas de proteção:</span>
                  <ul className="list-disc pl-5 space-y-1.5 text-slate-500 dark:text-slate-400">
                    <li>Utilize o <strong className="text-emerald-600 dark:text-emerald-400">Modo Seguro</strong> (envia apenas para quem já conversou com você).</li>
                    <li>Configure pausas longas entre os envios (mínimo de 15 segundos).</li>
                    <li>Evite enviar propaganda para quem não pediu para receber.</li>
                  </ul>
                </div>
                <label className="flex items-center gap-3 p-3 mt-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-700/50">
                  <input type="checkbox" checked={dontShowWarningToday} onChange={(e) => setDontShowWarningToday(e.target.checked)} className="w-5 h-5 rounded text-rose-500 focus:ring-rose-500 border-slate-300 dark:border-slate-600 dark:bg-slate-900" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Li e concordo com os riscos (Não mostrar hoje)</span>
                </label>
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                <button onClick={() => { if (dontShowWarningToday) localStorage.setItem('zapflow_broadcast_warning_date', new Date().toLocaleDateString('pt-BR')); setShowWarningModal(false); }} className="px-6 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition shadow-lg shadow-rose-500/20 w-full">Eu entendi e assumo a responsabilidade</button>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 lg:p-8 max-w-6xl mx-auto pb-24 text-slate-900 dark:text-slate-100">
          {!showWarningModal && (
            <div className="mb-6 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 border-l-4 border-l-rose-500 p-4 rounded-r-2xl flex items-start gap-3 shadow-sm animate-in slide-in-from-top-4">
              <ShieldAlert className="text-rose-500 shrink-0 mt-0.5" size={24} />
              <div>
                <h4 className="text-rose-800 dark:text-rose-400 font-bold">Atenção: Risco Constante de Banimento</h4>
                <p className="text-rose-600 dark:text-rose-300 text-sm mt-1">O disparo em massa pode resultar no bloqueio imediato do seu WhatsApp pela Meta. Utilize com moderação, respeite intervalos e evite SPAM. A plataforma isenta-se de responsabilidade sobre a perda de números.</p>
              </div>
            </div>
          )}

          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Disparos em Massa</h1>
              <p className="text-slate-500 dark:text-slate-400">O motor aplicará a pausa e respeitará os horários de expediente.</p>
            </div>
            <div className="flex gap-4">
              {isMaster && (
                <button onClick={handleResetDailyLimit} disabled={isBusy} className={cn("px-4 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-500/20 shadow-sm text-xs font-bold flex items-center gap-2 transition", isBusy ? "opacity-50 cursor-not-allowed" : "hover:bg-rose-100 dark:hover:bg-rose-500/20")}>
                  <AlertCircle size={14} /> Zerar Limite
                </button>
              )}
              <button onClick={handleReset} disabled={isBusy} className={cn("px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-bold flex items-center gap-2 transition", isBusy ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-200 dark:hover:bg-slate-700")}>
                <RefreshCw size={14} /> Limpar Sessão
              </button>
              <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-right">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Enviados Hoje</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{sentToday} / 300</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className={cn("bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all", isBusy && "opacity-60 pointer-events-none")}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><MessageSquare size={18} className="text-emerald-500" /> Conteúdo da Mensagem</h3>
                  <div className="flex flex-wrap gap-2">
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertTag('Data')} className="px-2 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition"><Calendar size={10}/> Data</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertTag('Hora')} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition"><Clock size={10}/> Hora</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertText('{{Olá | Oi | Tudo bem}}')} className="px-2 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition">👋 Saudação</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertText('{{Obrigado | Agradeço | Grato}}')} className="px-2 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition">🙏 Agradecimento</button>
                    {engine.columns.map(col => (
                      <button key={col} onMouseDown={(e) => e.preventDefault()} onClick={() => insertTag(col)} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 transition">+{col}</button>
                    ))}
                  </div>
                </div>
                <div className="w-full border border-slate-200 dark:border-slate-800 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/50 bg-slate-50 dark:bg-slate-950 relative flex flex-col mb-4 transition-all">
                  <textarea ref={textareaRef} value={engine.message} onChange={(e) => { engine.message = e.target.value; engine.notify(); handleTextareaActivity(); }} onBlur={handleTextareaActivity} onClick={handleTextareaActivity} onKeyUp={handleTextareaActivity} placeholder="Olá {{Nome}}, tudo bem? Escreva sua mensagem aqui..." className="w-full p-4 bg-transparent text-slate-800 dark:text-slate-200 text-sm min-h-[250px] outline-none resize-y placeholder-slate-400 dark:placeholder-slate-600" />
                  <div className="flex items-center justify-between px-2 py-2 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 rounded-b-xl">
                    <div className="flex items-center gap-1">
                      <button onClick={() => applyFormatting('*', '*')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"><Bold size={16}/></button>
                      <button onClick={() => applyFormatting('_', '_')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"><Italic size={16}/></button>
                      <button onClick={() => applyFormatting('~', '~')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"><Strikethrough size={16}/></button>
                      <button onClick={() => applyFormatting('\u0060\u0060\u0060', '\u0060\u0060\u0060')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"><Code size={16}/></button>
                      <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                      <button onClick={() => applyFormatting('> ', '')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"><Quote size={16}/></button>
                      <button onClick={() => applyFormatting('- ', '')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"><ListIcon size={16}/></button>
                    </div>
                    <div className="relative emoji-container">
                      <button onClick={() => setIsEmojiOpen(!isEmojiOpen)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition"><Smile size={20} /></button>
                      {isEmojiOpen && (
                        <div className="absolute bottom-full right-0 mb-2 bg-[#f0f2f5] dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-[300px] h-[300px] flex flex-col z-50 animate-in zoom-in-95">
                          <div className="flex justify-around items-center bg-[#f0f2f5] dark:bg-slate-800 p-2 border-b border-slate-300 dark:border-slate-700 rounded-t-xl">
                             <button onClick={() => scrollToCategory('Pessoas')} className="text-lg p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition">😀</button>
                             <button onClick={() => scrollToCategory('Animais')} className="text-lg p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition">🐻</button>
                             <button onClick={() => scrollToCategory('Comida')} className="text-lg p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition">🍔</button>
                             <button onClick={() => scrollToCategory('Atividades')} className="text-lg p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition">⚽️</button>
                          </div>
                          <div id="emoji-scroll-container" className="flex-1 overflow-y-auto custom-scrollbar p-2">
                             {Object.entries(emojiCategories).map(([category, emojis]) => (
                               <div key={category} id={`emoji-cat-${category}`} className="mb-4">
                                 <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 px-1">{category}</div>
                                 <div className="grid grid-cols-7 gap-1">
                                   {emojis.map((emoji, i) => (
                                     <button key={i} onClick={() => insertText(emoji)} className="text-xl hover:bg-slate-200/80 dark:hover:bg-slate-700/80 rounded transition p-1 flex items-center justify-center">{emoji}</button>
                                   ))}
                                 </div>
                               </div>
                             ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={cn("bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all", isBusy && "opacity-60 pointer-events-none")}>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Settings size={18} className="text-amber-500" /> Configurações & Intervalo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-2">Pausa Mínima (seg)</label><input type="number" value={engine.minInterval} onChange={(e) => { engine.minInterval = parseInt(e.target.value) || 0; engine.notify(); }} className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-2">Pausa Máxima (seg)</label><input type="number" value={engine.maxInterval} onChange={(e) => { engine.maxInterval = parseInt(e.target.value) || 0; engine.notify(); }} className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                </div>
              </div>

              <div className={cn("bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all overflow-hidden", isBusy && "opacity-60 pointer-events-none")}>
                <button onClick={() => setIsScheduleOpen(!isScheduleOpen)} className="w-full p-6 font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <span className="flex items-center gap-2"><Calendar size={18} className="text-indigo-500" /> Agendamento & Expediente</span>
                  {isScheduleOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </button>
                {isScheduleOpen && (
                  <div className="px-6 pb-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-6 pt-2">
                      <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Agendar Início (Opcional)</label><input type="datetime-local" value={engine.scheduleStart} onChange={e => { engine.scheduleStart = e.target.value; engine.notify(); }} className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 dark:text-slate-300" /></div>
                      <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Agendar Fim / Parada (Opcional)</label><input type="datetime-local" value={engine.scheduleEnd} onChange={e => { engine.scheduleEnd = e.target.value; engine.notify(); }} className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500 text-slate-600 dark:text-slate-300" /></div>
                    </div>
                    <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 uppercase">Dias Permitidos de Envio da Semana</h4>
                    <div className="space-y-2">
                      {[0,1,2,3,4,5,6].map(day => {
                        const config = engine.workingHours[day as keyof typeof engine.workingHours];
                        return (
                          <div key={day} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center gap-2 w-1/3">
                              <input type="checkbox" checked={config.enabled} onChange={e => { engine.workingHours[day as keyof typeof engine.workingHours].enabled = e.target.checked; engine.notify(); }} className="w-4 h-4 rounded text-indigo-500 cursor-pointer dark:bg-slate-800 dark:border-slate-600" />
                              <span className={cn("text-xs font-bold", config.enabled ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-600 line-through")}>{daysOfWeek[day]}</span>
                            </div>
                            <div className="flex items-center gap-2 w-2/3 justify-end">
                              <input type="time" disabled={!config.enabled} value={config.start} onChange={e => { engine.workingHours[day as keyof typeof engine.workingHours].start = e.target.value; engine.notify(); }} className="p-1 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 outline-none" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase">até</span>
                              <input type="time" disabled={!config.enabled} value={config.end} onChange={e => { engine.workingHours[day as keyof typeof engine.workingHours].end = e.target.value; engine.notify(); }} className="p-1 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 outline-none" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm text-slate-900 dark:text-white transition-all">
                <h3 className="font-bold mb-4 flex items-center justify-between text-slate-800 dark:text-white">
                  <span className="flex items-center gap-2"><Play size={18} className="text-emerald-500 dark:text-emerald-400" /> Monitor de Envio</span>
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{engine.currentIndex} / {total} processados</span>
                </h3>
                {engine.isWaitingSchedule && (
                  <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs p-3 rounded-xl flex items-center justify-center gap-2 font-bold mb-4 animate-in fade-in duration-300">
                    <Clock size={14} className="animate-pulse" /> Fila pausada. Aguardando expediente ou agendamento...
                  </div>
                )}
                {engine.isBatchPausing && (
                  <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs p-3 rounded-xl flex items-center justify-center gap-2 font-bold mb-4 animate-in fade-in duration-300">
                    <Clock size={14} className="animate-pulse" /> Fila pausada. Lote de 80 envios concluído. Pausa (3 a 6 min)...
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1 flex items-center justify-center gap-1"><CheckCircle2 size={12}/> Sucesso</p>
                      <p className="text-xl font-bold">{engine.successCount}</p>
                    </div>
                    <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase mb-1 flex items-center justify-center gap-1"><AlertCircle size={12}/> Falha</p>
                      <p className="text-xl font-bold">{engine.failCount + engine.logs.filter(l => l.status === 'skipped').length}</p>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${successPct}%` }} />
                    <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${failPct}%` }} />
                  </div>
                  {(engine.status === 'idle' || engine.status === 'stopped') && (
                    <div className="space-y-4">
                      <button onClick={startBroadcast} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 mt-2">
                        <Send size={18} /> Iniciar Envio
                      </button>
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">Modo de Disparo (Obrigatório)</label>
                        <div className="grid grid-cols-1 gap-2">
                          <button onClick={() => { engine.sendMode = 'safe'; engine.notify(); }} className={cn("p-3 rounded-xl border text-left transition-all flex items-start gap-3", engine.sendMode === 'safe' ? "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700")}>
                            <ShieldCheck size={20} className="shrink-0 mt-0.5" /><div><span className="font-bold text-sm block">Modo Seguro</span><span className="text-[10px] leading-tight block mt-0.5 opacity-80">Apenas para contatos que você já conversou. Ignora números novos para evitar bloqueios.</span></div>
                          </button>
                          <button onClick={() => { engine.sendMode = 'unsafe'; engine.notify(); }} className={cn("p-3 rounded-xl border text-left transition-all flex items-start gap-3", engine.sendMode === 'unsafe' ? "bg-amber-50 dark:bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700")}>
                            <ShieldAlert size={20} className="shrink-0 mt-0.5" /><div><span className="font-bold text-sm block">Modo Inseguro</span><span className="text-[10px] leading-tight block mt-0.5 opacity-80">Envia para todos os contatos da lista, independente de histórico (Maior risco de banimento).</span></div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {(engine.status === 'sending' || engine.status === 'paused') && (
                    <div className="space-y-4">
                      <div className={cn("p-3 rounded-xl border flex items-start gap-3 opacity-70 pointer-events-none", engine.sendMode === 'safe' ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400")}>
                        {engine.sendMode === 'safe' ? <ShieldCheck size={20} className="shrink-0 mt-0.5" /> : <ShieldAlert size={20} className="shrink-0 mt-0.5" />} 
                        <div><span className="font-bold text-sm block">{engine.sendMode === 'safe' ? 'Modo Seguro Ativo' : 'Modo Inseguro Ativo'}</span><span className="text-[10px] leading-tight block mt-0.5">{engine.sendMode === 'safe' ? 'Ignorando números novos sem histórico de conversa.' : 'Enviando para todos os números da lista importada.'}</span></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {engine.status === 'sending' ? <button onClick={() => engine.pause()} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"><Pause size={18} /> Pausar</button> : <button onClick={() => engine.resume()} className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"><Play size={18} /> Continuar</button>}
                        <button onClick={() => engine.stop()} className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/20"><Square size={18} /> Parar</button>
                      </div>
                    </div>
                  )}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1"><Smartphone size={12} /> Conexões para disparo</label>
                    {loadingConnections ? (
                      <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-400" size={20} /></div>
                    ) : availableConnections.length === 0 ? (
                      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2"><AlertCircle size={14} /> Nenhuma conexão ativa. Conecte um WhatsApp em <strong>Conexões</strong>.</div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {availableConnections.map(conn => (
                          <label key={conn.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                            <input type="checkbox" checked={selectedConnIds.includes(conn.id)} onChange={() => handleConnectionToggle(conn.id)} disabled={engine.status !== 'idle'} className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 border-slate-300 dark:border-slate-600 dark:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed" />
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm"></div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">{conn.name}</span>
                            <span className="text-xs text-green-600 dark:text-green-400 font-mono">Conectado</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedConnIds.length > 0 && engine.status === 'idle' && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 text-center">{selectedConnIds.length} conexão(ões) selecionada(s). O sistema alternará entre elas automaticamente.</p>}
                  </div>
                </div>
              </div>

              <div className={cn("bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all", isBusy && "opacity-60 pointer-events-none")}>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Users size={18} className="text-blue-500" /> Destinatários</h3>
                <Tabs defaultValue="manual" className="w-full" onValueChange={(v) => setImportType(v as any)}>
                  <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                    <TabsTrigger value="manual" className="text-xs font-bold rounded-lg dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-white">Manual</TabsTrigger>
                    <TabsTrigger value="file" className="text-xs font-bold rounded-lg dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-white">Planilha</TabsTrigger>
                  </TabsList>
                  <TabsContent value="manual" className="space-y-4">
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {manualContacts.map((contact, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6"><input placeholder="Número" value={contact.number} onChange={(e) => updateManualContact(idx, 'number', e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 outline-none focus:ring-1 focus:ring-blue-500" /></div>
                          <div className="col-span-5"><input placeholder="Nome" value={contact.name} onChange={(e) => updateManualContact(idx, 'name', e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 outline-none focus:ring-1 focus:ring-blue-500" /></div>
                          <button onClick={() => removeManualRow(idx)} className="col-span-1 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors flex justify-center"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={addManualRow} className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 rounded-xl text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-center gap-2"><Plus size={14} /> Adicionar Linha</button>
                    <button onClick={handleManualImport} className="w-full py-3 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20">Confirmar Lista</button>
                  </TabsContent>
                  <TabsContent value="file">
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10 transition-all"><FileUp size={36} /><span className="text-sm font-bold">Importar .xlsx ou .csv</span><span className="text-[10px] text-slate-400 dark:text-slate-500 text-center max-w-[200px]">A primeira coluna deve conter os números de telefone</span></button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" />
                  </TabsContent>
                </Tabs>
                {total > 0 && (
                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex flex-col gap-3">
                    <div className="flex items-center gap-2"><CheckCircle2 className="text-emerald-500 dark:text-emerald-400" size={20} /><span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{total} contatos carregados</span></div>
                    <button onClick={handleRemoveDuplicates} className="w-full py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"><Eraser size={14}/> Remover Números Duplicados</button>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl overflow-hidden shadow-sm text-slate-900 dark:text-white transition-all">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold flex items-center gap-2 text-sm text-slate-800 dark:text-white"><ListIcon size={16} className="text-emerald-500 dark:text-emerald-400" /> Histórico de Envio</h3>
                  <div className="flex gap-2"><button onClick={exportToExcel} className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-500 dark:hover:bg-emerald-600 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-lg text-slate-600 dark:text-slate-300 hover:text-white dark:hover:text-white transition-all text-[10px] font-bold flex items-center gap-1 shadow-sm"><Download size={12} /> Excel</button><button onClick={exportToPDF} className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-rose-500 dark:hover:bg-rose-600 border border-slate-200 dark:border-slate-700 hover:border-rose-500 rounded-lg text-slate-600 dark:text-slate-300 hover:text-white dark:hover:text-white transition-all text-[10px] font-bold flex items-center gap-1 shadow-sm"><FileText size={12} /> PDF</button></div>
                </div>
                <div className="grid grid-cols-2 p-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider rounded-t-lg"><span>Número de Destino</span><span className="text-right">Status Final</span></div>
                <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-1 space-y-1 bg-white dark:bg-slate-900/50 rounded-b-lg">
                  {engine.logs.map((log, i) => (
                    <div key={i} className="flex flex-col p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                      <div className="grid grid-cols-2 items-center"><span className="text-slate-600 dark:text-slate-300 font-mono tracking-tight">{log.number.split('@')[0]}</span><span className={cn("text-right font-bold text-[10px] uppercase px-2 py-0.5 rounded-full justify-self-end shadow-sm border", log.status === 'success' ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20" : log.status === 'skipped' ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20")}>{log.status === 'success' ? 'Enviado' : log.status === 'skipped' ? 'Ignorado' : 'Falha'}</span></div>
                    </div>
                  ))}
                  {engine.logs.length === 0 && <div className="p-6 text-center text-slate-400 dark:text-slate-600 text-xs italic">Nenhum registro de envio nesta sessão. Inicie os disparos para acompanhar a tabela.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Broadcast;