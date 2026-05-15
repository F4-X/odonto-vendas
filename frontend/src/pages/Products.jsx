import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard.jsx';
import { api } from '../services/api.js';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState('');
  const [tipoVenda, setTipoVenda] = useState('');

  const categoriaSelecionada = searchParams.get('categoria') || '';

  useEffect(() => {
    api.get('/categorias')
      .then((res) => setCategorias(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();

    if (categoriaSelecionada) {
      params.set('categoria_id', categoriaSelecionada);
    }

    if (tipoVenda) {
      params.set('tipo_venda', tipoVenda);
    }

    if (busca) {
      params.set('busca', busca);
    }

    api.get(`/produtos?${params.toString()}`)
      .then((res) => setProdutos(res.data))
      .catch(console.error);
  }, [categoriaSelecionada, tipoVenda, busca]);

  const tituloCategoria = useMemo(() => {
    if (!categoriaSelecionada) return 'Catálogo Odontek';

    return categorias.find((c) =>
      String(c.id) === String(categoriaSelecionada)
    )?.nome || 'Produtos';
  }, [categoriaSelecionada, categorias]);

  function changeCategory(value) {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set('categoria', value);
    } else {
      next.delete('categoria');
    }

    setSearchParams(next);
  }

  return (
    <div className="container page products-page">

      <div className="page-header catalog-header">
        <span>Produtos odontológicos</span>

        <h1>{tituloCategoria}</h1>

        <p>
          Encontre equipamentos, peças, materiais e produtos
          para clínicas odontológicas.
        </p>
      </div>

      <div className="catalog-toolbar">

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto..."
        />

        <select
          value={categoriaSelecionada}
          onChange={(e) => changeCategory(e.target.value)}
        >
          <option value="">Todas as categorias</option>

          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>

        <select
          value={tipoVenda}
          onChange={(e) => setTipoVenda(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option value="preco_fixo">Preço fixo</option>
          <option value="orcamento">Sob orçamento</option>
        </select>

      </div>

      <div className="catalog-info">
        <strong>{produtos.length}</strong>
        <span>produto(s) encontrado(s)</span>
      </div>

      {produtos.length === 0 ? (
        <div className="empty-state premium-empty">
          Nenhum produto encontrado.
        </div>
      ) : (
        <div className="products-grid">
          {produtos.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}
        </div>
      )}
    </div>
  );
}