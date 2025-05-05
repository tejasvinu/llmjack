'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

// Use dynamic import with SSR disabled for the game component
// This is necessary because our game uses browser-only features like Math.random()
const BlackjackGame = dynamic(() => import('./BlackjackGame'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="animate-pulse text-2xl text-white">Shuffling cards...</div>
    </div>
  ),
});

export default function GameContainer() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[url('/felt-background.jpg')] bg-cover bg-center font-[family-name:var(--font-geist-sans)]">
      <main className="container max-w-5xl mx-auto">
        <BlackjackGame />
      </main>
      
      <motion.footer 
        className="mt-12 text-sm text-center text-gray-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p>© {new Date().getFullYear()} Black-LLM-Jack - A React & Next.js Multiplayer Blackjack Game</p>
      </motion.footer>
    </div>
  );
}
