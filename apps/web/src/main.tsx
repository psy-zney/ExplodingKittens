import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './RoomChat.css';
import './IllustratedDeck.css';
import './gameTable.css';
import './tableArena.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
