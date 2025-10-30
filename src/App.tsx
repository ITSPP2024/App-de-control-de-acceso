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

export default function App() {
  const [currentZone, setCurrentZone] = useState('Laboratorio 1');
  const [accessType, setAccessType] = useState<'entrada' | 'salida'>('entrada');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [enabledDevices, setEnabledDevices] = useState({
    card: true,
    fingerprint: true,
  });

  const handleAccessGranted = (method: string) => {
    // Simulate getting a random user from the database
    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    setCurrentUser(randomUser);
    
    // Clear user after 5 seconds
    setTimeout(() => {
      setCurrentUser(null);
    }, 5000);
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
        {/* Header */}
        <div className="flex-shrink-0">
          <AccessControlHeader 
            zone={currentZone} 
            onOpenConfig={() => setConfigOpen(true)}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
          {/* Left Column - Access Type & Scanner Panel */}
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

          {/* Right Column - Welcome Message (Large) */}
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
