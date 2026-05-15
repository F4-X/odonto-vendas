import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, senha });

      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminUser', JSON.stringify(data.usuario));

      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-brand">
          <div className="admin-brand-icon">O</div>

          <span>Painel gerencial</span>

          <h1>Odontek Store</h1>

          <p>
            Acesse o painel administrativo para gerenciar produtos,
            categorias, pedidos e orçamentos.
          </p>
        </div>

        <div className="admin-login-form">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          {error && <div className="alert error">{error}</div>}

          <button className="btn admin-login-button" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar no painel'}
          </button>
        </div>
      </form>
    </div>
  );
}