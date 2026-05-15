import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span className="brand-mark">O</span>
          <div>
            <strong>Gerencial</strong>
            <small>Odonto Vendas</small>
          </div>
        </div>
        <nav>
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/produtos">Produtos</NavLink>
          <NavLink to="/admin/categorias">Categorias</NavLink>
          <NavLink to="/admin/pedidos">Pedidos</NavLink>
          <NavLink to="/admin/orcamentos">Orçamentos</NavLink>
        </nav>
        <button className="btn btn-outline admin-logout" onClick={logout}>Sair</button>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
