'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameActionType, GamePhase } from '../types/blackjack';

interface ControlsProps {
  dispatch: React.Dispatch<any>;
  isGameOver: boolean;
  isPlayerTurn: boolean;
  currentPlayerId?: string;
  playerChips?: number;
  gamePhase: GamePhase;
  allPlayersHaveBet: boolean;
  isCurrentPlayerAI?: boolean; // Add this prop
}

const Controls: React.FC<ControlsProps> = ({ 
  dispatch, 
  isGameOver, 
  isPlayerTurn, 
  currentPlayerId,
  playerChips = 0,
  gamePhase,
  allPlayersHaveBet,
  isCurrentPlayerAI = false
}) => {
  const buttonVariants = {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    disabled: { opacity: 0.5 }
  };

  return (
    <motion.div 
      className="flex flex-col gap-3 mt-6 items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Betting Phase - Show Deal button when all players have bet */}
      {gamePhase === GamePhase.BETTING && (
        <motion.div className="flex flex-col gap-3 items-center">
          {allPlayersHaveBet ? (
            <motion.button
              onClick={() => dispatch({ type: GameActionType.DEAL })}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg"
              variants={buttonVariants}
              initial="initial"
              animate="animate"
              whileHover="whileHover"
              whileTap="whileTap"
            >
              Deal Cards
            </motion.button>
          ) : (
            <motion.div
              className="px-8 py-3 bg-gray-600 text-white font-bold rounded-lg shadow-lg opacity-70"
              variants={buttonVariants}
              initial="initial"
              animate="animate"
            >
              Waiting for all bets...
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Game Over Phase - Show New Round button */}
      {gamePhase === GamePhase.GAME_OVER && (
        <motion.div className="flex flex-col gap-3 items-center">
          <motion.button
            onClick={() => dispatch({ type: GameActionType.START_BETTING_PHASE })}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg"
            variants={buttonVariants}
            initial="initial"
            animate="animate"
            whileHover="whileHover"
            whileTap="whileTap"
          >
            Start New Round
          </motion.button>
          
          <motion.div className="text-sm text-gray-300">
            Place bets for the next round
          </motion.div>
        </motion.div>
      )}

      {/* Player Turns Phase - Show Hit/Stand buttons or AI thinking message */}
      {gamePhase === GamePhase.PLAYER_TURNS && (
        isCurrentPlayerAI ? (
          <motion.div
            className="px-8 py-3 bg-purple-600 text-white font-bold rounded-lg shadow-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            AI is thinking...
          </motion.div>
        ) : (
          <div className="flex gap-3">
            <motion.button
              onClick={() => dispatch({ type: GameActionType.HIT })}
              disabled={!isPlayerTurn}
              className={`px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-colors ${
                !isPlayerTurn ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              variants={buttonVariants}
              initial="initial"
              animate={isPlayerTurn ? "animate" : "disabled"}
              whileHover={isPlayerTurn ? "whileHover" : ""}
              whileTap={isPlayerTurn ? "whileTap" : ""}
            >
              Hit
            </motion.button>
            <motion.button
              onClick={() => dispatch({ type: GameActionType.STAND })}
              disabled={!isPlayerTurn}
              className={`px-8 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg shadow-lg transition-colors ${
                !isPlayerTurn ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              variants={buttonVariants}
              initial="initial"
              animate={isPlayerTurn ? "animate" : "disabled"}
              whileHover={isPlayerTurn ? "whileHover" : ""}
              whileTap={isPlayerTurn ? "whileTap" : ""}
            >
              Stand
            </motion.button>
          </div>
        )
      )}
      
      {/* Dealer Turn Phase - Show waiting message */}
      {gamePhase === GamePhase.DEALER_TURN && (
        <motion.div
          className="px-8 py-3 bg-orange-600 text-white font-bold rounded-lg shadow-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Dealer is playing...
        </motion.div>
      )}

      {/* Always show Reset Game button */}
      <motion.button
        onClick={() => dispatch({ type: GameActionType.RESET })}
        className="mt-6 px-4 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg shadow-md"
        variants={buttonVariants}
        initial="initial"
        animate="animate"
        whileHover="whileHover"
        whileTap="whileTap"
      >
        Reset Game
      </motion.button>
    </motion.div>
  );
};

export default Controls;
