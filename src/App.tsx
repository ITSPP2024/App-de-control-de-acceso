import React, { useState, useEffect } from 'react';
import { AccessControlHeader } from './components/AccessControlHeader';
import { ScannerPanel } from './components/ScannerPanel';
import { AccessTypeSelector } from './components/AccessTypeSelector';
import { WelcomeMessage } from './components/WelcomeMessage';
import { ConfigModal } from './components/ConfigModal';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

const mockUsers = [
  'Juan Pérez',
  'María González',
  'Carlos Rodríguez',
  'Ana Martínez',
  'Luis Torres',
  'Sofía Ramírez',
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

  // ------------------------
  // Conexión WebSocket
  // ------------------------
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:5002/bridge");

    socket.onopen = () => console.log("🟢 Conectado a WebSocket del servidor");

    socket.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);

        // Esperamos el evento automático desde TTLock
        if (data.event === "access_attempt") {
          const userName = data.user?.nombre || "Desconocido";
          setCurrentUser(userName);

          // Animaciones y toast según estado
          if (data.estado === "Autorizado") {
            toast.success('Acceso Concedido', {
              description: `Usuario: ${userName}`,
            });
          } else {
            toast.error('Acceso Denegado', {
              description: data.motivo || "No autorizado",
            });
          }

          // Limpiar usuario después de 5s
          setTimeout(() => setCurrentUser(null), 5000);
        }

      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };

    return () => socket.close();
  }, []);

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

        {/* Header */}
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

            {/* Entrada / salida */}
            <div className="flex-shrink-0">
              <AccessTypeSelector 
                accessType={accessType} 
                onTypeChange={setAccessType} 
              />
            </div>

            {/* Panel visual — ya no simula accesos */}
            <div className="flex-1 min-h-0">
              <ScannerPanel 
                onAccessGranted={() => {}} 
                enabledDevices={enabledDevices}
              />
            </div>
          </div>

          {/* Mensaje de Bienvenida */}
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
