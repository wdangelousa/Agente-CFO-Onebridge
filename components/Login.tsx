import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Logo } from './Logo';
import { Loader2, Lock, AlertCircle } from 'lucide-react';
export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('Credenciais inválidas. Verifique e tente novamente.');
      setLoading(false);
    } 
    // Se sucesso, o listener no App.tsx redirecionará automaticamente
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header Visual */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="scale-125 mb-6 origin-center">
            {/* Logo variant 'dark' para aparecer no fundo claro */}
            <Logo variant="dark" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1C22] mt-4">Acesso Restrito</h1>
          <p className="text-[#6C757D] text-sm mt-1">Sistema de Gestão Financeira Integrada</p>
        </div>

        {/* Card Clean */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-100">
          <div className="p-8">
             <form onSubmit={handleLogin} className="space-y-5">
               
               {error && (
                 <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2 text-red-600 text-sm">
                   <AlertCircle className="w-4 h-4 flex-shrink-0" />
                   <span>{error}</span>
                 </div>
               )}

               <div>
                 <label className="block text-xs font-bold text-[#6C757D] uppercase mb-1.5 ml-1">Email Corporativo</label>
                 <input 
                   type="email" 
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8F9FA] focus:bg-white focus:border-[#D7FF3E] focus:ring-2 focus:ring-[#D7FF3E]/50 outline-none transition-all text-[#1A1C22] font-medium placeholder-[#6C757D]/50"
                   placeholder="seu.nome@onebridge.llc"
                   required
                 />
               </div>

               <div>
                 <label className="block text-xs font-bold text-[#6C757D] uppercase mb-1.5 ml-1">Senha de Acesso</label>
                 <input 
                   type="password" 
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8F9FA] focus:bg-white focus:border-[#D7FF3E] focus:ring-2 focus:ring-[#D7FF3E]/50 outline-none transition-all text-[#1A1C22] font-medium placeholder-[#6C757D]/50"
                   placeholder="••••••••"
                   required
                 />
               </div>

               <button 
                 type="submit" 
                 disabled={loading}
                 className="w-full py-3.5 bg-[#D7FF3E] hover:bg-[#cbe830] text-[#1A1C22] rounded-xl font-bold shadow-lg shadow-yellow-500/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed border border-transparent"
               >
                 {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-4 h-4" />}
                 {loading ? 'Autenticando...' : 'Acessar Dashboard'}
               </button>
             </form>
          </div>
          <div className="bg-[#F8F9FA] p-4 text-center border-t border-slate-100">
             <p className="text-[10px] text-[#6C757D] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
               <Lock className="w-3 h-3 text-slate-300" /> Secure Connection • 256-bit Encryption
             </p>
          </div>
        </div>
        
        <p className="text-center text-[#6C757D] text-xs mt-8">
          &copy; {new Date().getFullYear()} OneBridge Stalwart LLC. Internal Use Only.
        </p>
      </div>
    </div>
  );
};