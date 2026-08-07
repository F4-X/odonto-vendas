import { useState } from 'react';
import { api } from '../../services/api.js';

export default function AccountAdmin() {
  const [form, setForm] = useState({ senha_atual: '', nova_senha: '', confirmar: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    if (form.nova_senha !== form.confirmar) return setError('A confirmação da nova senha não confere.');
    if (form.nova_senha.length < 10) return setError('Use pelo menos 10 caracteres na nova senha.');

    setLoading(true);
    try {
      const { data } = await api.put('/admin/minha-senha', {
        senha_atual: form.senha_atual,
        nova_senha: form.nova_senha
      });
      setMessage(data.message);
      setForm({ senha_atual: '', nova_senha: '', confirmar: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Não foi possível alterar a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-header"><div><span>Segurança</span><h1>Minha conta</h1></div></div>
      <form className="admin-card form-stack account-form" onSubmit={submit}>
        <h2>Alterar senha</h2>
        <p>Troque a senha administrativa após publicar esta versão.</p>
        <input type="password" required placeholder="Senha atual" value={form.senha_atual} onChange={(e) => setForm({ ...form, senha_atual: e.target.value })} />
        <input type="password" required placeholder="Nova senha" value={form.nova_senha} onChange={(e) => setForm({ ...form, nova_senha: e.target.value })} />
        <input type="password" required placeholder="Confirmar nova senha" value={form.confirmar} onChange={(e) => setForm({ ...form, confirmar: e.target.value })} />
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success-alert">{message}</div>}
        <button className="btn" disabled={loading}>{loading ? 'Salvando...' : 'Alterar senha'}</button>
      </form>
    </div>
  );
}
