import { Card } from './ui/card';
import { motion, AnimatePresence } from "framer-motion";
import { User } from 'lucide-react';
import React from 'react';

interface WelcomeMessageProps {
  userName: string | null;
  accessType: 'entrada' | 'salida';
}

export function WelcomeMessage({ userName, accessType }: WelcomeMessageProps) {
  const message = accessType === 'entrada' ? '¡Bienvenido!' : '¡Hasta pronto!';
  const bgColor = accessType === 'entrada' ? 'bg-green-50' : 'bg-orange-50';
  const borderColor = accessType === 'entrada' ? 'border-green-200' : 'border-orange-200';
  const textColor = accessType === 'entrada' ? 'text-green-700' : 'text-orange-700';

  return (
    <Card className={`h-full ${bgColor} backdrop-blur-sm ${borderColor} border-2 shadow-sm transition-all duration-300 flex items-center justify-center`}>
      <AnimatePresence mode="wait">
        {userName ? (
          <motion.div
            key={userName}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className={`inline-flex items-center justify-center w-24 h-24 ${bgColor} ${borderColor} border-2 rounded-full mb-6`}
            >
              <User className={`w-12 h-12 ${textColor}`} />
            </motion.div>
            
            <h2 className={`${textColor} mb-3`}>{message}</h2>
            <div className="text-slate-900">{userName}</div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-slate-400"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 bg-slate-100 border-2 border-slate-200 rounded-full mb-6">
              <User className="w-12 h-12 text-slate-400" />
            </div>
            <div className="text-slate-500">En espera de escaneo...</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
