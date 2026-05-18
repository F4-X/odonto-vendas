import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { CartProvider } from './contexts/CartContext.jsx';
import './styles/global2.css';
import './styles/variables.css';
import './styles/base.css';
import './styles/header.css';
import './styles/hero.css';
import './styles/buttons.css';
import './styles/sections.css';
import './styles/products.css';
import './styles/admin.css';
import './styles/responsive.css';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CartProvider>
        <App />
      </CartProvider>
    </BrowserRouter>
  </React.StrictMode>
);
