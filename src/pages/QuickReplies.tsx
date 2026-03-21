"use client";

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Plus, Search, MessageSquare, Trash2, Edit2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const STORAGE_KEY = 'zapflow_quick_replies';

// ============================================================================
// HOOK DE TEMA AUTOMÁTICO (Baseado no sistema/dispositivo)
// ============================================================================
const useDarkTheme = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    
    // Função para aplicar o tema verificando a preferência do sistema
    const applyTheme = (matchesDark: boolean) => {
      if (matchesDark) {
        root.classList.add("dark");
        // Garantia extra: força a cor de fundo no body caso o AppLayout não preencha tudo
        document.body.style.backgroundColor = "#0b141a";
      } else {
        root.classList.remove("dark");
        document.body.style.backgroundColor = "#ffffff";
      }
    };

    // Mídia query para detectar o tema do sistema
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    
    // Aplica o tema imediatamente ao carregar
    applyTheme(media.matches);

    // Adiciona o listener para reagir a mudanças em tempo real no dispositivo
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
    media.addEventListener("change", handler);
    
    // Limpa o listener ao desmontar o componente
    return () => {
      media.removeEventListener("change", handler);
      document.body.style.backgroundColor = ""; // Limpeza do estilo
    };
  }, []);
};

const QuickReplies = () => {
  // Inicializa o tema automático
  useDarkTheme();

  const [replies, setReplies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentReply, setCurrentReply] = useState({ id: '', shortcut: '', message: '' });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setReplies(JSON.parse(saved));
  }, []);

  const saveReplies = (newReplies: any[]) => {
    setReplies(newReplies);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newReplies));
  };

  const handleSave = () => {
    if (!currentReply.shortcut || !currentReply.message) return toast.error("Preencha todos os campos.");
    
    if (currentReply.id) {
      saveReplies(replies.map(r => r.id === currentReply.id ? currentReply : r));
      toast.success("Resposta atualizada!");
    } else {
      const reply = { ...currentReply, id: Date.now().toString() };
      saveReplies([...replies, reply]);
      toast.success("Resposta criada!");
    }
    
    setIsModalOpen(false);
    setCurrentReply({ id: '', shortcut: '', message: '' });
  };

  const handleDelete = (id: string) => {
    saveReplies(replies.filter(r => r.id !== id));
    toast.success("Resposta removida.");
  };

  const filteredReplies = replies.filter(r => 
    r.shortcut.toLowerCase().includes(search.toLowerCase()) || 
    r.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      {/* Wrapper principal adicionado com classes de cor de fundo e altura total (min-h-screen e w-full) */}
      <div className="min-h-screen w-full bg-white dark:bg-[#0b141a] transition-colors duration-300">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 transition-colors">
                <Zap className="text-amber-500" fill="currentColor" />
                Respostas Rápidas
              </h1>
              <p className="text-slate-500 dark:text-slate-400 transition-colors">Crie atalhos para agilizar o atendimento da sua equipe.</p>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <button onClick={() => setCurrentReply({ id: '', shortcut: '', message: '' })} className="bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm">
                  <Plus size={20} />
                  Nova Resposta
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl dark:bg-[#111b21] dark:border-slate-800 dark:text-white transition-colors">
                <DialogHeader>
                  <DialogTitle className="dark:text-white">{currentReply.id ? 'Editar Resposta' : 'Nova Resposta Rápida'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="shortcut" className="dark:text-slate-300">Atalho (ex: /ola)</Label>
                    <Input 
                      id="shortcut" 
                      value={currentReply.shortcut} 
                      onChange={(e) => setCurrentReply({...currentReply, shortcut: e.target.value})} 
                      placeholder="/boasvindas" 
                      className="dark:bg-[#202c33] dark:border-slate-700 dark:text-white dark:placeholder-slate-500"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="message" className="dark:text-slate-300">Mensagem Completa</Label>
                    <Textarea 
                      id="message" 
                      value={currentReply.message} 
                      onChange={(e) => setCurrentReply({...currentReply, message: e.target.value})} 
                      placeholder="Olá! Seja bem-vindo ao ConversaUp..." 
                      className="min-h-[120px] dark:bg-[#202c33] dark:border-slate-700 dark:text-white dark:placeholder-slate-500" 
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors">Cancelar</Button>
                  <Button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-white">Salvar Resposta</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mb-6 relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Buscar atalhos ou mensagens..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReplies.map((reply) => (
              <div key={reply.id} className="bg-white dark:bg-[#202c33] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-500/50 transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <span className="px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold border border-amber-100 dark:border-amber-500/20 transition-colors">
                    {reply.shortcut}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setCurrentReply(reply); setIsModalOpen(true); }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(reply.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed transition-colors">
                  {reply.message}
                </p>
              </div>
            ))}
            
            {filteredReplies.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400 dark:text-slate-500 transition-colors">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-20 dark:opacity-40" />
                <p>Nenhuma resposta rápida encontrada.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default QuickReplies;