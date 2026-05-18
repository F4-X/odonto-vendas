import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { CartProvider } from './contexts/CartContext.jsx';
import './styles/global.css';
import './variables.css';
import './base.css';
import './header.css';
import './hero.css';
import './buttons.css';
import './sections.css';
import './products.css';
import './admin.css';
import './responsive.css';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>
  </React.StrictMode>
);
