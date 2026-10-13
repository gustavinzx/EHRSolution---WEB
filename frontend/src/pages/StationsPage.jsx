import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import AnpStationsMap from '../components/AnpStationsMap';
import {
  MapPin,
  Search,
  Plus,
  MapPinOff,
  CheckCircle2,
  XCircle,
  Database,
  X,
  Fuel,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

const glass = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
};

const ALL_UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export function formatCnpj(cnpj) {
  const d = String(cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function getAnpStationBadge(station) {
  if (station?.situacao_sigaf && /interdit/i.test(station.situacao_sigaf)) {
    return {
      label: 'Interditado',
      color: '#f87171',
      bg: 'rgba(248,113,113,0.14)',
      border: 'rgba(248,113,113,0.35)',
    };
  }
  if (
    station?.lat === null ||
    station?.lng === null ||
    station?.lat === undefined ||
    station?.lng === undefined
  ) {
    return {
      label: 'Sem coordenadas',
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.14)',
      border: 'rgba(251,191,36,0.35)',
    };
  }
  return {
    label: 'Regular',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.14)',
    border: 'rgba(52,211,153,0.35)',
  };
}

export default function StationsPage({ initialTab = 'authorized' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // ── Aba 1: Rede Autorizada (existente) ──
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lat: '',
    lng: '',
    is_authorized: true,
  });

  // ── Aba 2: ANP (Brasil) ──
  const [anpItems, setAnpItems] = useState([]);
  const [anpTotal, setAnpTotal] = useState(0);
  const [anpPage, setAnpPage] = useState(1);
  const [anpLimit] = useState(20);
  const [anpLoading, setAnpLoading] = useState(false);
  const [anpSummary, setAnpSummary] = useState({
    total_active: 0,
    total_without_coordinates: 0,
    by_uf: [],
    last_sync_at: null,
  });

  const [anpFilters, setAnpFilters] = useState({
    uf: '',
    municipio: '',
    bandeira: '',
    q: '',
  });

  // Mapa in-bounds
  const [mapBounds, setMapBounds] = useState({
    minLat: -16.05,
    minLng: -48.3,
    maxLat: -15.5,
    maxLng: -47.3,
  });
  const [mapStations, setMapStations] = useState([]);
  const [mapTruncated, setMapTruncated] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);

  // Gaveta de detalhes
  const [selectedAnpStation, setSelectedAnpStation] = useState(null);

  const fetchStations = async () => {
    try {
      const { data } = await client.get('/fueling/stations');
      setStations(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Erro ao carregar postos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchAnpSummary = useCallback(async () => {
    try {
      const { data } = await client.get('/anp/stations/summary');
      if (data) setAnpSummary(data);
    } catch (_) {}
  }, []);

  const fetchAnpStations = useCallback(async () => {
    setAnpLoading(true);
    try {
      const params = {
        page: anpPage,
        limit: anpLimit,
      };
      if (anpFilters.uf) params.uf = anpFilters.uf;
      if (anpFilters.municipio.trim()) params.municipio = anpFilters.municipio.trim();
      if (anpFilters.bandeira.trim()) params.bandeira = anpFilters.bandeira.trim();
      if (anpFilters.q.trim()) params.q = anpFilters.q.trim();

      const { data } = await client.get('/anp/stations', { params });
      setAnpItems(Array.isArray(data?.items) ? data.items : []);
      setAnpTotal(Number(data?.total) || 0);
    } catch (err) {
      toast.error('Erro ao carregar catálogo ANP');
    } finally {
      setAnpLoading(false);
    }
  }, [anpPage, anpLimit, anpFilters]);

  const fetchAnpInBounds = useCallback(
    async (bounds) => {
      if (!bounds) return;
      setMapLoading(true);
      try {
        const params = {
          minLat: bounds.minLat,
          minLng: bounds.minLng,
          maxLat: bounds.maxLat,
          maxLng: bounds.maxLng,
        };
        if (anpFilters.uf) params.uf = anpFilters.uf;
        if (anpFilters.municipio.trim()) params.municipio = anpFilters.municipio.trim();
        if (anpFilters.bandeira.trim()) params.bandeira = anpFilters.bandeira.trim();
        if (anpFilters.q.trim()) params.q = anpFilters.q.trim();

        const { data } = await client.get('/anp/stations/in-bounds', { params });
        setMapStations(Array.isArray(data?.items) ? data.items : []);
        setMapTruncated(Boolean(data?.truncated));
      } catch (_) {
      } finally {
        setMapLoading(false);
      }
    },
    [anpFilters]
  );

  useEffect(() => {
    if (activeTab === 'anp') {
      fetchAnpSummary();
      fetchAnpStations();
    }
  }, [activeTab, fetchAnpSummary, fetchAnpStations]);

  useEffect(() => {
    if (activeTab === 'anp' && mapBounds) {
      fetchAnpInBounds(mapBounds);
    }
  }, [activeTab, mapBounds, fetchAnpInBounds]);

  const handleOpenAnpDetails = async (station) => {
    setSelectedAnpStation(station);
    try {
      const { data } = await client.get(`/anp/stations/${station.cnpj}`);
      if (data) setSelectedAnpStation(data);
    } catch (_) {}
  };

  const handleFilterChange = (field, value) => {
    setAnpPage(1);
    setAnpFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleToggle = async (id) => {
    try {
      await client.patch(`/fueling/stations/${id}/toggle`);
      toast.success('Status alterado');
      fetchStations();
    } catch (err) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await client.post('/fueling/stations', formData);
      toast.success('Posto cadastrado');
      setIsModalOpen(false);
      fetchStations();
    } catch (err) {
      toast.error('Erro ao cadastrar');
    }
  };

  const filtered = stations.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(anpTotal / anpLimit));
  const formattedSyncDate = anpSummary?.last_sync_at
    ? new Date(anpSummary.last_sync_at).toLocaleString('pt-BR')
    : 'nunca sincronizado';

  const isNeverSynced =
    !anpLoading &&
    anpSummary.total_active === 0 &&
    !anpSummary.last_sync_at &&
    anpItems.length === 0;

  if (loading && activeTab === 'authorized') return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Cabeçalho Principal + Abas ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '28px',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              color: '#fff',
              margin: 0,
            }}
          >
            <MapPin size={28} color="#2FBEB5" /> Postos de Combustível
          </h1>
          {activeTab === 'authorized' ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
              {stations.filter(s => s.is_authorized).length} postos autorizados para destrava
            </p>
          ) : (
            <p
              data-testid="anp-header-summary"
              style={{ color: '#94a3b8', fontSize: '13px', marginTop: '6px' }}
            >
              {`${anpSummary.total_active} postos ativos • atualizado em ${formattedSyncDate}`}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            role="tablist"
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '4px',
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'authorized'}
              onClick={() => setActiveTab('authorized')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeTab === 'authorized' ? 'rgba(47,190,181,0.2)' : 'transparent',
                color: activeTab === 'authorized' ? '#2FBEB5' : '#94a3b8',
              }}
            >
              Rede Autorizada
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'anp'}
              onClick={() => setActiveTab('anp')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: activeTab === 'anp' ? 'rgba(47,190,181,0.2)' : 'transparent',
                color: activeTab === 'anp' ? '#2FBEB5' : '#94a3b8',
              }}
            >
              <Database size={14} /> ANP (Brasil)
            </button>
          </div>

          {activeTab === 'authorized' && (
            <button
              onClick={() => {
                setFormData({ name: '', address: '', lat: '', lng: '', is_authorized: true });
                setIsModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
                color: '#fff',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(56,189,248,0.3)',
              }}
            >
              <Plus size={16} /> Novo Posto
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          ABA 1: REDE AUTORIZADA
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'authorized' && (
        <>
          <div style={{ position: 'relative', maxWidth: '320px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Buscar posto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                padding: '10px 14px 10px 38px',
                borderRadius: '10px',
                width: '100%',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}
          >
            {filtered.map(s => (
              <div
                key={s.id}
                style={{
                  ...glass,
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: s.is_authorized ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: s.is_authorized ? '#34d399' : '#f87171',
                      }}
                    >
                      {s.is_authorized ? <MapPin size={18} /> : <MapPinOff size={18} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {s.id} • Lat/Lng</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(s.id)}
                    title={s.is_authorized ? 'Bloquear' : 'Autorizar'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: s.is_authorized ? '#34d399' : '#f87171',
                      cursor: 'pointer',
                    }}
                  >
                    {s.is_authorized ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {s.address || 'Sem endereço cadastrado.'}
                  <br />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    GPS: {s.lat}, {s.lng}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {isModalOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 999,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
              }}
            >
              <form
                onSubmit={handleSave}
                style={{
                  background: 'rgba(11,20,36,0.98)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '20px',
                  width: '100%',
                  maxWidth: '440px',
                  padding: '24px',
                }}
              >
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>
                  Cadastrar Posto
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    placeholder="Nome do posto"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      padding: '12px',
                      borderRadius: '10px',
                    }}
                  />
                  <input
                    placeholder="Endereço (opcional)"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      padding: '12px',
                      borderRadius: '10px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      placeholder="Latitude"
                      required
                      type="number"
                      step="any"
                      value={formData.lat}
                      onChange={e => setFormData({ ...formData, lat: e.target.value })}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        padding: '12px',
                        borderRadius: '10px',
                      }}
                    />
                    <input
                      placeholder="Longitude"
                      required
                      type="number"
                      step="any"
                      value={formData.lng}
                      onChange={e => setFormData({ ...formData, lng: e.target.value })}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        padding: '12px',
                        borderRadius: '10px',
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'transparent',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #2FBEB5, #4F8EF7)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ABA 2: ANP (BRASIL)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'anp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Barra de Filtros */}
          <div
            style={{
              ...glass,
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: '130px 1fr 1fr 1.4fr',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <select
              aria-label="Filtrar por UF"
              value={anpFilters.uf}
              onChange={e => handleFilterChange('uf', e.target.value)}
              style={{
                background: '#111D27',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="">Todas as UFs</option>
              {ALL_UFS.map(uf => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>

            <input
              type="text"
              aria-label="Filtrar por município"
              placeholder="Município..."
              value={anpFilters.municipio}
              onChange={e => handleFilterChange('municipio', e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '13px',
                outline: 'none',
              }}
            />

            <input
              type="text"
              aria-label="Filtrar por bandeira"
              placeholder="Bandeira (ex: VIBRA, RAIZEN)..."
              value={anpFilters.bandeira}
              onChange={e => handleFilterChange('bandeira', e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '13px',
                outline: 'none',
              }}
            />

            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                }}
              />
              <input
                type="text"
                aria-label="Buscar por nome ou CNPJ"
                placeholder="Buscar por Razão Social ou CNPJ..."
                value={anpFilters.q}
                onChange={e => handleFilterChange('q', e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '10px 12px 10px 34px',
                  borderRadius: '10px',
                  width: '100%',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {isNeverSynced ? (
            <div
              data-testid="anp-empty-state"
              style={{
                ...glass,
                padding: '40px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Database size={36} color="#2FBEB5" />
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                Catálogo ANP ainda não sincronizado
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '520px', margin: 0, lineHeight: 1.6 }}>
                Para importar os postos oficiais da ANP, acesse o diretório <code>backend</code> e{' '}
                <strong>rode npm run anp:sync</strong> (ex.: <code>npm run anp:sync -- --uf DF</code>).
              </p>
            </div>
          ) : (
            <>
              {/* Mapa por Região (in-bounds) */}
              <AnpStationsMap
                stations={mapStations}
                truncated={mapTruncated}
                loading={mapLoading}
                onBoundsChange={setMapBounds}
                onSelectStation={handleOpenAnpDetails}
              />

              {/* Tabela Paginada */}
              <div style={{ ...glass, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                          Razão Social
                        </th>
                        <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                          CNPJ
                        </th>
                        <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                          UF / Município
                        </th>
                        <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                          Bandeira
                        </th>
                        <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                          Situação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {anpItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                            {anpLoading ? 'Carregando postos...' : 'Nenhum posto encontrado para os filtros informados.'}
                          </td>
                        </tr>
                      ) : (
                        anpItems.map(st => {
                          const badge = getAnpStationBadge(st);
                          return (
                            <tr
                              key={st.cnpj}
                              onClick={() => handleOpenAnpDetails(st)}
                              style={{
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                              }}
                            >
                              <td style={{ padding: '13px 16px', fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                                {st.razao_social}
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>
                                  {st.endereco || '—'} {st.bairro ? `• ${st.bairro}` : ''}
                                </div>
                              </td>
                              <td style={{ padding: '13px 16px', fontSize: '12px', color: '#cbd5e1', fontFamily: 'var(--font-mono, monospace)' }}>
                                {formatCnpj(st.cnpj)}
                              </td>
                              <td style={{ padding: '13px 16px', fontSize: '13px', color: '#e2e8f0' }}>
                                {st.municipio || '—'} / <strong>{st.uf}</strong>
                              </td>
                              <td style={{ padding: '13px 16px', fontSize: '12px', color: '#cbd5e1' }}>
                                {st.bandeira || '—'}
                              </td>
                              <td style={{ padding: '13px 16px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: badge.color,
                                    background: badge.bg,
                                    border: `1px solid ${badge.border}`,
                                  }}
                                >
                                  {badge.label === 'Regular' && <ShieldCheck size={12} />}
                                  {badge.label === 'Interditado' && <AlertTriangle size={12} />}
                                  {badge.label === 'Sem coordenadas' && <MapPinOff size={12} />}
                                  {badge.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Rodapé de Paginação */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: '#94a3b8',
                  }}
                >
                  <span>
                    Total: <strong>{anpTotal}</strong> registros • Página <strong>{anpPage}</strong> de{' '}
                    <strong>{totalPages}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={anpPage <= 1}
                      onClick={() => setAnpPage(p => Math.max(1, p - 1))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)',
                        color: anpPage <= 1 ? '#475569' : '#fff',
                        cursor: anpPage <= 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronLeft size={14} /> Anterior
                    </button>
                    <button
                      type="button"
                      disabled={anpPage >= totalPages}
                      onClick={() => setAnpPage(p => Math.min(totalPages, p + 1))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)',
                        color: anpPage >= totalPages ? '#475569' : '#fff',
                        cursor: anpPage >= totalPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Próxima <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Gaveta Lateral de Detalhes do Posto ANP ── */}
      {selectedAnpStation && (
        <div
          role="dialog"
          aria-label="Detalhes do Posto ANP"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={e => e.target === e.currentTarget && setSelectedAnpStation(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              height: '100%',
              background: '#0b1424',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              padding: '24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#2FBEB5', fontWeight: 700, textTransform: 'uppercase' }}>
                  Detalhes do Posto ANP
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: '4px 0 0' }}>
                  {selectedAnpStation.razao_social}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fechar gaveta"
                onClick={() => setSelectedAnpStation(null)}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {(() => {
              const badge = getAnpStationBadge(selectedAnpStation);
              return (
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: badge.color,
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })()}

            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '13px',
                color: '#cbd5e1',
              }}
            >
              <div>
                <strong style={{ color: '#94a3b8' }}>CNPJ:</strong> {formatCnpj(selectedAnpStation.cnpj)} (
                {selectedAnpStation.cnpj})
              </div>
              <div>
                <strong style={{ color: '#94a3b8' }}>Bandeira:</strong> {selectedAnpStation.bandeira || '—'}
              </div>
              <div>
                <strong style={{ color: '#94a3b8' }}>Endereço:</strong> {selectedAnpStation.endereco || '—'}
              </div>
              <div>
                <strong style={{ color: '#94a3b8' }}>Bairro / CEP:</strong> {selectedAnpStation.bairro || '—'} • CEP:{' '}
                {selectedAnpStation.cep || '—'}
              </div>
              <div>
                <strong style={{ color: '#94a3b8' }}>Município / UF:</strong> {selectedAnpStation.municipio || '—'} /{' '}
                {selectedAnpStation.uf}
              </div>
              <div>
                <strong style={{ color: '#94a3b8' }}>Coordenadas:</strong>{' '}
                {selectedAnpStation.lat !== null && selectedAnpStation.lng !== null
                  ? `${selectedAnpStation.lat}, ${selectedAnpStation.lng}`
                  : 'Sem coordenadas'}
              </div>
              <div>
                <strong style={{ color: '#94a3b8' }}>Acurácia Estimada:</strong>{' '}
                {selectedAnpStation.acuracia_metros !== null && selectedAnpStation.acuracia_metros !== undefined
                  ? `${selectedAnpStation.acuracia_metros} m`
                  : '—'}
              </div>
              <div>
                <strong style={{ color: '#94a3b8' }}>Situação SIGAF:</strong>{' '}
                {selectedAnpStation.situacao_sigaf || 'Regular'}
              </div>
            </div>

            <div>
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#fff',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '10px',
                }}
              >
                <Fuel size={15} color="#2FBEB5" /> Produtos, Tancagem e Bicos
              </h3>
              {Array.isArray(selectedAnpStation.produtos) && selectedAnpStation.produtos.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedAnpStation.produtos.map((prod, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(47,190,181,0.06)',
                        border: '1px solid rgba(47,190,181,0.2)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        fontSize: '12px',
                        color: '#e2e8f0',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#2FBEB5' }}>{prod.produto}</div>
                      <div style={{ color: '#94a3b8', marginTop: '4px' }}>
                        Tancagem: <strong>{prod.tancagem}</strong> {prod.unidMedidaTancagem || 'm³'} • Bicos:{' '}
                        <strong>{prod.qtdeBicos}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748b' }}>Nenhum produto informado pela ANP.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
