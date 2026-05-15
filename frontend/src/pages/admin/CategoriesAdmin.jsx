import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';

export default function CategoriesAdmin() {
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState({ nome: '', descricao: '' });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.get('/admin/categorias').then((res) => setCategorias(res.data)).catch(console.error);
  }

  useEffect(load, []);

  function edit(categoria) {
    setEditing(categoria);
    setForm({ nome: categoria.nome, descricao: categoria.descricao || '' });
  }

  function reset() {
    setEditing(null);
    setForm({ nome: '', descricao: '' });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.put(`/admin/categorias/${editing.id}`, { ...form, ativo: editing.ativo });
      } else {
        await api.post('/admin/categorias', form);
      }
      reset();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar categoria.');
    }
  }

  async function deactivate(id) {
    await api.delete(`/admin/categorias/${id}`);
    load();
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <span>Cadastro</span>
          <h1>Categorias</h1>
        </div>
      </div>

      <div className="admin-grid two">
        <form className="admin-card form-stack" onSubmit={submit}>
          <h2>{editing ? 'Editar categoria' : 'Nova categoria'}</h2>
          <input required placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <textarea placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          {error && <div className="alert error">{error}</div>}
          <button className="btn" type="submit">{editing ? 'Salvar alterações' : 'Cadastrar'}</button>
          {editing && <button className="btn btn-ghost" type="button" onClick={reset}>Cancelar edição</button>}
        </form>

        <div className="admin-card">
          <h2>Lista de categorias</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nome</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {categorias.map((categoria) => (
                  <tr key={categoria.id}>
                    <td>{categoria.nome}</td>
                    <td>{categoria.ativo ? 'Ativa' : 'Inativa'}</td>
                    <td className="actions-cell">
                      <button className="btn btn-small" onClick={() => edit(categoria)}>Editar</button>
                      <button className="btn btn-small btn-ghost" onClick={() => deactivate(categoria.id)}>Desativar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
