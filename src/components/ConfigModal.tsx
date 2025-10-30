import { useState } from 'react';
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Lock, MapPin, Fingerprint, CreditCard } from 'lucide-react';

interface ConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentZone: string;
  onZoneChange: (zone: string) => void;
  enabledDevices: {
    card: boolean;
    fingerprint: boolean;
  };
  onDevicesChange: (devices: { card: boolean; fingerprint: boolean }) => void;
}

const zones = [
  'Laboratorio 1',
  'Laboratorio 2',
  'Laboratorio 3',
  'Sala de Servidores',
  'Oficina Principal',
  'Área de Almacenamiento',
  'Recepción',
];

export function ConfigModal({ 
  open, 
  onOpenChange, 
  currentZone, 
  onZoneChange,
  enabledDevices,
  onDevicesChange 
}: ConfigModalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock authentication - usuario: admin, contraseña: admin123
    if (username === 'admin' && password === 'admin123') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Usuario o contraseña incorrectos');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset authentication state after closing
    setTimeout(() => {
      setIsAuthenticated(false);
      setUsername('');
      setPassword('');
      setError('');
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            {isAuthenticated ? 'Configuración del Sistema' : 'Iniciar Sesión'}
          </DialogTitle>
        </DialogHeader>

        {!isAuthenticated ? (
          // Login Form
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingrese su usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-slate-600">
                <span className="text-blue-700">Usuario:</span> admin<br />
                <span className="text-blue-700">Contraseña:</span> admin123
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                Iniciar Sesión
              </Button>
            </div>
          </form>
        ) : (
          // Configuration Form
          <div className="space-y-6">
            {/* Zone Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Zona Actual
              </Label>
              <Select value={currentZone} onValueChange={onZoneChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione una zona" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Device Selection */}
            <div className="space-y-3">
              <Label>Dispositivos de Escaneo</Label>
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="card-device"
                    checked={enabledDevices.card}
                    onCheckedChange={(checked) =>
                      onDevicesChange({ ...enabledDevices, card: checked as boolean })
                    }
                  />
                  <label
                    htmlFor="card-device"
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span className="text-sm">Lector de Tarjetas</span>
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="fingerprint-device"
                    checked={enabledDevices.fingerprint}
                    onCheckedChange={(checked) =>
                      onDevicesChange({ ...enabledDevices, fingerprint: checked as boolean })
                    }
                  />
                  <label
                    htmlFor="fingerprint-device"
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <Fingerprint className="w-5 h-5 text-purple-600" />
                    <span className="text-sm">Lector de Huellas</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={handleClose} 
                className="flex-1"
              >
                Cerrar
              </Button>
              <Button 
                onClick={handleClose}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Guardar Configuración
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
