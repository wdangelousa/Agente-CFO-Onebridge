import React from 'react';

interface Props {
  variant?: 'light' | 'dark'; 
}

export const Logo: React.FC<Props> = ({ variant = 'dark' }) => {
  const isDarkBg = variant === 'light';
  
  // Cores Institucionais - Nova Paleta
  const primaryFill = isDarkBg ? '#D7FF3E' : '#1A1C22'; // Destaque ou Dark
  const accentFill = '#D7FF3E'; // Destaque (Verde Neon)
  const textColor = isDarkBg ? 'text-[#F8F9FA]' : 'text-[#1A1C22]';
  const subTextColor = '#6C757D'; // Texto Secundário

  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
           {/* Nova Logo OneBridge Stalwart - Geometria Ascendente (Clean) */}
           
           {/* Barra 1 (Esquerda) - Verde - Base de Crescimento */}
           <path d="M12 62 L32 52 L32 92 L12 92 Z" fill={accentFill} />
           
           {/* Barra 2 (Meio) - Escura - Estrutura Central */}
           <path d="M40 42 L60 32 L60 92 L40 92 Z" fill={isDarkBg ? '#F8F9FA' : primaryFill} />

           {/* Barra 3 (Direita) - Escura - Pilar Mais Alto (Stalwart) */}
           <path d="M68 22 L88 12 L88 92 L68 92 Z" fill={isDarkBg ? '#F8F9FA' : primaryFill} />
        </svg>
      </div>
      
      <div className="flex flex-col justify-center">
        <span className={`text-xl font-bold tracking-tight leading-none font-[Inter] ${textColor}`}>
          ONEBRIDGE
        </span>
        <span className={`text-[10px] font-bold tracking-[0.2em] leading-none mt-1 uppercase`} style={{ color: subTextColor }}>
          Stalwart
        </span>
      </div>
    </div>
  );
};