import { MapPin, Clock, Settings,Shield, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import React from 'react';

interface AccessControlHeaderProps {
  zone: string;
  zoneDescription: string;
  accessLevel: string;
  onOpenConfig: () => void;
}

export function AccessControlHeader({ zone, zoneDescription, accessLevel, onOpenConfig }: AccessControlHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case '1':
        return 'bg-green-50 border-green-200 text-green-700';
      case '2':
        return 'bg-green-50 border-green-200 text-green-700';
      case '3':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case '4':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      case '5':
        return 'bg-red-50 border-red-200 text-red-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-6">
        {/* Left Section - Zone Info */}
        <div className="flex items-start gap-3 flex-1">
          <MapPin className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-slate-500 text-sm">Zona Actual</div>
            <h1 className="text-slate-900 mb-1">{zone}</h1>
            
            {/* Zone Description */}
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-600 line-clamp-2">{zoneDescription}</p>
            </div>
          </div>
        </div>

        {/* Center Section - Access Level Badge */}
        <div className="flex-shrink-0">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${getLevelColor(accessLevel)}`}>
            <Shield className="w-5 h-5" />
            <div>
              <div className="text-xs opacity-80">Nivel de Acceso</div>
              <div className="font-medium">{accessLevel}</div>
            </div>
          </div>
        </div>

        {/* Right Section - Clock & Settings */}
        <div className="flex items-center gap-4 flex-shrink-0">
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
