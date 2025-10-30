import { LogIn, LogOut } from 'lucide-react';
import { Card } from './ui/card';
import React from 'react';

interface AccessTypeSelectorProps {
  accessType: 'entrada' | 'salida';
  onTypeChange: (type: 'entrada' | 'salida') => void;
}

export function AccessTypeSelector({ accessType, onTypeChange }: AccessTypeSelectorProps) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm px-[16px] py-[12px]">
      <div className="text-slate-700 text-center m-[0px]">Tipo de Acceso</div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onTypeChange('entrada')}
          className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
            accessType === 'entrada'
              ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <LogIn className="w-5 h-5" />
          <span>Entrada</span>
        </button>
        
        <button
          onClick={() => onTypeChange('salida')}
          className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
            accessType === 'salida'
              ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-md'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <LogOut className="w-5 h-5" />
          <span>Salida</span>
        </button>
      </div>
    </Card>
  );
}
