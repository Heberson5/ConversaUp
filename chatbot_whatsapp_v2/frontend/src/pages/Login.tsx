"use client";

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Sun, 
  Moon, 
  Monitor,
  ArrowRight,
  Loader2,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ==========================================================================
// FUNÇÃO DE CRIPTOGRAFIA (Sincronizada com o sistema)
// ==========================================================================
const encryptPassword = async (password: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "ZAPFLOW_SECURE_SALT_2026_X9#!");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('conversaup_theme') as any) || 'system';
    }
    return 'system';
  });

  // Gestão de Tema
  useEffect(() => {
    const root = window.document.documentElement;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const appliedTheme = theme === 'system' ? systemTheme : theme;

    root.classList.remove('light', 'dark');
    root.classList.add(appliedTheme);
    localStorage.setItem('conversaup_theme', theme);
  }, [theme]);

  // Verifica se já está logado para evitar que a tela de login apareça desnecessariamente
  useEffect(() => {
    const session = localStorage.getItem('conversaup_session');
    if (session === 'active') {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      return toast.error("Por favor, preencha todos os campos.");
    }

    setIsLoading(true);

    try {
      const hashedPassword = await encryptPassword(password);
      
      // Credenciais Master do Heberson
      if (email === 'hebersohas@gmail.com' && password === 'Guga430512') {
        
        // Grava a sessão e os dados de exibição
        localStorage.setItem('conversaup_session', 'active');
        localStorage.setItem('user_display_name', 'Heberson Sauberlich');
        localStorage.setItem('user_role', 'Administrador Master');

        toast.success("Bem-vindo ao ConversaUp, Heberson!");
        
        // Redirecionamento via router para evitar recarga de página desnecessária
        setTimeout(() => {
          navigate('/dashboard');
        }, 800);
      } else {
        toast.error("E-mail ou senha incorretos.");
      }
    } catch (error) {
      toast.error("Erro ao processar login seguro.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-500 bg-slate-50 dark:bg-[#0f172a]">
      
      {/* Seletor de Tema */}
      <div className="fixed top-6 right-6 flex bg-white dark:bg-slate-800 p-1 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50">
        <button onClick={() => setTheme('light')} className={`p-2 rounded-xl transition-all ${theme === 'light' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`} title="Tema Claro"><Sun size={18} /></button>
        <button onClick={() => setTheme('dark')} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`} title="Tema Escuro"><Moon size={18} /></button>
        <button onClick={() => setTheme('system')} className={`p-2 rounded-xl transition-all ${theme === 'system' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`} title="Automático (Sistema)"><Monitor size={18} /></button>
      </div>

      <div className="w-full max-w-[440px] animate-in fade-in zoom-in-95 duration-700">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-3xl shadow-2xl shadow-emerald-500/40 flex items-center justify-center text-white mb-4 rotate-3 hover:rotate-0 transition-transform duration-500 cursor-pointer">
            <Zap size={32} fill="currentColor" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">ConversaUp</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 text-center px-4">Plataforma de gestão e atendimento inteligente.</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700/50">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bem-vindo de volta!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Insira suas credenciais da Sauberlich Technology.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 dark:text-white"
                  placeholder="exemplo@sauberlich.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Senha de Acesso</label>
                <button type="button" className="text-xs font-bold text-emerald-600 hover:text-emerald-500 transition-colors">Esqueceu a senha?</button>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-12 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 dark:text-white"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-4 group"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <>Acessar ConversaUp <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-center gap-2">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Acesso Criptografado pela Sauberlich</span>
          </div>
        </div>

        <p className="text-center mt-8 text-xs text-slate-400 dark:text-slate-600 font-medium">
          &copy; 2026 Sauberlich Technology. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;