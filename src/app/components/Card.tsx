'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card as CardType, Suit } from '../types/blackjack';

interface CardProps {
  card: CardType;
  index?: number;
}

const Card: React.FC<CardProps> = ({ card, index = 0 }) => {
  
  const cardVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8, 
      rotateY: card.faceUp ? 0 : 180, // Start rotated if face down
    },
    visible: (i: number) => ({ // Accept index for delay
      opacity: 1, 
      scale: 1, 
      rotateY: card.faceUp ? 0 : 180, // End rotated if face down
      transition: { 
        delay: i * 0.1, // Use custom index prop
        duration: 0.4, // Slightly longer duration for flip
        ease: "easeOut"
      }
    }),
    hover: {
      scale: 1.05,
      boxShadow: "0px 10px 20px rgba(0,0,0,0.2)"
    }
  };

  const getSuitColor = (suit: Suit) => {
    return suit === Suit.Hearts || suit === Suit.Diamonds
      ? 'text-red-600 dark:text-red-500'
      : 'text-black dark:text-white';
  };

  const getSuitSymbol = (suit: Suit) => {
    switch (suit) {
      case Suit.Hearts:
        return '♥';
      case Suit.Diamonds:
        return '♦';
      case Suit.Clubs:
        return '♣';
      case Suit.Spades:
        return '♠';
      default:
        return '';
    }
  };

  return (
    <motion.div
      className="relative w-24 h-36 rounded-lg shadow-lg perspective"
      variants={cardVariants}
      initial="hidden"
      animate="visible" // Animate to visible state
      exit="hidden" // Animate out
      custom={index} // Pass index to variants
      whileHover="hover"
      layout // Enable layout animations
      style={{ transformStyle: "preserve-3d" }} // Ensure 3D transform works
    >
      {/* Front Face */}
      <motion.div 
        className="absolute w-full h-full rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex flex-col p-2 font-[family-name:var(--font-geist-mono)] backface-hidden"
        style={{ rotateY: 0 }} // Front is always at 0 degrees
      >
        <div className={`flex justify-between ${getSuitColor(card.suit)}`}>
          <div>{card.value}</div>
          <div>{getSuitSymbol(card.suit)}</div>
        </div>
        <div className={`flex-grow flex items-center justify-center text-4xl ${getSuitColor(card.suit)}`}>
          {getSuitSymbol(card.suit)}
        </div>
        <div className={`flex justify-between ${getSuitColor(card.suit)} transform rotate-180`}>
          <div>{card.value}</div>
          <div>{getSuitSymbol(card.suit)}</div>
        </div>
      </motion.div>

      {/* Back Face */}
      <motion.div 
        className="absolute w-full h-full rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-white/10 flex items-center justify-center backface-hidden"
        style={{ rotateY: 180 }} // Back is always at 180 degrees
      >
        <div className="transform -rotate-12">
          <div className="w-12 h-12 bg-white/20 rounded-full" />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Card;
