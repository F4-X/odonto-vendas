import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';

export default function Navbar() {
  const { summary } = useCart();
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand-mark">O</span>
          <span>
            <strong>Odontek Store</strong>
            <small>Produtos odontológicos</small>
          </span>
        </Link>

        <div className="mobile-actions">
          <NavLink to="/carrinho" className="mobile-cart" onClick={closeMenu}>
            🛒 {summary.totalItems}
          </NavLink>

          <button
            className="menu-toggle"
            onClick={() => setOpen((current) => !current)}
            aria-label="Abrir menu"
          >
            {open ? '×' : '☰'}
          </button>
        </div>

        <nav className={`nav-links ${open ? 'open' : ''}`}>
          <NavLink to="/" onClick={closeMenu}>Início</NavLink>
          <NavLink to="/produtos" onClick={closeMenu}>Produtos</NavLink>
          <NavLink to="/contato" onClick={closeMenu}>Contato</NavLink>
          <NavLink to="/carrinho" className="cart-link" onClick={closeMenu}>
            Carrinho ({summary.totalItems})
          </NavLink>
          <NavLink to="/admin/login" className="admin-link" onClick={closeMenu}>
            Área gerencial
          </NavLink>
        </nav>
      </div>
    </header>
  );
}