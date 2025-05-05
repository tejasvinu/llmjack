'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GameMessageProps {
  message: string;
  isSuccess?: boolean;
  isError?: boolean;
}

const GameMessage: React.FC<GameMessageProps> = ({ 
  message, 
  isSuccess = false, 
  isError = false 
}) => {
  const getMessageColor = () => {
    if (isSuccess) return 'text-green-500 dark:text-green-400';
    if (isError) return 'text-red-500 dark:text-red-400';
    return 'text-white';
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={message}
        className={`text-xl font-semibold mb-4 text-center p-2 rounded-lg ${getMessageColor()}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        {message}
      </motion.div>
    </AnimatePresence>
  );
};

export default GameMessage;
