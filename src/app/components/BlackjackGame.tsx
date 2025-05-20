'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameReducer } from '../hooks/useGameReducer';
import Hand from './Hand';
import Controls from './Controls';
import PlayerManager from './PlayerManager';
import GameMessage from './GameMessage';
import { GameActionType, GamePhase } from '../types/blackjack';

const BlackjackGame: React.FC = () => {
  const { state, dispatch } = useGameReducer();
  
  const currentPlayer = state.players[state.currentPlayerIndex];
  const allPlayersHaveBet = state.players.every(p => p.bet > 0);
  
  // Phase indicator text
  const getPhaseText = () => {
    switch(state.gamePhase) {
      case GamePhase.BETTING: return 'Betting Phase';
      case GamePhase.PLAYER_TURNS: return 'Player Turns';
      case GamePhase.DEALER_TURN: return 'Dealer Turn';
      case GamePhase.GAME_OVER: return 'Round Complete';
      default: return '';
    }
  };
  
  return (
    <motion.div 
      className="flex flex-col items-center gap-8 w-full max-w-5xl mx-auto p-6 bg-gradient-to-br from-green-900/50 to-green-950/80 rounded-xl shadow-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h1 
        className="text-4xl font-bold text-yellow-300 drop-shadow-glow"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500 }}
      >
        Black-LLM-Jack
      </motion.h1>
      
      {/* Game Phase Indicator */}
      <motion.div 
        className="py-1 px-4 rounded-full bg-blue-900/70 text-white text-sm font-bold"
        animate={{ 
          backgroundColor: state.gamePhase === GamePhase.BETTING 
            ? 'rgba(30, 64, 175, 0.7)' 
            : state.gamePhase === GamePhase.PLAYER_TURNS 
              ? 'rgba(22, 163, 74, 0.7)' 
              : state.gamePhase === GamePhase.DEALER_TURN 
                ? 'rgba(194, 65, 12, 0.7)' 
                : 'rgba(124, 58, 237, 0.7)'
        }}
      >
        {getPhaseText()}
      </motion.div>
      
      <PlayerManager 
        players={state.players}
        dispatch={dispatch}
        currentPlayerIndex={state.currentPlayerIndex}
        gamePhase={state.gamePhase}
        aiIsThinking={state.aiIsThinking} // Pass down aiIsThinking state
      />
      
      <div className="w-full flex flex-col gap-10">
        <motion.div 
          className="p-4 rounded-lg bg-green-800/30"
          layout
        >
          <Hand 
            hand={state.dealer.hand} 
            score={state.dealer.score} 
            label="Dealer's Hand" 
            isActive={state.gamePhase === GamePhase.DEALER_TURN}
            isGameOver={state.gamePhase === GamePhase.GAME_OVER}
            gamePhase={state.gamePhase}
          />
        </motion.div>
        
        <div className="text-center">
          <GameMessage 
            message={state.message}
            isSuccess={state.message.includes('win') || state.message.includes('Won')}
            isError={state.message.includes('lose') || state.message.includes('Lost') || state.message.includes('busted')}
          />
            <Controls 
            dispatch={dispatch}
            isGameOver={state.gamePhase === GamePhase.GAME_OVER}
            isPlayerTurn={state.isPlayerTurn && state.gamePhase === GamePhase.PLAYER_TURNS}
            currentPlayerId={currentPlayer?.id}
            playerChips={currentPlayer?.chips || 0}
            gamePhase={state.gamePhase}
            allPlayersHaveBet={allPlayersHaveBet}
            isCurrentPlayerAI={currentPlayer?.playerType === 'ai'}
          />
        </div>
        
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          layout
        >
          <AnimatePresence>
            {state.players.map((player, index) => (
              <motion.div 
                key={player.id}
                className="p-4 rounded-lg bg-green-800/30"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <Hand 
                  hand={player.hand} 
                  score={player.score} 
                  label={`${player.name}'s Hand`}
                  chips={player.chips}
                  bet={player.bet}
                  isActive={player.isActive}
                  resultMessage={player.resultMessage}
                  playerId={player.id}
                  gamePhase={state.gamePhase}
                  dispatch={dispatch}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
      
      <motion.div 
        className="mt-4 text-sm text-center text-gray-300"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p>Blackjack pays 3:2 • Dealer stands on 17 • Each player starts with $1000</p>
      </motion.div>
    </motion.div>
  );
};

export default BlackjackGame;
