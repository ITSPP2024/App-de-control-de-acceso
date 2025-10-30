import { MapPin, Clock, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import React from 'react';

interface AccessControlHeaderProps {
  zone: string;
  onOpenConfig: () => void;
}

export function AccessControlHeader({ zone, onOpenConfig }: AccessControlHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-blue-600" />
          <div>
            <div className="text-slate-500">Zona Actual</div>
            <h1 className="text-slate-900">{zone}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-blue-50 px-6 py-3 rounded-xl border border-blue-100">
            <Clock className="w-6 h-6 text-blue-600" />
            <div className="font-mono text-slate-900" style={{ fontSize: '2rem', lineHeight: '1' }}>
              {currentTime.toLocaleTimeString('es-ES')}
            </div>
          </div>

          <Button
            onClick={onOpenConfig}
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-xl border-slate-200 hover:bg-slate-100 hover:border-slate-300"
          >
            <Settings className="w-5 h-5 text-slate-600" />
          </Button>
        </div>
      </div>
    </div>
  );
}
