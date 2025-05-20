'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card as CardType, GamePhase, GameActionType } from '../types/blackjack';
import Card from './Card';

interface HandProps {
  hand: CardType[];
  score: number;
  label: string;
  isGameOver?: boolean;
  chips?: number;
  bet?: number;
  isActive?: boolean;
  resultMessage?: string;
  playerId?: string;
  gamePhase?: GamePhase;
  dispatch?: React.Dispatch<any>;
}

const Hand: React.FC<HandProps> = ({ 
  hand, 
  score, 
  label, 
  isGameOver = false, 
  chips = 0, 
  bet = 0, 
  isActive = false,
  resultMessage,
  playerId,
  gamePhase,
  dispatch
}) => {
  const [betAmount, setBetAmount] = useState(Math.min(10, chips));
  const isDealer = label.toLowerCase().includes('dealer');
  const canPlaceBet = gamePhase === GamePhase.BETTING && !isDealer && playerId;
  const betOptions = [5, 10, 25, 50, 100, 250, 500];

  // Reset bet amount when entering betting phase or when chips change
  useEffect(() => {
    if (gamePhase === GamePhase.BETTING) {
      setBetAmount(prev => Math.min(prev, chips));
    }
  }, [gamePhase, chips]);
  
  const handlePlaceBet = () => {
    if (playerId && betAmount > 0 && betAmount <= chips) {
      dispatch?.({ 
        type: GameActionType.PLACE_BET, 
        payload: { playerId, amount: betAmount } 
      });
    }
  };

  const buttonVariants = {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 }
  };

  return (
    <motion.div 
      className={`flex flex-col items-center gap-4 p-4 rounded-lg shadow-xl transition-all duration-300 ease-in-out ${
        isActive 
          ? 'bg-green-800/50 ring-4 ring-yellow-400 scale-105 shadow-yellow-500/30' 
          : 'bg-gray-800/30' // Default background for non-active players
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col items-center min-h-[60px]">
        <h2 className={`text-2xl font-bold ${isActive ? 'text-yellow-300' : 'text-white'}`}>{label}</h2>
        {isActive && !isDealer && (
          <motion.div 
            className="text-xs font-semibold text-yellow-200 -mt-2 mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {label.includes("AI") ? "AI's Turn" : "Your Turn"}
          </motion.div>
        )}
        <div className="flex flex-wrap gap-2 items-center justify-center">
          {hand.length > 0 && (
            <motion.div 
              className={`text-lg ${isActive ? 'font-semibold text-yellow-100' : 'text-gray-200'}`}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              key={`${label}-score-${score}`} // Ensures re-render on score change for animation
            >
              Score: {isDealer ? (isGameOver || hand.every(c => c.faceUp) ? score : '?') : score} 
            </motion.div>
          )}
          
          {!isDealer && (
            <div className={`text-sm px-2 py-1 rounded-full whitespace-nowrap ${isActive ? 'bg-yellow-700 text-white' : 'bg-blue-900 text-gray-300'}`}>
              Chips: ${chips}
            </div>
          )}
          
          {bet > 0 && (
            <motion.div 
              className="text-sm bg-amber-700 px-2 py-1 rounded-full whitespace-nowrap"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              Bet: ${bet}
            </motion.div>
          )}
        </div>
        
        {/* Result message */}
        <AnimatePresence>
          {resultMessage && (
            <motion.div
              className="mt-2 text-sm font-semibold rounded-md px-3 py-1 text-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                backgroundColor: resultMessage.includes('Won') ? 'rgba(22, 163, 74, 0.7)' : 
                              resultMessage.includes('Lost') ? 'rgba(220, 38, 38, 0.7)' : 
                              'rgba(59, 130, 246, 0.7)'
              }}
            >
              {resultMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Betting Controls - Only show for players during betting phase */}
      {canPlaceBet && bet === 0 && (
        <motion.div 
          className="w-full flex flex-col gap-2 items-center mt-2 p-3 bg-slate-800/40 rounded-lg border border-yellow-600/50"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <div className="flex flex-wrap gap-1 justify-center">
            {betOptions.filter(amount => amount <= chips).map(amount => (
              <motion.button
                key={amount}
                onClick={() => setBetAmount(amount)}
                className={`px-2 py-1 rounded-md text-xs font-bold ${
                  betAmount === amount 
                    ? 'bg-yellow-600 text-white ring-1 ring-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}
                variants={buttonVariants}
                initial="initial"
                animate="animate"
                whileHover="whileHover"
                whileTap="whileTap"
              >
                ${amount}
              </motion.button>
            ))}
          </div>
          
          {/* Custom bet input */}
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className="text-xs font-bold">Custom:</div>
            <input 
              type="number" 
              min={1} 
              max={chips}
              value={betAmount}
              onChange={(e) => setBetAmount(Math.min(chips, Math.max(1, parseInt(e.target.value) || 0)))}
              className="bg-gray-700 text-white px-2 py-0.5 rounded-md w-16 text-center text-xs"
            />
          </div>
          
          <motion.button
            onClick={handlePlaceBet}
            className="mt-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg shadow-lg text-sm"
            variants={buttonVariants}
            initial="initial"
            animate="animate"
            whileHover="whileHover"
            whileTap="whileTap"
            disabled={betAmount <= 0 || betAmount > chips}
          >
            Place Bet
          </motion.button>
        </motion.div>
      )}
      
      {/* Already Bet Message */}
      {canPlaceBet && bet > 0 && (
        <motion.div 
          className="mt-1 px-3 py-1 bg-green-800/40 text-white text-sm rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Bet placed! Waiting for other players...
        </motion.div>
      )}
      
      {/* Card Display Area */}
      <motion.div 
        className="flex justify-center items-center min-h-[150px] mt-2"
        layout
      >
        <div className="relative flex h-36">
          {hand.map((card, index) => (
            <motion.div
              key={card.id || `${card.suit}-${card.value}-${index}`}
              className="absolute"
              style={{
                left: `${index * (hand.length > 5 ? 25 : 35)}px`, 
                zIndex: index,
              }}
              layout
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card card={{ ...card, faceUp: isDealer && !isGameOver && index === 1 ? false : card.faceUp }} index={index} />
            </motion.div>
          ))}
          {hand.length === 0 && gamePhase !== GamePhase.BETTING && (
             <div className="w-24 h-36 rounded-lg border-2 border-dashed border-green-700/50 flex items-center justify-center text-green-700/50">
               No Cards
             </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Hand;
