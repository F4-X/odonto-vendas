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

function limitQuantity(product, quantity) {
  const wanted = Math.max(1, Number(quantity || 1));
  if (product.tipo_venda === 'orcamento') return Math.min(99, wanted);
  const available = Number(product.estoque_disponivel ?? product.estoque ?? 0);
  return Math.max(1, Math.min(wanted, Math.max(1, available)));
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(getInitialCart);

  useEffect(() => {
    localStorage.setItem('odontoCart', JSON.stringify(items));
  }, [items]);

  function addItem(product, quantity = 1) {
    if (product.tipo_venda !== 'orcamento') {
      const available = Number(product.estoque_disponivel ?? product.estoque ?? 0);
      if (available <= 0) return;
    }

    setItems((current) => {
      const exists = current.find((item) => item.id === product.id);
      if (exists) {
        return current.map((item) => item.id === product.id
          ? { ...item, ...product, quantity: limitQuantity(product, item.quantity + quantity) }
          : item
        );
      }
      return [...current, { ...product, quantity: limitQuantity(product, quantity) }];
    });
  }

  function removeItem(id) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function updateQuantity(id, quantity) {
    setItems((current) => current.map((item) => item.id === id
      ? { ...item, quantity: limitQuantity(item, quantity) }
      : item
    ));
  }

  function clearCart() {
    setItems([]);
  }

  const summary = useMemo(() => {
    const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
    const fixedItemsList = items.filter((item) => item.tipo_venda === 'preco_fixo');
    const quoteItemsList = items.filter((item) => item.tipo_venda === 'orcamento');
    const total = fixedItemsList.reduce((acc, item) => acc + Number(item.preco || 0) * item.quantity, 0);

    return {
      totalItems,
      fixedItems: fixedItemsList.length,
      quoteItems: quoteItemsList.length,
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
  if (!context) throw new Error('useCart precisa ser usado dentro de CartProvider.');
  return context;
}
