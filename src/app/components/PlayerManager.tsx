import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameActionType, GamePhase, PlayerType, AIModel } from '../types/blackjack'; // Import AIModel
import { getProviderForModel, AIProvider } from '../services/aiService'; // Import helper and enum

interface PlayerManagerProps {
  players: Array<{ 
    id: string, 
    name: string, 
    bet: number,
    playerType?: PlayerType,
    aiModel?: AIModel, // Add aiModel
    isActive?: boolean,
  }>;
  dispatch: React.Dispatch<any>;
  currentPlayerIndex: number;
  gamePhase: GamePhase;
}

const PlayerManager: React.FC<PlayerManagerProps> = ({ 
  players, 
  dispatch, 
  currentPlayerIndex,
  gamePhase
}) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>(AIModel.GEMINI_2_5_FLASH); // Corrected enum member
  
  // Can only modify players during betting phase
  const canModifyPlayers = gamePhase === GamePhase.BETTING;

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      dispatch({ 
        type: GameActionType.ADD_PLAYER, 
        payload: { name: newPlayerName.trim() } 
      });
      setNewPlayerName('');
      setIsAdding(false);
    }
  };

  const handleAddAIPlayer = (model: AIModel) => { // Use model parameter
    dispatch({
      type: GameActionType.ADD_AI_PLAYER,
      payload: { model } // Pass selected model
    });
    setIsAddingAI(false);
  };

  const handleRemovePlayer = (id: string) => {
    dispatch({ 
      type: GameActionType.REMOVE_PLAYER, 
      payload: { id } 
    });
  };

  const togglePlayerType = (id: string, currentType?: PlayerType) => {
    const newType = currentType === PlayerType.AI ? PlayerType.HUMAN : PlayerType.AI;
    dispatch({
      type: GameActionType.TOGGLE_PLAYER_TYPE,
      payload: { 
        playerId: id, 
        playerType: newType,
        model: newType === PlayerType.AI ? selectedModel : undefined // Pass model only if switching to AI
      }
    });
  };

  return (
    <motion.div 
      className="w-full max-w-md mx-auto mb-6 p-4 bg-gray-800/60 rounded-lg"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-xl font-bold mb-4 text-center">Players</h2>
      
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        <AnimatePresence>
          {players.map((player, index) => (
            <motion.div 
              key={player.id}
              className={`px-3 py-1 rounded-lg flex items-center gap-2 ${
                index === currentPlayerIndex && gamePhase === GamePhase.PLAYER_TURNS
                  ? 'bg-green-700 ring-2 ring-yellow-400' 
                  : player.bet > 0 && gamePhase === GamePhase.BETTING
                    ? 'bg-blue-800' // Highlight players who bet
                    : 'bg-gray-700'
              }`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <span>{player.name}</span>
              {player.playerType === PlayerType.AI && (
                <span className="text-xs bg-purple-600 rounded-full px-1.5 py-0.5 ml-1" title={`Model: ${player.aiModel || 'Default'}`}>
                  AI
                </span>
              )}
              {player.bet > 0 && gamePhase === GamePhase.BETTING && (
                <span className="text-xs bg-yellow-600 rounded-full px-1.5 py-0.5">
                  Bet: ${player.bet}
                </span>
              )}
              {canModifyPlayers && (
                <div className="flex gap-1">
                  {/* Toggle AI/Human button */}
                  <button
                    onClick={() => togglePlayerType(player.id, player.playerType)}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500 rounded px-1"
                    title={player.playerType === PlayerType.AI ? "Convert to Human" : "Convert to AI"}
                  >
                    {player.playerType === PlayerType.AI ? "👤" : "🤖"}
                  </button>
                  
                  {/* Remove player button */}
                  {players.length > 1 && (
                    <button 
                      onClick={() => handleRemovePlayer(player.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      <AnimatePresence>
        {canModifyPlayers && (
          isAdding ? (
            // ... (Add Human Player UI - unchanged) ...
            <motion.div 
              className="flex gap-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Player name"
                className="flex-1 px-3 py-2 rounded-l-lg bg-gray-700 text-white border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                maxLength={10} // Limit name length
              />
              <button
                onClick={handleAddPlayer}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-r-lg"
                disabled={!newPlayerName.trim()}
              >
                Add
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Cancel
              </button>
            </motion.div>
          ) : isAddingAI ? (
            <motion.div
              className="flex flex-col gap-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label htmlFor="ai-model-select" className="text-sm text-white mb-1">Select AI Model:</label>
              <select 
                id="ai-model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as AIModel)}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
              >
                {Object.entries(AIModel).map(([key, modelValue]) => {
                  const provider = getProviderForModel(modelValue as AIModel);
                  const providerName = provider === AIProvider.Google ? 'Google' : 'Groq';
                  // Create a more descriptive name, e.g., "Llama3 8B (Groq)" or "Gemini 1.5 Flash (Google)"
                  const displayName = `${key.replace(/_/g, ' ').replace(/LLAMA3/i, 'Llama3').replace(/GEMINI/i, 'Gemini')} (${providerName})`;
                  return (
                    <option key={modelValue} value={modelValue}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddAIPlayer(selectedModel)} // Pass selected model
                  className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  Add AI Player
                </button>
                <button
                  onClick={() => setIsAddingAI(false)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          ) : players.length < 4 && (
            <motion.div
              className="flex gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                onClick={() => setIsAdding(true)}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add Human Player
              </button>
              <button
                onClick={() => setIsAddingAI(true)}
                className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Add AI Player
              </button>
            </motion.div>
          )
        )}
      </AnimatePresence>
      
      {gamePhase !== GamePhase.BETTING && (
        <motion.div 
          className="text-sm text-center mt-2 text-gray-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {gamePhase === GamePhase.PLAYER_TURNS && 
            `Current turn: ${players[currentPlayerIndex]?.name || 'Player'}`}
        </motion.div>
      )}
    </motion.div>
  );
};

export default PlayerManager;