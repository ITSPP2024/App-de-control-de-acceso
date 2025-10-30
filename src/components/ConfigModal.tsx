import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Lock, MapPin, Fingerprint, CreditCard } from 'lucide-react';
type Zone = {
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

interface ConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentZone: Zone | null;
  onZoneChange: (zone: Zone) => void;
  enabledDevices: {
    card: boolean;
    fingerprint: boolean;
  };
  onDevicesChange: (devices: { card: boolean; fingerprint: boolean }) => void;
}

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
const [zones, setZones] = useState<Zone[]>([]);

  // 🔹 Cargar zonas dinámicamente desde el backend
  useEffect(() => {
    if (isAuthenticated) {
    fetch('http://localhost:5002/api/zonas')
      .then(res => res.json())
      .then((data: Zone[]) => {
        setZones(data);
        if (!currentZone && data.length > 0) onZoneChange(data[0]); // Default
      })
      .catch(err => console.error('Error al obtener zonas:', err));
  }
  }, [isAuthenticated]);

  // 🔹 Inicio de sesión con conexión a la base de datos
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://localhost:5002/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: username,
          contraseña: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al iniciar sesión');
        return;
      }

      console.log('✅ Admin autenticado:', data);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Resetear estado tras cerrar
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
          // 🔹 Formulario de Login
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
          // 🔹 Formulario de Configuración
          <div className="space-y-6">
            {/* Selección de Zona */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Zona Actual
              </Label>
              <Select 
  value={currentZone?.idzonas.toString() || ''} 
  onValueChange={(id) => {
    const zone = zones.find(z => z.idzonas.toString() === id);
    if (zone) onZoneChange(zone);
  }}
>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Seleccione una zona" />
  </SelectTrigger>
  <SelectContent>
    {zones.map((zone) => (
      <SelectItem key={zone.idzonas} value={zone.idzonas.toString()}>
        {zone.nombre_zona}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
            </div>

            {/* Dispositivos */}
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
                onClick={async () => {
                  try {
                    const usuario_id = 1; // 🔸 Temporal hasta que el login devuelva el ID real
                    const detalle = `Configuró la zona "${currentZone}" con los dispositivos: ${
                      enabledDevices.card ? "Tarjeta" : ""
                    } ${enabledDevices.fingerprint ? "Huellas" : ""}`;

                    await fetch("http://localhost:5002/api/auditoria", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        usuario_id,
                        accion: "CONFIGURAR",
                        entidad: "SISTEMA",
                        entidad_id: null,
                        detalle,
                      }),
                    });

                    console.log("✅ Auditoría registrada");
                    handleClose();
                  } catch (err) {
                    console.error("Error al registrar auditoría:", err);
                  }
                }}
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
