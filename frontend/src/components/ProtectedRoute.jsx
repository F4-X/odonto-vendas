import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../services/api.js';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('adminToken');
  const [state, setState] = useState(token ? 'checking' : 'denied');

  useEffect(() => {
    if (!token) return;
    api.get('/auth/me')
      .then(() => setState('allowed'))
      .catch(() => setState('denied'));
  }, [token]);

  if (state === 'checking') {
    return <div className="admin-loading-screen">Validando sessão...</div>;
  }
  if (state === 'denied') return <Navigate to="/admin/login" replace />;
  return children;
}
