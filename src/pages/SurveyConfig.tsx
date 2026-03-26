"use client";

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Save, Star, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const SurveyConfig = () => {
  const [config, setConfig] = useState({
    title: '',
    message: '',
    options: [
      { value: 1, label: '' },
      { value: 2, label: '' },
      { value: 3, label: '' },
      { value: 4, label: '' },
      { value: 5, label: '' }
    ]
  });

  // Carrega configuração atual
  useEffect(() => {
    fetch('http://localhost:3001/api/survey/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error(err));
  }, []);

  const handleSave = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/survey/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        toast.success('Configuração salva com sucesso!');
      } else {
        toast.error('Erro ao salvar');
      }
    } catch (err) {
      toast.error('Erro de conexão');
    }
  };

  const updateOption = (index: number, label: string) => {
    const newOptions = [...config.options];
    newOptions[index].label = label;
    setConfig({ ...config, options: newOptions });
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Configurar Pesquisa</h1>
            <p className="text-slate-500">Personalize a mensagem de satisfação enviada ao cliente.</p>
          </div>
          <button
            onClick={handleSave}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm"
          >
            <Save size={20} /> Salvar
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Título</label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Ex: 🔍 Pesquisa de Satisfação"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Mensagem</label>
            <textarea
              value={config.message}
              onChange={(e) => setConfig({ ...config, message: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Ex: O atendimento foi encerrado. Por favor, avalie..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-4">Opções (estrelas)</label>
            <div className="space-y-3">
              {config.options.map((opt, idx) => (
                <div key={opt.value} className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 font-bold">
                    {opt.value} <Star size={14} className="ml-1 fill-amber-500" />
                  </div>
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder={`Ex: ${opt.value} ★ - Ruim`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-amber-800 mb-2">Prévia da mensagem</h3>
            <div className="bg-white p-4 rounded-lg border border-amber-100">
              <p className="font-bold text-slate-800">{config.title || "🔍 Pesquisa de Satisfação"}</p>
              <p className="text-slate-600 mt-2">{config.message || "O atendimento foi encerrado..."}</p>
              <div className="mt-3 space-y-1 text-sm">
                {config.options.map(opt => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <Star size={14} className="text-amber-500 fill-amber-500" />
                    <span>{opt.label || `Opção ${opt.value}`}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 italic mt-3">_Responda apenas com o número correspondente._</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SurveyConfig;