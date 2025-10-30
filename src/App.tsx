import React, { useState } from 'react';
import { AccessControlHeader } from './components/AccessControlHeader';
import { ScannerPanel } from './components/ScannerPanel';
import { AccessTypeSelector } from './components/AccessTypeSelector';
import { WelcomeMessage } from './components/WelcomeMessage';
import { ConfigModal } from './components/ConfigModal';
import { Toaster } from './components/ui/sonner';

// Mock user database
const mockUsers = [
  'Juan Pérez',
  'María González',
  'Carlos Rodríguez',
  'Ana Martínez',
  'Luis Torres',
  'Sofia Ramírez',
];

export type Zone = {
  idzonas: number;
  nombre_zona: string;
  nivel_seguridad_zona: string;
  capacidad_maxima_zona: number;
  horario_inicio_zona: string;
  horario_fin_zona: string;
  descripcion_zona: string;
  estado_zona: string;
  requiresEscort: number;
};

export default function App() {
  const [currentZone, setCurrentZone] = useState<Zone | null>(null);
  const [accessType, setAccessType] = useState<'entrada' | 'salida'>('entrada');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [enabledDevices, setEnabledDevices] = useState({
    card: true,
    fingerprint: true,
  });

  const handleAccessGranted = (method: string) => {
    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    setCurrentUser(randomUser);
    setTimeout(() => setCurrentUser(null), 5000);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 overflow-hidden">
      <Toaster />
      <ConfigModal 
        open={configOpen}
        onOpenChange={setConfigOpen}
        currentZone={currentZone}
        onZoneChange={setCurrentZone}
        enabledDevices={enabledDevices}
        onDevicesChange={setEnabledDevices}
      />
      
      <div className="h-full flex flex-col p-6 gap-6">
        <div className="flex-shrink-0">
          <AccessControlHeader 
            zone={currentZone?.nombre_zona || ''}
            zoneDescription={currentZone?.descripcion_zona || ''}
            accessLevel={currentZone?.nivel_seguridad_zona || '1'}
            onOpenConfig={() => setConfigOpen(true)}
          />
        </div>

        <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
          <div className="flex flex-col gap-6 min-h-0">
            <div className="flex-shrink-0">
              <AccessTypeSelector 
                accessType={accessType} 
                onTypeChange={setAccessType} 
              />
            </div>
            <div className="flex-1 min-h-0">
              <ScannerPanel 
                onAccessGranted={handleAccessGranted}
                enabledDevices={enabledDevices}
              />
            </div>
          </div>

          <div className="col-span-2 min-h-0">
            <WelcomeMessage 
              userName={currentUser} 
              accessType={accessType} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
