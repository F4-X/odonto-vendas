import { useEffect, useMemo, useState } from 'react';
import { api, assetUrl, formatCurrency } from '../../services/api.js';

const emptyForm = {
  nome: '',
  descricao: '',
  marca: '',
  modelo: '',
  categoria_id: '',
  preco: '',
  tipo_venda: 'preco_fixo',
  estoque: 0,
  destaque: false,
  ativo: true,
  imagem: null
};

export default function ProductsAdmin() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  function load() {
    Promise.all([
      api.get('/admin/produtos'),
      api.get('/admin/categorias')
    ]).then(([prodRes, catRes]) => {
      setProdutos(prodRes.data);
      setCategorias(catRes.data.filter((cat) => cat.ativo));
    }).catch(console.error);
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!filter) return produtos;
    return produtos.filter((p) => p.nome.toLowerCase().includes(filter.toLowerCase()));
  }, [produtos, filter]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function reset() {
    setEditing(null);
    setForm(emptyForm);
  }

  function edit(produto) {
    setEditing(produto);
    setForm({
      nome: produto.nome || '',
      descricao: produto.descricao || '',
      marca: produto.marca || '',
      modelo: produto.modelo || '',
      categoria_id: produto.categoria_id || '',
      preco: produto.preco || '',
      tipo_venda: produto.tipo_venda || 'preco_fixo',
      estoque: produto.estoque || 0,
      destaque: Boolean(produto.destaque),
      ativo: Boolean(produto.ativo),
      imagem: null
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === 'imagem') {
        if (value) payload.append(key, value);
      } else {
        payload.append(key, value);
      }
    });

    try {
      if (editing) {
        await api.put(`/admin/produtos/${editing.id}`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/admin/produtos', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      reset();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar produto.');
    }
  }

  async function deactivate(id) {
    await api.delete(`/admin/produtos/${id}`);
    load();
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <span>Cadastro</span>
          <h1>Produtos</h1>
        </div>
      </div>

      <div className="admin-card product-form-card">
        <h2>{editing ? 'Editar produto' : 'Novo produto'}</h2>
        <form className="product-form" onSubmit={submit}>
          <input required placeholder="Nome do produto" value={form.nome} onChange={(e) => update('nome', e.target.value)} />
          <select required value={form.categoria_id} onChange={(e) => update('categoria_id', e.target.value)}>
            <option value="">Selecione a categoria</option>
            {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
          </select>
          <input placeholder="Marca" value={form.marca} onChange={(e) => update('marca', e.target.value)} />
          <input placeholder="Modelo" value={form.modelo} onChange={(e) => update('modelo', e.target.value)} />
          <select value={form.tipo_venda} onChange={(e) => update('tipo_venda', e.target.value)}>
            <option value="preco_fixo">Preço fixo</option>
            <option value="orcamento">Sob orçamento</option>
          </select>
          <input placeholder="Preço" disabled={form.tipo_venda === 'orcamento'} value={form.preco} onChange={(e) => update('preco', e.target.value)} />
          <input type="number" placeholder="Estoque" value={form.estoque} onChange={(e) => update('estoque', e.target.value)} />
          <input type="file" accept="image/*" onChange={(e) => update('imagem', e.target.files[0])} />
          <textarea className="full" placeholder="Descrição" value={form.descricao} onChange={(e) => update('descricao', e.target.value)} />
          <label className="check"><input type="checkbox" checked={form.destaque} onChange={(e) => update('destaque', e.target.checked)} /> Destaque</label>
          <label className="check"><input type="checkbox" checked={form.ativo} onChange={(e) => update('ativo', e.target.checked)} /> Ativo</label>
          <div className="form-actions full">
            {error && <div className="alert error">{error}</div>}
            <button className="btn" type="submit">{editing ? 'Salvar alterações' : 'Cadastrar produto'}</button>
            {editing && <button className="btn btn-ghost" type="button" onClick={reset}>Cancelar edição</button>}
          </div>
        </form>
      </div>

      <div className="admin-card">
        <div className="table-head">
          <h2>Produtos cadastrados</h2>
          <input placeholder="Buscar produto" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Imagem</th><th>Produto</th><th>Categoria</th><th>Tipo</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((produto) => {
                const image = assetUrl(produto.imagem);
                return (
                  <tr key={produto.id}>
                    <td>{image ? <img className="table-img" src={image} alt={produto.nome} /> : <span className="table-placeholder">-</span>}</td>
                    <td><strong>{produto.nome}</strong><br /><small>{produto.marca}</small></td>
                    <td>{produto.categoria_nome}</td>
                    <td>{produto.tipo_venda === 'orcamento' ? 'Orçamento' : 'Preço fixo'}</td>
                    <td>{produto.tipo_venda === 'orcamento' ? '-' : formatCurrency(produto.preco)}</td>
                    <td>{produto.estoque}</td>
                    <td>{produto.ativo ? 'Ativo' : 'Inativo'}</td>
                    <td className="actions-cell">
                      <button className="btn btn-small" onClick={() => edit(produto)}>Editar</button>
                      <button className="btn btn-small btn-ghost" onClick={() => deactivate(produto.id)}>Desativar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
