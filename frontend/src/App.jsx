import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import FloatingWhatsApp from './components/FloatingWhatsApp.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import Home from './pages/Home.jsx';
import Products from './pages/Products.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import Cart from './pages/Cart.jsx';
import CheckoutSuccess from './pages/CheckoutSuccess.jsx';
import Contact from './pages/Contact.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import CategoriesAdmin from './pages/admin/CategoriesAdmin.jsx';
import ProductsAdmin from './pages/admin/ProductsAdmin.jsx';
import PedidosAdmin from './pages/admin/PedidosAdmin.jsx';
import OrcamentosAdmin from './pages/admin/OrcamentosAdmin.jsx';

function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
       <FloatingWhatsApp />
      <main>{children}</main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
      <Route path="/produtos" element={<PublicLayout><Products /></PublicLayout>} />
      <Route path="/produtos/:id" element={<PublicLayout><ProductDetails /></PublicLayout>} />
      <Route path="/carrinho" element={<PublicLayout><Cart /></PublicLayout>} />
      <Route path="/pedido-finalizado" element={<PublicLayout><CheckoutSuccess /></PublicLayout>} />
      <Route path="/contato" element={<PublicLayout><Contact /></PublicLayout>} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="categorias" element={<CategoriesAdmin />} />
        <Route path="produtos" element={<ProductsAdmin />} />
        <Route path="pedidos" element={<PedidosAdmin />} />
        <Route path="orcamentos" element={<OrcamentosAdmin />} />
      </Route>

      <Route path="*" element={<PublicLayout><div className="container page"><h1>Página não encontrada</h1></div></PublicLayout>} />
    </Routes>
  );
}
