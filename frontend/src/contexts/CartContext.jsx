import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);

function getInitialCart() {
  try {
    const saved = localStorage.getItem('odontoCart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(getInitialCart);

  useEffect(() => {
    localStorage.setItem('odontoCart', JSON.stringify(items));
  }, [items]);

  function addItem(product, quantity = 1) {
    setItems((current) => {
      const exists = current.find((item) => item.id === product.id);
      if (exists) {
        return current.map((item) => item.id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
        );
      }

      return [...current, { ...product, quantity }];
    });
  }

  function removeItem(id) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function updateQuantity(id, quantity) {
    setItems((current) => current.map((item) => item.id === id
      ? { ...item, quantity: Math.max(1, Number(quantity || 1)) }
      : item
    ));
  }

  function clearCart() {
    setItems([]);
  }

  const summary = useMemo(() => {
    const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
    const fixedItems = items.filter((item) => item.tipo_venda === 'preco_fixo');
    const quoteItems = items.filter((item) => item.tipo_venda === 'orcamento');
    const total = fixedItems.reduce((acc, item) => acc + Number(item.preco || 0) * item.quantity, 0);

    return {
      totalItems,
      fixedItems: fixedItems.length,
      quoteItems: quoteItems.length,
      total
    };
  }, [items]);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, summary }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart precisa ser usado dentro de CartProvider.');
  }
  return context;
}
