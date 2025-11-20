import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Lock, MapPin, Fingerprint, CreditCard, Cpu } from 'lucide-react';

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

type Device = {
  idDispositivo: number;
  nombre_dispositivo: string;
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
  onDevicesChange,
}: ConfigModalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');

  // 🔹 Cargar zonas y dispositivos al iniciar sesión
  useEffect(() => {
    if (isAuthenticated) {
      fetch('http://localhost:5002/api/zonas')
        .then((res) => res.json())
        .then((data: Zone[]) => {
          setZones(data);
          if (!currentZone && data.length > 0) onZoneChange(data[0]);
        })
        .catch((err) => console.error('Error al obtener zonas:', err));

      fetch('http://localhost:5002/api/dispositivos')
        .then((res) => res.json())
        .then((data: Device[]) => setDevices(data))
        .catch((err) => console.error('Error al obtener dispositivos:', err));
    }
  }, [isAuthenticated]);

  // 🔹 Inicio de sesión
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

      setIsAuthenticated(true);
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setIsAuthenticated(false);
      setUsername('');
      setPassword('');
      setError('');
      setSelectedDevice('');
    }, 300);
  };

  // 🔹 Guardar configuración y vincular dispositivo con zona
 const handleSave = async () => {
  if (!currentZone) {
    alert('Seleccione una zona');
    return;
  }

  const device = devices.find(
    (d) => d.idDispositivo.toString() === selectedDevice
  );

  if (!device) {
    alert('Seleccione un dispositivo válido');
    return;
  }

  try {
    // Valores que enviamos al servidor. Ajusta lock_key / wifi_lock si tu UI los provee.
    const payload = {
      Idzona_dispositivo: currentZone.idzonas,
      idDispositivo: device.idDispositivo,
      nombre_dispositivo: device.nombre_dispositivo,
      tipo_dispositivo: "Biométrico TTLock",
      nombre_zona_dispositivo: currentZone.nombre_zona,
      ubicacion: currentZone.nombre_zona, // o "Entrada Principal" si quieres otro texto
      Estado: "Activo",
      lock_key: "",   // default vacío; si tienes el lock_key en UI, reemplázalo
      wifi_lock: 0    // 1 si el dispositivo es wifi/Gateway, 0 si no
    };

    const response = await fetch('http://localhost:5002/api/dispositivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error al vincular dispositivo:', data);
      alert('❌ Error al vincular dispositivo: ' + (data.error || JSON.stringify(data)));
      return;
    }

    console.log('✅', data.message);
    alert('✅ Configuración guardada y dispositivo vinculado correctamente');
    handleClose();
  } catch (err) {
    console.error('Error de conexión:', err);
    alert('❌ Error al guardar la configuración');
  }
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
          // 🔹 Login
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Input
                type="text"
                placeholder="Ingrese su usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                Iniciar Sesión
              </Button>
            </div>
          </form>
        ) : (
          // 🔹 Configuración
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
                  const zone = zones.find((z) => z.idzonas.toString() === id);
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

            {/* Selección de Dispositivo */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-green-600" />
                Dispositivo Vinculado
              </Label>
              <Select
                value={selectedDevice}
                onValueChange={(id) => setSelectedDevice(id)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione un dispositivo" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.idDispositivo} value={device.idDispositivo.toString()}>
                      {device.nombre_dispositivo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dispositivos de Escaneo */}
            <div className="space-y-3">
              <Label>Dispositivos de Escaneo</Label>
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={enabledDevices.card}
                    onCheckedChange={(checked) =>
                      onDevicesChange({ ...enabledDevices, card: checked as boolean })
                    }
                  />
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span className="text-sm">Lector de Tarjetas</span>
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={enabledDevices.fingerprint}
                    onCheckedChange={(checked) =>
                      onDevicesChange({ ...enabledDevices, fingerprint: checked as boolean })
                    }
                  />
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <Fingerprint className="w-5 h-5 text-purple-600" />
                    <span className="text-sm">Lector de Huellas</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cerrar
              </Button>
              <Button
                onClick={handleSave}
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
