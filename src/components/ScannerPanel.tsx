import { useState } from 'react';
import { CreditCard, Fingerprint, CheckCircle, XCircle } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner@2.0.3';

interface ScannerPanelProps {
  onAccessGranted: (method: string) => void;
}

type ScanStatus = 'idle' | 'scanning' | 'success' | 'denied';

export function ScannerPanel({ onAccessGranted }: ScannerPanelProps) {
  const [cardStatus, setCardStatus] = useState<ScanStatus>('idle');
  const [fingerprintStatus, setFingerprintStatus] = useState<ScanStatus>('idle');

  const handleCardScan = () => {
    setCardStatus('scanning');
    
    setTimeout(() => {
      const isGranted = Math.random() > 0.2; // 80% success rate
      setCardStatus(isGranted ? 'success' : 'denied');
      
      if (isGranted) {
        toast.success('Acceso Concedido', {
          description: 'Tarjeta verificada correctamente'
        });
        onAccessGranted('Tarjeta');
      } else {
        toast.error('Acceso Denegado', {
          description: 'Tarjeta no autorizada'
        });
      }
      
      setTimeout(() => setCardStatus('idle'), 3000);
    }, 2000);
  };

  const handleFingerprintScan = () => {
    setFingerprintStatus('scanning');
    
    setTimeout(() => {
      const isGranted = Math.random() > 0.2; // 80% success rate
      setFingerprintStatus(isGranted ? 'success' : 'denied');
      
      if (isGranted) {
        toast.success('Acceso Concedido', {
          description: 'Huella verificada correctamente'
        });
        onAccessGranted('Huella');
      } else {
        toast.error('Acceso Denegado', {
          description: 'Huella no reconocida'
        });
      }
      
      setTimeout(() => setFingerprintStatus('idle'), 3000);
    }, 2000);
  };

  return (
    <Card className="h-full bg-white/80 backdrop-blur-sm border-slate-200 p-6 shadow-sm">      
      <div className="flex flex-col gap-6 h-full">
        {/* Card Scanner */}
        <ScannerOption
          icon={CreditCard}
          title="Escanear Tarjeta"
          description="Acerque su tarjeta"
          status={cardStatus}
          onScan={handleCardScan}
          color="blue"
        />

        {/* Fingerprint Scanner */}
        <ScannerOption
          icon={Fingerprint}
          title="Escanear Huella"
          description="Coloque su dedo"
          status={fingerprintStatus}
          onScan={handleFingerprintScan}
          color="purple"
        />
      </div>
    </Card>
  );
}

interface ScannerOptionProps {
  icon: any;
  title: string;
  description: string;
  status: ScanStatus;
  onScan: () => void;
  color: 'blue' | 'purple';
}

function ScannerOption({ icon: Icon, title, description, status, onScan, color }: ScannerOptionProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-600',
      glow: 'shadow-blue-200/50',
      btnBg: 'bg-blue-600 hover:bg-blue-700',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-600',
      glow: 'shadow-purple-200/50',
      btnBg: 'bg-purple-600 hover:bg-purple-700',
    }
  };

  const colors = colorClasses[color];
  const isDisabled = status === 'scanning';

  return (
    <div className="flex items-center gap-4 border-2 border-slate-200 rounded-xl bg-gradient-to-br from-white to-slate-50 px-[16px] py-[12px]">
      <div className={`relative ${colors.bg} ${colors.border} border-2 rounded-xl p-4 transition-all duration-300 ${
        status === 'scanning' ? `${colors.glow} shadow-xl` : 'shadow-md'
      }`}>
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Icon className={`w-12 h-12 ${colors.text}`} />
            </motion.div>
          )}
          
          {status === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Icon className={`w-12 h-12 ${colors.text}`} />
              </motion.div>
            </motion.div>
          )}
          
          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <CheckCircle className="w-12 h-12 text-green-600" />
            </motion.div>
          )}
          
          {status === 'denied' && (
            <motion.div
              key="denied"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <XCircle className="w-12 h-12 text-red-600" />
            </motion.div>
          )}
        </AnimatePresence>

        {status === 'scanning' && (
          <motion.div
            className={`absolute inset-0 rounded-xl border-2 ${colors.border}`}
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>

      <div className="flex-1">
        <div className="text-slate-900 mb-1 text-[16px]">{title}</div>
        <p className="text-slate-500 mb-2 text-[16px]">{description}</p>
        
        <AnimatePresence mode="wait">
          {status === 'scanning' && (
            <motion.p
              key="scanning-text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`${colors.text}`}
            >
              Escaneando...
            </motion.p>
          )}
          {status === 'success' && (
            <motion.p
              key="success-text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-green-600"
            >
              Acceso Concedido
            </motion.p>
          )}
          {status === 'denied' && (
            <motion.p
              key="denied-text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-red-600"
            >
              Acceso Denegado
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <Button
        onClick={onScan}
        disabled={isDisabled}
        className={`${colors.btnBg} text-white transition-all shadow-md px-6`}
      >
        {status === 'scanning' ? 'Escaneando...' : 'Escanear'}
      </Button>
    </div>
  );
}
