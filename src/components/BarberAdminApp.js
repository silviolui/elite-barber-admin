import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Scissors, Star, Phone, MapPin, Gift, History, Settings, CheckCircle, XCircle, ArrowLeft, ArrowRight, Heart, Zap, Plus, Edit, Trash2, DollarSign, TrendingUp, Users, CalendarDays, BarChart3, Filter, Search, Eye, Coffee, Moon } from 'lucide-react';
import { supabase } from '../lib/supabase';

const BarberAdminApp = () => {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [selectedTab, setSelectedTab] = useState('hoje');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(false);

  // Estados dos dados baseados nas suas tabelas
  const [agendamentos, setAgendamentos] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [horariosFunc, setHorariosFunc] = useState([]);

  // Carregar dados do Supabase
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Carregar agendamentos
        const { data: agendamentosData, error: agendamentosError } = await supabase
          .from('agendamentos')
          .select('*')
          .order('data_agendamento');
        
        if (agendamentosError) throw agendamentosError;
        setAgendamentos(agendamentosData || []);

        // Carregar barbeiros
        const { data: barbeirosData, error: barbeirosError } = await supabase
          .from('barbeiros')
          .select('*')
          .order('nome');
        
        if (barbeirosError) throw barbeirosError;
        setBarbeiros(barbeirosData || []);

        // Carregar serviços
        const { data: servicosData, error: servicosError } = await supabase
          .from('servicos')
          .select('*')
          .order('nome');
        
        if (servicosError) throw servicosError;
        setServicos(servicosData || []);

        // Carregar horários de funcionamento
        const { data: horariosData, error: horariosError } = await supabase
          .from('horarios_funcionamento')
          .select('*')
          .order('dia_semana_numero');
        
        if (horariosError) throw horariosError;
        setHorariosFunc(horariosData || []);

      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);
  // Métricas calculadas baseadas nos seus dados
  const hoje = new Date().toISOString().split('T')[0];
  const agendamentosHoje = agendamentos.filter(a => a.data_agendamento === hoje);
  const receitaHoje = agendamentosHoje
    .filter(a => a.status === 'concluido')
    .reduce((sum, a) => sum + parseFloat(a.valor_servico || 0), 0);
  const receitaMes = agendamentos
    .filter(a => a.status === 'concluido')
    .reduce((sum, a) => sum + parseFloat(a.valor_servico || 0), 0);

  // Funções auxiliares
  const getComboIcon = (combo) => {
    const icons = {
      'Diamante': '💎',
      'Ouro': '🥇',
      'Prata': '🥈',
      'Bronze': '🥉',
      'Cobre': '🔸',
      'Serviço': '✂️'
    };
    return icons[combo] || '⭐';
  };

  const getStatusColor = (status) => {
    const colors = {
      'agendado': 'bg-blue-400/20 text-blue-400',
      'confirmado': 'bg-green-400/20 text-green-400',
      'concluido': 'bg-purple-400/20 text-purple-400',
      'cancelado': 'bg-red-400/20 text-red-400'
    };
    return colors[status] || 'bg-gray-400/20 text-gray-400';
  };

  // Função para criar agendamento
  const criarAgendamento = async (novoAgendamento) => {
    try {
      const agendamentoData = {
        id: `AG-${Math.floor(Math.random() * 100000)}`,
        barbeiro_id: novoAgendamento.barbeiro_id,
        cliente_nome: novoAgendamento.cliente_nome,
        cliente_telefone: novoAgendamento.cliente_telefone,
        cliente_cpf: novoAgendamento.cliente_cpf,
        servico: novoAgendamento.servico,
        data_agendamento: novoAgendamento.data_agendamento,
        hora_inicio: novoAgendamento.hora_inicio,
        hora_fim: novoAgendamento.hora_fim,
        status: 'agendado',
        observacoes: novoAgendamento.observacoes || '',
        valor_servico: novoAgendamento.valor_servico,
        confirmado: false,
        lembrete_enviado: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('agendamentos')
        .insert([agendamentoData])
        .select()
        .single();

      if (error) throw error;

      setAgendamentos([...agendamentos, data]);
      return { success: true };
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      return { success: false, error: error.message };
    }
  };

  const Dashboard = () => (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 pt-6">
        <div>
          <h1 className="text-3xl font-bold text-yellow-400">🔥 Elite Barber</h1>
          <p className="text-gray-300">Sistema Conectado ao Supabase</p>
        </div>
        <button 
          onClick={() => setCurrentScreen('configuracoes')}
          className="p-3 bg-gray-800 rounded-full border border-yellow-400/30 hover:bg-gray-700 transition-all"
        >
          <Settings className="w-6 h-6 text-yellow-400" />
        </button>
      </div>

      {/* Banner de Conexão */}
      <div className="mb-6">
        <div className="bg-gradient-to-r from-green-400/20 to-green-600/20 border border-green-400/30 p-4 rounded-2xl">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🔗</div>
            <div>
              <h3 className="font-bold text-green-400">Conectado ao Supabase!</h3>
              <p className="text-sm text-gray-300">
                {agendamentos.length} agendamentos • {barbeiros.length} barbeiros • {servicos.length} serviços
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gradient-to-r from-green-400 to-green-600 p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-800 text-sm">Receita Hoje</p>
              <p className="text-2xl font-bold text-gray-900">R$ {receitaHoje.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-gray-900" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-400 to-blue-600 p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-800 text-sm">Agendamentos</p>
              <p className="text-2xl font-bold text-gray-900">{agendamentosHoje.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-gray-900" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-400 to-purple-600 p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-800 text-sm">Barbeiros Ativos</p>
              <p className="text-2xl font-bold text-gray-900">{barbeiros.filter(b => b.ativo).length}</p>
            </div>
            <Users className="w-8 h-8 text-gray-900" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-800 text-sm">Receita Mês</p>
              <p className="text-2xl font-bold text-gray-900">R$ {receitaMes.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-gray-900" />
          </div>
        </div>
      </div>
{/* Agendamentos de Hoje */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">📅 Agendamentos de Hoje</h2>
          <button 
            onClick={() => setCurrentScreen('agendamentos')}
            className="text-yellow-400 text-sm font-semibold hover:text-yellow-300"
          >
            Ver todos →
          </button>
        </div>
        
        <div className="space-y-3">
          {agendamentosHoje.slice(0, 3).map(agendamento => (
            <div key={agendamento.id} className="bg-gray-800 p-4 rounded-2xl border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">👤</div>
                  <div>
                    <h3 className="font-bold">{agendamento.cliente_nome}</h3>
                    <p className="text-gray-400 text-sm">{agendamento.servico}</p>
                    <p className="text-gray-400 text-sm">com {agendamento.nome_profissional}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-yellow-400">⏰ {agendamento.hora_inicio?.substring(0, 5)}</p>
                  <p className="text-green-400 text-sm">R$ {parseFloat(agendamento.valor_servico || 0).toFixed(2)}</p>
                  <div className={`px-2 py-1 rounded-full text-xs font-bold mt-1 ${getStatusColor(agendamento.status)}`}>
                    {agendamento.status.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {agendamentosHoje.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum agendamento para hoje</p>
            </div>
          )}
        </div>
      </div>

      {/* Menu Principal */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => setCurrentScreen('agendamentos')}
          className="bg-gray-800 p-6 rounded-2xl border border-gray-700 hover:border-yellow-400/50 transition-all"
        >
          <Calendar className="w-8 h-8 text-yellow-400 mb-3 mx-auto" />
          <h3 className="font-bold text-center">Agendamentos</h3>
          <p className="text-gray-400 text-sm text-center mt-1">{agendamentos.length} total</p>
        </button>

        <button 
          onClick={() => setCurrentScreen('barbeiros')}
          className="bg-gray-800 p-6 rounded-2xl border border-gray-700 hover:border-yellow-400/50 transition-all"
        >
          <Scissors className="w-8 h-8 text-yellow-400 mb-3 mx-auto" />
          <h3 className="font-bold text-center">Barbeiros</h3>
          <p className="text-gray-400 text-sm text-center mt-1">{barbeiros.filter(b => b.ativo).length} ativos</p>
        </button>

        <button 
          onClick={() => setCurrentScreen('servicos')}
          className="bg-gray-800 p-6 rounded-2xl border border-gray-700 hover:border-yellow-400/50 transition-all"
        >
          <Star className="w-8 h-8 text-yellow-400 mb-3 mx-auto" />
          <h3 className="font-bold text-center">Serviços</h3>
          <p className="text-gray-400 text-sm text-center mt-1">{servicos.length} disponíveis</p>
        </button>

        <button 
          onClick={() => setCurrentScreen('horarios')}
          className="bg-gray-800 p-6 rounded-2xl border border-gray-700 hover:border-yellow-400/50 transition-all"
        >
          <Clock className="w-8 h-8 text-yellow-400 mb-3 mx-auto" />
          <h3 className="font-bold text-center">Horários</h3>
          <p className="text-gray-400 text-sm text-center mt-1">Funcionamento</p>
        </button>
      </div>
    </div>
  );

  const AgendamentosScreen = () => (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="flex items-center justify-between p-6 pt-12">
        <button 
          onClick={() => setCurrentScreen('dashboard')}
          className="p-3 bg-gray-800 rounded-full border border-yellow-400/30"
        >
          <ArrowLeft className="w-5 h-5 text-yellow-400" />
        </button>
        <h1 className="text-xl font-bold">Agendamentos</h1>
        <button className="p-3 bg-yellow-400 rounded-full text-gray-900">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6">
        <div className="space-y-4">
          {agendamentos.map(agendamento => (
            <div key={agendamento.id} className="bg-gray-800 p-4 rounded-2xl border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="text-3xl">👤</div>
                  <div>
                    <h3 className="font-bold">{agendamento.cliente_nome}</h3>
                    <p className="text-gray-400 text-sm">{agendamento.servico}</p>
                    <p className="text-gray-400 text-sm">📞 {agendamento.cliente_telefone}</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(agendamento.status)}`}>
                  {agendamento.status.toUpperCase()}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-400 font-bold">📅 {new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR')}</p>
                  <p className="text-gray-400">⏰ {agendamento.hora_inicio?.substring(0, 5)} - {agendamento.hora_fim?.substring(0, 5)}</p>
                  <p className="text-green-400 font-bold">💰 R$ {parseFloat(agendamento.valor_servico || 0).toFixed(2)}</p>
                </div>
                <div className="flex space-x-2">
                  <button className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all">
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {agendamento.observacoes && (
                <div className="mt-3 p-3 bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-300">💬 {agendamento.observacoes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const BarbeirosScreen = () => (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="flex items-center justify-between p-6 pt-12">
        <button 
          onClick={() => setCurrentScreen('dashboard')}
          className="p-3 bg-gray-800 rounded-full border border-yellow-400/30"
        >
          <ArrowLeft className="w-5 h-5 text-yellow-400" />
        </button>
        <h1 className="text-xl font-bold">Barbeiros</h1>
        <button className="p-3 bg-yellow-400 rounded-full text-gray-900">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6">
        <div className="space-y-4">
          {barbeiros.map(barbeiro => (
            <div key={barbeiro.barbeiro_id} className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="text-5xl">👨‍🦲</div>
                  <div>
                    <h3 className="text-xl font-bold">{barbeiro.nome}</h3>
                    <p className="text-gray-400">🎯 {barbeiro.servicos?.join(', ')}</p>
                    <p className="text-gray-400 text-sm">
                      🌅 {barbeiro.horario_inicio_manha?.substring(0, 5)} - {barbeiro.horario_fim_manha?.substring(0, 5)} | 
                      🌆 {barbeiro.horario_inicio_tarde?.substring(0, 5)} - {barbeiro.horario_fim_tarde?.substring(0, 5)}
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  barbeiro.ativo ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'
                }`}>
                  {barbeiro.ativo ? 'ATIVO' : 'INATIVO'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const ServicosScreen = () => (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="flex items-center justify-between p-6 pt-12">
        <button 
          onClick={() => setCurrentScreen('dashboard')}
          className="p-3 bg-gray-800 rounded-full border border-yellow-400/30"
        >
          <ArrowLeft className="w-5 h-5 text-yellow-400" />
        </button>
        <h1 className="text-xl font-bold">Serviços</h1>
        <button className="p-3 bg-yellow-400 rounded-full text-gray-900">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6">
        <div className="space-y-4">
          {servicos.map(servico => (
            <div key={servico.id} className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="text-4xl">{getComboIcon(servico.Combo)}</div>
                  <div>
                    <h3 className="text-xl font-bold">{servico.nome}</h3>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        servico.Combo === 'Diamante' ? 'bg-purple-400/20 text-purple-400' :
                        servico.Combo === 'Ouro' ? 'bg-yellow-400/20 text-yellow-400' :
                        servico.Combo === 'Prata' ? 'bg-gray-400/20 text-gray-400' :
                        servico.Combo === 'Bronze' ? 'bg-orange-400/20 text-orange-400' :
                        'bg-blue-400/20 text-blue-400'
                      }`}>
                        {servico.Combo}
                      </span>
                      <p className="text-gray-400 text-sm">⏱️ {servico.duracao_minutos} min</p>
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  servico.ativo ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'
                }`}>
                  {servico.ativo ? 'ATIVO' : 'INATIVO'}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-400 font-bold text-2xl">R$ {parseFloat(servico.preco).toFixed(2)}</p>
                </div>
                <div className="flex space-x-2">
                  <button className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all">
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Renderização das telas
  const renderScreen = () => {
    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin text-6xl mb-4">⚡</div>
            <p className="text-white text-xl">Carregando dados do Supabase...</p>
          </div>
        </div>
      );
    }

    switch (currentScreen) {
      case 'dashboard': return <Dashboard />;
      case 'agendamentos': return <AgendamentosScreen />;
      case 'barbeiros': return <BarbeirosScreen />;
      case 'servicos': return <ServicosScreen />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-black relative">
      {renderScreen()}
    </div>
  );
};

export default BarberAdminApp;