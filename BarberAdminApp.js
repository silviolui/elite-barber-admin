import React, { useState, useEffect, useCallback, useContext } from 'react';
import { 
  Calendar, 
  Users, 
  Scissors, 
  Settings, 
  Plus, 
  DollarSign, 
  TrendingUp, 
  Edit, 
  CheckCircle, 
  XCircle,
  Star,
  BarChart3,
  Search,
  Menu,
  Home,
  Bell,
  User,
  ChevronRight,
  CreditCard,
  PieChart,
  Crown,
  ArrowLeft,
  History,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
// Função para obter data/hora no timezone de Brasília-SP - CORRIGIDA
const getBrasiliaDate = () => {
  const now = new Date();
  // Calcula o offset de São Paulo (-3 UTC)
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const saoPauloOffset = -3; // UTC-3 para São Paulo
  const brasiliaTime = new Date(utcTime + (saoPauloOffset * 3600000));
  return brasiliaTime;
};
// Estados para o modal de agendamento

const getBrasiliaDateString = () => {
  const brasiliaDate = getBrasiliaDate();
  const year = brasiliaDate.getFullYear();
  const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
  const day = String(brasiliaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


// 🔐 CONTEXT DE AUTENTICAÇÃO
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [appLoading, setLoading] = useState(true);
  const getSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (session?.user) {
        setUser(session.user);
        const profileResult = await loadUserProfile(session.user.id);
if (!profileResult.success) {
  // Se perfil não existe, fazer logout
  await supabase.auth.signOut();
  setUser(null);
  setUserProfile(null);
  return;
}
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
    } finally {
      setLoading(false);
    }
}, []);

  // Verificar sessão ao carregar
useEffect(() => {
  getSession();
}, [getSession]);



 const loadUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      throw new Error('Perfil não encontrado');
    }
    
console.log('🔍 DADOS DO PERFIL CARREGADOS:', data);
console.log('🔍 BARBEARIA_ID RECEBIDO:', data.barbearia_id);
setUserProfile(data);
return { success: true };
  } catch (error) {
    console.error('Erro ao carregar perfil:', error);
    return { success: false, error: error.message };
  }
};

const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    // Verificar se o perfil existe
    const profileResult = await loadUserProfile(data.user.id);
    
    if (!profileResult.success) {
      // Se perfil não existe, fazer logout e retornar erro
      await supabase.auth.signOut();
      return { success: false, error: 'Conta não encontrada ou foi removida' };
    }
    
    setUser(data.user);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const signUp = async (email, password, userData) => {
  console.log('🚀 INICIANDO SIGNUP COM:', email);
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    
    if (error) throw error;
    
    // Gerar ID único da barbearia SEMPRE para novos usuários
   const novaBarbeariaId = `BARB${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;
    console.log('🆔 GERANDO NOVA BARBEARIA COM ID:', novaBarbeariaId);
    
    // Verificar se o perfil já existe
    console.log('🔍 VERIFICANDO SE PERFIL EXISTE PARA USER ID:', data.user.id);
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    console.log('🔍 RESULTADO DA BUSCA:', existingProfile);
    console.log('🔍 ERRO DA BUSCA:', profileError);

    if (!existingProfile) {
      console.log('🆕 PERFIL NÃO EXISTE - CRIANDO NOVO COM BARBEARIA_ID');
      
      // Dados do perfil com barbearia_id garantido
      const perfilData = {
        id: data.user.id,
        nome_completo: userData.nome_completo,
        email: email,
        telefone: userData.telefone || '',
        role: 'admin',
        barbearia_id: novaBarbeariaId,
        ativo: true
      };
      
      console.log('🔍 DADOS COMPLETOS DO PERFIL:', perfilData);
      console.log('🔍 BARBEARIA_ID QUE SERÁ INSERIDO:', perfilData.barbearia_id);

      // Inserir perfil com retry em caso de erro
      let tentativas = 0;
      let profileInsertError;
      
      while (tentativas < 3) {
        const { error } = await supabase
          .from('user_profiles')
          .insert([perfilData]);
          
        profileInsertError = error;
        
        if (!error) {
          console.log('✅ PERFIL INSERIDO COM SUCESSO NA TENTATIVA:', tentativas + 1);
          break;
        } else {
          tentativas++;
          console.error(`❌ ERRO NA TENTATIVA ${tentativas}:`, error);
          if (tentativas < 3) {
            console.log('🔄 Tentando novamente em 1 segundo...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (profileInsertError) {
        console.error('❌ ERRO DEFINITIVO AO INSERIR PERFIL:', profileInsertError);
        throw profileInsertError;
      }

      // Verificar se o perfil foi realmente inserido com barbearia_id
      const { data: perfilVerificacao, error: verificacaoError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
      if (verificacaoError || !perfilVerificacao) {
        console.error('❌ ERRO AO VERIFICAR PERFIL INSERIDO:', verificacaoError);
        throw new Error('Perfil não foi inserido corretamente');
      }
      
      if (!perfilVerificacao.barbearia_id) {
        console.error('❌ PERFIL INSERIDO MAS SEM BARBEARIA_ID!');
        throw new Error('Perfil inserido sem barbearia_id');
      }
      
      console.log('✅ PERFIL VERIFICADO COM BARBEARIA_ID:', perfilVerificacao.barbearia_id);

      // Criar horários de funcionamento padrão para nova barbearia
      const diasSemana = [
        { nome: 'Segunda-feira', numero: 1 },
        { nome: 'Terça-feira', numero: 2 },
        { nome: 'Quarta-feira', numero: 3 },
        { nome: 'Quinta-feira', numero: 4 },
        { nome: 'Sexta-feira', numero: 5 },
        { nome: 'Sábado', numero: 6 },
        { nome: 'Domingo', numero: 0 }
      ];

      const horariosDefault = diasSemana.map(dia => ({
        barbearia_id: novaBarbeariaId,
        dia_semana: dia.nome,
        dia_semana_numero: dia.numero,
        hora_inicio_manha: '08:00:00',
        hora_fim_manha: '12:00:00',
        hora_inicio_tarde: '14:00:00',
        hora_fim_tarde: '18:00:00',
        ativo: dia.numero >= 1 && dia.numero <= 6
      }));

      const { error: horariosError } = await supabase
        .from('horarios_funcionamento')
        .insert(horariosDefault);
        
      if (horariosError) {
        console.error('⚠️ Erro ao criar horários (não crítico):', horariosError);
      } else {
        console.log('✅ Horários de funcionamento criados com sucesso');
      }
    } else {
      console.log('⚠️ PERFIL JÁ EXISTE - VERIFICANDO BARBEARIA_ID');
      
      // Se perfil existe mas não tem barbearia_id, atualizar
      if (!existingProfile.barbearia_id) {
        console.log('🔧 PERFIL EXISTE MAS SEM BARBEARIA_ID - ATUALIZANDO');
        
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ barbearia_id: novaBarbeariaId })
          .eq('id', data.user.id);
          
        if (updateError) {
          console.error('❌ ERRO AO ATUALIZAR BARBEARIA_ID:', updateError);
          throw updateError;
        }
        
        console.log('✅ BARBEARIA_ID ATUALIZADO PARA PERFIL EXISTENTE:', novaBarbeariaId);
      }
    }
    
    // Carregar o perfil após garantir que existe
    console.log('🔄 Carregando perfil do usuário criado...');
    const profileResult = await loadUserProfile(data.user.id);
    
    if (!profileResult.success) {
      console.error('❌ Erro ao carregar perfil após criação');
      throw new Error('Erro ao carregar perfil do usuário');
    }
    
    // Definir o usuário como logado
    setUser(data.user);      
    console.log('✅ Usuário criado e logado com sucesso!');
    
    return { success: true };
  } catch (error) {
    console.error('❌ Erro no signup:', error);
    return { success: false, error: error.message };
  }
};
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const value = {
    user,
    userProfile,
    appLoading,
    signIn,
    signUp,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

// 🔐 TELA DE LOGIN
const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [appLoading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      alert('Preencha todos os campos');
      return;
    }

  setLoading(true);
    
    const result = await signIn(email, password);
    
    if (!result.success) {
      alert('Erro ao fazer login: ' + result.error);
    }
    
    setLoading(false);
  };

  if (showRegister) {
    return <RegisterScreen onBack={() => setShowRegister(false)} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: '#FF6B35',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(255, 107, 53, 0.3)'
          }}>
            <Calendar size={40} color="white" />
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1E293B',
            margin: '0 0 8px 0'
          }}>
            BookIA
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#64748B',
            margin: 0
          }}>
            Sistema de Agendamentos
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
              display: 'block'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{
                width: '100%',
                padding: '16px',
                border: '2px solid #F1F5F9',
                borderRadius: '12px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#FF6B35'}
              onBlur={(e) => e.target.style.borderColor = '#F1F5F9'}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
              display: 'block'
            }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '16px',
                  paddingRight: '50px',
                  border: '2px solid #F1F5F9',
                  borderRadius: '12px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#FF6B35'}
                onBlur={(e) => e.target.style.borderColor = '#F1F5F9'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={appLoading}
            style={{
              width: '100%',
              background: appLoading ? '#94A3B8' : '#FF6B35',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: appLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginBottom: '20px'
            }}
          >
            {appLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Link para cadastro */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 12px 0' }}>
            Não tem uma conta?
          </p>
          <button
            onClick={() => setShowRegister(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#FF6B35',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Criar conta
          </button>
        </div>
      </div>
    </div>
  );
};

// 🔐 TELA DE CADASTRO
const RegisterScreen = ({ onBack }) => {
  const [formData, setFormData] = useState({
    nome_completo: '',
    email: '',
    telefone: '',
    password: '',
    confirmPassword: ''
  });
  const [appLoading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signUp } = useAuth();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.nome_completo.trim() || !formData.email.trim() || !formData.password.trim()) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      alert('As senhas não coincidem');
      return;
    }

    if (formData.password.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres');
      return;
    }

   setLoading(true);
    
    const result = await signUp(formData.email, formData.password, {
      nome_completo: formData.nome_completo,
      telefone: formData.telefone
    });
    
    if (result.success) {
      alert('Conta criada com sucesso! Você pode fazer login agora.');
      onBack();
    } else {
      alert('Erro ao criar conta: ' + result.error);
    }
    
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <button
            onClick={onBack}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              marginRight: '12px'
            }}
          >
            <ArrowLeft size={16} color="#64748B" />
          </button>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1E293B',
              margin: 0
            }}>
              Criar Conta
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              margin: '4px 0 0 0'
            }}>
              Preencha os dados para criar sua conta
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px',
              display: 'block'
            }}>
              Nome Completo *
            </label>
            <input
              type="text"
              value={formData.nome_completo}
              onChange={(e) => handleInputChange('nome_completo', e.target.value)}
              placeholder="Seu nome completo"
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #F1F5F9',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#FF6B35'}
              onBlur={(e) => e.target.style.borderColor = '#F1F5F9'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px',
              display: 'block'
            }}>
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="seu@email.com"
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #F1F5F9',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#FF6B35'}
              onBlur={(e) => e.target.style.borderColor = '#F1F5F9'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px',
              display: 'block'
            }}>
              Telefone
            </label>
            <input
              type="tel"
              value={formData.telefone}
              onChange={(e) => handleInputChange('telefone', e.target.value)}
              placeholder="(00) 00000-0000"
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #F1F5F9',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#FF6B35'}
              onBlur={(e) => e.target.style.borderColor = '#F1F5F9'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px',
              display: 'block'
            }}>
              Senha *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={{
                  width: '100%',
                  padding: '14px',
                  paddingRight: '50px',
                  border: '2px solid #F1F5F9',
                  borderRadius: '10px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#FF6B35'}
                onBlur={(e) => e.target.style.borderColor = '#F1F5F9'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '6px',
              display: 'block'
            }}>
              Confirmar Senha *
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              placeholder="Digite a senha novamente"
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #F1F5F9',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#FF6B35'}
              onBlur={(e) => e.target.style.borderColor = '#F1F5F9'}
            />
          </div>

          <button
            type="submit"
            disabled={appLoading}
            style={{
              width: '100%',
              background: appLoading ? '#94A3B8' : '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: appLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {appLoading ? 'Criando conta...' : 'Criar Conta'}
          </button>
        </form>
      </div>
    </div>
  );
};

const App = () => {
  const { user, userProfile, appLoading, signOut } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [, setIsLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(getBrasiliaDate());
  // 🔔 SISTEMA DE NOTIFICAÇÕES CORRIGIDO
const [notifications, setNotifications] = useState(() => {
  try {
const saved = localStorage.getItem('elite-notifications');
if (saved) {
  const parsed = JSON.parse(saved);
  const hoje = getBrasiliaDate().toDateString();
  // Manter apenas notificações de hoje
  return parsed.filter(n => new Date(n.timestamp).toDateString() === hoje);
}
  } catch (error) {
    console.error('Erro ao restaurar notificações:', error);
  }
  return [];
});
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastProcessedId, setLastProcessedId] = useState(null); // Para evitar duplicatas

  // Estados dos dados REAIS do Supabase
  const [agendamentos, setAgendamentos] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  // ESTADOS DE FATURAMENTO
  const [faturamentoDia, setFaturamentoDia] = useState(0);
  const [faturamentoSemana, setFaturamentoSemana] = useState(0);
  const [faturamentoMes, setFaturamentoMes] = useState(0);
  const [faturamentoTotal, setFaturamentoTotal] = useState(0);
  const [historicoConfirmados, setHistoricoConfirmados] = useState([]);
const [clientes, setClientes] = useState([]);
const [showSuccessPopup, setShowSuccessPopup] = useState(false);
const [popupTimeout, setPopupTimeout] = useState(null);
const [successMessage, setSuccessMessage] = useState('');
const [showEditModal, setShowEditModal] = useState(false);
const [clienteEditando, setClienteEditando] = useState(null);
const [dadosEdicao, setDadosEdicao] = useState({ nome: '', telefone: '', cpf: '' });
const [minAgendamentosAtivo, setMinAgendamentosAtivo] = useState(3); // Configuração padrão
const [horariosFuncionamento, setHorariosFuncionamento] = useState([]);
const [editandoHorarios, setEditandoHorarios] = useState(false);
const [horariosTemp, setHorariosTemp] = useState([]);
const [salvandoHorarios, setSalvandoHorarios] = useState(false);
const [showProfissionalModal, setShowProfissionalModal] = useState(false);
const [showAgendamentoModal, setShowAgendamentoModal] = useState(false);
const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
const [horarioSelecionado, setHorarioSelecionado] = useState('');
const [agendamentoEditando, setAgendamentoEditando] = useState(null);
const [showConfirmModal, setShowConfirmModal] = useState(false);
const [agendamentoPendente, setAgendamentoPendente] = useState(null);
const [dadosAgendamento, setDadosAgendamento] = useState({
  nome_cliente: '',
  telefone_cliente: '',
  cliente_cpf: '',
  data_agendamento: '',
  servicos_selecionados: [],
  barbeiro_selecionado: ''
});
const [servicosDisponiveis, setServicosDisponiveis] = useState([]);
const [profissionalEditando, setProfissionalEditando] = useState(null);
const [dadosProfissional, setDadosProfissional] = useState({
  nome: '',
  servicos: [],
  horario_inicio_manha: '08:00',
  horario_fim_manha: '12:00',
  horario_inicio_tarde: '14:00',
  horario_fim_tarde: '18:00',
  ativo: 'true'
});

  // 🔔 CONFIGURAR NOTIFICAÇÕES PWA MELHORADO
  useEffect(() => {
    const setupNotifications = async () => {
      console.log('🔔 === INICIANDO CONFIGURAÇÃO DE NOTIFICAÇÕES PWA ===');
      
      // 1. Verificar suporte básico
      if (!('Notification' in window)) {
        console.log('❌ Browser não suporta Notification API');
        return;
      }

      if (!('serviceWorker' in navigator)) {
        console.log('❌ Browser não suporta Service Worker');
        return;
      }

      if (!('PushManager' in window)) {
        console.log('❌ Browser não suporta Push API');
        return;
      }

      console.log('✅ Browser suporta todas as APIs necessárias');

      // 2. Registrar Service Worker PRIMEIRO
      try {
        console.log('🔧 Registrando Service Worker...');
        const registration = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none'
        });
        
        console.log('✅ Service Worker registrado:', registration);

        // Aguardar o service worker estar pronto
        await navigator.serviceWorker.ready;
        console.log('✅ Service Worker pronto');

      } catch (error) {
        console.error('❌ Erro ao registrar Service Worker:', error);
        return;
      }

      // 3. Verificar/Solicitar permissão
      console.log('🔔 Permissão atual:', Notification.permission);

      if (Notification.permission === 'default') {
        console.log('🔔 Solicitando permissão...');
        const permission = await Notification.requestPermission();
        console.log('🔔 Resultado da permissão:', permission);
        
        if (permission === 'granted') {
          console.log('✅ Permissão concedida! Enviando notificação de teste...');
          sendTestNotification();
        } else {
          console.log('❌ Permissão negada');
        }
} else if (Notification.permission === 'granted') {
  console.log('✅ Permissão já concedida');
  const jaTestou = localStorage.getItem('pwa-testado') === 'true';
  if (!jaTestou) {
    sendTestNotification();
    localStorage.setItem('pwa-testado', 'true');
  }
}
    };

    // Função para enviar notificação de teste
    const sendTestNotification = () => {
      console.log('🧪 Enviando notificação de teste...');
      
      // Teste via Service Worker (background)
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification('BookIA!', {
          body: 'Notificações PWA configuradas com sucesso!',
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          requireInteraction: true,
          data: { url: '/' }
        });
      }).catch(error => {
        console.error('❌ Erro ao enviar notificação via SW:', error);
      });
    };

    setupNotifications();
  }, []);

  // 🔔 MARCAR NOTIFICAÇÕES COMO LIDAS
  const markAllAsRead = () => {
    console.log('🔔 Marcando todas as notificações como lidas...');
    setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
    setUnreadCount(0);
  };
  // 📝 MARCAR AGENDAMENTO COMO NOTIFICADO
const marcarComoNotificado = useCallback(async (agendamentoId) => {
  try {
    console.log('📝 Marcando agendamento como notificado:', agendamentoId);
    
 const { error } = await supabase
  .from('agendamentos')
  .update({ notificado: true })
  .eq('id', agendamentoId)
  .eq('barbearia_id', userProfile?.barbearia_id);
    
    if (error) throw error;
    
    console.log('✅ Agendamento marcado como notificado:', agendamentoId);
    
  } catch (error) {
    console.error('❌ Erro ao marcar como notificado:', error);
  }
}, [userProfile?.barbearia_id]);


// 🛠️ FUNÇÃO PARA PROCESSAR MANUALMENTE AGENDAMENTOS PENDENTES
const processarAgendamentosPendentes = async () => {
  console.log('🛠️ Processando agendamentos pendentes manualmente...');
  
  const ontem = getBrasiliaDate();
  ontem.setDate(ontem.getDate() - 1);
  // eslint-disable-next-line no-unused-vars
  const dataOntem = ontem.getFullYear() + '-' + 
                   String(ontem.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(ontem.getDate()).padStart(2, '0');
  
  const agendamentosPendentes = agendamentos.filter(a => 
    a.data_agendamento < getBrasiliaDateString() && 
    a.status === 'agendado'
  );
  
  console.log('🛠️ Agendamentos pendentes encontrados:', agendamentosPendentes.length);
  
  for (const agendamento of agendamentosPendentes) {
    console.log('🛠️ Processando:', agendamento.id, agendamento.cliente_nome);
    await moverParaHistorico(agendamento, 'não compareceu');
    await removerAgendamento(agendamento.id);
  }
  
  if (agendamentosPendentes.length > 0) {
    await loadData(false);
    console.log('🛠️ Processamento manual concluído!');
  }
};
// 🔔 DETECTAR NOVOS AGENDAMENTOS REAIS MELHORADO
// eslint-disable-next-line react-hooks/exhaustive-deps
const detectarNovoAgendamento = useCallback((payload) => {
    console.log('🔍 === ANALISANDO MUDANÇA DO SUPABASE (DADOS REAIS) ===');
    console.log('📋 Event Type:', payload.eventType);
    console.log('📋 Schema:', payload.schema);
    console.log('📋 Table:', payload.table);
    console.log('📋 New Data:', payload.new);
    console.log('📋 Timestamp:', getBrasiliaDate().toISOString());
    
    // ✅ VERIFICAR SE É REALMENTE UM NOVO AGENDAMENTO REAL
    if (payload.eventType === 'INSERT' && 
        payload.schema === 'public' && 
        payload.table === 'agendamentos' && 
        payload.new &&
        payload.new.id &&
        payload.new.cliente_nome) {
      
      const agendamento = payload.new;
      console.log('🆕 === NOVO AGENDAMENTO REAL DETECTADO ===');
      console.log('📋 ID:', agendamento.id);
      console.log('📋 Cliente:', agendamento.cliente_nome);
      console.log('📋 Serviço:', agendamento.servico);
      console.log('📋 Data:', agendamento.data_agendamento);
      console.log('📋 Hora:', agendamento.hora_inicio);
      console.log('📋 Profissional:', agendamento.nome_profissional);
      console.log('📋 Telefone:', agendamento.cliente_telefone);
      console.log('📋 Valor:', agendamento.valor_servico);
      
      // 🚫 VERIFICAR DUPLICATA (anti-spam)
      if (lastProcessedId === agendamento.id) {
        console.log('⚠️ Agendamento já processado, ignorando duplicata');
        return;
      }
      
      setLastProcessedId(agendamento.id);
      
      // 📅 FORMATAR DADOS REAIS PARA NOTIFICAÇÃO
      const dataAgendamento = new Date(agendamento.data_agendamento + 'T00:00:00');
const dataFormatada = dataAgendamento.toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo'
});
      const horaFormatada = agendamento.hora_inicio?.substring(0, 5) || 'N/A';
      const valorFormatado = agendamento.valor_servico ? 
        `R$ ${parseFloat(agendamento.valor_servico).toFixed(2).replace('.', ',')}` : '';
      
      // 🎯 CRIAR MENSAGEM DETALHADA COM DADOS REAIS
      const tituloNotificacao = '🎉 Novo Agendamento Recebido!';
      const mensagemDetalhada = `
📋 Cliente: ${agendamento.cliente_nome}
🔧 Serviço: ${agendamento.servico}
👨‍💼 Profissional: ${agendamento.nome_profissional || 'A definir'}
📅 Data: ${dataFormatada}
🕐 Horário: ${horaFormatada}
📞 Telefone: ${agendamento.cliente_telefone || 'N/A'}
${valorFormatado ? `💰 Valor: ${valorFormatado}` : ''}
      `.trim();
      
      const mensagemCurta = `${agendamento.cliente_nome} agendou ${agendamento.servico} para ${dataFormatada} às ${horaFormatada}`;
      
      console.log('🔔 === CRIANDO NOTIFICAÇÃO COM DADOS REAIS ===');
      console.log('📋 Título:', tituloNotificacao);
      console.log('📋 Mensagem:', mensagemCurta);
      console.log('📋 Detalhes completos:', mensagemDetalhada);
      
      // 💾 ADICIONAR À LISTA DE NOTIFICAÇÕES DO DIA
      addNotificationReal(
        'novo_agendamento',
        tituloNotificacao,
        mensagemCurta,
        mensagemDetalhada,
        agendamento
      );
      
      console.log('✅ Notificação real processada e armazenada com sucesso!');
      
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      console.log('🔄 Agendamento atualizado (não gera notificação):', payload.new.id);
    } else if (payload.eventType === 'DELETE' && payload.old) {
      console.log('🗑️ Agendamento deletado (não gera notificação):', payload.old.id);
    } else {
      console.log('ℹ️ Evento não relevante para notificações:', payload.eventType);
    }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [lastProcessedId]);

  // 🔔 FUNÇÃO MELHORADA PARA ADICIONAR NOTIFICAÇÕES REAIS
  const addNotificationReal = (tipo, titulo, mensagemCurta, mensagemDetalhada, agendamento = null) => {
    console.log('🔔 === ADICIONANDO NOTIFICAÇÃO REAL AO SISTEMA ===');
    console.log('📋 Tipo:', tipo);
    console.log('📋 Título:', titulo);
    console.log('📋 Mensagem:', mensagemCurta);

const agora = getBrasiliaDate();
const novaNotificacao = {
  id: Date.now() + Math.random(),
  tipo,
  titulo,
  mensagem: mensagemCurta,
  mensagemDetalhada: mensagemDetalhada || mensagemCurta,
  agendamento,
  timestamp: agora,
  lida: false,
  dataHora: agora.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
};

setNotifications(prev => {
  const novasNotificacoes = [novaNotificacao, ...prev];
  const hoje = getBrasiliaDate().toDateString();
  const notificacoesHoje = novasNotificacoes.filter(n => 
    new Date(n.timestamp).toDateString() === hoje
  ).slice(0, 50);
  
  // Salvar no localStorage
  salvarNotificacoes(notificacoesHoje);
  
  return notificacoesHoje;
});
    
    setUnreadCount(prev => prev + 1);

    // 🔔 ENVIAR NOTIFICAÇÃO PWA REAL
    sendPWANotificationReal(titulo, mensagemCurta, mensagemDetalhada, {
      screen: agendamento ? 'agenda' : 'dashboard',
      agendamentId: agendamento?.id,
      tipo: tipo
    });

    console.log('✅ Notificação real adicionada ao sistema!');
  };
  // 💾 SALVAR NOTIFICAÇÕES NO LOCALSTORAGE - ADICIONE AQUI
const salvarNotificacoes = (novasNotificacoes) => {
  try {
    localStorage.setItem('elite-notifications', JSON.stringify(novasNotificacoes));
  } catch (error) {
    console.error('Erro ao salvar notificações:', error);
  }
};

  // 🔔 FUNÇÃO PWA PARA NOTIFICAÇÕES REAIS
  const sendPWANotificationReal = (titulo, corpo, detalhes, dados = {}) => {
    console.log('🔔 === ENVIANDO NOTIFICAÇÃO PWA REAL ===');
    console.log('📋 Título:', titulo);
    console.log('📋 Corpo:', corpo);
    console.log('📋 Detalhes:', detalhes);
    console.log('📋 Permissão:', Notification.permission);
    
    if (Notification.permission !== 'granted') {
      console.log('❌ Permissão não concedida para notificações PWA');
      return;
    }

    // 🎯 ENVIAR VIA SERVICE WORKER (funciona em background)
    navigator.serviceWorker.ready.then(registration => {
      console.log('🔔 Enviando notificação real via Service Worker...');
      
return registration.showNotification(titulo, {
  body: corpo,
  icon: '/icon-192x192.png',
  badge: '/badge-72x72.png',
  tag: 'elite-barber-real-' + Date.now(),
  requireInteraction: false, // Mudou para false
  silent: false,
  renotify: true, // Força renotificação
  persistent: true, // Tenta manter persistente
        data: {
          ...dados,
          detalhes: detalhes,
          timestamp: getBrasiliaDate().toISOString()
        },
        actions: [
          {
            action: 'view',
            title: 'Ver Detalhes'
          },
          {
            action: 'close', 
            title: 'Fechar'
          }
        ]
      });
    }).then(() => {
      console.log('✅ Notificação PWA real enviada com sucesso!');
    }).catch(error => {
      console.error('❌ Erro ao enviar notificação PWA real:', error);
      
      // 🔄 FALLBACK: Notificação direta (só funciona com app aberto)
      try {
        console.log('🔄 Usando fallback de notificação direta...');
        const notification = new Notification(titulo, {
          body: corpo,
          icon: '/icon-192x192.png',
          tag: 'elite-barber-fallback-' + Date.now()
        });
        
        notification.onclick = () => {
          window.focus();
          if (dados.screen) {
            setCurrentScreen(dados.screen);
          }
          notification.close();
        };
        
        console.log('✅ Notificação fallback enviada');
      } catch (fallbackError) {
        console.error('❌ Erro no fallback de notificação:', fallbackError);
      }
    });
  };

  // 🔄 FUNÇÃO PARA CARREGAR DADOS
const loadData = useCallback(async (showLoadingState = false) => {
  if (showLoadingState) setIsLoading(true);
  
  try {
    console.log('🔄 Carregando dados do Supabase para barbearia:', userProfile?.barbearia_id);
    
    if (!userProfile?.barbearia_id) {
      console.log('❌ Sem barbearia_id, não carregando dados');
      return;
    }
    
    // Carregar agendamentos APENAS desta barbearia
    const { data: agendamentosData, error: agendamentosError } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('barbearia_id', userProfile.barbearia_id)
      .order('created_at', { ascending: false })
      .order('data_agendamento', { ascending: false });
    
    if (agendamentosError) throw agendamentosError;
    setAgendamentos(agendamentosData || []);
    console.log('✅ Agendamentos carregados:', (agendamentosData || []).length);

    // Carregar barbeiros APENAS desta barbearia
    const { data: barbeirosData, error: barbeirosError } = await supabase
      .from('barbeiros')
      .select('*')
      .eq('barbearia_id', userProfile.barbearia_id)
      .order('nome');
    
    if (barbeirosError) throw barbeirosError;
    setBarbeiros(barbeirosData || []);
    console.log('✅ Barbeiros carregados:', (barbeirosData || []).length);

    // Carregar histórico APENAS desta barbearia
    const { data: historicoData, error: historicoError } = await supabase
      .from('historico_agendamentos')
      .select('*')
      .eq('barbearia_id', userProfile.barbearia_id)
      .order('data_acao', { ascending: false });
    
    if (historicoError) throw historicoError;
    setHistoricoConfirmados(historicoData || []);
    
    // Carregar clientes APENAS desta barbearia
    const { data: clientesData, error: clientesError } = await supabase
      .from('clientes')
      .select('*')
      .eq('barbearia_id', userProfile.barbearia_id)
      .order('data_cadastro', { ascending: false });
    
    if (clientesError) {
      console.log('⚠️ Tabela clientes não existe ainda, será criada automaticamente');
      setClientes([]);
    } else {
      setClientes(clientesData || []);
      console.log('✅ Clientes carregados:', (clientesData || []).length);
    }

    // Carregar configurações APENAS desta barbearia
    const { data: configData, error: configError } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('chave', 'min_agendamentos_ativo')
      .eq('barbearia_id', userProfile.barbearia_id)
      .single();
    
    if (configError) {
      console.log('⚠️ Configuração não encontrada, usando padrão (3)');
    } else {
      setMinAgendamentosAtivo(parseInt(configData.valor) || 3);
      console.log('✅ Configuração carregada:', configData.valor);
    }
    
    // Carregar horários APENAS desta barbearia
    const { data: horariosData, error: horariosError } = await supabase
      .from('horarios_funcionamento')
      .select('*')
      .eq('barbearia_id', userProfile.barbearia_id)
      .order('dia_semana_numero');
    
    if (horariosError) {
      console.log('⚠️ Erro ao carregar horários:', horariosError);
      setHorariosFuncionamento([]);
    } else {
      setHorariosFuncionamento(horariosData || []);
      console.log('✅ Horários carregados:', (horariosData || []).length);
    }
    
    console.log('✅ Histórico carregado:', (historicoData || []).length);
    
    // Calcular faturamentos
    calcularFaturamentos(historicoData || []);
    
    // Atualizar timestamp
    setLastUpdate(getBrasiliaDate());
    console.log('✅ Todos os dados carregados com sucesso para barbearia:', userProfile.barbearia_id);

  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);
  } finally {
    if (showLoadingState) setIsLoading(false);
  }
}, [userProfile?.barbearia_id]);

  // 🔔 VERIFICAR AGENDAMENTOS NÃO NOTIFICADOS
  const verificarAgendamentosNaoNotificados = useCallback(async () => {
    console.log('🔍 === VERIFICANDO AGENDAMENTOS NÃO NOTIFICADOS ===');
    
    try {
      // Buscar agendamentos com notificado = false
const { data: agendamentosNaoNotificados, error } = await supabase
  .from('agendamentos')
  .select('*')
  .eq('barbearia_id', userProfile.barbearia_id)
  .eq('notificado', false)
  .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      console.log('📋 Agendamentos não notificados encontrados:', agendamentosNaoNotificados?.length || 0);
      
      if (agendamentosNaoNotificados && agendamentosNaoNotificados.length > 0) {
        for (const agendamento of agendamentosNaoNotificados) {
          console.log('🔔 Processando agendamento não notificado:', agendamento.id);
          
          // Simular payload do real-time
          const payload = {
            eventType: 'INSERT',
            new: agendamento,
            schema: 'public',
            table: 'agendamentos'
          };
          
          // Processar notificação
          await detectarNovoAgendamento(payload);
          
          // Marcar como notificado
          await marcarComoNotificado(agendamento.id);
          
          // Pequeno delay entre processamentos
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('✅ Todos os agendamentos não notificados foram processados');
      }
      
    } catch (error) {
      console.error('❌ Erro ao verificar agendamentos não notificados:', error);
    }
  }, [detectarNovoAgendamento, marcarComoNotificado, userProfile?.barbearia_id]);

// 🛡️ FUNÇÃO SEGURA PARA PARSEAR SERVIÇOS
const parseServicos = (servicos) => {
  try {
    if (!servicos) return [];
    if (Array.isArray(servicos)) return servicos;
    if (typeof servicos === 'string') {
      // Tentar fazer parse como JSON
      const parsed = JSON.parse(servicos);
      if (Array.isArray(parsed)) return parsed;
      // Se não for array, tratar como string simples
      return [servicos];
    }
    return [];
  } catch (error) {
    console.log('Erro ao parsear serviços:', servicos, error);
    // Se der erro no parse, tratar como string simples
    return typeof servicos === 'string' ? [servicos] : [];
  }
};
// 🐛 DEBUG: Verificar valores de ativo
const isAtivo = (ativo) => {
  console.log('🔍 Valor do ativo:', ativo, 'Tipo:', typeof ativo);
  return ativo === 'true' || ativo === true || ativo === 1;
};

// 🎉 MOSTRAR POPUP DE SUCESSO COM SEGURANÇA
const mostrarPopupSucesso = (mensagem) => {
  // Limpar timeout anterior se existir
  if (popupTimeout) {
    clearTimeout(popupTimeout);
    setPopupTimeout(null);
  }
  
  // Garantir que popup está fechado primeiro
  setShowSuccessPopup(false);
  setSuccessMessage('');
  
  // Aguardar um momento e mostrar popup
  setTimeout(() => {
    setSuccessMessage(mensagem);
    setShowSuccessPopup(true);
    
    // Configurar fechamento automático
    const timeout = setTimeout(() => {
      setShowSuccessPopup(false);
      setSuccessMessage('');
      setPopupTimeout(null);
    }, 3000);
    
    setPopupTimeout(timeout);
  }, 100);
};
// 🚀 ABRIR MODAL DE NOVO PROFISSIONAL (GLOBAL)
const abrirModalNovo = () => {
  setProfissionalEditando(null);
  setDadosProfissional({
    nome: '',
    servicos: [],
    horario_inicio_manha: '08:00',
    horario_fim_manha: '12:00',
    horario_inicio_tarde: '14:00',
    horario_fim_tarde: '18:00',
    ativo: 'true'
  });
  setShowProfissionalModal(true);
};

// 📊 ATUALIZAR CONTADOR DE AGENDAMENTOS DO CLIENTE ATIVO
const atualizarContadorCliente = async (telefoneCliente, cpfCliente) => {
  try {
    // Encontrar cliente existente
    let criterioIdentificacao = null;
    let valorCriterio = null;
    
    if (telefoneCliente && telefoneCliente.trim() !== '') {
      criterioIdentificacao = 'telefone';
      valorCriterio = telefoneCliente.trim();
    } else if (cpfCliente && cpfCliente.trim() !== '') {
      criterioIdentificacao = 'cpf';
      valorCriterio = cpfCliente.trim();
    } else {
      return;
    }
    
    const clienteExistente = clientes.find(c => {
      if (criterioIdentificacao === 'telefone') {
        return c.telefone === valorCriterio;
      } else {
        return c.cpf === valorCriterio;
      }
    });
    
    if (clienteExistente) {
      // Recalcular total de agendamentos
      const agendamentosConfirmados = historicoConfirmados.filter(h => {
        if (criterioIdentificacao === 'telefone') {
          return h.cliente_telefone === valorCriterio && h.status === 'confirmado';
        } else {
          return h.cliente_cpf === valorCriterio && h.status === 'confirmado';
        }
      });
      
      const novoTotal = agendamentosConfirmados.length;
      console.log(`📊 Atualizando contador do cliente ${clienteExistente.nome}: ${novoTotal} agendamentos`);
      
      // Atualizar no Supabase
const { error } = await supabase
  .from('clientes')
  .update({ 
    total_agendamentos: novoTotal,
    data_ultimo_agendamento: getBrasiliaDate().toISOString().split('T')[0]
  })
  .eq('id', clienteExistente.id)
  .eq('barbearia_id', userProfile?.barbearia_id);
      
      if (!error) {
        // Atualizar no estado local
        setClientes(prev => prev.map(c => 
          c.id === clienteExistente.id 
            ? { ...c, total_agendamentos: novoTotal, data_ultimo_agendamento: getBrasiliaDate().toISOString().split('T')[0] }
            : c
        ));
        console.log('✅ Contador atualizado com sucesso!');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao atualizar contador:', error);
  }
};
// 🤖 VERIFICAR E CADASTRAR CLIENTE AUTOMATICAMENTE
const verificarECadastrarCliente = async (nomeCliente, telefoneCliente, cpfCliente) => {
  try {
    console.log('🤖 === VERIFICANDO SE CLIENTE DEVE SER CADASTRADO ===');
    console.log('📋 Cliente:', nomeCliente);
    console.log('📞 Telefone:', telefoneCliente);
    console.log('🆔 CPF:', cpfCliente);
    console.log('📋 Mínimo de agendamentos:', minAgendamentosAtivo);
    
    // Definir critério de identificação: telefone primeiro, depois CPF
    let criterioIdentificacao = null;
    let valorCriterio = null;
    
    if (telefoneCliente && telefoneCliente.trim() !== '') {
      criterioIdentificacao = 'telefone';
      valorCriterio = telefoneCliente.trim();
    } else if (cpfCliente && cpfCliente.trim() !== '') {
      criterioIdentificacao = 'cpf';
      valorCriterio = cpfCliente.trim();
    } else {
      console.log('⚠️ Cliente sem telefone nem CPF, não pode ser identificado uniquamente');
      return;
    }
    
    console.log('🔍 Identificando cliente por:', criterioIdentificacao, '=', valorCriterio);
    
    // Verificar se já está cadastrado (por telefone OU CPF)
    const clienteExistente = clientes.find(c => {
      if (criterioIdentificacao === 'telefone') {
        return c.telefone === valorCriterio;
      } else {
        return c.cpf === valorCriterio;
      }
    });
    
if (clienteExistente) {
  console.log('✅ Cliente já cadastrado com este', criterioIdentificacao + ':', valorCriterio);
  console.log('📋 Nome no cadastro:', clienteExistente.nome);
  
  // Atualizar contador mesmo se já for ativo
  await atualizarContadorCliente(telefoneCliente, cpfCliente);
  return;
}
    // Contar agendamentos confirmados usando o mesmo critério
    const agendamentosConfirmados = historicoConfirmados.filter(h => {
      if (criterioIdentificacao === 'telefone') {
        return h.cliente_telefone === valorCriterio && h.status === 'confirmado';
      } else {
        return h.cliente_cpf === valorCriterio && h.status === 'confirmado';
      }
    });
    
    console.log('📊 Agendamentos confirmados do', criterioIdentificacao, valorCriterio + ':', agendamentosConfirmados.length);
    console.log('📊 Detalhes dos agendamentos:', agendamentosConfirmados.map(h => ({
      nome: h.cliente_nome,
      data: h.data_agendamento,
      servico: h.servico,
      telefone: h.cliente_telefone,
      cpf: h.cliente_cpf
    })));
    
    // Verificar se atingiu o mínimo
    if (agendamentosConfirmados.length >= minAgendamentosAtivo) {
      console.log('🎉 Cliente atingiu o mínimo! Cadastrando automaticamente...');
      
      // Dados do primeiro e último agendamento
      const primeiroAgendamento = agendamentosConfirmados.sort((a, b) => 
        new Date(a.data_agendamento) - new Date(b.data_agendamento)
      )[0];
      
      const ultimoAgendamento = agendamentosConfirmados.sort((a, b) => 
        new Date(b.data_agendamento) - new Date(a.data_agendamento)
      )[0];
      
      // Usar o nome mais completo encontrado nos agendamentos
      const nomesMaisCompletos = agendamentosConfirmados
        .map(h => h.cliente_nome)
        .sort((a, b) => b.length - a.length); // Ordenar por comprimento, maior primeiro
      
      const nomeCompleto = nomesMaisCompletos[0] || nomeCliente;
      
      console.log('📝 Nome mais completo encontrado:', nomeCompleto);
      
      // Criar registro na tabela clientes
      const novoCliente = {
        nome: nomeCompleto, // Usar o nome mais completo
        telefone: telefoneCliente || '',
        cpf: cpfCliente || '',
        data_cadastro: getBrasiliaDate().toISOString().split('T')[0],
        status: 'ativo',
        total_agendamentos: agendamentosConfirmados.length,
        data_primeiro_agendamento: primeiroAgendamento.data_agendamento,
        data_ultimo_agendamento: ultimoAgendamento.data_agendamento,
        created_at: getBrasiliaDate().toISOString(),
        barbearia_id: userProfile?.barbearia_id
      };

const { error } = await supabase
  .from('clientes')
  .insert([{
    ...novoCliente,
    barbearia_id: userProfile?.barbearia_id
  }]);
      
      if (error) {
        console.error('❌ Erro ao cadastrar cliente:', error);
        console.log('🔧 Tentando salvar no localStorage...');
        
        // Usar localStorage temporariamente se tabela não existir
        const clientesLocal = JSON.parse(localStorage.getItem('clientes_ativos') || '[]');
        clientesLocal.push({...novoCliente, id: Date.now()});
        localStorage.setItem('clientes_ativos', JSON.stringify(clientesLocal));
        
        setClientes(prev => [{...novoCliente, id: Date.now()}, ...prev]);
        
        console.log('✅ Cliente salvo temporariamente no localStorage!');
      } else {
        console.log('✅ Cliente cadastrado com sucesso no Supabase!');
        
        // Atualizar lista local
        setClientes(prev => [novoCliente, ...prev]);
      }
      
      // Notificação de novo cliente ativo
      addNotificationReal(
        'novo_cliente_ativo',
        '🎉 Novo Cliente Ativo!',
        `${nomeCompleto} se tornou cliente ativo com ${agendamentosConfirmados.length} agendamentos`,
        `🎉 Parabéns! ${nomeCompleto} se tornou um cliente ativo!\n\n📞 Telefone: ${telefoneCliente || 'N/A'}\n🆔 CPF: ${cpfCliente || 'N/A'}\n📊 Total de agendamentos: ${agendamentosConfirmados.length}\n📅 Primeiro agendamento: ${new Date(primeiroAgendamento.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')}\n📅 Último agendamento: ${new Date(ultimoAgendamento.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')}\n\n✅ Cliente cadastrado automaticamente no sistema!\n🔍 Identificado por: ${criterioIdentificacao.toUpperCase()}`
      );
      
    } else {
      console.log(`📊 Cliente ainda não atingiu o mínimo (${agendamentosConfirmados.length}/${minAgendamentosAtivo})`);
      console.log(`🔍 Identificação por ${criterioIdentificacao}:`, valorCriterio);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar/cadastrar cliente:', error);
  }
};


// 📊 CARREGAR DADOS INICIAL (APENAS DADOS REAIS)
useEffect(() => {
  console.log('🚀 === INICIANDO CARREGAMENTO DE DADOS REAIS ===');
  
 const inicializarApp = async () => {
  // Verificar se tem barbearia_id antes de carregar
  if (!userProfile?.barbearia_id) {
    console.log('❌ Sem barbearia_id, aguardando...');
    return;
  }
  
  console.log('🚀 Inicializando app para barbearia:', userProfile.barbearia_id);
  
  // Carregar dados primeiro
  await loadData(true);
    
    // Processar agendamentos pendentes automaticamente
    await processarAgendamentosPendentes();
    
    // Depois verificar notificações perdidas
    await verificarAgendamentosNaoNotificados();
  };
  
  inicializarApp();
  
  console.log('📱 Aguardando novos agendamentos via Real-time...');
  console.log('🔔 Sistema de notificações do dia ativo com reset automático à meia-noite');
  console.log('✅ Sistema configurado para notificações REAIS apenas');
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [loadData, verificarAgendamentosNaoNotificados, userProfile]);

// 🔄 SISTEMA DE POLLING RÁPIDO (substitui real-time temporariamente)
useEffect(() => {
  console.log('🔄 === CONFIGURANDO POLLING RÁPIDO ===');
  console.log('⚠️ Real-time Supabase não disponível, usando polling');
  
  let ultimoAgendamento = null;
  
  const verificarNovosAgendamentos = async () => {
    try {
const { data, error } = await supabase
  .from('agendamentos')
  .select('*')
  .eq('barbearia_id', userProfile?.barbearia_id)
  .order('created_at', { ascending: false })
  .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const agendamentoMaisRecente = data[0];
        
        // Verificar se é um novo agendamento
        if (ultimoAgendamento && 
            agendamentoMaisRecente.id !== ultimoAgendamento.id) {
          
          console.log('🆕 === NOVO AGENDAMENTO DETECTADO VIA POLLING ===');
          console.log('📋 Agendamento:', agendamentoMaisRecente);
          
          // Simular payload do real-time
          const payload = {
            eventType: 'INSERT',
            new: agendamentoMaisRecente,
            schema: 'public',
            table: 'agendamentos'
          };
          
          // Processar como se fosse real-time
          await detectarNovoAgendamento(payload);
          // Marcar como notificado
          await marcarComoNotificado(agendamentoMaisRecente.id);
          // Atualizar estado
          setAgendamentos(prev => {
            const jaExiste = prev.find(a => a.id === agendamentoMaisRecente.id);
            if (jaExiste) return prev;
            return [agendamentoMaisRecente, ...prev];
          });
          
          // Recarregar todos os dados
          setTimeout(() => loadData(false), 1000);
        }
        
        ultimoAgendamento = agendamentoMaisRecente;
      }
      
    } catch (error) {
      console.error('❌ Erro no polling:', error);
    }
  };
  
  // Verificar a cada 3 segundos
  const pollingInterval = setInterval(verificarNovosAgendamentos, 3000);
  
  // Primeira verificação
  verificarNovosAgendamentos();
  
  return () => {
    console.log('🧹 Removendo polling rápido');
    clearInterval(pollingInterval);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [detectarNovoAgendamento, loadData, marcarComoNotificado]);

// 🔄 RECALCULAR HORÁRIOS QUANDO SERVIÇOS MUDAREM
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  // Só recalcular se já tem barbeiro e data selecionados
  if (dadosAgendamento.barbeiro_selecionado && 
      dadosAgendamento.data_agendamento && 
      dadosAgendamento.servicos_selecionados.length > 0) {
    
    console.log('🔄 Serviços mudaram, recalculando horários...');
    console.log('📋 Serviços selecionados:', dadosAgendamento.servicos_selecionados);
    
    // Limpar horário selecionado atual
    setHorarioSelecionado('');
    
    // Recalcular horários disponíveis
    calcularHorariosDisponiveis(
      dadosAgendamento.barbeiro_selecionado, 
      dadosAgendamento.data_agendamento
    );
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [dadosAgendamento.servicos_selecionados]);
// 🎁 IDENTIFICAR SE É COMBO E QUAL TIPO
const identificarTipoCombo = (servicoNome) => {
  if (!servicoNome) return null;
  
  // Procurar na lista de serviços/combos disponíveis
  const servicoEncontrado = servicosDisponiveis.find(s => {
    // Comparar nome exato primeiro
    if (s.nome.toLowerCase().trim() === servicoNome.toLowerCase().trim()) {
      return true;
    }
    
    // Se não encontrou exato, tentar busca por similaridade alta (80% de match)
    const palavrasServico = servicoNome.toLowerCase().split(/[\s+]+/).filter(p => p.length > 2);
    const palavrasCombo = s.nome.toLowerCase().split(/[\s+]+/).filter(p => p.length > 2);
    
    let matches = 0;
    palavrasServico.forEach(palavra => {
      if (palavrasCombo.some(p => p.includes(palavra) || palavra.includes(p))) {
        matches++;
      }
    });
    
    // Se tem pelo menos 80% de match nas palavras
    return matches >= Math.ceil(palavrasServico.length * 0.8);
  });
  
  if (servicoEncontrado && servicoEncontrado.Combo && servicoEncontrado.Combo !== 'Serviço') {
    return servicoEncontrado.Combo;
  }
  
  // Fallback: analisar padrões do nome para determinar tipo de combo
  const nomeNormalizado = servicoNome.toLowerCase();
  if (nomeNormalizado.includes('+')) {
    // Baseado na quantidade de serviços
    const qtdServicos = (nomeNormalizado.match(/\+/g) || []).length + 1;
    
    // Baseado em padrões específicos
    if (nomeNormalizado.includes('hidratacao') && nomeNormalizado.includes('sobrancelha') && nomeNormalizado.includes('barba')) {
      return 'Diamante'; // Combo completo
    }
    if (nomeNormalizado.includes('barba') && nomeNormalizado.includes('sobrancelha')) {
      return 'Ouro';
    }
    if (nomeNormalizado.includes('barba') || nomeNormalizado.includes('hidratacao')) {
      return 'Prata';
    }
    if (nomeNormalizado.includes('sobrancelha')) {
      return 'Bronze';
    }
    
    // Fallback por quantidade
    if (qtdServicos >= 4) return 'Diamante';
    if (qtdServicos === 3) return 'Ouro';
    if (qtdServicos === 2) return 'Bronze';
    
    return 'Combo';
  }
  
  return null;
};

const CustomDatePicker = ({ value, onChange, label }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };
  
  const formatDateForValue = (day, month, year) => {
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDay = new Date(year, month, -i);
      days.push({ day: prevDay.getDate(), isCurrentMonth: false, date: prevDay });
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({ day, isCurrentMonth: true, date });
    }
    
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const nextDate = new Date(year, month + 1, day);
      days.push({ day, isCurrentMonth: false, date: nextDate });
    }
    
    return days;
  };
  
  const handleDateSelect = (dateObj) => {
    const formattedDate = formatDateForValue(dateObj.day, dateObj.date.getMonth() + 1, dateObj.date.getFullYear());
    onChange(formattedDate);
    setShowCalendar(false);
  };
  
  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const days = getDaysInMonth(currentDate);
  
  return (
    <>
      <div style={{ position: 'relative', width: '100%' }}>
        {label && (
          <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
            {label}
          </label>
        )}
        
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            fontSize: '14px',
            boxSizing: 'border-box',
            background: '#FFFFFF',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span style={{ color: value ? '#1E293B' : '#94A3B8' }}>
            {value ? formatDateForDisplay(value) : 'Selecione uma data'}
          </span>
          <Calendar size={16} color="#64748B" />
        </button>
      </div>

      {/* MODAL OVERLAY - SEMPRE PERFEITO */}
      {showCalendar && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowCalendar(false)}
        >
          <div 
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              padding: '24px',
              width: '100%',
              maxWidth: '320px',
              animation: 'slideUp 0.3s ease-out forwards'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ArrowLeft size={16} color="#64748B" />
              </button>
              
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: '#1E293B', 
                margin: 0,
                textAlign: 'center',
                flex: 1,
                padding: '0 16px'
              }}>
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              
              <button
                type="button"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ArrowLeft size={16} color="#64748B" style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>
            
            {/* Dias da Semana */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px',
              marginBottom: '12px'
            }}>
              {weekDays.map(day => (
                <div key={day} style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748B',
                  padding: '8px 4px'
                }}>
                  {day}
                </div>
              ))}
            </div>
            
            {/* Grid dos Dias */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px',
              marginBottom: '20px'
            }}>
              {days.map((dayObj, index) => {
                const isSelected = selectedDate && 
                  dayObj.date.getDate() === selectedDate.getDate() &&
                  dayObj.date.getMonth() === selectedDate.getMonth() &&
                  dayObj.date.getFullYear() === selectedDate.getFullYear();
                
                const isToday = dayObj.date.toDateString() === new Date().toDateString();
                
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => dayObj.isCurrentMonth && handleDateSelect(dayObj)}
                    style={{
                      padding: '10px 4px',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      cursor: dayObj.isCurrentMonth ? 'pointer' : 'default',
                      background: isSelected ? '#3B82F6' : isToday ? '#F0F9FF' : 'transparent',
                      color: isSelected ? '#FFFFFF' : 
                             isToday ? '#3B82F6' :
                             dayObj.isCurrentMonth ? '#1E293B' : '#CBD5E1',
                      fontWeight: isSelected || isToday ? '600' : '400',
                      transition: 'all 0.2s',
                      minHeight: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {dayObj.day}
                  </button>
                );
              })}
            </div>
            
            {/* Footer com botões */}
            <div style={{
              display: 'flex',
              gap: '12px',
              paddingTop: '20px',
              borderTop: '1px solid #F1F5F9'
            }}>
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setShowCalendar(false);
                }}
                style={{
                  flex: 1,
                  background: '#F8FAFC',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Limpar
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const todayFormatted = formatDateForValue(today.getDate(), today.getMonth() + 1, today.getFullYear());
                  onChange(todayFormatted);
                  setShowCalendar(false);
                }}
                style={{
                  flex: 1,
                  background: '#3B82F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Hoje
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
// 🕐 COMPONENTE TIMEPICKER CUSTOMIZADO
// eslint-disable-next-line no-unused-vars
const CustomTimePicker = ({ value, onChange, label, placeholder = "Selecionar horário" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState(value || '');
  
  // Gerar opções de horário (00:00 até 23:45, de 15 em 15 minutos)
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeStr);
      }
    }
    return options;
  };
  
  const timeOptions = generateTimeOptions();
  
  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    onChange(time + ':00'); // Adicionar segundos
    setIsOpen(false);
  };
  
  const formatTimeForDisplay = (timeStr) => {
    if (!timeStr) return placeholder;
    return timeStr.substring(0, 5); // Mostrar apenas HH:MM
  };
  
  return (
    <div style={{ position: 'relative', marginBottom: '16px' }}>
      {label && (
        <label style={{
          fontSize: '12px',
          color: '#64748B',
          fontWeight: '500',
          marginBottom: '4px',
          display: 'block'
        }}>
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '12px',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          fontSize: '16px',
          textAlign: 'left',
          background: '#FFFFFF',
          color: selectedTime ? '#1E293B' : '#94A3B8',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        {formatTimeForDisplay(selectedTime)}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          maxHeight: '300px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #F1F5F9',
            background: '#F8FAFC'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#1E293B',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              Selecionar Horário
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          
          <div style={{
            maxHeight: '250px',
            overflow: 'auto',
            padding: '8px 0'
          }}>
            {timeOptions.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => handleTimeSelect(time)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: selectedTime?.substring(0, 5) === time ? '#F0FDF4' : 'transparent',
                  color: selectedTime?.substring(0, 5) === time ? '#10B981' : '#1E293B',
                  fontSize: '14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: selectedTime?.substring(0, 5) === time ? '600' : '400',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (selectedTime?.substring(0, 5) !== time) {
                    e.target.style.background = '#F8FAFC';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTime?.substring(0, 5) !== time) {
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                {time}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
// 📋 COMPONENTE SELECT CUSTOMIZADO
// eslint-disable-next-line no-unused-vars
const CustomSelect = ({ value, onChange, options, label, placeholder = "Selecionar..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');
  
  const selectedOption = options.find(opt => opt.value === selectedValue);
  
  const handleSelect = (optionValue) => {
    setSelectedValue(optionValue);
    onChange(optionValue);
    setIsOpen(false);
  };
  
  return (
    <div style={{ position: 'relative', marginBottom: '16px' }}>
      <label style={{
        fontSize: '12px',
        color: '#64748B',
        fontWeight: '500',
        marginBottom: '4px',
        display: 'block'
      }}>
        {label}
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '12px',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          fontSize: '16px',
          textAlign: 'left',
          background: '#FFFFFF',
          color: selectedValue ? '#1E293B' : '#94A3B8',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        {selectedOption ? selectedOption.label : placeholder}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: selectedValue === option.value ? '#F0FDF4' : 'transparent',
                color: selectedValue === option.value ? '#10B981' : '#1E293B',
                fontSize: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: selectedValue === option.value ? '600' : '400'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// 🔄 MAPEAR SERVIÇOS DO AGENDAMENTO PARA IDS
const mapearServicosParaIds = (servicosString) => {
  if (!servicosString) return [];
  
  const nomesServicos = servicosString.split(',').map(s => s.trim());
  const idsEncontrados = [];
  
  nomesServicos.forEach(nomeServico => {
    const servico = servicosDisponiveis.find(s => 
      s.nome.toLowerCase() === nomeServico.toLowerCase()
    );
    if (servico) {
      idsEncontrados.push(servico.id);
    }
  });
  
  return idsEncontrados;
};
// 🕐 CALCULAR HORA DE FIM BASEADA NA DURAÇÃO DOS SERVIÇOS
const calcularHoraFim = (horaInicio, valorTotal) => {
  const duracaoTotal = dadosAgendamento.servicos_selecionados.reduce((total, servicoId) => {
    const servico = servicosDisponiveis.find(s => s.id === servicoId);
    return total + (servico?.duracao_minutos || 30);
  }, 0) || 30;

  const [horas, minutos] = horaInicio.split(':').map(Number);
  const minutosInicio = horas * 60 + minutos;
  const minutosFim = minutosInicio + duracaoTotal;
  
  const horasFim = Math.floor(minutosFim / 60);
  const minutosFimFormatados = minutosFim % 60;
  
  return `${horasFim.toString().padStart(2, '0')}:${minutosFimFormatados.toString().padStart(2, '0')}:00`;
};

// 🕐 CALCULAR HORÁRIOS DISPONÍVEIS
const calcularHorariosDisponiveis = (barbeiro_id, data_selecionada) => {
// 🕐 CALCULAR DURAÇÃO EXATA DOS SERVIÇOS SELECIONADOS
  let duracaoTotal = 0;
  
  console.log('🔍 === CALCULANDO DURAÇÃO ===');
  console.log('📋 Serviços selecionados (IDs):', dadosAgendamento.servicos_selecionados);
  console.log('📋 Serviços disponíveis total:', servicosDisponiveis.length);
  
  // SEMPRE somar as durações individuais dos serviços selecionados
  duracaoTotal = dadosAgendamento.servicos_selecionados.reduce((total, servicoId) => {
    const servico = servicosDisponiveis.find(s => s.id === servicoId);
    
    if (servico) {
      const duracao = servico.duracao_minutos || 30;
      console.log(`✅ Serviço encontrado: ${servico.nome} - ${duracao} min`);
      return total + duracao;
    } else {
      console.log(`❌ Serviço não encontrado para ID: ${servicoId}`);
      return total + 30; // Fallback de 30 min
    }
  }, 0);
  
  console.log('⏱️ DURAÇÃO TOTAL CALCULADA:', duracaoTotal, 'minutos');
  
  // Garantir duração mínima
  if (duracaoTotal <= 0) {
    duracaoTotal = 30;
    console.log('⚠️ Usando duração padrão de 30 minutos');
  }

  // Verificar se a data selecionada é hoje
  const hoje = getBrasiliaDateString();
  const isHoje = data_selecionada === hoje;
  
  // Se for hoje, calcular horário mínimo (agora + 15 minutos)
  let horarioMinimoMinutos = 0;
  if (isHoje) {
    const agora = getBrasiliaDate();
    const horaAtual = agora.getHours();
    const minutoAtual = agora.getMinutes();
    
    // Hora atual + 15 minutos
    let horarioMinimo = horaAtual * 60 + minutoAtual + 15;
    
    // Arredondar para o próximo slot de 30 em 30 minutos
    // Arredondar para o próximo slot baseado na duração exata
    horarioMinimo = Math.ceil(horarioMinimo / duracaoTotal) * duracaoTotal;
    
    horarioMinimoMinutos = horarioMinimo;
    
    console.log('📅 Agendamento para hoje!');
    console.log('🕐 Hora atual:', `${horaAtual}:${minutoAtual.toString().padStart(2, '0')}`);
    console.log('⏰ Horário mínimo para agendamento:', `${Math.floor(horarioMinimo / 60)}:${(horarioMinimo % 60).toString().padStart(2, '0')}`);
  }

// Obter horário do dia da semana selecionado
const dataSelecionada = new Date(data_selecionada + 'T00:00:00');
const diaSemana = dataSelecionada.getDay(); // 0 = Domingo, 1 = Segunda, etc.

const horarioDia = horariosFuncionamento.find(h => h.dia_semana_numero === diaSemana);

if (!horarioDia || !horarioDia.ativo) {
  console.log('🔒 Barbearia fechada neste dia');
  setHorariosDisponiveis([]);
  return;
}

// Montar períodos do dia baseado na tabela
const periodos = [];

// Adicionar manhã se existir
if (horarioDia.hora_inicio_manha && horarioDia.hora_fim_manha) {
  periodos.push({
    inicio: horarioDia.hora_inicio_manha.substring(0, 5),
    fim: horarioDia.hora_fim_manha.substring(0, 5),
    nome: 'Manhã'
  });
}

// Adicionar tarde se existir
if (horarioDia.hora_inicio_tarde && horarioDia.hora_fim_tarde) {
  periodos.push({
    inicio: horarioDia.hora_inicio_tarde.substring(0, 5),
    fim: horarioDia.hora_fim_tarde.substring(0, 5),
    nome: 'Tarde'
  });
}

console.log('📅 Horários do dia:', horarioDia.dia_semana, periodos);

  const slotsDisponiveis = [];

  periodos.forEach(periodo => {
    const [horaInicio, minInicio] = periodo.inicio.split(':').map(Number);
    const [horaFim, minFim] = periodo.fim.split(':').map(Number);
    
    const inicioMinutos = horaInicio * 60 + minInicio;
    const fimMinutos = horaFim * 60 + minFim;

// Gerar slots baseados na duração do serviço/combo
// Usar a duração EXATA do serviço/combo como incremento
    const incremento = duracaoTotal;
    
    console.log('⏱️ Duração do serviço/combo:', duracaoTotal, 'min');
    console.log('📊 Incremento de slots:', incremento, 'min');
    
    // Gerar slots com a duração exata
    for (let minutos = inicioMinutos; minutos + duracaoTotal <= fimMinutos; minutos += incremento) {
      // Se for hoje, verificar se o horário é >= horário mínimo
      if (isHoje && minutos < horarioMinimoMinutos) {
        continue; // Pular este horário pois já passou
      }
      
      const horas = Math.floor(minutos / 60);
      const mins = minutos % 60;
      const horarioFormatado = `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      
// Calcular horário de fim do slot
      const minutosInicioSlot = minutos;
      const minutosFimSlot = minutos + duracaoTotal;
      const horasFim = Math.floor(minutosFimSlot / 60);
      const minsFim = minutosFimSlot % 60;
      const horarioFimFormatado = `${horasFim.toString().padStart(2, '0')}:${minsFim.toString().padStart(2, '0')}`;
      
      // Verificar se TODO o período está livre (não apenas o horário de início)
      const conflito = agendamentos.find(agendamento => {
        if (agendamento.barbeiro_id !== barbeiro_id ||
            agendamento.data_agendamento !== data_selecionada ||
            agendamento.status !== 'agendado' ||
            agendamento.id === agendamentoEditando?.id) {
          return false;
        }
        
        // Converter horários do agendamento existente para minutos
        const [horaInicioExistente, minInicioExistente] = agendamento.hora_inicio.split(':').map(Number);
        const [horaFimExistente, minFimExistente] = agendamento.hora_fim.split(':').map(Number);
        
        const inicioExistenteMinutos = horaInicioExistente * 60 + minInicioExistente;
        const fimExistenteMinutos = horaFimExistente * 60 + minFimExistente;
        
        // Verificar se há sobreposição de horários
        const hasConflito = !(minutosFimSlot <= inicioExistenteMinutos || minutosInicioSlot >= fimExistenteMinutos);
        
        if (hasConflito) {
          console.log('⚠️ Conflito detectado:', {
            novoSlot: `${horarioFormatado} - ${horarioFimFormatado}`,
            agendamentoExistente: `${agendamento.hora_inicio} - ${agendamento.hora_fim}`,
            cliente: agendamento.cliente_nome
          });
        }
        
        return hasConflito;
      });

      if (!conflito) {
        slotsDisponiveis.push({
          horario: horarioFormatado,
          periodo: periodo.nome,
          disponivel: true
        });
      }
    }
  });

  console.log('⏰ Slots disponíveis:', slotsDisponiveis.length);
  setHorariosDisponiveis(slotsDisponiveis);
};
// Carregar serviços disponíveis
useEffect(() => {
  const carregarServicos = async () => {
    try {
const { data, error } = await supabase
  .from('servicos')
  .select('*')
  .eq('barbearia_id', userProfile?.barbearia_id)
  .eq('ativo', true)
  .order('nome');
      
      if (error) throw error;
      setServicosDisponiveis(data || []);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    }
  };
  carregarServicos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// 🔔 VERIFICAR PERMISSÕES E SERVICE WORKER PERIODICAMENTE
useEffect(() => {
  const verificarStatus = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        console.log('🔧 Service Worker ativo:', !!registration.active);
      });
    }
  };

  // Verificar a cada 30 segundos
  const interval = setInterval(verificarStatus, 30000);
  verificarStatus(); // Primeira verificação

  return () => clearInterval(interval);
}, []);


const moverParaHistorico = useCallback(async (agendamento, novoStatus) => {
  const historicoData = {
    id: `HIST-${agendamento.id}`,
    agendamento_original_id: agendamento.id.replace('AG-', ''),
    barbearia_id: userProfile.barbearia_id,
    cliente_nome: agendamento.cliente_nome,
    cliente_telefone: agendamento.cliente_telefone,
    cliente_cpf: agendamento.cliente_cpf || '00000000000',
    barbeiro_id: String(agendamento.barbeiro_id),
    servico: agendamento.servico,
    data_agendamento: agendamento.data_agendamento,
    hora_inicio: agendamento.hora_inicio,
    hora_fim: agendamento.hora_fim,
    status: novoStatus,
    motivo_cancelamento: novoStatus === 'não compareceu' ? 'Não compareceu' : null,
    observacoes: agendamento.observacoes || '',
    data_acao: getBrasiliaDate().toISOString(),
    nome_profissional: agendamento.nome_profissional,
    valor_servico: String(agendamento.valor_servico || '0')
  };

  const { error } = await supabase
    .from('historico_agendamentos')
    .insert([historicoData]);
  
  if (error) throw error;
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [userProfile?.barbearia_id]);

// REMOVER AGENDAMENTO
const removerAgendamento = useCallback(async (agendamentoId, barbeariaId) => {
  const { error } = await supabase
    .from('agendamentos')
    .delete()
    .eq('id', agendamentoId)
    .eq('barbearia_id', barbeariaId || userProfile?.barbearia_id);
  
  if (error) throw error;
}, [userProfile?.barbearia_id]);

  // 🌙 TIMER PARA MEIA-NOITE
  useEffect(() => {
const processarAgendamentosAutomatico = async () => {
  console.log('🌙 Processamento automático da meia-noite...');
  
// CORREÇÃO: Calcular ontem corretamente para processamento da meia-noite
const dataHoje = getBrasiliaDateString();
console.log('🌙 Data de hoje:', dataHoje);
console.log('🌙 Processamento automático da meia-noite iniciado');
  
// CORREÇÃO: Só processar agendamentos de ONTEM especificamente
const ontem = getBrasiliaDate();
ontem.setDate(ontem.getDate() - 1);
// eslint-disable-next-line no-unused-vars
const dataOntem = ontem.getFullYear() + '-' + 
                 String(ontem.getMonth() + 1).padStart(2, '0') + '-' + 
                 String(ontem.getDate()).padStart(2, '0');

console.log('🌙 Processamento da meia-noite - Data de ontem:', dataOntem);
console.log('🌙 Agendamentos totais:', agendamentos.length);

const agendamentosNaoConfirmados = agendamentos.filter(a => {
  const isOntem = a.data_agendamento === dataOntem;
  const isAgendado = a.status === 'agendado';
  const naoConfirmado = a.confirmado === 'false' || a.confirmado === false || !a.confirmado;
  
  console.log('🔍 Verificando:', a.id, {
    data: a.data_agendamento,
    isOntem,
    status: a.status,
    isAgendado,
    confirmado: a.confirmado,
    naoConfirmado
  });
  
  return isOntem && isAgendado && naoConfirmado;
});
  console.log('🌙 Agendamentos não confirmados encontrados:', agendamentosNaoConfirmados.length);

  for (const agendamento of agendamentosNaoConfirmados) {
    console.log('🔄 Processando agendamento não confirmado:', agendamento.id, agendamento.cliente_nome);
    await moverParaHistorico(agendamento, 'não compareceu');
    await removerAgendamento(agendamento.id);
  }

  if (agendamentosNaoConfirmados.length > 0) {
    console.log('✅ Recarregando dados após processamento automático');
    await loadData(false);
  }
  
  console.log('🌙 Processamento automático da meia-noite concluído!');
    };

   const meiaNoite = getBrasiliaDate();
    meiaNoite.setHours(24, 0, 0, 0);
    
    const tempoAteProcessar = meiaNoite.getTime() - getBrasiliaDate().getTime();
console.log('🌙 Timer da meia-noite configurado para:', new Date(getBrasiliaDate().getTime() + tempoAteProcessar).toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'}));
console.log('🌙 Tempo restante até processamento:', Math.floor(tempoAteProcessar / 1000 / 60), 'minutos'); 
    const timer = setTimeout(processarAgendamentosAutomatico, tempoAteProcessar);
    const intervaloDiario = setInterval(processarAgendamentosAutomatico, 24 * 60 * 60 * 1000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(intervaloDiario);
    };

    
}, [agendamentos, loadData, moverParaHistorico, removerAgendamento]);

// 🌙 RESET DE NOTIFICAÇÕES À MEIA-NOITE
useEffect(() => {
const resetarNotificacoes = () => {
  console.log('🌙 Reset de notificações à meia-noite');
  setNotifications([]);
  localStorage.removeItem('elite-notifications');
  localStorage.removeItem('pwa-testado'); // Reset do teste também
};

const meiaNoite = getBrasiliaDate();
meiaNoite.setHours(24, 0, 0, 0);
  
  const tempoAteReset = meiaNoite.getTime() - getBrasiliaDate().getTime();
  console.log('🌙 Reset agendado para:', meiaNoite.toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'}));
  
  const timer = setTimeout(resetarNotificacoes, tempoAteReset);
  const intervaloDiario = setInterval(resetarNotificacoes, 24 * 60 * 60 * 1000);
  
  return () => {
    clearTimeout(timer);
    clearInterval(intervaloDiario);
  };
}, []);
// 🧹 CLEANUP DOS TIMEOUTS DO POPUP
useEffect(() => {
  return () => {
    if (popupTimeout) {
      clearTimeout(popupTimeout);
    }
  };
}, [popupTimeout]);
  // CALCULAR FATURAMENTOS
const calcularFaturamentos = (historico) => {
  const hoje = getBrasiliaDate();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
   const hojeStr = getBrasiliaDateString();
const inicioSemanaStr = inicioSemana.toISOString().split('T')[0];
const inicioMesStr = inicioMes.toISOString().split('T')[0];
    
    const confirmados = historico.filter(h => h.status === 'confirmado');
    
    const dia = confirmados
      .filter(h => h.data_agendamento === hojeStr)
      .reduce((sum, h) => sum + parseFloat(h.valor_servico || 0), 0);
      
    const semana = confirmados
      .filter(h => h.data_agendamento >= inicioSemanaStr && h.data_agendamento <= hojeStr)
      .reduce((sum, h) => sum + parseFloat(h.valor_servico || 0), 0);
      
    const mes = confirmados
      .filter(h => h.data_agendamento >= inicioMesStr && h.data_agendamento <= hojeStr)
      .reduce((sum, h) => sum + parseFloat(h.valor_servico || 0), 0);
      
    const total = confirmados
      .reduce((sum, h) => sum + parseFloat(h.valor_servico || 0), 0);
    
    setFaturamentoDia(dia);
    setFaturamentoSemana(semana);
    setFaturamentoMes(mes);
    setFaturamentoTotal(total);
    
    console.log('💰 Faturamentos calculados:', { dia, semana, mes, total });
};

const editarAgendamento = async () => {
  try {
    if (!dadosAgendamento.nome_cliente.trim()) {
      alert('Nome do cliente é obrigatório');
      return;
    }
    if (!dadosAgendamento.data_agendamento) {
      alert('Data do agendamento é obrigatória');
      return;
    }
    if (!dadosAgendamento.telefone_cliente.trim()) {
      alert('Telefone é obrigatório');
      return;
    }
    if (dadosAgendamento.servicos_selecionados.length === 0) {
      alert('Selecione pelo menos um serviço');
      return;
    }
    if (!dadosAgendamento.barbeiro_selecionado) {
      alert('Selecione um barbeiro');
      return;
    }
    if (!horarioSelecionado) {
      alert('Selecione um horário');
      return;
    }

    // Calcular valor total dos serviços
    const valorTotal = dadosAgendamento.servicos_selecionados.reduce((total, servicoId) => {
      const servico = servicosDisponiveis.find(s => s.id === servicoId);
      return total + (servico?.preco || 0);
    }, 0);

    // Pegar nomes dos serviços
    const nomesServicos = dadosAgendamento.servicos_selecionados.map(servicoId => {
      const servico = servicosDisponiveis.find(s => s.id === servicoId);
      return servico?.nome || '';
    }).join(', ');

    // Pegar nome do barbeiro
    const barbeiro = barbeiros.find(b => b.barbeiro_id === dadosAgendamento.barbeiro_selecionado);

    const agendamentoAtualizado = {
      barbeiro_id: dadosAgendamento.barbeiro_selecionado,
      cliente_nome: dadosAgendamento.nome_cliente.trim(),
      cliente_telefone: dadosAgendamento.telefone_cliente.trim(),
      cliente_cpf: dadosAgendamento.cliente_cpf?.trim() || '',
      servico: nomesServicos,
      data_agendamento: dadosAgendamento.data_agendamento,
      hora_inicio: `${horarioSelecionado}:00`,
      hora_fim: calcularHoraFim(horarioSelecionado, valorTotal),
      nome_profissional: barbeiro?.nome || '',
      valor_servico: valorTotal.toString(),
      updated_at: getBrasiliaDate().toISOString()
    };

    console.log('📝 EDITANDO AGENDAMENTO:', agendamentoEditando.id, agendamentoAtualizado);

const { error } = await supabase
  .from('agendamentos')
  .update(agendamentoAtualizado)
  .eq('id', agendamentoEditando.id)
  .eq('barbearia_id', userProfile?.barbearia_id);

    if (error) throw error;

    // Fechar modal e limpar estados
    setShowAgendamentoModal(false);
    setAgendamentoEditando(null);
    setDadosAgendamento({
      nome_cliente: '',
      telefone_cliente: '',
      cliente_cpf: '',
      data_agendamento: '',
      servicos_selecionados: [],
      barbeiro_selecionado: ''
    });
    setHorarioSelecionado('');
    setHorariosDisponiveis([]);
    
    // Recarregar dados
    await loadData(false);
    mostrarPopupSucesso('Agendamento editado com sucesso!');

  } catch (error) {
    console.error('❌ ERRO AO EDITAR:', error);
    alert(`Erro ao editar agendamento: ${error.message}`);
  }
};

const salvarNovoAgendamento = async () => {
  try {
    if (!dadosAgendamento.nome_cliente.trim()) {
      alert('Nome do cliente é obrigatório');
      return;
    }
    if (!dadosAgendamento.data_agendamento) {
      alert('Data do agendamento é obrigatória');
      return;
    }
    if (!dadosAgendamento.telefone_cliente.trim()) {
      alert('Telefone é obrigatório');
      return;
    }
    if (dadosAgendamento.servicos_selecionados.length === 0) {
      alert('Selecione pelo menos um serviço');
      return;
    }
    if (!dadosAgendamento.barbeiro_selecionado) {
      alert('Selecione um barbeiro');
      return;
    }
if (!horarioSelecionado) {
      alert('Selecione um horário');
      return;
    }
    // Calcular valor total dos serviços
    const valorTotal = dadosAgendamento.servicos_selecionados.reduce((total, servicoId) => {
      const servico = servicosDisponiveis.find(s => s.id === servicoId);
      return total + (servico?.preco || 0);
    }, 0);

    // Pegar nomes dos serviços
    const nomesServicos = dadosAgendamento.servicos_selecionados.map(servicoId => {
      const servico = servicosDisponiveis.find(s => s.id === servicoId);
      return servico?.nome || '';
    }).join(', ');

    // Pegar nome do barbeiro
    const barbeiro = barbeiros.find(b => b.barbeiro_id === dadosAgendamento.barbeiro_selecionado);

    // Gerar ID único no formato correto
    const agendamentoId = `AG-${Math.floor(Math.random() * 99999)}`;

    const novoAgendamento = {
      id: agendamentoId,
      barbeiro_id: dadosAgendamento.barbeiro_selecionado,
      cliente_nome: dadosAgendamento.nome_cliente.trim(),
      cliente_telefone: dadosAgendamento.telefone_cliente.trim(),
      cliente_cpf: dadosAgendamento.cliente_cpf?.trim() || '',
      cliente_id: '0',
      barbearia_id: userProfile?.barbearia_id,
      servico: nomesServicos,
      data_agendamento: dadosAgendamento.data_agendamento,
      hora_inicio: `${horarioSelecionado}:00`,
      hora_fim: calcularHoraFim(horarioSelecionado, valorTotal),
      status: 'agendado',
      observacoes: '',
      nome_profissional: barbeiro?.nome || '',
      valor_servico: valorTotal.toString(),
      confirmado: 'false',
      notificado: 'true',
      lembrete_enviado: 'false',
      created_at: getBrasiliaDate().toISOString(),
      updated_at: getBrasiliaDate().toISOString()
    };

    console.log('📋 DADOS DO AGENDAMENTO:', novoAgendamento);

    const { error } = await supabase
      .from('agendamentos')
      .insert([novoAgendamento]);

    if (error) throw error;

    // Fechar modal e recarregar dados
    setShowAgendamentoModal(false);
    setDadosAgendamento({
      nome_cliente: '',
      telefone_cliente: '',
      cliente_cpf: '',
      data_agendamento: '',
      servicos_selecionados: [],
      barbeiro_selecionado: ''
    });
    setHorarioSelecionado('');
    setHorariosDisponiveis([]);
    await loadData(false);
    mostrarPopupSucesso('Agendamento criado com sucesso!');

  } catch (error) {
    console.error('❌ ERRO DETALHADO:', error);
    console.error('❌ MENSAGEM:', error.message);
    alert(`Erro ao criar agendamento: ${error.message}`);
  }
};
const abrirEdicaoAgendamento = (agendamento) => {
  console.log('✏️ Abrindo edição para:', agendamento);
  
  // Mapear serviços string → IDs
  const servicosIds = mapearServicosParaIds(agendamento.servico);
  
  // Definir agendamento sendo editado
  setAgendamentoEditando(agendamento);
  
  // Pré-preencher formulário
  setDadosAgendamento({
    nome_cliente: agendamento.cliente_nome || '',
    telefone_cliente: agendamento.cliente_telefone || '',
    cliente_cpf: agendamento.cliente_cpf || '',
    data_agendamento: agendamento.data_agendamento || '',
    servicos_selecionados: servicosIds,
    barbeiro_selecionado: agendamento.barbeiro_id || ''
  });
  
  // Pré-definir horário selecionado
  setHorarioSelecionado(agendamento.hora_inicio?.substring(0, 5) || '');
  
  // Calcular horários disponíveis para a data/barbeiro atual
  if (agendamento.barbeiro_id && agendamento.data_agendamento) {
    calcularHorariosDisponiveis(agendamento.barbeiro_id, agendamento.data_agendamento);
  }
  
  // Abrir modal
  setShowAgendamentoModal(true);
};
const cancelarAgendamento = async (agendamento) => {
  // Confirmação antes de cancelar
  const confirmacao = window.confirm(`Tem certeza que deseja cancelar o agendamento de ${agendamento.cliente_nome}?`);
  
  if (!confirmacao) return;
  
  try {
    console.log('🚫 Cancelando agendamento:', agendamento);
    
    // Remover IMEDIATAMENTE da lista de agendamentos (visual instantâneo)
    setAgendamentos(prev => prev.filter(a => a.id !== agendamento.id));
    
 // Processo no background
    await moverParaHistorico(agendamento, 'cancelado');
    await removerAgendamento(agendamento.id, userProfile?.barbearia_id);
    
    // RECARREGAR DADOS IMEDIATAMENTE
    await loadData(false);
    
    // Mostrar popup de sucesso
    mostrarPopupSucesso(`Agendamento de ${agendamento.cliente_nome} cancelado!`);
    
    // 🔔 NOTIFICAÇÃO DE CANCELAMENTO
    const mensagemDetalhada = `
🚫 Agendamento cancelado

📋 Cliente: ${agendamento.cliente_nome}
🔧 Serviço: ${agendamento.servico}
👨‍💼 Profissional: ${agendamento.nome_profissional}
📅 Data: ${new Date(agendamento.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'})}
🕐 Horário: ${agendamento.hora_inicio?.substring(0, 5)}
💰 Valor: R$ ${parseFloat(agendamento.valor_servico || 0).toFixed(2).replace('.', ',')}
    `.trim();
    
    addNotificationReal(
      'cancelamento',
      '🚫 Agendamento Cancelado',
      `${agendamento.cliente_nome} - ${agendamento.servico} cancelado`,
      mensagemDetalhada,
      agendamento
    );
    
    console.log('✅ Agendamento cancelado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao cancelar:', error);
    
    // Em caso de erro, voltar o agendamento para a lista
    setAgendamentos(prev => [...prev, agendamento].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)));
    
    // Mostrar popup de erro
    mostrarPopupSucesso(`Erro ao cancelar agendamento de ${agendamento.cliente_nome}`);
  }
};
const confirmarAgendamento = async (agendamento) => {
  // Abrir modal de confirmação primeiro
  setAgendamentoPendente(agendamento);
  setShowConfirmModal(true);
};

const executarConfirmacao = async () => {
  if (!agendamentoPendente) return;
  
  try {
    console.log('🔧 Confirmando agendamento:', agendamentoPendente);
    
    // Fechar modal primeiro
    setShowConfirmModal(false);
    setAgendamentoPendente(null);
    
    // Remover IMEDIATAMENTE da lista de agendamentos (visual instantâneo)
    setAgendamentos(prev => prev.filter(a => a.id !== agendamentoPendente.id));
    
    // Processo no background
    await moverParaHistorico(agendamentoPendente, 'confirmado');
    await removerAgendamento(agendamentoPendente.id);
    
    // Mostrar popup de sucesso
    mostrarPopupSucesso(`Agendamento de ${agendamentoPendente.cliente_nome} confirmado com sucesso!`);
    
    // 🔔 NOTIFICAÇÃO DE CONFIRMAÇÃO COM DADOS REAIS
    const mensagemDetalhada = `
✅ Agendamento confirmado com sucesso!

📋 Cliente: ${agendamentoPendente.cliente_nome}
🔧 Serviço: ${agendamentoPendente.servico}
👨‍💼 Profissional: ${agendamentoPendente.nome_profissional}
📅 Data: ${new Date(agendamentoPendente.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'})}
🕐 Horário: ${agendamentoPendente.hora_inicio?.substring(0, 5)}
💰 Valor: R$ ${parseFloat(agendamentoPendente.valor_servico || 0).toFixed(2).replace('.', ',')}
    `.trim();
    
    addNotificationReal(
      'confirmacao',
      '✅ Agendamento Confirmado!',
      `${agendamentoPendente.cliente_nome} - ${agendamentoPendente.servico} confirmado`,
      mensagemDetalhada,
      agendamentoPendente
    );
    
    // Verificar se cliente deve ser cadastrado automaticamente
    await verificarECadastrarCliente(
      agendamentoPendente.cliente_nome,
      agendamentoPendente.cliente_telefone,
      agendamentoPendente.cliente_cpf
    );
    
    console.log('✅ Agendamento confirmado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao confirmar:', error);
    
    // Em caso de erro, voltar o agendamento para a lista
    setAgendamentos(prev => [...prev, agendamentoPendente].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)));
    
    // Mostrar popup de erro
    mostrarPopupSucesso(`Erro ao confirmar agendamento de ${agendamentoPendente.cliente_nome}`);
  }
};


  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  // Métricas calculadas
const hoje = getBrasiliaDateString();
  const agendamentosHoje = agendamentos
    .filter(a => a.data_agendamento === hoje && a.status === 'agendado')
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

// 👨‍💼 MODAL DE ADICIONAR/EDITAR PROFISSIONAL
// 👨‍💼 MODAL DE ADICIONAR/EDITAR PROFISSIONAL
const ProfissionalModal = React.memo(() => {
  // Estados locais do modal para evitar re-renders do componente pai
  const [localNome, setLocalNome] = useState('');
  const [localServicos, setLocalServicos] = useState([]);
  const [localHorarioInicioManha, setLocalHorarioInicioManha] = useState('08:00');
  const [localHorarioFimManha, setLocalHorarioFimManha] = useState('12:00');
  const [localHorarioInicioTarde, setLocalHorarioInicioTarde] = useState('14:00');
  const [localHorarioFimTarde, setLocalHorarioFimTarde] = useState('18:00');
  const [localAtivo, setLocalAtivo] = useState('true');
  const [localFotoPerfil, setLocalFotoPerfil] = useState('');
  const [upappLoadingPhoto, setUpappLoadingPhoto] = useState(false);
// Sincronizar com dados globais apenas quando modal abrir
useEffect(() => {
  if (showProfissionalModal) {
    setTimeout(() => {
      setLocalNome(dadosProfissional.nome || '');
      setLocalServicos(dadosProfissional.servicos || []);
      setLocalHorarioInicioManha(dadosProfissional.horario_inicio_manha || '08:00');
      setLocalHorarioFimManha(dadosProfissional.horario_fim_manha || '12:00');
      setLocalHorarioInicioTarde(dadosProfissional.horario_inicio_tarde || '14:00');
      setLocalHorarioFimTarde(dadosProfissional.horario_fim_tarde || '18:00');
      setLocalAtivo(dadosProfissional.ativo || 'true');
      setLocalFotoPerfil(dadosProfissional.foto_url || '');
    }, 50);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [showProfissionalModal]);

const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Formato não suportado. Use JPG, PNG ou WebP');
      return;
    }
    
    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Imagem muito grande. Máximo 10MB');
      return;
    }
    
    setUpappLoadingPhoto(true);
    
    try {
      console.log('📸 Iniciando upload da foto...');
      
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `profissionais/${fileName}`;
      
      console.log('📁 Caminho do arquivo:', filePath);
      
      // Upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('fotos-profissionais')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) {
        console.error('❌ Erro no upload:', error);
        alert(`Erro ao fazer upload: ${error.message}`);
        setUpappLoadingPhoto(false);
        return;
      }
      
      console.log('✅ Upload realizado:', data);
      
      // Obter URL pública da imagem
      const { data: urlData } = supabase.storage
        .from('fotos-profissionais')
        .getPublicUrl(filePath);
      
      console.log('🔗 URL pública gerada:', urlData.publicUrl);
      
      // Salvar URL no estado local
      setLocalFotoPerfil(urlData.publicUrl);
      setUpappLoadingPhoto(false);
      
      console.log('✅ Foto processada com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro no upload:', error);
      alert('Erro ao fazer upload da foto');
      setUpappLoadingPhoto(false);
    }
  };

 const removerServicoLocal = (servicoNome) => {
    setLocalServicos(localServicos.filter(s => s !== servicoNome));
  };
const excluirProfissionalDoModal = async () => {
  const confirmacao = window.confirm(`Tem certeza que deseja excluir o profissional ${profissionalEditando.nome}?`);
  
  if (!confirmacao) return;
  
  try {
const { error } = await supabase
  .from('barbeiros')
  .delete()
  .eq('barbeiro_id', profissionalEditando.barbeiro_id)
  .eq('barbearia_id', userProfile?.barbearia_id);
    
    if (error) {
      alert('Erro ao excluir profissional');
      return;
    }
    
    // Fechar modal
    setShowProfissionalModal(false);
    setProfissionalEditando(null);
    
    // Recarregar dados
    await loadData(false);
    
    // Mostrar sucesso
    mostrarPopupSucesso(`Profissional ${profissionalEditando.nome} excluído com sucesso!`);
    
  } catch (error) {
    alert('Erro ao excluir profissional');
  }
};
const salvarProfissionalLocal = async () => {
  try {
    if (!localNome.trim()) {
      alert('Nome é obrigatório');
      return;
    }
    
    if (localServicos.length === 0) {
      alert('Adicione pelo menos um serviço');
      return;
    }
    
const dadosParaSalvar = {
  nome: localNome.trim(),
  servicos: JSON.stringify(localServicos),
  horario_inicio_manha: localHorarioInicioManha,
  horario_fim_manha: localHorarioFimManha,
  horario_inicio_tarde: localHorarioInicioTarde,
  horario_fim_tarde: localHorarioFimTarde,
  ativo: localAtivo,
  foto_url: localFotoPerfil || null,
  barbearia_id: userProfile?.barbearia_id,
};
    
    let erro = null;
    
    if (profissionalEditando) {
      // Editando profissional existente
      console.log('✏️ Editando profissional:', profissionalEditando.barbeiro_id);
      
const { error } = await supabase
  .from('barbeiros')
  .delete()
  .eq('barbeiro_id', profissionalEditando.barbeiro_id)
  .eq('barbearia_id', userProfile?.barbearia_id);
        
      erro = error;
    } else {
      // Adicionando novo profissional
      console.log('➕ Adicionando novo profissional');
      
      const { error } = await supabase
        .from('barbeiros')
        .insert([{
          ...dadosParaSalvar,
          created_at: getBrasiliaDate().toISOString()
        }]);
        
      erro = error;
    }
    
    if (erro) {
      console.error('Erro ao salvar profissional:', erro);
      alert('Erro ao salvar profissional');
      return;
    }
    
    // Recarregar dados
    await loadData(false);
    
    // Fechar modal
    setShowProfissionalModal(false);
    setProfissionalEditando(null);
    setDadosProfissional({
      nome: '',
      servicos: [],
      horario_inicio_manha: '08:00',
      horario_fim_manha: '12:00',
      horario_inicio_tarde: '14:00',
      horario_fim_tarde: '18:00',
      ativo: 'true'
    });
    
    // Mostrar popup de sucesso
    mostrarPopupSucesso(profissionalEditando ? 'Profissional editado com sucesso!' : 'Profissional adicionado com sucesso!');
    
    console.log('✅ Profissional salvo com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao salvar profissional:', error);
    alert('Erro ao salvar profissional');
  }
};

  if (!showProfissionalModal) return null;

  return (
<div 
  style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px' // ← NOVO: Espaçamento nas bordas
  }}
  onClick={(e) => {
    if (e.target === e.currentTarget) {
      setShowProfissionalModal(false);
    }
  }}
>
<div
  style={{
    background: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    padding: '32px',
    maxWidth: '600px', // ← AUMENTADO de 520px para 600px
    width: '92%', // ← AUMENTADO de 95% para 92% (mais espaço lateral)
    maxHeight: '90vh',
    overflow: 'auto',
    margin: '0 auto'
  }}
  onClick={(e) => e.stopPropagation()}
>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1E293B',
          margin: '0 0 20px 0'
        }}>
          {profissionalEditando ? '✏️ Editar Profissional' : '➕ Novo Profissional'}
        </h3>
        {/* CAMPO DE FOTO DE PERFIL */}
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <label style={{
            fontSize: '12px',
            color: '#64748B',
            fontWeight: '500',
            marginBottom: '8px',
            display: 'block'
          }}>
            Foto de Perfil
          </label>
          
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 12px',
            position: 'relative',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid #E2E8F0',
            background: localFotoPerfil ? 'transparent' : '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {localFotoPerfil ? (
              <img 
                src={localFotoPerfil} 
                alt="Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <User size={32} color="#94A3B8" />
            )}
            
            {upappLoadingPhoto && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #FFFFFF',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <label style={{
              background: '#3B82F6',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-block'
            }}>
              📷 Escolher Foto
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
                disabled={upappLoadingPhoto}
              />
            </label>
            
            {localFotoPerfil && (
              <button
                type="button"
                onClick={() => setLocalFotoPerfil('')}
                style={{
                  background: '#EF4444',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                🗑️ Remover
              </button>
            )}
          </div>
          
          <p style={{
            fontSize: '10px',
            color: '#94A3B8',
            margin: '8px 0 0 0',
            textAlign: 'center'
          }}>
            JPG, PNG ou WebP • Máximo 5MB
          </p>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            fontSize: '12px',
            color: '#64748B',
            fontWeight: '500',
            marginBottom: '4px',
            display: 'block'
          }}>
            Nome Completo *
          </label>
          <input
            type="text"
            value={localNome}
            onChange={(e) => setLocalNome(e.target.value)}
            placeholder="Ex: João Silva"
            autoComplete="off"
            autoCapitalize="words"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '16px',
              outline: 'none',
              boxSizing: 'border-box',
              WebkitAppearance: 'none'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            fontSize: '12px',
            color: '#64748B',
            fontWeight: '500',
            marginBottom: '4px',
            display: 'block'
          }}>
            Serviços *
          </label>
          
          <div style={{
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '8px',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#64748B',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              📋 Selecionar serviços disponíveis:
            </div>
            
            {servicosDisponiveis
              .filter(servico => servico.Combo === 'Serviço')
              .map((servico) => (
                <label 
                  key={servico.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 0',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#1E293B'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localServicos.includes(servico.nome)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setLocalServicos(prev => [...prev, servico.nome]);
                      } else {
                        setLocalServicos(prev => prev.filter(s => s !== servico.nome));
                      }
                    }}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  />
                  <span>{servico.nome}</span>
                  <span style={{
                    fontSize: '11px',
                    color: '#64748B',
                    marginLeft: 'auto'
                  }}>
                    {servico.duracao_minutos}min • R$ {(servico.preco || 0).toFixed(2).replace('.', ',')}
                  </span>
                </label>
              ))}
            
            {servicosDisponiveis.filter(s => s.Combo === 'Serviço').length === 0 && (
              <div style={{
                textAlign: 'center',
                color: '#94A3B8',
                fontSize: '12px',
                padding: '16px 0'
              }}>
                📋 Nenhum serviço cadastrado ainda
                <br />
                Cadastre serviços na tela "Serviços" primeiro
              </div>
            )}
          </div>
          
<div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {localServicos.map((servicoNome, index) => (
              <span
                key={index}
                style={{
                  background: '#F1F5F9',
                  color: '#1E293B',
                  padding: '6px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '500'
                }}
              >
                ✂️ {servicoNome}
                <button
                  type="button"
                  onClick={() => removerServicoLocal(servicoNome)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#EF4444',
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            
            {localServicos.length === 0 && (
              <div style={{
                color: '#94A3B8',
                fontSize: '12px',
                fontStyle: 'italic',
                padding: '8px 0'
              }}>
                Selecione os serviços acima
              </div>
            )}
          </div>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div>
            <label style={{
              fontSize: '12px',
              color: '#64748B',
              fontWeight: '500',
              marginBottom: '4px',
              display: 'block'
            }}>
              Início Manhã
            </label>
<CustomSelect
              value={localHorarioInicioManha}
              onChange={setLocalHorarioInicioManha}
              options={Array.from({length: 17}, (_, i) => {
                const hour = i + 6;
                const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                return { value: timeStr, label: timeStr };
              })}
              label=""
              placeholder="Selecionar horário"
            />
          </div>
          
          <div>
            <label style={{
              fontSize: '12px',
              color: '#64748B',
              fontWeight: '500',
              marginBottom: '4px',
              display: 'block'
            }}>
              Fim Tarde
            </label>
<CustomSelect
              value={localHorarioFimTarde}
              onChange={setLocalHorarioFimTarde}
              options={Array.from({length: 17}, (_, i) => {
                const hour = i + 6;
                const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                return { value: timeStr, label: timeStr };
              })}
              label=""
              placeholder="Selecionar horário"
            />
          </div>
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            fontSize: '12px',
            color: '#64748B',
            fontWeight: '500',
            marginBottom: '8px',
            display: 'block'
          }}>
            Status
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="ativo"
                checked={localAtivo === 'true'}
                onChange={() => setLocalAtivo('true')}
              />
              <span style={{ fontSize: '14px', color: '#10B981' }}>Ativo</span>
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="ativo"
                checked={localAtivo === 'false'}
                onChange={() => setLocalAtivo('false')}
              />
              <span style={{ fontSize: '14px', color: '#EF4444' }}>Inativo</span>
            </label>
          </div>
        </div>
        
<div style={{
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  paddingTop: '24px',
  borderTop: '1px solid #E2E8F0',
  marginTop: '24px'
}}>
  {/* Botão Excluir - linha separada se existir */}
  {profissionalEditando && (
    <button
      onClick={() => excluirProfissionalDoModal()}
      style={{
        background: '#EF4444',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        padding: '12px 20px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%'
      }}
    >
      <X size={16} />
      Excluir Profissional
    </button>
  )}
  
  {/* Botões principais */}
  <div style={{ 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: '12px' 
  }}>
    <button
      onClick={() => setShowProfissionalModal(false)}
      style={{
        background: '#F8FAFC',
        color: '#64748B',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        padding: '14px 20px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer'
      }}
    >
      Cancelar
    </button>
    <button
      onClick={salvarProfissionalLocal}
      style={{
        background: '#10B981',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        padding: '14px 20px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer'
      }}
    >
      {profissionalEditando ? 'Salvar' : 'Adicionar'}
    </button>
  </div>
</div>
      </div>
    </div>
  );
});
// ✏️ MODAL DE EDIÇÃO DE CLIENTE COM ESTADOS LOCAIS
const EditClientModal = React.memo(() => {
  // Estados locais do modal
  const [localNome, setLocalNome] = useState('');
  const [localTelefone, setLocalTelefone] = useState('');
  const [localCpf, setLocalCpf] = useState('');

  // Sincronizar com dados globais apenas quando modal abrir
  useEffect(() => {
    if (showEditModal && clienteEditando) {
      setTimeout(() => {
        setLocalNome(dadosEdicao.nome || '');
        setLocalTelefone(dadosEdicao.telefone || '');
        setLocalCpf(dadosEdicao.cpf || '');
      }, 50);
    }
}, []);

  const salvarEdicaoClienteLocal = async () => {
    try {
      if (!localNome.trim()) {
        alert('Nome é obrigatório');
        return;
      }
      
      console.log('💾 Salvando edição do cliente:', clienteEditando.id);
      
const { error } = await supabase
  .from('clientes')
  .update({
    nome: localNome.trim(),
    telefone: localTelefone.trim(),
    cpf: localCpf.trim()
  })
  .eq('id', clienteEditando.id)
  .eq('barbearia_id', userProfile?.barbearia_id);
      
      if (error) {
        console.error('Erro ao salvar:', error);
        alert('Erro ao salvar alterações');
        return;
      }
      
      // Atualizar no estado local
   // Atualizar no estado local
setClientes(prev => prev.map(c => 
  c.id === clienteEditando.id 
    ? { 
        ...c, 
        nome: localNome.trim(),
        telefone: localTelefone.trim(),
        cpf: localCpf.trim()
      }
    : c
));
      
      // Fechar modal
      setShowEditModal(false);
      setClienteEditando(null);
      setDadosEdicao({ nome: '', telefone: '', cpf: '' });
      
      // Mostrar popup de sucesso
      mostrarPopupSucesso('Cliente editado com sucesso!');    
      console.log('✅ Cliente editado com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao salvar edição:', error);
      alert('Erro ao salvar alterações');
    }
  };

  if (!showEditModal || !clienteEditando) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={() => setShowEditModal(false)}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          padding: '24px',
          maxWidth: '400px',
          width: '90%'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1E293B',
          margin: '0 0 20px 0'
        }}>
          ✏️ Editar Cliente
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            fontSize: '12px',
            color: '#64748B',
            fontWeight: '500',
            marginBottom: '4px',
            display: 'block'
          }}>
            Nome Completo
          </label>
          <input
            type="text"
            value={localNome}
            onChange={(e) => setLocalNome(e.target.value)}
            autoComplete="off"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            fontSize: '12px',
            color: '#64748B',
            fontWeight: '500',
            marginBottom: '4px',
            display: 'block'
          }}>
            Telefone
          </label>
          <input
            type="tel"
            value={localTelefone}
            onChange={(e) => setLocalTelefone(e.target.value)}
            autoComplete="off"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            fontSize: '12px',
            color: '#64748B',
            fontWeight: '500',
            marginBottom: '4px',
            display: 'block'
          }}>
            CPF
          </label>
          <input
            type="text"
            value={localCpf}
            onChange={(e) => setLocalCpf(e.target.value)}
            autoComplete="off"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={() => setShowEditModal(false)}
            style={{
              background: '#F8FAFC',
              color: '#64748B',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={salvarEdicaoClienteLocal}
            style={{
              background: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
});
// 🎉 POPUP DE SUCESSO ESTÁVEL
const SuccessPopup = () => {
  if (!showSuccessPopup || !successMessage) return null;
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.3s ease-out forwards'
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          padding: '32px',
          textAlign: 'center',
          maxWidth: '320px',
          width: '90%',
          animation: 'slideUp 0.3s ease-out forwards',
          position: 'relative'
        }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          background: '#10B981',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          animation: 'checkBounce 0.6s ease-out forwards'
        }}>
          <Check size={32} color="white" strokeWidth={3} />
        </div>
        
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1E293B',
          margin: '0 0 8px 0'
        }}>
          Sucesso!
        </h3>
        
        <p style={{
          fontSize: '14px',
          color: '#64748B',
          margin: '0 0 20px 0',
          lineHeight: '1.5'
        }}>
          {successMessage}
        </p>
        
        <div style={{
          width: '100%',
          height: '4px',
          background: '#F1F5F9',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            width: '0%',
            height: '100%',
            background: '#10B981',
            borderRadius: '2px',
            animation: 'progressBar 3s linear forwards'
          }} />
        </div>
      </div>
    </div>
  );
};
  // 🔔 POPUP DE NOTIFICAÇÕES MELHORADO PARA DADOS REAIS
  const NotificationPopup = () => (
    <>
      {showNotificationPopup && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            paddingTop: '70px',
            paddingRight: '20px'
          }}
          onClick={() => setShowNotificationPopup(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
              width: '350px',
              maxHeight: '500px',
              overflow: 'hidden',
              animation: 'slideDown 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Popup */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC'
            }}>
              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1E293B',
                  margin: 0
                }}>
                  🔔 Notificações do Dia
                </h3>
                <p style={{
                  fontSize: '12px',
                  color: '#64748B',
                  margin: '2px 0 0 0'
                }}>
                  {notifications.length} notificações • {unreadCount} não lidas
                </p>
              </div>
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    background: '#FF6B35',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '10px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Marcar como lidas
                </button>
              )}
            </div>

            {/* Lista de Notificações Reais */}
            <div style={{
              maxHeight: '420px',
              overflow: 'auto',
              overflowX: 'hidden'
            }}>
              {notifications.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#94A3B8'
                }}>
                  <Bell size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                  <p style={{ fontSize: '14px', margin: '0 0 4px 0', fontWeight: '600' }}>
                    Nenhuma notificação hoje
                  </p>
                  <p style={{ fontSize: '12px', margin: 0 }}>
                    Notificações de novos agendamentos aparecerão aqui
                  </p>
                  <p style={{ fontSize: '11px', margin: '8px 0 0 0', color: '#CBD5E1' }}>
                    Reset automático à meia-noite
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    style={{
                      padding: '12px 20px',
                      borderBottom: '1px solid #F8FAFC',
                      background: notif.lida ? '#FFFFFF' : '#FEF7ED',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => {
                      if (notif.agendamento) {
                        setCurrentScreen('agenda');
                        setShowNotificationPopup(false);
                      }
                    }}
                  >
                    {/* Header da Notificação */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '6px'
                    }}>
                      <h4 style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#1E293B',
                        margin: 0,
                        flex: 1,
                        lineHeight: '1.3'
                      }}>
                        {notif.titulo}
                      </h4>
                      
                      {!notif.lida && (
                        <div style={{
                          width: '6px',
                          height: '6px',
                          background: '#FF6B35',
                          borderRadius: '50%',
                          marginLeft: '8px',
                          marginTop: '2px',
                          flexShrink: 0
                        }} />
                      )}
                    </div>
                    
                    {/* Mensagem Principal */}
                    <p style={{
                      fontSize: '12px',
                      color: '#64748B',
                      margin: '0 0 6px 0',
                      lineHeight: '1.4',
                      fontWeight: '500'
                    }}>
                      {notif.mensagem}
                    </p>
                    
                    {/* Detalhes Adicionais (se tiver) */}
                    {notif.mensagemDetalhada && notif.mensagemDetalhada !== notif.mensagem && (
                      <div style={{
                        background: '#F8FAFC',
                        borderRadius: '6px',
                        padding: '8px',
                        marginBottom: '6px',
                        fontSize: '11px',
                        color: '#475569',
                        lineHeight: '1.3',
                        whiteSpace: 'pre-line'
                      }}>
                        {notif.mensagemDetalhada}
                      </div>
                    )}
                    
                    {/* Timestamp */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <p style={{
                        fontSize: '10px',
                        color: '#94A3B8',
                        margin: 0
                      }}>
                        {notif.timestamp.toLocaleString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo'
})}
                      </p>
                      
                      {/* Tipo da Notificação */}
                      <div style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: notif.tipo === 'novo_agendamento' ? '#DCFCE7' : '#FEF3C7',
                        color: notif.tipo === 'novo_agendamento' ? '#166534' : '#92400E',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        {notif.tipo === 'novo_agendamento' ? 'Novo' : notif.tipo}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const SideMenu = () => (
    <>
      {showMenu && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
          }}
          onClick={() => setShowMenu(false)}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '280px',
              background: '#FFFFFF',
              boxShadow: '-2px 0 10px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<div style={{
  width: '32px',
  height: '32px',
  background: '#ffffffff',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}}>
<svg width="32" height="32" viewBox="0 0 24 24" fill="none">
  {/* Calendário azul marinho exato da imagem */}
  <rect x="3" y="4" width="18" height="16" rx="3" ry="3" fill="#1E293B"/>
  {/* Argolas superiores */}
  <rect x="6" y="2" width="2" height="4" rx="1" fill="#1E293B"/>
  <rect x="16" y="2" width="2" height="4" rx="1" fill="#1E293B"/>
  {/* Área branca interna */}
  <rect x="5" y="8" width="14" height="10" rx="1" fill="white"/>
  {/* Check mark azul no centro */}
  <path d="M9 12.5l2 2 4-4" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
</div>
  <span style={{ fontSize: '18px', fontWeight: '600', color: '#1E293B' }}>Menu</span>
  
  {/* Ícone da Lua */}
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="#64748B" 
    strokeWidth="2"
    style={{ marginLeft: '8px' }}
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
  </svg>
</div>
              <button
                onClick={() => setShowMenu(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} color="#64748B" />
              </button>
            </div>

            <div style={{
              height: 'calc(100vh - 80px)',
              overflow: 'auto',
              overflowX: 'hidden'
            }}>
              <div style={{ padding: '20px 20px 0' }}>
                <button
                  onClick={() => {
                    setCurrentScreen('dashboard');
                    setShowMenu(false);
                  }}
                  style={{
                    width: '100%',
                    background: currentScreen === 'dashboard' ? '#1E293B' : 'transparent',
                    color: currentScreen === 'dashboard' ? '#FFFFFF' : '#64748B',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px'
                  }}
                >
                  <Home size={16} />
                  Dashboard
                </button>
              </div>

              <div style={{ padding: '20px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px'
                }}>
                  OPERAÇÕES
                </div>
                
   {[
  { id: 'agenda', icon: Calendar, label: 'Agenda' },
  { id: 'clientes', icon: Users, label: 'Clientes' },
  { id: 'profissionais', icon: User, label: 'Profissionais' },
  { id: 'servicos', icon: Scissors, label: 'Serviços' },
  { id: 'historico', icon: History, label: 'Histórico' },
  { id: 'financeiro', icon: CreditCard, label: 'Financeiro' },
  { id: 'relatorios', icon: PieChart, label: 'Relatórios' }
].map((item) => (
<button
                    key={item.id}
                    onClick={() => {
                      setCurrentScreen(item.id);
                      setShowMenu(false);
                    }}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      padding: '12px 0',
                      fontSize: '14px',
                      color: '#64748B',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
              <div style={{ padding: '0 20px 40px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px'
                }}>
                  SISTEMA
                </div>
                
                <button style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '12px 0',
                  fontSize: '14px',
                  color: '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Crown size={16} />
                    <span>Meu Plano</span>
                  </div>
                  <span style={{
                    background: '#FF6B35',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '600',
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}>
                    Premium
                  </span>
                </button>

<button 
  onClick={() => {
    setCurrentScreen('configuracoes');
    setShowMenu(false);
  }}
  style={{
    width: '100%',
    background: 'none',
    border: 'none',
    padding: '12px 0',
    fontSize: '14px',
    color: '#64748B',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }}
>
  <Settings size={16} />
  <span>Configurações</span>
</button>
<button 
  onClick={async () => {
    const confirmar = window.confirm('Tem certeza que deseja sair da sua conta?');
    if (confirmar) {
      await signOut();
      setShowMenu(false);
    }
  }}
  style={{
    width: '100%',
    background: 'none',
    border: 'none',
    padding: '12px 0',
    fontSize: '14px',
    color: '#EF4444',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '8px',
    borderTop: '1px solid #F1F5F9',
    paddingTop: '20px'
  }}
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16,17 21,12 16,7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
  <span>Sair da Conta</span>
</button>

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const BottomNav = () => (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#FFFFFF',
      borderTop: '1px solid #F1F5F9',
      padding: '8px 0 20px',
      display: 'flex',
      alignItems: 'flex-end',
      zIndex: 100
    }}>
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center' 
      }}>
        <button
          onClick={() => setCurrentScreen('dashboard')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '8px',
            color: currentScreen === 'dashboard' ? '#1E293B' : '#94A3B8'
          }}
        >
          <Home size={20} />
          <span style={{ fontSize: '10px', fontWeight: '500' }}>Início</span>
          {currentScreen === 'dashboard' && (
            <div style={{
              width: '4px',
              height: '4px',
              background: '#1E293B',
              borderRadius: '50%',
              marginTop: '2px'
            }} />
          )}
        </button>
      </div>

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center' 
      }}>
        <button
          onClick={() => setCurrentScreen('agenda')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '8px',
            color: currentScreen === 'agenda' ? '#1E293B' : '#94A3B8',
            position: 'relative'
          }}
        >
          <Calendar size={20} />
          <span style={{ fontSize: '10px', fontWeight: '500' }}>Agenda</span>
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '8px',
            background: '#EF4444',
            color: 'white',
            fontSize: '8px',
            fontWeight: '600',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {agendamentosHoje.length}
          </div>
          {currentScreen === 'agenda' && (
            <div style={{
              width: '4px',
              height: '4px',
              background: '#1E293B',
              borderRadius: '50%',
              marginTop: '2px'
            }} />
          )}
        </button>
      </div>

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center'
      }}>
<button
onClick={() => {
setDadosAgendamento({
    nome_cliente: '',
    telefone_cliente: '',
    cliente_cpf: '',
    data_agendamento: getBrasiliaDateString(),
    servicos_selecionados: [],
    barbeiro_selecionado: ''
  });
  setShowAgendamentoModal(true);
}}
  style={{
    background: '#FF6B35',
    border: 'none',
    cursor: 'pointer',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)',
    transform: 'translateY(-8px)'
  }}
>
  <Plus size={24} color="white" />
</button>
      </div>

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center' 
      }}>
        <button
          onClick={() => setCurrentScreen('profissionais')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '8px',
            color: currentScreen === 'profissionais' ? '#1E293B' : '#94A3B8'
          }}
        >
          <Users size={20} />
          <span style={{ fontSize: '10px', fontWeight: '500' }}>Profissionais</span>
          {currentScreen === 'profissionais' && (
            <div style={{
              width: '4px',
              height: '4px',
              background: '#1E293B',
              borderRadius: '50%',
              marginTop: '2px'
            }} />
          )}
        </button>
      </div>

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center' 
      }}>
        <button
          onClick={() => setCurrentScreen('relatorios')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '8px',
            color: currentScreen === 'relatorios' ? '#1E293B' : '#94A3B8'
          }}
        >
          <BarChart3 size={20} />
          <span style={{ fontSize: '10px', fontWeight: '500' }}>Relatórios</span>
          {currentScreen === 'relatorios' && (
            <div style={{
              width: '4px',
              height: '4px',
              background: '#1E293B',
              borderRadius: '50%',
              marginTop: '2px'
            }} />
          )}
        </button>
      </div>
    </div>
  );

const Header = ({ title, subtitle, showBack = false, onBackAction }) => (
  <div style={{
    background: '#FFFFFF',
    padding: '12px 20px',
    borderBottom: '1px solid #F1F5F9',
    position: 'sticky',
    top: 0,
    zIndex: 50
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {showBack ? (
          <button
            onClick={() => {
              if (onBackAction) {
                onBackAction();
              } else {
                setCurrentScreen('dashboard');
              }
            }}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowLeft size={16} color="#64748B" />
          </button>
        ) : (
          <button
            onClick={() => setShowMenu(true)}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Menu size={16} color="#64748B" />
          </button>
        )}
        
        <div>
          <h1 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#1E293B',
            margin: 0
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{
              fontSize: '12px',
              color: '#64748B',
              margin: '2px 0 0 0'
            }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          fontSize: '10px',
          color: '#10B981',
          background: '#DCFCE7',
          padding: '2px 6px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '2px'
        }}>
          <div style={{
            width: '4px',
            height: '4px',
            background: '#10B981',
            borderRadius: '50%'
          }} />
          {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
        </div>
        
        <button 
          onClick={() => {
            setShowNotificationPopup(!showNotificationPopup);
            if (!showNotificationPopup && unreadCount > 0) {
              setTimeout(() => markAllAsRead(), 1000);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            padding: '8px'
          }}
        >
          <Bell size={16} color="#64748B" />
          {unreadCount > 0 && (
            <div style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#EF4444',
              color: 'white',
              fontSize: '8px',
              fontWeight: '600',
              minWidth: '16px',
              height: '16px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none'
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </button>
        
        <div style={{
          width: '32px',
          height: '32px',
          background: '#FF6B35',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: '600',
          color: 'white'
        }}>
          BI
        </div>
      </div>
    </div>
  </div>
);

  const Dashboard = () => {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        paddingBottom: '100px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <Header title="BookIA" />

<div style={{ padding: '16px 8px' }}>
<div style={{ marginBottom: '4px' }}>
  
  <div style={{ position: 'relative', marginTop: '4px' }}>
              <Search 
                size={16} 
                color="#94A3B8"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              />
              <input
                type="text"
                placeholder="Buscar clientes, agendamentos..."
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#64748B',
                  background: '#FFFFFF',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
<div style={{ 
  marginBottom: '24px',
  paddingBottom: '16px',
  borderBottom: '1px solid #F1F5F9'
}}>
  <h1 style={{
    fontSize: '28px',
    fontWeight: '600',
    color: '#0F172A',
    margin: 0,
    letterSpacing: '-0.020em'
  }}>
  </h1>
</div>

{/* BOTÕES RÁPIDOS ELEGANTES */}
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '8px',
  marginBottom: '24px',
  paddingTop: '0px'
}}>
  <button
    onClick={() => setCurrentScreen('servicos')}
    style={{
      background: '#1E293B',
      border: 'none',
      borderRadius: '10px',
      padding: '12px 16px',
      fontSize: '13px',
      fontWeight: '600',
      color: '#FFFFFF',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s',
      boxShadow: '0 2px 8px rgba(30, 41, 59, 0.15)'
    }}
  >
    <Scissors size={18} color="#FFFFFF" />
    Serviços
  </button>
  
  <button
    onClick={() => setCurrentScreen('clientes')}
    style={{
      background: '#FF6B35',
      border: 'none',
      borderRadius: '10px',
      padding: '12px 16px',
      fontSize: '13px',
      fontWeight: '600',
      color: '#FFFFFF',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s',
      boxShadow: '0 2px 8px rgba(255, 107, 53, 0.15)'
    }}
  >
    <Users size={18} color="#FFFFFF" />
    Clientes
  </button>
</div>

<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '8px',
  marginBottom: '20px'
}}>
  <div style={{
    background: '#FFFFFF',
    border: '1px solid #F1F5F9',
    borderRadius: '12px',
    padding: '8px 12px',
    minHeight: '70px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <DollarSign size={16} color="#10B981" />
      <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
        Faturamento Hoje
      </span>
    </div>
    <div style={{ fontSize: '22px', fontWeight: '700', color: '#1E293B', lineHeight: '1.2' }}>
      R$ {formatCurrency(faturamentoDia)}
    </div>
    <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '500' }}>
      Confirmado hoje
    </div>
  </div>

  <div style={{
    background: '#FFFFFF',
    border: '1px solid #F1F5F9',
    borderRadius: '12px',
    padding: '8px 12px',
    minHeight: '70px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <Calendar size={16} color="#F59E0B" />
      <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
        Faturamento Mês
      </span>
    </div>
    <div style={{ fontSize: '22px', fontWeight: '700', color: '#1E293B', lineHeight: '1.2' }}>
      R$ {formatCurrency(faturamentoMes)}
    </div>
    <div style={{ fontSize: '12px', color: '#F59E0B', fontWeight: '500' }}>
      Este mês
    </div>
  </div>

  <div style={{
    background: '#FFFFFF',
    border: '1px solid #F1F5F9',
    borderRadius: '12px',
    padding: '8px 12px',
    minHeight: '70px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <Calendar size={16} color="#3B82F6" />
      <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
        Agendamentos Hoje
      </span>
    </div>
    <div style={{ fontSize: '22px', fontWeight: '700', color: '#1E293B', lineHeight: '1.2' }}>
      {agendamentosHoje.length}
    </div>
    <div style={{ fontSize: '12px', color: '#3B82F6', fontWeight: '500' }}>
      Agendados
    </div>
  </div>

  <div style={{
    background: '#FFFFFF',
    border: '1px solid #F1F5F9',
    borderRadius: '12px',
    padding: '8px 12px',
    minHeight: '70px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <Users size={16} color="#8B5CF6" />
      <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
        Clientes Ativos
      </span>
    </div>
    <div style={{ fontSize: '22px', fontWeight: '700', color: '#1E293B', lineHeight: '1.2' }}>
      {clientes.filter(c => c.status === 'ativo').length}
    </div>
    <div style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: '500' }}>
      Únicos
    </div>
  </div>
</div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid #F1F5F9',
            borderRadius: '12px',
            padding: '20px 12px',               // ← NOVO: 4px nas laterais,
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Calendar size={16} color="#1E293B" />
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1E293B',
                margin: 0
              }}>
                Agendamentos de Hoje
              </h3>
            </div>
            
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              margin: '0 0 16px 0'
            }}>
              {agendamentosHoje.length} agendamentos para hoje
            </p>

            <div style={{
              maxHeight: '400px',
              overflow: 'auto',
              overflowX: 'hidden'
            }}>
              {agendamentosHoje.map((agendamento, index) => (
<div key={agendamento.id} style={{
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: '10px',
  padding: '12px 20px',
  marginBottom: index < agendamentosHoje.length - 1 ? '8px' : '0',
  position: 'relative' // ← ADICIONAR ESTA LINHA
}}>
<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px'
}}>
  <div style={{
    background: '#1E293B',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '700',
    minWidth: '55px',
    textAlign: 'center'
  }}>
    {agendamento.hora_inicio?.substring(0, 5)}
  </div>
  
<button
    onClick={() => confirmarAgendamento(agendamento)}
    style={{
      background: '#10B981',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: '11px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
    }}
  >
    <Check size={12} />
    Confirmar
  </button>
</div>

{/* ÍCONE WHATSAPP OFICIAL CENTRALIZADO */}
<div style={{
  position: 'absolute',
  bottom: '6px',
  right: '6px',
  cursor: 'pointer',
  transform: 'translateY(+20%)'
}}
onClick={() => {
  const numero = agendamento.cliente_telefone?.replace(/\D/g, '');
  window.location.assign(`https://wa.me/55${numero}`);
}}
>
<img 
  src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
  alt="WhatsApp"
  width="32"
  height="32"
  style={{
    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))',
    opacity: 0.65 // ← ADICIONAR ESTA LINHA
  }}
/>
</div>

                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1E293B',
                    marginBottom: '4px',
                    lineHeight: '1.3'
                  }}>
                    {agendamento.cliente_nome}
                  </div>

                  <div style={{
                    fontSize: '13px',
                    color: '#64748B',
                    marginBottom: '2px',
                    lineHeight: '1.4'
                  }}>
                    📋 {agendamento.servico}
                  </div>

                  <div style={{
                    fontSize: '13px',
                    color: '#64748B',
                    marginBottom: '6px',
                    lineHeight: '1.4'
                  }}>
                    👨‍💼 {agendamento.nome_profissional}
                  </div>

<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '6px', // ← REDUZIR de 8px para 6px
  borderTop: '1px solid #E2E8F0'
}}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        📞 {agendamento.cliente_telefone}
                      </div>
                      
                      {/* Etiqueta de Combo/Serviço */}
                      {(() => {
                        const tipoCombo = identificarTipoCombo(agendamento.servico);
                        if (tipoCombo) {
                          return (
                            <div style={{
                              background: tipoCombo === 'Diamante' ? '#DBEAFE' :
                                         tipoCombo === 'Ouro' ? '#FEF3C7' :
                                         tipoCombo === 'Prata' ? '#F1F5F9' :
                                         tipoCombo === 'Bronze' ? '#FED7AA' :
                                         tipoCombo === 'Cobre' ? '#FECACA' : '#E5E7EB',
                              color: tipoCombo === 'Diamante' ? '#1E40AF' :
                                     tipoCombo === 'Ouro' ? '#92400E' :
                                     tipoCombo === 'Prata' ? '#475569' :
                                     tipoCombo === 'Bronze' ? '#C2410C' :
                                     tipoCombo === 'Cobre' ? '#B91C1C' : '#374151',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              fontSize: '7px',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: '0.2px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              {tipoCombo === 'Diamante' ? 'COMBO DIA' :
                               tipoCombo === 'Ouro' ? 'COMBO OURO' :
                               tipoCombo === 'Prata' ? 'COMBO PRATA' :
                               tipoCombo === 'Bronze' ? 'COMBO BRONZE' :
                               tipoCombo === 'Cobre' ? 'COMBO COBRE' : 'COMBO'}
                            </div>
                          );
                        } else {
                          return (
                            <div style={{
                              background: '#E5E7EB',
                              color: '#374151',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              fontSize: '7px',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: '0.2px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              SERVIÇO
                            </div>
                          );
                        }
                      })()}
                    </div>
                    
{agendamento.valor_servico && (
  <div style={{
    fontSize: '12px',
    fontWeight: '600',
    color: '#10B981',
    background: '#DCFCE7',
    padding: '2px 8px',
    borderRadius: '5px',
    marginRight: '20px' // ← ADICIONAR ESTA LINHA
    
  }}>
    R$ {formatCurrency(agendamento.valor_servico)}
  </div>
)}
                  </div>
                </div>
              ))}
              
              {agendamentosHoje.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '2rem 0', 
                  color: '#94A3B8' 
                }}>
                  <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '1rem' }}>Nenhum agendamento para hoje</p>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setCurrentScreen('agenda')}
              style={{
                width: '100%',
                background: '#1E293B',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: '16px'
              }}
            >
              Ver todos os agendamentos
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AgendaScreen = () => {
    const [filtroAtivo, setFiltroAtivo] = useState('todos');

const agendamentosFiltrados = agendamentos
  .filter(a => {
    // CORREÇÃO: Usar timezone correto de São Paulo para todos os cálculos
    const hoje = getBrasiliaDate();
    const hojeStr = getBrasiliaDateString();
    
    // AMANHÃ - CORRIGIDO
    const amanhaBrasilia = new Date(hoje.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    amanhaBrasilia.setDate(amanhaBrasilia.getDate() + 1);
    const amanhaStr = amanhaBrasilia.getFullYear() + '-' + 
                     String(amanhaBrasilia.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(amanhaBrasilia.getDate()).padStart(2, '0');
    
    // SEMANA ATUAL - CORRIGIDO
    const inicioSemanaBrasilia = new Date(hoje.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    const diaSemana = inicioSemanaBrasilia.getDay();
    const diasParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    inicioSemanaBrasilia.setDate(inicioSemanaBrasilia.getDate() + diasParaSegunda);
    
    const fimSemanaBrasilia = new Date(inicioSemanaBrasilia);
    fimSemanaBrasilia.setDate(inicioSemanaBrasilia.getDate() + 6);
    
    const inicioSemanaStr = inicioSemanaBrasilia.getFullYear() + '-' + 
                           String(inicioSemanaBrasilia.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(inicioSemanaBrasilia.getDate()).padStart(2, '0');
    const fimSemanaStr = fimSemanaBrasilia.getFullYear() + '-' + 
                        String(fimSemanaBrasilia.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(fimSemanaBrasilia.getDate()).padStart(2, '0');
    
    // MÊS ATUAL - CORRIGIDO
    const inicioMesBrasilia = new Date(hoje.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    inicioMesBrasilia.setDate(1); // Primeiro dia do mês
    
    const fimMesBrasilia = new Date(inicioMesBrasilia);
    fimMesBrasilia.setMonth(fimMesBrasilia.getMonth() + 1);
    fimMesBrasilia.setDate(0); // Último dia do mês
    
    const inicioMesStr = inicioMesBrasilia.getFullYear() + '-' + 
                        String(inicioMesBrasilia.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(inicioMesBrasilia.getDate()).padStart(2, '0');
    const fimMesStr = fimMesBrasilia.getFullYear() + '-' + 
                     String(fimMesBrasilia.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(fimMesBrasilia.getDate()).padStart(2, '0');
    
    // DEBUG: Mostrar as datas calculadas
    console.log('🔍 FILTROS DEBUG:');
    console.log('📅 Hoje:', hojeStr);
    console.log('📅 Amanhã:', amanhaStr);
    console.log('📅 Semana:', inicioSemanaStr, 'até', fimSemanaStr);
    console.log('📅 Mês:', inicioMesStr, 'até', fimMesStr);
    console.log('📋 Agendamento data:', a.data_agendamento);
    
switch(filtroAtivo) {
      case 'todos':
        return a.data_agendamento >= hojeStr;
      case 'amanha':
        return a.data_agendamento === amanhaStr;
      case 'semana':
        return a.data_agendamento >= hojeStr && a.data_agendamento >= inicioSemanaStr && a.data_agendamento <= fimSemanaStr;
      case 'mes':
        return a.data_agendamento >= hojeStr && a.data_agendamento >= inicioMesStr && a.data_agendamento <= fimMesStr;
      default:
        return a.data_agendamento >= hojeStr;
    }
  })
  .sort((a, b) => {
    const dataComparison = a.data_agendamento.localeCompare(b.data_agendamento);
    if (dataComparison !== 0) return dataComparison;
    return a.hora_inicio.localeCompare(b.hora_inicio);
  });

    return (
      <div style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        paddingBottom: '100px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <Header title="Agenda" subtitle={`${agendamentosFiltrados.length} agendamentos encontrados`} showBack />

        <div style={{ padding: '20px' }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px'
          }}>
            <button 
              onClick={() => setFiltroAtivo('todos')}
              style={{
                background: filtroAtivo === 'todos' ? '#1E293B' : '#FFFFFF',
                color: filtroAtivo === 'todos' ? 'white' : '#374151',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Todos
            </button>
            <button 
              onClick={() => setFiltroAtivo('amanha')}
              style={{
                background: filtroAtivo === 'amanha' ? '#1E293B' : '#FFFFFF',
                color: filtroAtivo === 'amanha' ? 'white' : '#374151',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Amanhã
            </button>
            <button 
              onClick={() => setFiltroAtivo('semana')}
              style={{
                background: filtroAtivo === 'semana' ? '#1E293B' : '#FFFFFF',
                color: filtroAtivo === 'semana' ? 'white' : '#374151',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Semana
            </button>
            <button 
              onClick={() => setFiltroAtivo('mes')}
              style={{
                background: filtroAtivo === 'mes' ? '#1E293B' : '#FFFFFF',
                color: filtroAtivo === 'mes' ? 'white' : '#374151',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Mês
            </button>
          </div>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            maxHeight: 'calc(100vh - 220px)',
            overflow: 'auto',
            overflowX: 'hidden'
          }}>
            {agendamentosFiltrados.map((agendamento, index) => {
              return (
                <div 
  key={agendamento.id}
  style={{
    background: '#FFFFFF',
    border: '1px solid #F1F5F9',
    borderRadius: '12px',
    padding: '12px 16px', // ← REDUZIDO de 16px para 12px verticalmente
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    position: 'relative' // ← ADICIONAR para posicionamento do WhatsApp
  }}
>
  <div style={{ 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '8px' // ← REDUZIDO de 12px para 8px
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
      <div style={{
        background: '#1E293B',
        color: 'white',
        padding: '6px 10px', // ← REDUZIDO de 8px 12px
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '700',
        minWidth: '55px',
        textAlign: 'center'
      }}>
        {agendamento.hora_inicio?.substring(0, 5)}
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{
          fontSize: '15px',
          fontWeight: '600',
          color: '#1E293B',
          margin: '0 0 4px 0',
          lineHeight: '1.3'
        }}>
          {agendamento.cliente_nome}
        </h3>
        <p style={{
          fontSize: '12px',
          color: '#374151',
          margin: '0 0 2px 0',
          fontWeight: '500',
          lineHeight: '1.4',
          wordWrap: 'break-word',
          overflowWrap: 'break-word'
        }}>
          ✂️ {agendamento.servico}
        </p>
        <p style={{
          fontSize: '11px',
          color: '#64748B',
          margin: 0,
          fontWeight: '500'
        }}>
          👨‍💼 {agendamento.nome_profissional}
        </p>
      </div>
    </div>
    
<div style={{
  background: agendamento.status === 'agendado' ? '#DCFCE7' : 
             agendamento.status === 'finalizado' ? '#E0E7FF' : '#FEF3C7',
  color: agendamento.status === 'agendado' ? '#166534' : 
         agendamento.status === 'finalizado' ? '#3730A3' : '#92400E',
  padding: '4px 8px', // ← AUMENTADO de 3px para 4px
  borderRadius: '12px',
  fontSize: '10px', // ← AUMENTADO de 9px para 10px
  fontWeight: '600',
  textTransform: 'uppercase',
  position: 'absolute', // ← ADICIONAR
  top: '8px', // ← ADICIONAR - posiciona mais para cima
  right: '12px', // ← ADICIONAR - posiciona mais para o lado
  whiteSpace: 'nowrap' // ← ADICIONAR - evita quebra de linha
}}>
  {agendamento.status}
</div>
  </div>

  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#F8FAFC',
    borderRadius: '6px', // ← REDUZIDO de 8px
    padding: '8px 10px', // ← REDUZIDO de 10px 12px
    marginBottom: agendamento.observacoes ? '8px' : '6px' // ← REDUZIDO
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <div style={{ fontSize: '11px', color: '#374151', fontWeight: '500' }}> {/* REDUZIDO de 12px */}
        📅 {new Date(agendamento.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'})}
      </div>
      <div style={{ fontSize: '11px', color: '#374151', fontWeight: '500' }}> {/* REDUZIDO de 12px */}
        📞 {agendamento.cliente_telefone}
      </div>
      {agendamento.valor_servico && (
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#10B981' }}> {/* REDUZIDO de 12px */}
          R$ {formatCurrency(agendamento.valor_servico)}
        </div>
      )}
    </div>
  </div>
  
  {agendamento.observacoes && (
    <div style={{
      background: '#FEF7ED',
      borderRadius: '6px', // ← REDUZIDO de 8px
      padding: '6px 8px', // ← REDUZIDO de 8px 10px
      marginBottom: '6px', // ← REDUZIDO de 8px
      borderLeft: '3px solid #FB923C'
    }}>
      <p style={{ fontSize: '11px', color: '#9A3412', margin: 0, fontWeight: '500' }}> {/* REDUZIDO de 12px */}
        💬 {agendamento.observacoes}
      </p>
    </div>
  )}

<div style={{ 
    display: 'flex', 
    gap: '6px', 
    justifyContent: 'flex-end', 
    alignItems: 'center',
    flexWrap: 'nowrap',
    minHeight: '32px'
  }}>
    {/* Etiqueta de Combo */}
    {(() => {
      const tipoCombo = identificarTipoCombo(agendamento.servico);
      if (tipoCombo) {
        return (
          <div style={{
            background: tipoCombo === 'Diamante' ? '#DBEAFE' :
                       tipoCombo === 'Ouro' ? '#FEF3C7' :
                       tipoCombo === 'Prata' ? '#F1F5F9' :
                       tipoCombo === 'Bronze' ? '#FED7AA' :
                       tipoCombo === 'Cobre' ? '#FECACA' : '#E5E7EB',
            color: tipoCombo === 'Diamante' ? '#1E40AF' :
                   tipoCombo === 'Ouro' ? '#92400E' :
                   tipoCombo === 'Prata' ? '#475569' :
                   tipoCombo === 'Bronze' ? '#C2410C' :
                   tipoCombo === 'Cobre' ? '#B91C1C' : '#374151',
            padding: '3px 6px',
            borderRadius: '6px',
            fontSize: '8px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            COMBO {tipoCombo}
          </div>
        );
      } else {
        return (
          <div style={{
            background: '#E5E7EB',
            color: '#374151',
            padding: '3px 6px',
            borderRadius: '6px',
            fontSize: '8px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            SERVIÇO
          </div>
        );
      }
    })()}

    <button 
      onClick={() => abrirEdicaoAgendamento(agendamento)}
      style={{
        background: '#F8FAFC',
        color: '#374151',
        border: '1px solid #E2E8F0',
        borderRadius: '6px',
        padding: '5px 8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        fontWeight: '600'
      }}
    >
      <Edit size={11} />
      Editar
    </button>
    
    <button 
      onClick={() => cancelarAgendamento(agendamento)}
      style={{
        background: '#FEE2E2',
        color: '#B91C1C',
        border: '1px solid #FECACA',
        borderRadius: '6px',
        padding: '5px 8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        fontWeight: '600'
      }}
    >
      <X size={11} />
      Cancelar
    </button>
    
   <div style={{
      cursor: 'pointer',
      marginLeft: '8px'
    }}
    onClick={() => window.open(`https://wa.me/55${agendamento.cliente_telefone?.replace(/\D/g, '')}`, '_blank')}
    >
      <img 
  src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
  alt="WhatsApp"
  width="32"
  height="32"
  style={{
    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))',
    opacity: 0.65
  }}
/>
    </div>
  </div>
                </div>
              );
            })}
            
            {agendamentosFiltrados.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: '#6B7280' }}>
                <Calendar size={64} style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
                <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#374151' }}>
                  {filtroAtivo === 'todos' && 'Nenhum agendamento hoje ou futuro'}
                  {filtroAtivo === 'amanha' && 'Nenhum agendamento para amanhã'}
                  {filtroAtivo === 'semana' && 'Nenhum agendamento para esta semana'}
                  {filtroAtivo === 'mes' && 'Nenhum agendamento para este mês'}
                </p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#6B7280' }}>
                  {filtroAtivo === 'todos' && 'Os agendamentos de hoje e futuros aparecerão aqui'}
                  {filtroAtivo === 'amanha' && 'Não há agendamentos marcados para amanhã'}
                  {filtroAtivo === 'semana' && 'Não há agendamentos para os próximos 7 dias'}
                  {filtroAtivo === 'mes' && 'Não há agendamentos para o próximo mês'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const HistoricoScreen = () => {
    const [filtroData, setFiltroData] = useState('');
    const [filtroCliente, setFiltroCliente] = useState('');

    const historicoFiltrado = historicoConfirmados.filter(item => {
      const matchData = !filtroData || item.data_agendamento === filtroData;
      const matchCliente = !filtroCliente || 
        item.cliente_nome.toLowerCase().includes(filtroCliente.toLowerCase()) ||
        (item.cliente_cpf && item.cliente_cpf.includes(filtroCliente));
      
      return matchData && matchCliente;
    });

    return (
      <div style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        paddingBottom: '100px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <Header title="Histórico" subtitle={`${historicoFiltrado.length} registros encontrados`} showBack />

        <div style={{ padding: '20px' }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #F1F5F9',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#1E293B',
              margin: '0 0 12px 0'
            }}>
              Filtros
            </h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  color: '#64748B',
                  fontWeight: '500',
                  marginBottom: '4px',
                  display: 'block'
                }}>
                  Data
                </label>
                <input
                  type="date"
                  value={filtroData}
                  onChange={(e) => setFiltroData(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: '#64748B',
                    background: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  fontSize: '12px',
                  color: '#64748B',
                  fontWeight: '500',
                  marginBottom: '4px',
                  display: 'block'
                }}>
                  Cliente/CPF
                </label>
                <input
                  type="text"
                  placeholder="Nome ou CPF..."
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: '#64748B',
                    background: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {(filtroData || filtroCliente) && (
              <button
                onClick={() => {
                  setFiltroData('');
                  setFiltroCliente('');
                }}
                style={{
                  background: '#F8FAFC',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginTop: '12px'
                }}
              >
                Limpar Filtros
              </button>
            )}
          </div>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            maxHeight: 'calc(100vh - 320px)',
            overflow: 'auto',
            overflowX: 'hidden'
          }}>
            {historicoFiltrado.map((item, index) => (
              <div 
                key={item.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F1F5F9',
                  borderRadius: '8px',
                  padding: '12px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1E293B'
                  }}>
                    {item.cliente_nome}
                  </div>
                  
                  <div style={{
                    background: item.status === 'confirmado' ? '#DCFCE7' : '#FEE2E2',
                    color: item.status === 'confirmado' ? '#166534' : '#B91C1C',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {item.status}
                  </div>
                </div>

                <div style={{
                  fontSize: '12px',
                  color: '#64748B',
                  marginBottom: '6px'
                }}>
                  📋 {item.servico} • 👨‍💼 {item.nome_profissional}
                </div>

                <div style={{
                  fontSize: '12px',
                  color: '#64748B',
                  marginBottom: '6px'
                }}>
                  📅 {new Date(item.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'})} • 
                  🕐 {item.hora_inicio?.substring(0, 5)} - {item.hora_fim?.substring(0, 5)}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '6px',
                  borderTop: '1px solid #F8FAFC'
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: '#94A3B8'
                  }}>
                    📞 {item.cliente_telefone} • 🆔 {item.cliente_cpf || 'N/A'}
                  </div>
                  
                  {item.valor_servico && (
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: item.status === 'confirmado' ? '#10B981' : '#64748B',
                      background: item.status === 'confirmado' ? '#DCFCE7' : '#F8FAFC',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      R$ {formatCurrency(item.valor_servico)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {historicoFiltrado.length === 0 && (
              <div style={{ 
                textAlign: 'center', 
                padding: '3rem 0', 
                color: '#94A3B8' 
              }}>
                <History size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                  {filtroData || filtroCliente ? 'Nenhum registro encontrado' : 'Nenhum histórico disponível'}
                </p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {filtroData || filtroCliente ? 'Tente ajustar os filtros' : 'Os agendamentos confirmados aparecerão aqui'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
const ClientesScreen = () => {
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroNome, setFiltroNome] = useState('');

  const clientesFiltrados = clientes.filter(cliente => {
    const matchStatus = filtroStatus === 'todos' || cliente.status === filtroStatus;
    const matchNome = !filtroNome || 
      cliente.nome.toLowerCase().includes(filtroNome.toLowerCase()) ||
      (cliente.telefone && cliente.telefone.includes(filtroNome)) ||
      (cliente.cpf && cliente.cpf.includes(filtroNome));
    
    return matchStatus && matchNome;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title="Clientes" subtitle={`${clientesFiltrados.length} clientes encontrados`} showBack />

      <div style={{ padding: '20px' }}>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#1E293B',
            margin: '0 0 12px 0'
          }}>
            Filtros
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div>
              <label style={{
                fontSize: '12px',
                color: '#64748B',
                fontWeight: '500',
                marginBottom: '4px',
                display: 'block'
              }}>
                Status
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#64748B',
                  background: '#FFFFFF',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="todos">Todos</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
            </div>

            <div>
              <label style={{
                fontSize: '12px',
                color: '#64748B',
                fontWeight: '500',
                marginBottom: '4px',
                display: 'block'
              }}>
                Buscar
              </label>
              <input
                type="text"
                placeholder="Nome, telefone ou CPF..."
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#64748B',
                  background: '#FFFFFF',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{
            fontSize: '12px',
            color: '#64748B',
            background: '#F8FAFC',
            padding: '8px',
            borderRadius: '6px',
            marginTop: '8px'
          }}>
            ℹ️ Clientes se tornam ativos automaticamente após {minAgendamentosAtivo} agendamentos confirmados
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          maxHeight: 'calc(100vh - 320px)',
          overflow: 'auto',
          overflowX: 'hidden'
        }}>
          {clientesFiltrados.map((cliente, index) => (
            <div 
              key={cliente.id || index}
              style={{
                background: '#FFFFFF',
                border: '1px solid #F1F5F9',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: cliente.status === 'ativo' ? '#10B981' : '#94A3B8',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User size={24} color="white" />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1E293B',
                      margin: '0 0 4px 0'
                    }}>
                      {cliente.nome}
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      color: '#64748B',
                      margin: '0 0 2px 0'
                    }}>
                      📞 {cliente.telefone || 'Não informado'}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: '#94A3B8',
                      margin: 0
                    }}>
                      🆔 {cliente.cpf || 'CPF não informado'}
                    </p>
                  </div>
                </div>
                <div style={{
                  background: cliente.status === 'ativo' ? '#DCFCE7' : '#FEE2E2',
                  color: cliente.status === 'ativo' ? '#166534' : '#B91C1C',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {cliente.status === 'ativo' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {cliente.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#F8FAFC',
                borderRadius: '8px',
                padding: '12px'
              }}>
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '16px',
  flex: 1
}}>
  <div style={{ textAlign: 'center' }}>
    <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px 0' }}>Total Agendamentos</p>
    <p style={{ fontSize: '18px', fontWeight: '700', color: '#3B82F6', margin: 0 }}>
      {cliente.total_agendamentos || 0}
    </p>
  </div>
  <div style={{ textAlign: 'center' }}>
    <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px 0' }}>Data Cadastro</p>
    <p style={{ fontSize: '12px', fontWeight: '600', color: '#10B981', margin: 0 }}>
      {cliente.data_cadastro ? new Date(cliente.data_cadastro + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
    </p>
  </div>
</div>
                
                <button 
  onClick={() => {
    setClienteEditando(cliente);
    setDadosEdicao({
      nome: cliente.nome || '',
      telefone: cliente.telefone || '',
      cpf: cliente.cpf || ''
    });
    setShowEditModal(true);
  }}
  style={{
    background: '#1E293B',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    cursor: 'pointer',
    marginLeft: '12px'
  }}
>
  <Edit size={14} />
</button>
              </div>
            </div>
          ))}
          
          {clientesFiltrados.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '4rem 0', 
              color: '#94A3B8' 
            }}>
              <Users size={64} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                {filtroNome || filtroStatus !== 'todos' ? 'Nenhum cliente encontrado' : 'Nenhum cliente ativo ainda'}
              </p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {filtroNome || filtroStatus !== 'todos' ? 'Tente ajustar os filtros' : `Clientes aparecerão aqui após ${minAgendamentosAtivo} agendamentos confirmados`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
const ProfissionaisScreen = () => {
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const profissionaisFiltrados = barbeiros.filter(barbeiro => {
    if (filtroStatus === 'todos') return true;
    return barbeiro.ativo === filtroStatus;
  });

const abrirModalEdicao = (barbeiro) => {
  setProfissionalEditando(barbeiro);
  setDadosProfissional({
    nome: barbeiro.nome || '',
    servicos: parseServicos(barbeiro.servicos),
    horario_inicio_manha: barbeiro.horario_inicio_manha || '08:00',
    horario_fim_manha: barbeiro.horario_fim_manha || '12:00',
    horario_inicio_tarde: barbeiro.horario_inicio_tarde || '14:00',
    horario_fim_tarde: barbeiro.horario_fim_tarde || '18:00',
    ativo: barbeiro.ativo || 'true',
    foto_url: barbeiro.foto_url || ''
  });
  setShowProfissionalModal(true);
};

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title="Profissionais" subtitle={`${profissionaisFiltrados.length} profissionais encontrados`} showBack />

      <div style={{ padding: '20px' }}>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#1E293B',
              margin: 0
            }}>
              Gerenciar Profissionais
            </h3>
            
            <button
              onClick={abrirModalNovo}
              style={{
                background: '#10B981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={14} />
              Novo Profissional
            </button>
          </div>
          
          <div>
            <label style={{
              fontSize: '12px',
              color: '#64748B',
              fontWeight: '500',
              marginBottom: '4px',
              display: 'block'
            }}>
              Filtrar por status
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              style={{
                width: '200px',
                padding: '8px 12px',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#64748B',
                background: '#FFFFFF',
                outline: 'none'
              }}
            >
              <option value="todos">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {profissionaisFiltrados.map((barbeiro) => (
            <div 
              key={barbeiro.barbeiro_id}
              style={{
                background: '#FFFFFF',
                border: '1px solid #F1F5F9',
                borderRadius: '12px',
                padding: '16px',
                opacity: (isAtivo(barbeiro.ativo) || barbeiro.ativo === true || barbeiro.ativo === 1) ? 1 : 0.7
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: (isAtivo(barbeiro.ativo) || barbeiro.ativo === true || barbeiro.ativo === 1) ? '#10B981' : '#94A3B8',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    flexShrink: 0,
                    overflow: 'hidden',
                    border: '2px solid #FFFFFF',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }}>
                    {barbeiro.foto_url ? (
                      <img 
                        src={barbeiro.foto_url}
                        alt={barbeiro.nome}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '50%'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: barbeiro.foto_url ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: barbeiro.foto_url ? 'absolute' : 'static',
                      top: 0,
                      left: 0
                    }}>
                      <User size={24} color="white" />
                    </div>
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1E293B',
                      margin: '0 0 4px 0'
                    }}>
                      {barbeiro.nome}
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      color: '#64748B',
                      margin: '0 0 2px 0'
                    }}>
                      🔧 {parseServicos(barbeiro.servicos).join(', ') || 'Serviços não especificados'}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: '#94A3B8',
                      margin: 0
                    }}>
                      🕐 {barbeiro.horario_inicio_manha?.substring(0, 5)} - {barbeiro.horario_fim_tarde?.substring(0, 5)}
                    </p>
                  </div>
                </div>
                <div style={{
                  background: (isAtivo(barbeiro.ativo) || barbeiro.ativo === true || barbeiro.ativo === 1) ? '#DCFCE7' : '#FEE2E2',
                  color: (isAtivo(barbeiro.ativo) || barbeiro.ativo === true || barbeiro.ativo === 1) ? '#166534' : '#B91C1C',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {(isAtivo(barbeiro.ativo) || barbeiro.ativo === true || barbeiro.ativo === 1) ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {(isAtivo(barbeiro.ativo) || barbeiro.ativo === true || barbeiro.ativo === 1) ? 'Ativo' : 'Inativo'}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#F8FAFC',
                borderRadius: '8px',
                padding: '12px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                  flex: 1
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px 0' }}>Hoje</p>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: '#3B82F6', margin: 0 }}>
                      {agendamentos.filter(a => a.nome_profissional === barbeiro.nome && a.data_agendamento === getBrasiliaDateString()).length}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px 0' }}>Total</p>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: '#10B981', margin: 0 }}>
                      {agendamentos.filter(a => a.nome_profissional === barbeiro.nome).length}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px 0' }}>Serviços</p>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: '#F59E0B', margin: 0 }}>
                      {parseServicos(barbeiro.servicos).length}
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => abrirModalEdicao(barbeiro)}
                  style={{
                    background: '#1E293B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px',
                    cursor: 'pointer',
                    marginLeft: '12px'
                  }}
                >
                  <Edit size={14} />
                </button>
              </div>
            </div>
          ))}
          
          {profissionaisFiltrados.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '4rem 0', 
              color: '#94A3B8' 
            }}>
              <Users size={64} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                {filtroStatus !== 'todos' ? `Nenhum profissional ${filtroStatus === 'true' ? 'ativo' : 'inativo'}` : 'Nenhum profissional cadastrado'}
              </p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {filtroStatus !== 'todos' ? 'Tente mudar o filtro' : 'Clique em "Novo Profissional" para começar'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ConfiguracoesScreen = () => {
  const [novoMinimo, setNovoMinimo] = useState(minAgendamentosAtivo);
  const [salvando, setSalvando] = useState(false);
const iniciarEdicaoHorarios = () => {
  setHorariosTemp([...horariosFuncionamento]);
  setEditandoHorarios(true);
};

const cancelarEdicaoHorarios = () => {
  setHorariosTemp([]);
  setEditandoHorarios(false);
};

const salvarHorarios = async () => {
  setSalvandoHorarios(true);
  try {
    for (const horario of horariosTemp) {
      const { error } = await supabase
  .from('horarios_funcionamento')
  .update({
    hora_inicio_manha: horario.hora_inicio_manha,
    hora_fim_manha: horario.hora_fim_manha,
    hora_inicio_tarde: horario.hora_inicio_tarde,
    hora_fim_tarde: horario.hora_fim_tarde,
    ativo: horario.ativo
  })
.eq('id', horario.id)
.eq('barbearia_id', userProfile?.barbearia_id);
      
      if (error) throw error;
    }
    
    // Recarregar horários
    await loadData(false);
    setEditandoHorarios(false);
    setHorariosTemp([]);
    mostrarPopupSucesso('Horários salvos com sucesso!');
    
  } catch (error) {
    console.error('Erro ao salvar horários:', error);
    mostrarPopupSucesso('Erro ao salvar horários');
  } finally {
    setSalvandoHorarios(false);
  }
};

const atualizarHorarioTemp = (id, campo, valor) => {
  setHorariosTemp(prev => prev.map(h => 
    h.id === id ? { ...h, [campo]: valor } : h
  ));
};
  const salvarConfiguracao = async () => {
    setSalvando(true);
    try {
      // Tentar atualizar configuração existente
const { error: updateError } = await supabase
  .from('configuracoes')
  .update({ valor: novoMinimo.toString() })
  .eq('chave', 'min_agendamentos_ativo')
  .eq('barbearia_id', userProfile?.barbearia_id);
      
      if (updateError) {
        // Se não existe, criar nova
        const { error: insertError } = await supabase
          .from('configuracoes')
          .insert([
            {
              chave: 'min_agendamentos_ativo',
              valor: novoMinimo.toString(),
              descricao: 'Número mínimo de agendamentos para cliente se tornar ativo',
              created_at: getBrasiliaDate().toISOString(),
              barbearia_id: userProfile?.barbearia_id,
            }
          ]);
        
        if (insertError) {
          console.error('Erro ao salvar configuração:', insertError);
          alert('Erro ao salvar configuração');
          return;
        }
      }
      
      setMinAgendamentosAtivo(novoMinimo);
      alert('✅ Configuração salva com sucesso!');
      
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configuração');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title="Configurações" subtitle="Ajustes do sistema" showBack />

      <div style={{ padding: '20px' }}>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1E293B',
            margin: '0 0 16px 0'
          }}>
            🎯 Clientes Ativos
          </h3>
          
          <p style={{
            fontSize: '14px',
            color: '#64748B',
            margin: '0 0 16px 0'
          }}>
            Configure quantos agendamentos confirmados um cliente precisa ter para se tornar "ativo" e ser cadastrado automaticamente.
          </p>

          <div style={{ marginBottom: '8px' }}>
            <label style={{
              fontSize: '12px',
              color: '#64748B',
              fontWeight: '500',
              marginBottom: '8px',
              display: 'block'
            }}>
              Número mínimo de agendamentos
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={novoMinimo}
              onChange={(e) => setNovoMinimo(parseInt(e.target.value) || 1)}
              style={{
                width: '100px',
                padding: '8px 12px',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#64748B',
                background: '#FFFFFF',
                outline: 'none',
                textAlign: 'center'
              }}
            />
          </div>

          <div style={{
            background: '#F8FAFC',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#64748B',
            lineHeight: '1.5'
          }}>
            <strong>Como funciona:</strong><br/>
            • Cliente faz agendamentos normalmente<br/>
            • Após {novoMinimo} agendamentos confirmados, vira "ativo"<br/>
            • É cadastrado automaticamente no sistema<br/>
            • Aparece no contador do dashboard e na tela de clientes
          </div>

          <button
            onClick={salvarConfiguracao}
            disabled={salvando || novoMinimo === minAgendamentosAtivo}
            style={{
              background: novoMinimo === minAgendamentosAtivo ? '#94A3B8' : '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: novoMinimo === minAgendamentosAtivo ? 'not-allowed' : 'pointer'
            }}
          >
            {salvando ? 'Salvando...' : novoMinimo === minAgendamentosAtivo ? 'Salvo' : 'Salvar Configuração'}
          </button>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1E293B',
            margin: '0 0 16px 0'
          }}>
            📊 Status Atual
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px'
          }}>
            <div style={{
              background: '#F8FAFC',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px 0' }}>Configuração Atual</p>
              <p style={{ fontSize: '20px', fontWeight: '700', color: '#3B82F6', margin: 0 }}>
                {minAgendamentosAtivo}
              </p>
              <p style={{ fontSize: '10px', color: '#64748B', margin: '4px 0 0 0' }}>agendamentos</p>
            </div>
            <div style={{
              background: '#F8FAFC',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px 0' }}>Clientes Ativos</p>
              <p style={{ fontSize: '20px', fontWeight: '700', color: '#10B981', margin: 0 }}>
                {clientes.filter(c => c.status === 'ativo').length}
              </p>
<p style={{ fontSize: '10px', color: '#64748B', margin: '4px 0 0 0' }}>cadastrados</p>
            </div>
          </div>
        </div>

        {/* SEÇÃO HORÁRIOS DE FUNCIONAMENTO */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1E293B',
              margin: 0
            }}>
              🕐 Horários de Funcionamento
            </h3>
            
            {!editandoHorarios && (
              <button
                onClick={iniciarEdicaoHorarios}
                style={{
                  background: '#3B82F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ✏️ Editar
              </button>
            )}
          </div>
          
          <p style={{
            fontSize: '14px',
            color: '#64748B',
            margin: '0 0 16px 0'
          }}>
            {editandoHorarios ? 'Edite os horários e clique em salvar.' : 'Horários de funcionamento da barbearia.'}
          </p>

          {horariosFuncionamento.length > 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {(editandoHorarios ? horariosTemp : horariosFuncionamento).map((horario) => (
                <div key={horario.id} style={{
                  background: horario.ativo ? '#F8FAFC' : '#FEE2E2',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: editandoHorarios ? '12px' : '0'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: horario.ativo ? '#1E293B' : '#B91C1C',
                      minWidth: '80px'
                    }}>
                      {horario.dia_semana}
                    </div>
                    
                    {editandoHorarios && (
                      <div>
                        <label style={{ fontSize: '12px', color: '#64748B', marginRight: '8px' }}>
                          <input
                            type="checkbox"
                            checked={horario.ativo}
                            onChange={(e) => atualizarHorarioTemp(horario.id, 'ativo', e.target.checked)}
                            style={{ marginRight: '4px' }}
                          />
                          Aberto
                        </label>
                      </div>
                    )}
                  </div>
                  
                  {horario.ativo ? (
                    editandoHorarios ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '12px'
                      }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                            Manhã - Início
                          </label>
<CustomTimePicker
                            value={horario.hora_inicio_manha?.substring(0, 5) || ''}
                            onChange={(time) => atualizarHorarioTemp(horario.id, 'hora_inicio_manha', time)}
                            label=""
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                            Manhã - Fim
                          </label>
<CustomTimePicker
                            value={horario.hora_fim_manha?.substring(0, 5) || ''}
                            onChange={(time) => atualizarHorarioTemp(horario.id, 'hora_fim_manha', time)}
                            label=""
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                            Tarde - Início
                          </label>
<CustomTimePicker
                            value={horario.hora_inicio_tarde?.substring(0, 5) || ''}
                            onChange={(time) => atualizarHorarioTemp(horario.id, 'hora_inicio_tarde', time)}
                            label=""
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                            Tarde - Fim
                          </label>
<CustomTimePicker
                            value={horario.hora_fim_tarde?.substring(0, 5) || ''}
                            onChange={(time) => atualizarHorarioTemp(horario.id, 'hora_fim_tarde', time)}
                            label=""
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '12px',
                        color: '#64748B',
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center'
                      }}>
                        <span>
                          Manhã: {horario.hora_inicio_manha?.substring(0, 5)} - {horario.hora_fim_manha?.substring(0, 5)}
                        </span>
                        <span>
                          Tarde: {horario.hora_inicio_tarde?.substring(0, 5)} - {horario.hora_fim_tarde?.substring(0, 5)}
                        </span>
                      </div>
                    )
                  ) : (
                    !editandoHorarios && (
                      <div style={{
                        fontSize: '12px',
                        color: '#B91C1C',
                        fontWeight: '600'
                      }}>
                        FECHADO
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: '#FEF7ED',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              fontSize: '14px',
              color: '#92400E'
            }}>
              ⚠️ Nenhum horário encontrado
            </div>
          )}

          {editandoHorarios && (
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '16px'
            }}>
              <button
                onClick={cancelarEdicaoHorarios}
                style={{
                  flex: 1,
                  background: '#F8FAFC',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={salvarHorarios}
                disabled={salvandoHorarios}
                style={{
                  flex: 1,
                  background: salvandoHorarios ? '#94A3B8' : '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: salvandoHorarios ? 'not-allowed' : 'pointer'
                }}
              >
                {salvandoHorarios ? 'Salvando...' : 'Salvar Horários'}
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
  );
};
// 🔧 TELA DE SERVIÇOS COMPLETA
const ServicosScreen = () => {
  const [comboEditando, setComboEditando] = useState(null);
  const [servicos, setServicos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [showServicoModal, setShowServicoModal] = useState(false);
  const [showComboModal, setShowComboModal] = useState(false);
  const [servicoEditando, setServicoEditando] = useState(null);
  const [dadosServico, setDadosServico] = useState({
    nome: '',
    duracao_minutos: '',
    preco: '',
    ativo: 'true'
  });
  const [dadosCombo, setDadosCombo] = useState({
    nome: '',
    servicos_selecionados: [],
    tipo_combo: 'Bronze',
    preco: '',
    ativo: 'true'
  });

const carregarServicos = useCallback(async () => {
  console.log('🔍 DEBUG CARREGAR SERVIÇOS - BARBEARIA ID:', userProfile?.barbearia_id);
  try {
    if (!userProfile?.barbearia_id) return;
    
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('barbearia_id', userProfile.barbearia_id)
      .order('nome');
    
    if (error) throw error;
    
    const servicosIndividuais = data.filter(item => item.Combo === 'Serviço');
    const combosLista = data.filter(item => item.Combo !== 'Serviço');
    
    setServicos(servicosIndividuais);
    setCombos(combosLista);
    
  } catch (error) {
    console.error('Erro ao carregar serviços:', error);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [userProfile?.barbearia_id]);

  useEffect(() => {
    carregarServicos();
  }, [carregarServicos]);

  // 🗑️ EXCLUIR ITEM
  const excluirItem = async (item) => {
    const confirmacao = window.confirm(`Excluir "${item.nome}"?`);
    if (!confirmacao) return;

    try {
const { error } = await supabase
  .from('servicos')
  .delete()
  .eq('id', item.id)
  .eq('barbearia_id', userProfile?.barbearia_id);

      if (error) throw error;
      
      await carregarServicos();
      mostrarPopupSucesso('Item excluído!');
      
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir item');
    }
  };
// 🔍 IDENTIFICAR SERVIÇOS DO COMBO PELO NOME
const identificarServicosDoCombo = (nomeCombo) => {
  const servicosEncontrados = [];
  const nomeNormalizado = nomeCombo.toLowerCase();
  
  servicos.forEach(servico => {
    const nomeServico = servico.nome.toLowerCase();
    
    if (nomeNormalizado.includes(nomeServico)) {
      servicosEncontrados.push(servico.id);
    }
  });
  
  return servicosEncontrados;
};
// 📝 MODAL SERVIÇO COM ESTADOS LOCAIS
const ServicoModal = React.memo(() => {
  // Estados locais do modal
  const [localNome, setLocalNome] = useState('');
  const [localDuracao, setLocalDuracao] = useState('');
  const [localPreco, setLocalPreco] = useState('');
  const [localAtivo, setLocalAtivo] = useState('true');


  // Sincronizar com dados globais apenas quando modal abrir
useEffect(() => {
  if (showServicoModal) {
    setTimeout(() => {
      setLocalNome(dadosServico.nome || '');
      setLocalDuracao(dadosServico.duracao_minutos || '');
      setLocalPreco(dadosServico.preco || '');
      setLocalAtivo(dadosServico.ativo || 'true');
    }, 50);
  }
}, []); // ← array vazio
  const salvarServicoLocal = async () => {
    try {
      if (!localNome.trim()) {
        alert('Nome do serviço é obrigatório');
        return;
      }
console.log('🔍 DEBUG BARBEARIA ID:', userProfile?.barbearia_id);
const servicoData = {
  nome: localNome.trim(),
  duracao_minutos: parseInt(localDuracao),
  preco: parseFloat(localPreco),
  Combo: 'Serviço',
  ativo: localAtivo === 'true',
  barbearia_id: userProfile?.barbearia_id,
  created_at: getBrasiliaDate().toISOString(),
  updated_at: getBrasiliaDate().toISOString()
};

      let error;
      if (servicoEditando) {
        ({ error } = await supabase
          .from('servicos')
          .update(servicoData)
          .eq('id', servicoEditando.id));
      } else {
        ({ error } = await supabase
          .from('servicos')
          .insert([servicoData]));
      }

      if (error) throw error;

      await carregarServicos();
      setShowServicoModal(false);
      setServicoEditando(null);
      setDadosServico({ nome: '', duracao_minutos: '', preco: '', ativo: 'true' });
      mostrarPopupSucesso(servicoEditando ? 'Serviço editado!' : 'Serviço criado!');
      
    } catch (error) {
      console.error('Erro ao salvar serviço:', error);
      alert('Erro ao salvar serviço');
    }
  };

  if (!showServicoModal) return null;
  
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.4)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }} onClick={() => setShowServicoModal(false)}>
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', padding: '24px',
        maxWidth: '400px', width: '100%', maxHeight: '90vh', overflow: 'auto'
      }} onClick={(e) => e.stopPropagation()}>
        
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B', margin: '0 0 20px 0' }}>
          {servicoEditando ? '✏️ Editar Serviço' : '➕ Novo Serviço'}
        </h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
            Nome do Serviço *
          </label>
          <input
            type="text"
            value={localNome}
            onChange={(e) => setLocalNome(e.target.value)}
            placeholder="Ex: Corte de cabelo"
            autoComplete="off"
            style={{
              width: '100%', padding: '12px', border: '1px solid #E2E8F0',
              borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
              Duração (min) *
            </label>
            <input
              type="number"
              value={localDuracao}
              onChange={(e) => setLocalDuracao(e.target.value)}
              placeholder="30"
              style={{
                width: '100%', padding: '12px', border: '1px solid #E2E8F0',
                borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
              Preço (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              value={localPreco}
              onChange={(e) => setLocalPreco(e.target.value)}
              placeholder="25.00"
              style={{
                width: '100%', padding: '12px', border: '1px solid #E2E8F0',
                borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
            Status
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={localAtivo === 'true'}
                onChange={() => setLocalAtivo('true')}
              />
              <span style={{ fontSize: '14px', color: '#10B981' }}>Ativo</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={localAtivo === 'false'}
                onChange={() => setLocalAtivo('false')}
              />
              <span style={{ fontSize: '14px', color: '#EF4444' }}>Inativo</span>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowServicoModal(false)}
            style={{
              flex: 1, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0',
              borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={salvarServicoLocal}
            style={{
              flex: 1, background: '#10B981', color: 'white', border: 'none',
              borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            {servicoEditando ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
});
// 🎁 MODAL COMBO COM ESTADOS LOCAIS
const ComboModal = React.memo(() => {
  // Estados locais do modal
  const [localNome, setLocalNome] = useState('');
  const [localDuracao, setLocalDuracao] = useState('');
  const [localServicosSelecionados, setLocalServicosSelecionados] = useState([]);
  const [localTipoCombo, setLocalTipoCombo] = useState('Bronze');
  const [localPreco, setLocalPreco] = useState('');
  const [localAtivo, setLocalAtivo] = useState('true');

  // Sincronizar com dados globais apenas quando modal abrir
useEffect(() => {
  if (showComboModal) {
    setTimeout(() => {
      setLocalNome(dadosCombo.nome || '');
      setLocalServicosSelecionados(dadosCombo.servicos_selecionados || []);
      setLocalTipoCombo(dadosCombo.tipo_combo || 'Bronze');
      setLocalPreco(dadosCombo.preco || '');
      setLocalDuracao(dadosCombo.duracao_minutos?.toString() || ''); // ← CORRIGIR AQUI
      setLocalAtivo(dadosCombo.ativo || 'true');
    }, 50);
  }
}, []);
// Atualizar nome automaticamente APENAS quando criando novo combo
useEffect(() => {
  // SÓ gerar nome automático se NÃO estiver editando
  if (!comboEditando && localServicosSelecionados.length > 0) {
    const nomesServicos = localServicosSelecionados.map(servicoId => {
      const servico = servicos.find(s => s.id === servicoId);
      return servico?.nome || '';
    }).filter(nome => nome !== '');
    
    const nomeGerado = nomesServicos.join(' + ');
    setLocalNome(nomeGerado);
  } else if (!comboEditando && localServicosSelecionados.length === 0) {
    setLocalNome('');
  }
  // Se estiver editando, mantém o nome original
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [localServicosSelecionados]);

  const salvarComboLocal = async () => {
    try {
      if (!localNome.trim()) {
        alert('Nome do combo é obrigatório');
        return;
      }
      if (localServicosSelecionados.length === 0) {
        alert('Selecione pelo menos um serviço');
        return;
      }

      // Calcular duração total
// Usar duração manual se preenchida, senão calcular automaticamente
const duracaoTotal = localDuracao ? 
  parseInt(localDuracao) : 
  localServicosSelecionados.reduce((total, servicoId) => {
    const servico = servicos.find(s => s.id === servicoId);
    return total + (servico?.duracao_minutos || 0);
  }, 0);
      // Gerar nome automaticamente baseado nos serviços selecionados
      const nomesServicos = localServicosSelecionados.map(servicoId => {
        const servico = servicos.find(s => s.id === servicoId);
        return servico?.nome || '';
      }).filter(nome => nome !== '');

      const nomeGerado = nomesServicos.join(' + ');

const comboData = {
  nome: nomeGerado || localNome.trim(),
  duracao_minutos: duracaoTotal,
  preco: parseFloat(localPreco),
  Combo: localTipoCombo,
  ativo: localAtivo === 'true',
  barbearia_id: userProfile?.barbearia_id,
  updated_at: getBrasiliaDate().toISOString()
};

      let error;
      if (comboEditando) {
        // EDITANDO - fazer UPDATE
        ({ error } = await supabase
          .from('servicos')
          .update(comboData)
          .eq('id', comboEditando.id));
      } else {
        // CRIANDO - fazer INSERT
        comboData.created_at = getBrasiliaDate().toISOString();
        ({ error } = await supabase
          .from('servicos')
          .insert([comboData]));
      }

      if (error) throw error;

      await carregarServicos();
      setShowComboModal(false);
      setComboEditando(null);
      setDadosCombo({
        nome: '',
        servicos_selecionados: [],
        tipo_combo: 'Bronze',
        preco: '',
        ativo: 'true'
      });
      mostrarPopupSucesso(comboEditando ? 'Combo editado com sucesso!' : 'Combo criado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao salvar combo:', error);
      alert('Erro ao salvar combo');
    }
  };

  if (!showComboModal) return null;
  
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.4)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }} onClick={() => setShowComboModal(false)}>
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', padding: '24px',
        maxWidth: '500px', width: '100%', maxHeight: '90vh', overflow: 'auto'
      }} onClick={(e) => e.stopPropagation()}>
        
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B', margin: '0 0 20px 0' }}>
          🎁 {comboEditando ? 'Editar Combo' : 'Criar Combo'}
        </h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
            Nome do Combo *
          </label>
<input
  type="text"
  value={localNome}
  onChange={(e) => setLocalNome(e.target.value)} // ← Esta linha pode ser removida
  placeholder="Selecione os serviços acima"
  autoComplete="off"
  disabled // ← ADICIONAR
  style={{
    width: '100%', padding: '12px', border: '1px solid #E2E8F0',
    borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box',
    backgroundColor: '#F8FAFC', color: '#64748B' // ← ADICIONAR cor de disabled
  }}
/>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
            Selecionar Serviços *
          </label>
          <div style={{ maxHeight: '150px', overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px' }}>
            {servicos.map((servico) => (
              <label key={servico.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px',
                cursor: 'pointer', borderRadius: '4px', marginBottom: '4px'
              }}>
                <input
                  type="checkbox"
                  checked={localServicosSelecionados.includes(servico.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setLocalServicosSelecionados(prev => [...prev, servico.id]);
                    } else {
                      setLocalServicosSelecionados(prev => prev.filter(id => id !== servico.id));
                    }
                  }}
                />
                <span style={{ fontSize: '14px', color: '#1E293B' }}>
                  {servico.nome} ({servico.duracao_minutos}min - R$ {formatCurrency(servico.preco)})
                </span>
              </label>
            ))}
          </div>
        </div>

<div style={{ marginBottom: '16px' }}>
  {/* PRIMEIRA LINHA - Tipo do Combo */}
  <div style={{ marginBottom: '12px' }}>
    <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
      Tipo do Combo *
    </label>
<CustomSelect
              value={localTipoCombo}
              onChange={setLocalTipoCombo}
              options={[
                { value: 'Bronze', label: 'Bronze' },
                { value: 'Prata', label: 'Prata' },
                { value: 'Ouro', label: 'Ouro' },
                { value: 'Diamante', label: 'Diamante' },
                { value: 'Cobre', label: 'Cobre' }
              ]}
              label=""
              placeholder="Selecionar tipo"
            />
  </div>

  {/* SEGUNDA LINHA - Duração e Preço lado a lado */}
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
    <div>
      <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
        Duração (min)
      </label>
      <input
        type="number"
        value={localDuracao}
        onChange={(e) => setLocalDuracao(e.target.value)}
        placeholder="Auto"
        style={{
          width: '100%', padding: '12px', border: '1px solid #E2E8F0',
          borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box'
        }}
      />
    </div>
    <div>
      <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
        Preço Final (R$) *
      </label>
      <input
        type="number"
        step="0.01"
        value={localPreco}
        onChange={(e) => setLocalPreco(e.target.value)}
        placeholder="35.00"
        style={{
          width: '100%', padding: '12px', border: '1px solid #E2E8F0',
          borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box'
        }}
      />
    </div>
  </div>
</div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
            Status
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={localAtivo === 'true'}
                onChange={() => setLocalAtivo('true')}
              />
              <span style={{ fontSize: '14px', color: '#10B981' }}>Ativo</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={localAtivo === 'false'}
                onChange={() => setLocalAtivo('false')}
              />
              <span style={{ fontSize: '14px', color: '#EF4444' }}>Inativo</span>
            </label>
          </div>
        </div>

        {localServicosSelecionados.length > 0 && (
          <div style={{
            background: '#F8FAFC', borderRadius: '8px', padding: '12px', marginBottom: '16px',
            fontSize: '12px', color: '#64748B'
          }}>
            <strong>Duração total: {localServicosSelecionados.reduce((total, servicoId) => {
              const servico = servicos.find(s => s.id === servicoId);
              return total + (servico?.duracao_minutos || 0);
            }, 0)} minutos</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowComboModal(false)}
            style={{
              flex: 1, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0',
              borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={salvarComboLocal}
            style={{
              flex: 1, background: '#FF6B35', color: 'white', border: 'none',
              borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            {comboEditando ? 'Salvar' : 'Criar Combo'}
          </button>
        </div>
      </div>
    </div>
  );
});
  return (
    <div style={{
      minHeight: '100vh', background: '#F8FAFC', paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title="Serviços" subtitle={`${servicos.length} serviços • ${combos.length} combos`} showBack />

      <div style={{ padding: '20px' }}>
        {/* SEÇÃO SERVIÇOS INDIVIDUAIS */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: 0 }}>
              🔧 Serviços Individuais
            </h3>
            <button
              onClick={() => {
                setServicoEditando(null);
                setDadosServico({ nome: '', duracao_minutos: '', preco: '', ativo: 'true' });
                setShowServicoModal(true);
              }}
              style={{
                background: '#10B981', color: 'white', border: 'none', borderRadius: '8px',
                padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Plus size={14} />
              Novo Serviço
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
            {servicos.map((servico) => (
              <div key={servico.id} style={{
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px',
                padding: '12px', opacity: servico.ativo ? 1 : 0.6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 4px 0' }}>
                    {servico.nome}
                  </h4>
                  <div style={{
                    background: servico.ativo ? '#DCFCE7' : '#FEE2E2',
                    color: servico.ativo ? '#166534' : '#B91C1C',
                    padding: '2px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: '600'
                  }}>
                    {servico.ativo ? 'ATIVO' : 'INATIVO'}
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 8px 0' }}>
                  ⏱️ {servico.duracao_minutos}min • 💰 R$ {formatCurrency(servico.preco)}
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => {
                      setServicoEditando(servico);
                      setDadosServico({
                        nome: servico.nome,
                        duracao_minutos: servico.duracao_minutos.toString(),
                        preco: servico.preco.toString(),
                        ativo: servico.ativo
                      });
                      setShowServicoModal(true);
                    }}
                    style={{
                      background: '#3B82F6', color: 'white', border: 'none', borderRadius: '4px',
                      padding: '4px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    <Edit size={10} />
                  </button>
                  <button
                    onClick={() => excluirItem(servico)}
                    style={{
                      background: '#EF4444', color: 'white', border: 'none', borderRadius: '4px',
                      padding: '4px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {servicos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94A3B8' }}>
              <Scissors size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p style={{ fontSize: '1rem' }}>Nenhum serviço cadastrado</p>
              <p style={{ fontSize: '0.875rem' }}>Clique em "Novo Serviço" para começar</p>
            </div>
          )}
        </div>

        {/* SEÇÃO COMBOS */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: 0 }}>
              🎁 Combos & Pacotes
            </h3>
            <button
onClick={() => {
  if (servicos.length === 0) {
    alert('Cadastre pelo menos um serviço antes de criar combos');
    return;
  }
  setComboEditando(null); // ← ADICIONAR ESTA LINHA
  setDadosCombo({
    nome: '', servicos_selecionados: [], tipo_combo: 'Bronze',
    preco: '', ativo: 'true'
  });
  setShowComboModal(true);
}}
              style={{
                background: '#FF6B35', color: 'white', border: 'none', borderRadius: '8px',
                padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Plus size={14} />
              Criar Combo
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {combos.map((combo) => (
              <div key={combo.id} style={{
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px',
                padding: '12px', opacity: combo.ativo ? 1 : 0.6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 2px 0' }}>
                      {combo.nome}
                    </h4>
                    <div style={{
                      background: combo.Combo === 'Diamante' ? '#DBEAFE' :
                                 combo.Combo === 'Ouro' ? '#FEF3C7' :
                                 combo.Combo === 'Prata' ? '#F1F5F9' :
                                 combo.Combo === 'Bronze' ? '#FED7AA' : '#FECACA',
                      color: combo.Combo === 'Diamante' ? '#1E40AF' :
                             combo.Combo === 'Ouro' ? '#92400E' :
                             combo.Combo === 'Prata' ? '#475569' :
                             combo.Combo === 'Bronze' ? '#C2410C' : '#B91C1C',
                      padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '600',
                      display: 'inline-block', marginBottom: '4px'
                    }}>
                      {combo.Combo}
                    </div>
                  </div>
                  <div style={{
                    background: combo.ativo ? '#DCFCE7' : '#FEE2E2',
                    color: combo.ativo ? '#166534' : '#B91C1C',
                    padding: '2px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: '600'
                  }}>
                    {combo.ativo ? 'ATIVO' : 'INATIVO'}
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 8px 0' }}>
                  ⏱️ {combo.duracao_minutos}min • 💰 R$ {formatCurrency(combo.preco)}
                </p>
<div style={{ display: 'flex', gap: '6px' }}>
  <button
onClick={() => {
  const servicosDoCombo = identificarServicosDoCombo(combo.nome);
  setComboEditando(combo);
  setDadosCombo({
    nome: combo.nome,
    servicos_selecionados: servicosDoCombo,
    tipo_combo: combo.Combo,
    preco: combo.preco.toString(),
    duracao_minutos: combo.duracao_minutos, // ← VERIFICAR SE ESTÁ AQUI
    ativo: combo.ativo ? 'true' : 'false'
  });
  setShowComboModal(true);
}}
    style={{
      background: '#3B82F6', color: 'white', border: 'none', borderRadius: '4px',
      padding: '4px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer'
    }}
  >
    <Edit size={10} />
  </button>
  <button
    onClick={() => excluirItem(combo)}
    style={{
      background: '#EF4444', color: 'white', border: 'none', borderRadius: '4px',
      padding: '4px 8px', fontSize: '10px', fontWeight: '600', cursor: 'pointer'
    }}
  >
    <X size={10} />
  </button>
</div>
              </div>
            ))}
          </div>

          {combos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94A3B8' }}>
              <Star size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p style={{ fontSize: '1rem' }}>Nenhum combo criado</p>
              <p style={{ fontSize: '0.875rem' }}>
                {servicos.length === 0 ? 'Cadastre serviços primeiro' : 'Clique em "Criar Combo" para começar'}
              </p>
            </div>
          )}
        </div>
      </div>

      <ServicoModal />
      <ComboModal />
    </div>
  );
};
const RelatoriosMenuScreen = () => {
  const [tipoRelatorio, setTipoRelatorio] = useState(null);
  
  if (tipoRelatorio === 'financeiro') {
    return <RelatoriosFinanceiroScreen onBack={() => setTipoRelatorio(null)} />;
  }
  if (tipoRelatorio === 'servicos') {
    return <RelatoriosServicosScreen onBack={() => setTipoRelatorio(null)} />;
  }
  if (tipoRelatorio === 'profissionais') {
    return <RelatoriosProfissionaisScreen onBack={() => setTipoRelatorio(null)} />;
  }
  if (tipoRelatorio === 'clientes') {
    return <RelatoriosClientesScreen onBack={() => setTipoRelatorio(null)} />;
  }
  
  if (tipoRelatorio === 'agendamentos') {
    return <RelatoriosAgendamentosScreen onBack={() => setTipoRelatorio(null)} />;
  }
  if (tipoRelatorio && tipoRelatorio !== 'financeiro' && tipoRelatorio !== 'servicos' && tipoRelatorio !== 'profissionais' && tipoRelatorio !== 'clientes' && tipoRelatorio !== 'agendamentos') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        paddingBottom: '100px'
      }}>
        <Header 
          title={`Relatório ${tipoRelatorio === 'profissionais' ? 'de Profissionais' : 
                               tipoRelatorio === 'clientes' ? 'de Clientes' : 'de Agendamentos'}`} 
          subtitle="Em desenvolvimento" 
          showBack={true}
          onBackAction={() => setTipoRelatorio(null)}
        />
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '60px 20px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🚧</div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 8px 0' }}>
            Em Desenvolvimento
          </h2>
          <p style={{ fontSize: '16px', color: '#64748B', margin: 0 }}>
            Este relatório estará disponível em breve
          </p>
        </div>
      </div>
    );

  }
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title="Relatórios" subtitle="Escolha o tipo de relatório" showBack />

      <div style={{ padding: '20px' }}>
<div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
         {/* RELATÓRIO FINANCEIRO */}
          <button
            onClick={() => setTipoRelatorio('financeiro')}
            style={{
              background: '#197a4c',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(69, 62, 151, 0.5)',
              minHeight: '80px',
              width: '100%',
            }}
          >
            <DollarSign size={24} color="#FFFFFF" />
            <div style={{ textAlign: 'center' }}>
              <div>Financeiro</div>
              <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}></div>
            </div>
          </button>

 {/* RELATÓRIO DE PROFISSIONAIS */}
          <button
            onClick={() => setTipoRelatorio('profissionais')}
            style={{
              background: '#5f0609',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(255, 143, 0, 0.5)',
              minHeight: '80px',
              width: '100%',
            }}
          >
            <Users size={24} color="#FFFFFF" />
            <div style={{ textAlign: 'center' }}>
              <div>Profissionais</div>
              <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}></div>
            </div>
          </button>

{/* RELATÓRIO DE SERVIÇOS */}
          <button
            onClick={() => setTipoRelatorio('servicos')}
            style={{
              background: '#000018',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(33, 150, 243, 0.5)',
              minHeight: '80px',
              width: '100%',
            }}
          >
            <Scissors size={24} color="#FFFFFF" />
            <div style={{ textAlign: 'center' }}>
              <div>Serviços</div>
              <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}></div>
            </div>
          </button>

{/* RELATÓRIO DE CLIENTES */}
          <button
            onClick={() => setTipoRelatorio('clientes')}
            style={{
              background: '#FF6B35',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(255, 107, 53, 0.5)',
              minHeight: '80px',
              width: '100%',
            }}
          >
            <User size={24} color="#FFFFFF" />
            <div style={{ textAlign: 'center' }}>
              <div>Clientes</div>
              <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}></div>
            </div>
          </button>

{/* RELATÓRIO DE AGENDAMENTOS */}
          <button
            onClick={() => setTipoRelatorio('agendamentos')}
            style={{
              background: '#030d4f',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(244, 67, 54, 0.5)',
              minHeight: '80px',
              width: '100%',
            }}
          >
            <Calendar size={24} color="#FFFFFF" />
            <div style={{ textAlign: 'center' }}>
              <div>Agendamentos</div>
              <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}></div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const RelatoriosClientesScreen = ({ onBack }) => {
  const [filtroInicio, setFiltroInicio] = useState(() => {
    const inicio = getBrasiliaDate();
    inicio.setDate(1); // Primeiro dia do mês
    return inicio.toISOString().split('T')[0];
  });
  
  const [filtroFim, setFiltroFim] = useState(getBrasiliaDateString());
  
  // Filtrar dados confirmados por período
  const dadosFiltrados = historicoConfirmados.filter(item => {
    if (item.status !== 'confirmado') return false;
    return item.data_agendamento >= filtroInicio && item.data_agendamento <= filtroFim;
  });

  // Calcular métricas de clientes
  const calcularMetricasClientes = () => {
    // Agrupar por cliente
    const porCliente = dadosFiltrados.reduce((acc, item) => {
      const cliente = item.cliente_nome || 'Cliente sem nome';
      if (!acc[cliente]) {
        acc[cliente] = {
          total: 0,
          quantidade: 0,
          primeiroAtendimento: item.data_agendamento,
          ultimoAtendimento: item.data_agendamento,
          servicos: [],
          profissionais: new Set(),
          valores: []
        };
      }
      acc[cliente].total += parseFloat(item.valor_servico || 0);
      acc[cliente].quantidade += 1;
      acc[cliente].servicos.push(item.servico);
      acc[cliente].profissionais.add(item.nome_profissional);
      acc[cliente].valores.push(parseFloat(item.valor_servico || 0));
      
      // Atualizar datas
      if (item.data_agendamento < acc[cliente].primeiroAtendimento) {
        acc[cliente].primeiroAtendimento = item.data_agendamento;
      }
      if (item.data_agendamento > acc[cliente].ultimoAtendimento) {
        acc[cliente].ultimoAtendimento = item.data_agendamento;
      }
      
      return acc;
    }, {});
    
    // Calcular métricas adicionais para cada cliente
    Object.keys(porCliente).forEach(cliente => {
      const dados = porCliente[cliente];
      dados.ticketMedio = dados.quantidade > 0 ? dados.total / dados.quantidade : 0;
      dados.profissionaisUnicos = dados.profissionais.size;
      
      // Calcular dias desde último atendimento
      const hoje = new Date();
      const ultimoAtendimento = new Date(dados.ultimoAtendimento + 'T00:00:00');
      dados.diasSemRetorno = Math.floor((hoje - ultimoAtendimento) / (1000 * 60 * 60 * 24));
      
      // Calcular período de relacionamento
      const primeiro = new Date(dados.primeiroAtendimento + 'T00:00:00');
      const ultimo = new Date(dados.ultimoAtendimento + 'T00:00:00');
      dados.diasRelacionamento = Math.floor((ultimo - primeiro) / (1000 * 60 * 60 * 24)) + 1;
      
      // Frequência (atendimentos por mês)
      dados.frequenciaMensal = dados.diasRelacionamento > 0 ? 
        (dados.quantidade * 30) / dados.diasRelacionamento : dados.quantidade;
        
      // Serviço favorito
      const servicosCount = dados.servicos.reduce((acc, servico) => {
        acc[servico] = (acc[servico] || 0) + 1;
        return acc;
      }, {});
      dados.servicoFavorito = Object.entries(servicosCount)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';
    });
    
    // Classificar clientes
    const clientesAtivos = Object.entries(porCliente).filter(([,dados]) => dados.diasSemRetorno <= 30);
    const clientesInativos = Object.entries(porCliente).filter(([,dados]) => dados.diasSemRetorno > 30);
    const clientesNovos = Object.entries(porCliente).filter(([,dados]) => dados.diasRelacionamento <= 30);
    const clientesFieis = Object.entries(porCliente).filter(([,dados]) => dados.quantidade >= 3);
    
    // Métricas gerais
    const totalClientes = Object.keys(porCliente).length;
    const faturamentoTotal = Object.values(porCliente).reduce((sum, c) => sum + c.total, 0);
    const ticketMedioGeral = totalClientes > 0 ? faturamentoTotal / totalClientes : 0;
    const atendimentosTotal = Object.values(porCliente).reduce((sum, c) => sum + c.quantidade, 0);
    
    return {
      porCliente,
      clientesAtivos: clientesAtivos.length,
      clientesInativos: clientesInativos.length,
      clientesNovos: clientesNovos.length,
      clientesFieis: clientesFieis.length,
      totalClientes,
      faturamentoTotal,
      ticketMedioGeral,
      atendimentosTotal,
      listaClientesInativos: clientesInativos
    };
  };

  const metricas = calcularMetricasClientes();
  
  // Rankings
  const rankingFidelidade = Object.entries(metricas.porCliente)
    .sort(([,a], [,b]) => b.quantidade - a.quantidade)
    .slice(0, 10);
    
  const rankingValor = Object.entries(metricas.porCliente)
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 10);
    
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title="Relatório de Clientes" subtitle={`${metricas.totalClientes} clientes analisados`} showBack={true} onBackAction={onBack} />

      <div style={{ padding: '20px' }}>
        {/* FILTROS */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 12px 0' }}>
            📅 Período de Análise
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                Data Início
              </label>
<CustomDatePicker
  value={filtroInicio}
  onChange={setFiltroInicio}
  label=""
/>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                Data Fim
              </label>
<CustomDatePicker
  value={filtroFim}
  onChange={setFiltroFim}
  label=""
/>
            </div>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Users size={16} color="#3B82F6" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Total de Clientes
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.totalClientes}
            </div>
            <div style={{ fontSize: '12px', color: '#3B82F6', fontWeight: '500' }}>
              No período
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Star size={16} color="#10B981" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Clientes Fiéis
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.clientesFieis}
            </div>
            <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '500' }}>
              3+ atendimentos
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={16} color="#F59E0B" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Clientes Novos
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.clientesNovos}
            </div>
            <div style={{ fontSize: '12px', color: '#F59E0B', fontWeight: '500' }}>
              Últimos 30 dias
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={16} color="#EF4444" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Clientes Inativos
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.clientesInativos}
            </div>
            <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: '500' }}>
              +30 dias sem retorno
            </div>
          </div>
        </div>

        {/* ANÁLISE DE RETENÇÃO */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            📊 Análise de Retenção
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div style={{ textAlign: 'center', padding: '16px', background: '#F8FAFC', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#10B981', marginBottom: '4px' }}>
                {metricas.totalClientes > 0 ? ((metricas.clientesAtivos / metricas.totalClientes) * 100).toFixed(1) : 0}%
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                CLIENTES ATIVOS
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                Últimos 30 dias
              </div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '16px', background: '#F8FAFC', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#8B5CF6', marginBottom: '4px' }}>
                {metricas.totalClientes > 0 ? ((metricas.clientesFieis / metricas.totalClientes) * 100).toFixed(1) : 0}%
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                TAXA DE FIDELIDADE
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                3+ atendimentos
              </div>
            </div>
          </div>
        </div>

        {/* RANKING FIDELIDADE */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            🏆 Top 10 Clientes Mais Fiéis
          </h3>
          {rankingFidelidade.length > 0 ? rankingFidelidade.map(([nome, dados], index) => (
            <div key={nome} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < rankingFidelidade.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  #{index + 1} {nome}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Serviço favorito: {dados.servicoFavorito} • {dados.diasSemRetorno} dias sem retorno
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#10B981' }}>
                  {dados.quantidade} atendimentos
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  R$ {formatCurrency(dados.total)} total
                </div>
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px' }}>
              Nenhum cliente no período
            </div>
          )}
        </div>

        {/* RANKING VALOR */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            💰 Top 10 Clientes por Valor
          </h3>
          {rankingValor.length > 0 ? rankingValor.map(([nome, dados], index) => (
            <div key={nome} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < rankingValor.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  #{index + 1} {nome}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {dados.quantidade} atendimentos • Ticket médio: R$ {formatCurrency(dados.ticketMedio)}
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#F59E0B' }}>
                R$ {formatCurrency(dados.total)}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px' }}>
              Nenhum cliente no período
            </div>
          )}
        </div>

        {/* CLIENTES INATIVOS - ALERTA */}
        {metricas.listaClientesInativos.length > 0 && (
          <div style={{
            background: '#FFFFFF', border: '1px solid #FEE2E2', borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#DC2626', margin: '0 0 16px 0' }}>
              ⚠️ Clientes Inativos (Ação Necessária)
            </h3>
            <div style={{ fontSize: '12px', color: '#DC2626', marginBottom: '12px', fontWeight: '600' }}>
              Clientes que não retornam há mais de 30 dias:
            </div>
            {metricas.listaClientesInativos.slice(0, 5).map(([nome, dados], index) => (
              <div key={nome} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: '#FEF2F2', borderRadius: '6px',
                marginBottom: index < 4 ? '6px' : '0'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>
                    {nome}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    {dados.quantidade} atendimentos • Último: {new Date(dados.ultimoAtendimento).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#DC2626' }}>
                  {dados.diasSemRetorno} dias
                </div>
              </div>
            ))}
            {metricas.listaClientesInativos.length > 5 && (
              <div style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', marginTop: '8px' }}>
                +{metricas.listaClientesInativos.length - 5} outros clientes inativos
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RelatoriosAgendamentosScreen = ({ onBack }) => {
  const [filtroInicio, setFiltroInicio] = useState(() => {
    const inicio = getBrasiliaDate();
    inicio.setDate(1); // Primeiro dia do mês
    return inicio.toISOString().split('T')[0];
  });
  
  const [filtroFim, setFiltroFim] = useState(getBrasiliaDateString());
  
  // Todos os agendamentos (confirmados + cancelados + não compareceu)
  const todosAgendamentos = historicoConfirmados.filter(item => {
    return item.data_agendamento >= filtroInicio && item.data_agendamento <= filtroFim;
  });
  
  // Separar por status
  const confirmados = todosAgendamentos.filter(item => item.status === 'confirmado');
  const cancelados = todosAgendamentos.filter(item => item.status === 'cancelado');
  const naoCompareceu = todosAgendamentos.filter(item => item.status === 'nao_compareceu');

  // Calcular métricas de agendamentos
  const calcularMetricasAgendamentos = () => {
    // Análise por horário
    const porHorario = todosAgendamentos.reduce((acc, item) => {
      const horario = item.horario || 'Sem horário';
      if (!acc[horario]) {
        acc[horario] = { total: 0, confirmados: 0, cancelados: 0, naoCompareceu: 0 };
      }
      acc[horario].total += 1;
      if (item.status === 'confirmado') acc[horario].confirmados += 1;
      if (item.status === 'cancelado') acc[horario].cancelados += 1;
      if (item.status === 'nao_compareceu') acc[horario].naoCompareceu += 1;
      return acc;
    }, {});
    
    // Análise por dia da semana
    const porDiaSemana = todosAgendamentos.reduce((acc, item) => {
      const data = new Date(item.data_agendamento + 'T00:00:00');
      const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'long' });
      if (!acc[diaSemana]) {
        acc[diaSemana] = { total: 0, confirmados: 0, cancelados: 0, naoCompareceu: 0 };
      }
      acc[diaSemana].total += 1;
      if (item.status === 'confirmado') acc[diaSemana].confirmados += 1;
      if (item.status === 'cancelado') acc[diaSemana].cancelados += 1;
      if (item.status === 'nao_compareceu') acc[diaSemana].naoCompareceu += 1;
      return acc;
    }, {});
    
    // Análise por profissional
    const porProfissional = todosAgendamentos.reduce((acc, item) => {
      const prof = item.nome_profissional || 'Sem profissional';
      if (!acc[prof]) {
        acc[prof] = { total: 0, confirmados: 0, cancelados: 0, naoCompareceu: 0 };
      }
      acc[prof].total += 1;
      if (item.status === 'confirmado') acc[prof].confirmados += 1;
      if (item.status === 'cancelado') acc[prof].cancelados += 1;
      if (item.status === 'nao_compareceu') acc[prof].naoCompareceu += 1;
      return acc;
    }, {});
    
    // Métricas gerais
    const totalAgendamentos = todosAgendamentos.length;
    const taxaConfirmacao = totalAgendamentos > 0 ? (confirmados.length / totalAgendamentos) * 100 : 0;
    const taxaCancelamento = totalAgendamentos > 0 ? (cancelados.length / totalAgendamentos) * 100 : 0;
    const taxaNaoComparecimento = totalAgendamentos > 0 ? (naoCompareceu.length / totalAgendamentos) * 100 : 0;
    
    return {
      porHorario,
      porDiaSemana,
      porProfissional,
      totalAgendamentos,
      confirmados: confirmados.length,
      cancelados: cancelados.length,
      naoCompareceu: naoCompareceu.length,
      taxaConfirmacao,
      taxaCancelamento,
      taxaNaoComparecimento
    };
  };

  const metricas = calcularMetricasAgendamentos();
  
  // Rankings
  const horariosPopulares = Object.entries(metricas.porHorario)
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 5);
    
  const diasPopulares = Object.entries(metricas.porDiaSemana)
    .sort(([,a], [,b]) => b.total - a.total);
    
  const profissionaisOcupacao = Object.entries(metricas.porProfissional)
    .sort(([,a], [,b]) => b.total - a.total);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title="Relatório de Agendamentos" subtitle={`${metricas.totalAgendamentos} agendamentos analisados`} showBack={true} onBackAction={onBack} />

      <div style={{ padding: '20px' }}>
        {/* FILTROS */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 12px 0' }}>
            📅 Período de Análise
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                Data Início
              </label>
<CustomDatePicker
  value={filtroInicio}
  onChange={setFiltroInicio}
  label=""
/>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                Data Fim
              </label>
<CustomDatePicker
  value={filtroFim}
  onChange={setFiltroFim}
  label=""
/>
            </div>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Calendar size={16} color="#3B82F6" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Total Agendamentos
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.totalAgendamentos}
            </div>
            <div style={{ fontSize: '12px', color: '#3B82F6', fontWeight: '500' }}>
              No período
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CheckCircle size={16} color="#10B981" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Taxa de Confirmação
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.taxaConfirmacao.toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '500' }}>
              {metricas.confirmados} confirmados
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <XCircle size={16} color="#EF4444" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Taxa de Cancelamento
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.taxaCancelamento.toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: '500' }}>
              {metricas.cancelados} cancelados
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={16} color="#F59E0B" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Não Compareceram
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.taxaNaoComparecimento.toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', color: '#F59E0B', fontWeight: '500' }}>
              {metricas.naoCompareceu} no-shows
            </div>
          </div>
        </div>

        {/* ANÁLISE DE PERFORMANCE */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            📊 Análise de Performance
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ textAlign: 'center', padding: '16px', background: '#DCFCE7', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#10B981', marginBottom: '4px' }}>
                {metricas.taxaConfirmacao.toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: '#064E3B', fontWeight: '600' }}>
                CONFIRMAÇÃO
              </div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '16px', background: '#FEE2E2', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#EF4444', marginBottom: '4px' }}>
                {metricas.taxaCancelamento.toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: '#7F1D1D', fontWeight: '600' }}>
                CANCELAMENTO
              </div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '16px', background: '#FEF3C7', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#F59E0B', marginBottom: '4px' }}>
                {metricas.taxaNaoComparecimento.toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: '#78350F', fontWeight: '600' }}>
                NO-SHOW
              </div>
            </div>
          </div>
        </div>

        {/* HORÁRIOS MAIS POPULARES */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            🕐 Top 5 Horários Mais Populares
          </h3>
          {horariosPopulares.length > 0 ? horariosPopulares.map(([horario, dados], index) => (
            <div key={horario} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < horariosPopulares.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  #{index + 1} {horario}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Confirmações: {dados.confirmados} • Cancelamentos: {dados.cancelados}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#3B82F6' }}>
                  {dados.total} agendamentos
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  {((dados.confirmados / dados.total) * 100).toFixed(1)}% confirmação
                </div>
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px' }}>
              Nenhum agendamento no período
            </div>
          )}
        </div>

        {/* DIAS DA SEMANA */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            📅 Análise por Dia da Semana
          </h3>
          {diasPopulares.map(([dia, dados], index) => (
            <div key={dia} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < diasPopulares.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', textTransform: 'capitalize' }}>
                  {dia}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Taxa de confirmação: {((dados.confirmados / dados.total) * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#8B5CF6' }}>
                  {dados.total} agendamentos
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  {dados.confirmados} confirmados
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* OCUPAÇÃO POR PROFISSIONAL */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            👨‍💼 Ocupação por Profissional
          </h3>
          {profissionaisOcupacao.length > 0 ? profissionaisOcupacao.map(([nome, dados], index) => (
            <div key={nome} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < profissionaisOcupacao.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  {nome}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Confirmação: {((dados.confirmados / dados.total) * 100).toFixed(1)}% • 
                  No-show: {((dados.naoCompareceu / dados.total) * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#F59E0B' }}>
                  {dados.total} agendamentos
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  {dados.confirmados} efetivos
                </div>
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px' }}>
              Nenhum profissional com agendamentos
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RelatoriosProfissionaisScreen = ({ onBack }) => {
  const [filtroInicio, setFiltroInicio] = useState(() => {
    const inicio = getBrasiliaDate();
    inicio.setDate(1); // Primeiro dia do mês
    return inicio.toISOString().split('T')[0];
  });
  
  const [filtroFim, setFiltroFim] = useState(getBrasiliaDateString());
  
  // Filtrar dados confirmados por período
  const dadosFiltrados = historicoConfirmados.filter(item => {
    if (item.status !== 'confirmado') return false;
    return item.data_agendamento >= filtroInicio && item.data_agendamento <= filtroFim;
  });

  // Calcular métricas de profissionais
  const calcularMetricasProfissionais = () => {
    // Agrupar por profissional
    const porProfissional = dadosFiltrados.reduce((acc, item) => {
      const prof = item.nome_profissional || 'Sem profissional';
      if (!acc[prof]) {
        acc[prof] = {
          total: 0,
          quantidade: 0,
          clientes: new Set(),
          servicos: [],
          valores: []
        };
      }
      acc[prof].total += parseFloat(item.valor_servico || 0);
      acc[prof].quantidade += 1;
      acc[prof].clientes.add(item.cliente_nome);
      acc[prof].servicos.push(item.servico);
      acc[prof].valores.push(parseFloat(item.valor_servico || 0));
      return acc;
    }, {});
    
    // Converter Set para array e calcular métricas adicionais
    Object.keys(porProfissional).forEach(prof => {
      const dados = porProfissional[prof];
      dados.clientesUnicos = dados.clientes.size;
      dados.ticketMedio = dados.quantidade > 0 ? dados.total / dados.quantidade : 0;
      dados.faturamentoPorCliente = dados.clientesUnicos > 0 ? dados.total / dados.clientesUnicos : 0;
      
      // Serviços mais realizados por este profissional
      const servicosCount = dados.servicos.reduce((acc, servico) => {
        acc[servico] = (acc[servico] || 0) + 1;
        return acc;
      }, {});
      dados.servicoFavorito = Object.entries(servicosCount)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';
    });
    
    // Métricas gerais
    const totalAtendimentos = dadosFiltrados.length;
    const totalFaturamento = dadosFiltrados.reduce((sum, item) => sum + parseFloat(item.valor_servico || 0), 0);
    const profissionaisAtivos = Object.keys(porProfissional).length;
    const ticketMedioGeral = totalAtendimentos > 0 ? totalFaturamento / totalAtendimentos : 0;
    
    return {
      porProfissional,
      totalAtendimentos,
      totalFaturamento,
      profissionaisAtivos,
      ticketMedioGeral
    };
  };

  const metricas = calcularMetricasProfissionais();
  
  // Rankings
  const rankingProdutividade = Object.entries(metricas.porProfissional)
    .sort(([,a], [,b]) => b.quantidade - a.quantidade);
    
  const rankingFaturamento = Object.entries(metricas.porProfissional)
    .sort(([,a], [,b]) => b.total - a.total);
    
  const rankingTicketMedio = Object.entries(metricas.porProfissional)
    .sort(([,a], [,b]) => b.ticketMedio - a.ticketMedio);
    
  const rankingClientes = Object.entries(metricas.porProfissional)
    .sort(([,a], [,b]) => b.clientesUnicos - a.clientesUnicos);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title="Relatório de Profissionais" subtitle={`${dadosFiltrados.length} atendimentos analisados`} showBack={true} onBackAction={onBack} />

      <div style={{ padding: '20px' }}>
        {/* FILTROS */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 12px 0' }}>
            📅 Período de Análise
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                Data Início
              </label>
<CustomDatePicker
  value={filtroInicio}
  onChange={setFiltroInicio}
  label=""
/>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                Data Fim
              </label>
<CustomDatePicker
  value={filtroFim}
  onChange={setFiltroFim}
  label=""
/>
            </div>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Users size={16} color="#3B82F6" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Profissionais Ativos
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.profissionaisAtivos}
            </div>
            <div style={{ fontSize: '12px', color: '#3B82F6', fontWeight: '500' }}>
              Com atendimentos
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Scissors size={16} color="#10B981" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Total Atendimentos
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.totalAtendimentos}
            </div>
            <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '500' }}>
              No período
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <DollarSign size={16} color="#F59E0B" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Ticket Médio Geral
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              R$ {formatCurrency(metricas.ticketMedioGeral)}
            </div>
            <div style={{ fontSize: '12px', color: '#F59E0B', fontWeight: '500' }}>
              Por atendimento
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={16} color="#8B5CF6" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Média por Profissional
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.profissionaisAtivos > 0 ? Math.round(metricas.totalAtendimentos / metricas.profissionaisAtivos) : 0}
            </div>
            <div style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: '500' }}>
              Atendimentos/profissional
            </div>
          </div>
        </div>

        {/* RANKING PRODUTIVIDADE */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            🏆 Ranking de Produtividade
          </h3>
          {rankingProdutividade.length > 0 ? rankingProdutividade.map(([nome, dados], index) => (
            <div key={nome} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < rankingProdutividade.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  #{index + 1} {nome}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {dados.clientesUnicos} clientes únicos • Serviço favorito: {dados.servicoFavorito}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#3B82F6' }}>
                  {dados.quantidade} atendimentos
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  R$ {formatCurrency(dados.ticketMedio)} ticket médio
                </div>
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px' }}>
              Nenhum atendimento no período
            </div>
          )}
        </div>

        {/* RANKING FATURAMENTO */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            💰 Ranking de Faturamento
          </h3>
          {rankingFaturamento.length > 0 ? rankingFaturamento.map(([nome, dados], index) => (
            <div key={nome} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < rankingFaturamento.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  #{index + 1} {nome}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {dados.quantidade} atendimentos • R$ {formatCurrency(dados.faturamentoPorCliente)} por cliente
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#10B981' }}>
                R$ {formatCurrency(dados.total)}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px' }}>
              Nenhum faturamento no período
            </div>
          )}
        </div>

        {/* ANÁLISE DE PERFORMANCE */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            📊 Análise de Performance Individual
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Maior Ticket Médio */}
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>
                🎯 MAIOR TICKET MÉDIO
              </div>
              {rankingTicketMedio[0] && (
                <>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#F59E0B' }}>
                    {rankingTicketMedio[0][0]}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    R$ {formatCurrency(rankingTicketMedio[0][1].ticketMedio)}
                  </div>
                </>
              )}
            </div>
            
            {/* Mais Clientes Únicos */}
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>
                👥 MAIS CLIENTES ÚNICOS
              </div>
              {rankingClientes[0] && (
                <>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#8B5CF6' }}>
                    {rankingClientes[0][0]}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    {rankingClientes[0][1].clientesUnicos} clientes
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* DETALHAMENTO POR PROFISSIONAL */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            📋 Detalhamento Completo
          </h3>
          {Object.entries(metricas.porProfissional).map(([nome, dados], index) => (
            <div key={nome} style={{
              border: '1px solid #F1F5F9',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: index < Object.keys(metricas.porProfissional).length - 1 ? '12px' : '0'
            }}>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', marginBottom: '8px' }}>
                👨‍💼 {nome}
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: '12px',
                color: '#64748B'
              }}>
                <div>
                  <strong>Atendimentos:</strong> {dados.quantidade}
                </div>
                <div>
                  <strong>Faturamento:</strong> R$ {formatCurrency(dados.total)}
                </div>
                <div>
                  <strong>Clientes únicos:</strong> {dados.clientesUnicos}
                </div>
                <div>
                  <strong>Ticket médio:</strong> R$ {formatCurrency(dados.ticketMedio)}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>Serviço mais realizado:</strong> {dados.servicoFavorito}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RelatoriosServicosScreen = ({ onBack }) => {
  const [filtroInicio, setFiltroInicio] = useState(() => {
    const inicio = getBrasiliaDate();
    inicio.setDate(1); // Primeiro dia do mês
    return inicio.toISOString().split('T')[0];
  });
  
  const [filtroFim, setFiltroFim] = useState(getBrasiliaDateString());
  
  // Filtrar dados confirmados por período
  const dadosFiltrados = historicoConfirmados.filter(item => {
    if (item.status !== 'confirmado') return false;
    return item.data_agendamento >= filtroInicio && item.data_agendamento <= filtroFim;
  });

  // Calcular métricas de serviços
  const calcularMetricasServicos = () => {
    // Separar serviços individuais de combos
    const servicos = [];
    const combos = [];
    
    dadosFiltrados.forEach(item => {
      const servicoNome = item.servico || 'Sem serviço';
      const tipoCombo = identificarTipoCombo(servicoNome);
      
      if (tipoCombo) {
        combos.push({
          nome: servicoNome,
          tipo: tipoCombo,
          valor: parseFloat(item.valor_servico || 0),
          data: item.data_agendamento,
          profissional: item.nome_profissional
        });
      } else {
        servicos.push({
          nome: servicoNome,
          valor: parseFloat(item.valor_servico || 0),
          data: item.data_agendamento,
          profissional: item.nome_profissional
        });
      }
    });
    
    // Análise de serviços individuais
    const servicosStats = servicos.reduce((acc, item) => {
      if (!acc[item.nome]) {
        acc[item.nome] = { total: 0, quantidade: 0, valores: [] };
      }
      acc[item.nome].total += item.valor;
      acc[item.nome].quantidade += 1;
      acc[item.nome].valores.push(item.valor);
      return acc;
    }, {});
    
    // Análise de combos
    const combosStats = combos.reduce((acc, item) => {
      if (!acc[item.nome]) {
        acc[item.nome] = { total: 0, quantidade: 0, tipo: item.tipo, valores: [] };
      }
      acc[item.nome].total += item.valor;
      acc[item.nome].quantidade += 1;
      acc[item.nome].valores.push(item.valor);
      return acc;
    }, {});
    
    // Análise por tipo de combo
    const porTipoCombo = combos.reduce((acc, item) => {
      if (!acc[item.tipo]) {
        acc[item.tipo] = { total: 0, quantidade: 0 };
      }
      acc[item.tipo].total += item.valor;
      acc[item.tipo].quantidade += 1;
      return acc;
    }, {});
    
    // Métricas gerais
    const totalServicos = Object.values(servicosStats).reduce((sum, s) => sum + s.quantidade, 0);
    const totalCombos = Object.values(combosStats).reduce((sum, c) => sum + c.quantidade, 0);
    const faturamentoServicos = Object.values(servicosStats).reduce((sum, s) => sum + s.total, 0);
    const faturamentoCombos = Object.values(combosStats).reduce((sum, c) => sum + c.total, 0);
    
    return {
      servicosStats,
      combosStats,
      porTipoCombo,
      totalServicos,
      totalCombos,
      faturamentoServicos,
      faturamentoCombos,
      servicosIndividuais: servicos.length,
      combosVendidos: combos.length
    };
  };

  const metricas = calcularMetricasServicos();
  
  // Top 5 serviços individuais
  const topServicos = Object.entries(metricas.servicosStats)
    .sort(([,a], [,b]) => b.quantidade - a.quantidade)
    .slice(0, 5);
    
  // Top 5 combos
  const topCombos = Object.entries(metricas.combosStats)
    .sort(([,a], [,b]) => b.quantidade - a.quantidade)
    .slice(0, 5);
    
  // Ranking tipos de combo
  const rankingTipos = Object.entries(metricas.porTipoCombo)
    .sort(([,a], [,b]) => b.quantidade - a.quantidade);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title="Relatório de Serviços" subtitle={`${dadosFiltrados.length} atendimentos analisados`} showBack={true} onBackAction={onBack} />

      <div style={{ padding: '20px' }}>
        {/* FILTROS */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 12px 0' }}>
            📅 Período de Análise
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                Data Início
              </label>
<CustomDatePicker
  value={filtroInicio}
  onChange={setFiltroInicio}
  label=""
/>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                Data Fim
              </label>
<CustomDatePicker
  value={filtroFim}
  onChange={setFiltroFim}
  label=""
/>
            </div>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Scissors size={16} color="#3B82F6" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Serviços Vendidos
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.totalServicos}
            </div>
            <div style={{ fontSize: '12px', color: '#3B82F6', fontWeight: '500' }}>
              Individuais
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Star size={16} color="#FF6B35" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Combos Vendidos
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.totalCombos}
            </div>
            <div style={{ fontSize: '12px', color: '#FF6B35', fontWeight: '500' }}>
              Pacotes
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <DollarSign size={16} color="#10B981" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Receita Serviços
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              R$ {formatCurrency(metricas.faturamentoServicos)}
            </div>
            <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '500' }}>
              Individuais
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={16} color="#8B5CF6" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Receita Combos
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              R$ {formatCurrency(metricas.faturamentoCombos)}
            </div>
            <div style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: '500' }}>
              Pacotes
            </div>
          </div>
        </div>

        {/* COMPARATIVO SERVIÇOS VS COMBOS */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            ⚖️ Serviços vs Combos
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ textAlign: 'center', padding: '16px', background: '#F8FAFC', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#3B82F6', marginBottom: '4px' }}>
                {metricas.totalServicos > 0 ? ((metricas.totalServicos / (metricas.totalServicos + metricas.totalCombos)) * 100).toFixed(1) : 0}%
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                SERVIÇOS INDIVIDUAIS
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                {metricas.totalServicos} vendas
              </div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '16px', background: '#F8FAFC', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#FF6B35', marginBottom: '4px' }}>
                {metricas.totalCombos > 0 ? ((metricas.totalCombos / (metricas.totalServicos + metricas.totalCombos)) * 100).toFixed(1) : 0}%
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                COMBOS/PACOTES
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                {metricas.totalCombos} vendas
              </div>
            </div>
          </div>
        </div>

        {/* TOP SERVIÇOS INDIVIDUAIS */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            🔧 Top Serviços Individuais
          </h3>
          {topServicos.length > 0 ? topServicos.map(([nome, dados], index) => (
            <div key={nome} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < topServicos.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  #{index + 1} {nome}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {dados.quantidade} vendas • Ticket médio: R$ {formatCurrency(dados.total / dados.quantidade)}
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#3B82F6' }}>
                R$ {formatCurrency(dados.total)}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px' }}>
              Nenhum serviço individual vendido no período
            </div>
          )}
        </div>

        {/* TOP COMBOS */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            🎁 Top Combos
          </h3>
          {topCombos.length > 0 ? topCombos.map(([nome, dados], index) => (
            <div key={nome} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < topCombos.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  #{index + 1} {nome}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {dados.quantidade} vendas • Ticket médio: R$ {formatCurrency(dados.total / dados.quantidade)}
                </div>
                <div style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: dados.tipo === 'Diamante' ? '#DBEAFE' :
                             dados.tipo === 'Ouro' ? '#FEF3C7' :
                             dados.tipo === 'Prata' ? '#F1F5F9' :
                             dados.tipo === 'Bronze' ? '#FED7AA' : '#E5E7EB',
                  color: dados.tipo === 'Diamante' ? '#1E40AF' :
                         dados.tipo === 'Ouro' ? '#92400E' :
                         dados.tipo === 'Prata' ? '#475569' :
                         dados.tipo === 'Bronze' ? '#C2410C' : '#374151',
                  fontWeight: '700',
                  display: 'inline-block',
                  marginTop: '4px'
                }}>
                  {dados.tipo?.toUpperCase()}
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#FF6B35' }}>
                R$ {formatCurrency(dados.total)}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px' }}>
              Nenhum combo vendido no período
            </div>
          )}
        </div>

        {/* ANÁLISE POR TIPO DE COMBO */}
        {rankingTipos.length > 0 && (
          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
              🏆 Ranking por Tipo de Combo
            </h3>
            {rankingTipos.map(([tipo, dados], index) => (
              <div key={tipo} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px', background: '#F8FAFC', borderRadius: '8px',
                marginBottom: index < rankingTipos.length - 1 ? '8px' : '0'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                    #{index + 1} Combo {tipo}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    {dados.quantidade} vendas • Ticket médio: R$ {formatCurrency(dados.total / dados.quantidade)}
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#8B5CF6' }}>
                  R$ {formatCurrency(dados.total)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
const RelatoriosFinanceiroScreen = ({ onBack }) => {
  const [filtroInicio, setFiltroInicio] = useState(() => {
    const inicio = getBrasiliaDate();
    inicio.setDate(1); // Primeiro dia do mês
    return inicio.toISOString().split('T')[0];
  });
  
  const [filtroFim, setFiltroFim] = useState(getBrasiliaDateString());
  
  // Filtrar dados confirmados por período
  const dadosFiltrados = historicoConfirmados.filter(item => {
    if (item.status !== 'confirmado') return false;
    return item.data_agendamento >= filtroInicio && item.data_agendamento <= filtroFim;
  });

  // Calcular métricas financeiras
  const calcularMetricas = () => {
    const faturamentoTotal = dadosFiltrados.reduce((sum, item) => sum + parseFloat(item.valor_servico || 0), 0);
    const quantidadeAtendimentos = dadosFiltrados.length;
    const ticketMedio = quantidadeAtendimentos > 0 ? faturamentoTotal / quantidadeAtendimentos : 0;
    
    // Faturamento por profissional
    const porProfissional = dadosFiltrados.reduce((acc, item) => {
      const prof = item.nome_profissional || 'Sem profissional';
      if (!acc[prof]) acc[prof] = { total: 0, quantidade: 0 };
      acc[prof].total += parseFloat(item.valor_servico || 0);
      acc[prof].quantidade += 1;
      return acc;
    }, {});
    
 // Faturamento por serviço
    const porServico = dadosFiltrados.reduce((acc, item) => {
      const servico = item.servico || 'Sem serviço';
      const tipoCombo = identificarTipoCombo(servico);
      
      if (!tipoCombo) { // É um serviço individual
        if (!acc[servico]) acc[servico] = { total: 0, quantidade: 0 };
        acc[servico].total += parseFloat(item.valor_servico || 0);
        acc[servico].quantidade += 1;
      }
      return acc;
    }, {});
    
    // Faturamento por combo
    const porCombo = dadosFiltrados.reduce((acc, item) => {
      const servico = item.servico || 'Sem serviço';
      const tipoCombo = identificarTipoCombo(servico);
      
      if (tipoCombo) { // É um combo
        if (!acc[servico]) acc[servico] = { total: 0, quantidade: 0 };
        acc[servico].total += parseFloat(item.valor_servico || 0);
        acc[servico].quantidade += 1;
      }
      return acc;
    }, {});
    
    // Faturamento diário (para gráfico)
    const porDia = dadosFiltrados.reduce((acc, item) => {
      const data = new Date(item.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      });
      if (!acc[data]) acc[data] = 0;
      acc[data] += parseFloat(item.valor_servico || 0);
      return acc;
    }, {});
    
    return {
      faturamentoTotal,
      quantidadeAtendimentos,
      ticketMedio,
      porProfissional,
      porServico,
      porCombo,
      porDia
    };
  };

  const metricas = calcularMetricas();
  
  // Dados para gráfico de linha (faturamento diário)
  const dadosGrafico = Object.entries(metricas.porDia).map(([data, valor]) => ({
    data,
    valor: parseFloat(valor.toFixed(2))
  })).sort((a, b) => {
    const [diaA, mesA] = a.data.split('/');
    const [diaB, mesB] = b.data.split('/');
    const dataA = new Date(2024, parseInt(mesA) - 1, parseInt(diaA));
    const dataB = new Date(2024, parseInt(mesB) - 1, parseInt(diaB));
    return dataA - dataB;
  });

  // Top 5 profissionais
  const topProfissionais = Object.entries(metricas.porProfissional)
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 5);
    
// Top 5 serviços
  const topServicos = Object.entries(metricas.porServico)
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 5);
    
  // Top 5 combos
  const topCombos = Object.entries(metricas.porCombo)
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 5);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
    <Header title="Relatórios Financeiros" subtitle={`${dadosFiltrados.length} atendimentos analisados`} showBack={true} onBackAction={onBack} />

      <div style={{ padding: '20px' }}>
        {/* FILTROS */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B', margin: '0 0 12px 0' }}>
            📅 Período de Análise
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                Data Início
              </label>
<CustomDatePicker
  value={filtroInicio}
  onChange={setFiltroInicio}
  label=""
/>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                Data Fim
              </label>
<CustomDatePicker
  value={filtroFim}
  onChange={setFiltroFim}
  label=""
/>
            </div>
          </div>
        </div>

        {/* CARDS DE MÉTRICAS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <DollarSign size={16} color="#10B981" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Faturamento Total
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              R$ {formatCurrency(metricas.faturamentoTotal)}
            </div>
            <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '500' }}>
              Período selecionado
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={16} color="#3B82F6" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Ticket Médio
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              R$ {formatCurrency(metricas.ticketMedio)}
            </div>
            <div style={{ fontSize: '12px', color: '#3B82F6', fontWeight: '500' }}>
              Por atendimento
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Users size={16} color="#F59E0B" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Atendimentos
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              {metricas.quantidadeAtendimentos}
            </div>
            <div style={{ fontSize: '12px', color: '#F59E0B', fontWeight: '500' }}>
              Confirmados
            </div>
          </div>

          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Star size={16} color="#8B5CF6" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Média Diária
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              R$ {formatCurrency(dadosGrafico.length > 0 ? metricas.faturamentoTotal / dadosGrafico.length : 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: '500' }}>
              Receita/dia
            </div>
          </div>
        </div>

       {/* GRÁFICO DE FATURAMENTO DIÁRIO */}
        {dadosGrafico.length > 0 && (
          <div style={{
            background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
            padding: '20px', marginBottom: '24px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
              📈 Faturamento Diário
            </h3>
            <div style={{ 
              display: 'flex', 
              alignItems: 'end', 
              gap: '4px', 
              height: '200px',
              padding: '16px',
              background: '#F8FAFC',
              borderRadius: '8px',
              overflow: 'auto'
            }}>
              {dadosGrafico.map((item, index) => {
                const maxValor = Math.max(...dadosGrafico.map(d => d.valor));
                const altura = maxValor > 0 ? (item.valor / maxValor) * 160 : 10;
                
                return (
                  <div key={index} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '60px'
                  }}>
                    <div style={{
                      fontSize: '10px',
                      color: '#64748B',
                      marginBottom: '4px',
                      fontWeight: '600'
                    }}>
                      R$ {item.valor.toFixed(0)}
                    </div>
                    <div style={{
                      width: '24px',
                      height: `${altura}px`,
                      background: 'linear-gradient(to top, #10B981, #34D399)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: '10px'
                    }} />
                    <div style={{
                      fontSize: '9px',
                      color: '#94A3B8',
                      marginTop: '8px',
                      textAlign: 'center',
                      transform: 'rotate(-45deg)',
                      transformOrigin: 'center'
                    }}>
                      {item.data}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TOP PROFISSIONAIS */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            🏆 Top Profissionais
          </h3>
          {topProfissionais.map(([nome, dados], index) => (
            <div key={nome} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < topProfissionais.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  #{index + 1} {nome}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {dados.quantidade} atendimentos
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#10B981' }}>
                R$ {formatCurrency(dados.total)}
              </div>
            </div>
          ))}
        </div>

       {/* TOP SERVIÇOS */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            🔧 Top Serviços Individuais
          </h3>
          {topServicos.length > 0 ? topServicos.map(([servico, dados], index) => (
            <div key={servico} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < topServicos.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  #{index + 1} {servico}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {dados.quantidade} vendas
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#3B82F6' }}>
                R$ {formatCurrency(dados.total)}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px' }}>
              Nenhum serviço individual vendido no período
            </div>
          )}
        </div>

        {/* TOP COMBOS */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #F1F5F9', borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B', margin: '0 0 16px 0' }}>
            🎁 Top Combos
          </h3>
          {topCombos.length > 0 ? topCombos.map(([combo, dados], index) => (
            <div key={combo} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px', background: '#F8FAFC', borderRadius: '8px',
              marginBottom: index < topCombos.length - 1 ? '8px' : '0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                  #{index + 1} {combo}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {dados.quantidade} vendas
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#FF6B35' }}>
                R$ {formatCurrency(dados.total)}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', padding: '20px' }}>
              Nenhum combo vendido no período
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
  if (appLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #F1F5F9',
          borderTop: '3px solid #FF6B35',
          borderRadius: '50%',
          marginBottom: '16px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#64748B', fontSize: '14px', fontWeight: '500' }}>
          Carregando dados do Supabase...
        </p>
<p style={{ color: '#94A3B8', fontSize: '12px', marginTop: '8px' }}>
  Carregando sistema...
</p>
      </div>
    );
  }

const FinanceiroScreen = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title="Financeiro" subtitle="Gestão financeira completa" showBack />

      <div style={{ padding: '20px 4px' }}>
        {/* Cards de Faturamento */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Faturamento Hoje */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #F1F5F9',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <DollarSign size={16} color="#10B981" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Hoje
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              R$ {formatCurrency(faturamentoDia)}
            </div>
            <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '500' }}>
              Confirmado
            </div>
          </div>

          {/* Faturamento Semana */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #F1F5F9',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={16} color="#3B82F6" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Semana
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              R$ {formatCurrency(faturamentoSemana)}
            </div>
            <div style={{ fontSize: '12px', color: '#3B82F6', fontWeight: '500' }}>
              Esta semana
            </div>
          </div>

          {/* Faturamento Mês */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #F1F5F9',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Calendar size={16} color="#F59E0B" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Mês
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              R$ {formatCurrency(faturamentoMes)}
            </div>
            <div style={{ fontSize: '12px', color: '#F59E0B', fontWeight: '500' }}>
              Este mês
            </div>
          </div>

          {/* Faturamento Total */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #F1F5F9',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Star size={16} color="#FF6B35" />
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                Total
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
              R$ {formatCurrency(faturamentoTotal)}
            </div>
            <div style={{ fontSize: '12px', color: '#FF6B35', fontWeight: '500' }}>
              Histórico
            </div>
          </div>
        </div>

        {/* Seção de Análises */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1E293B',
            margin: '0 0 16px 0'
          }}>
            📊 Análise Financeira
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ textAlign: 'center', padding: '12px', background: '#F8FAFC', borderRadius: '8px' }}>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px 0' }}>Média Diária</p>
              <p style={{ fontSize: '16px', fontWeight: '700', color: '#10B981', margin: 0 }}>
                R$ {formatCurrency(faturamentoMes / getBrasiliaDate().getDate())}
              </p>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#F8FAFC', borderRadius: '8px' }}>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 4px 0' }}>Clientes Atendidos</p>
              <p style={{ fontSize: '16px', fontWeight: '700', color: '#3B82F6', margin: 0 }}>
                {historicoConfirmados.filter(h => h.status === 'confirmado').length}
              </p>
            </div>
          </div>
        </div>

        {/* Seção de Ações Rápidas */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F1F5F9',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1E293B',
            margin: '0 0 16px 0'
          }}>
            🚀 Ações Rápidas
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px'
          }}>
            <button style={{
              background: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              💰 Registrar Receita
            </button>
            
            <button style={{
              background: '#EF4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              📤 Registrar Despesa
            </button>
            
            <button style={{
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              📊 Relatório Mensal
            </button>
            
            <button style={{
              background: '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              📈 Projeções
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
const ComingSoonScreen = ({ title }) => (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      paddingBottom: '100px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <Header title={title} subtitle="Em desenvolvimento" showBack />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🚧</div>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#1E293B',
          margin: '0 0 8px 0'
        }}>
          Em Desenvolvimento
        </h2>
        <p style={{
          fontSize: '16px',
          color: '#64748B',
          margin: 0
        }}>
          Esta funcionalidade estará disponível em breve
        </p>
      </div>
    </div>
  );
  const renderScreen = () => {
    switch(currentScreen) {
      case 'agenda':
        return <AgendaScreen />;
      case 'profissionais':
        return <ProfissionaisScreen />;
      case 'financeiro':
        return <FinanceiroScreen />;
      case 'historico':
        return <HistoricoScreen />;
      case 'configuracoes':
        return <ConfiguracoesScreen />;
      case 'servicos':
        return <ServicosScreen />;
      case 'clientes':
        return <ClientesScreen />;
      case 'produtos':
        return <ComingSoonScreen title="Produtos" />;
      case 'pacotes':
        return <ComingSoonScreen title="Financeiro" />;
      case 'marketing':
        return <ComingSoonScreen title="Marketing" />;
      case 'relatorios':
        return <RelatoriosMenuScreen />;
      default:
        return <Dashboard />;
    }
  };

// Se ainda está carregando
  if (appLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #F1F5F9',
          borderTop: '3px solid #FF6B35',
          borderRadius: '50%',
          marginBottom: '16px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#64748B', fontSize: '14px', fontWeight: '500' }}>
          Verificando autenticação...
        </p>
      </div>
    );
  }

  // Se não está logado, mostrar tela de login
  if (!user) {
    return <LoginScreen />;
  }

  // Se está logado, mostrar o app normal
  return (
    <div>
      {renderScreen()}
      {/* MODAL DE NOVO AGENDAMENTO */}
{showAgendamentoModal && (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
  }} onClick={() => {
            setShowAgendamentoModal(false);
            setAgendamentoEditando(null);
            setDadosAgendamento({
              nome_cliente: '',
              telefone_cliente: '',
              cliente_cpf: '',
              data_agendamento: '',
              servicos_selecionados: [],
              barbeiro_selecionado: ''
            });
            setHorarioSelecionado('');
            setHorariosDisponiveis([]);
          }}>
    <div style={{
      background: '#FFFFFF', borderRadius: '16px', padding: '24px',
      maxWidth: '500px', width: '100%', maxHeight: '90vh', overflow: 'auto'
    }} onClick={(e) => e.stopPropagation()}>
      
      <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B', margin: '0 0 20px 0' }}>
        {agendamentoEditando ? '✏️ Editar Agendamento' : '📅 Novo Agendamento'}
      </h3>

      {/* Nome do Cliente */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
          Nome do Cliente *
        </label>
        <input
          type="text"
          value={dadosAgendamento.nome_cliente}
          onChange={(e) => setDadosAgendamento(prev => ({ ...prev, nome_cliente: e.target.value }))}
          placeholder="Digite o nome completo"
          style={{
            width: '100%', padding: '12px', border: '1px solid #E2E8F0',
            borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Telefone */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
          Telefone *
        </label>
        <input
          type="tel"
          value={dadosAgendamento.telefone_cliente}
          onChange={(e) => setDadosAgendamento(prev => ({ ...prev, telefone_cliente: e.target.value }))}
          placeholder="(00) 00000-0000"
          style={{
            width: '100%', padding: '12px', border: '1px solid #E2E8F0',
            borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box'
          }}
        />
      </div>
{/* CPF */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
          CPF (opcional)
        </label>
        <input
          type="text"
          value={dadosAgendamento.cliente_cpf || ''}
          onChange={(e) => setDadosAgendamento(prev => ({ ...prev, cliente_cpf: e.target.value }))}
          placeholder="000.000.000-00"
          style={{
            width: '100%', padding: '12px', border: '1px solid #E2E8F0',
            borderRadius: '8px', fontSize: '16px', outline: 'none', boxSizing: 'border-box'
          }}
        />
      </div>
{/* Data - só mostra depois de selecionar barbeiro */}
      {dadosAgendamento.barbeiro_selecionado && (
       <CustomDatePicker
          value={dadosAgendamento.data_agendamento}
          onChange={(novaData) => {
            setDadosAgendamento(prev => ({ ...prev, data_agendamento: novaData }));
            setHorarioSelecionado('');
            if (novaData) {
              calcularHorariosDisponiveis(dadosAgendamento.barbeiro_selecionado, novaData);
            }
          }}
          minDate={getBrasiliaDateString()}
          label="Data do Agendamento *"
        />
      )}

{/* Horários - só mostra depois de selecionar data */}
      {dadosAgendamento.data_agendamento && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
            Selecionar Horário *
          </label>
          
          {horariosDisponiveis.length > 0 ? (
            <div style={{ 
              maxHeight: '150px', 
              overflow: 'auto', 
              border: '1px solid #E2E8F0', 
              borderRadius: '8px', 
              padding: '8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px'
            }}>
              {horariosDisponiveis.map((slot, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setHorarioSelecionado(slot.horario)}
                  style={{
                    background: horarioSelecionado === slot.horario ? '#10B981' : '#F8FAFC',
                    color: horarioSelecionado === slot.horario ? 'white' : '#1E293B',
                    border: horarioSelecionado === slot.horario ? '2px solid #10B981' : '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '12px 8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    boxShadow: horarioSelecionado === slot.horario ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none'
                  }}
                >
                  {slot.horario}
                </button>
              ))}
            </div>
          ) : (
            <div style={{
              border: '1px solid #FEE2E2',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              background: '#FEF2F2'
            }}>
              <p style={{ fontSize: '14px', color: '#B91C1C', margin: 0, fontWeight: '500' }}>
                Nenhum horário disponível para esta data
              </p>
            </div>
          )}
        </div>
      )}

      {/* Serviços */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
          Selecionar Serviços *
        </label>
        <div style={{ maxHeight: '150px', overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px' }}>
          {servicosDisponiveis.map((servico) => (
            <label key={servico.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '6px',
              cursor: 'pointer', borderRadius: '4px', marginBottom: '4px'
            }}>
              <input
                type="checkbox"
                checked={dadosAgendamento.servicos_selecionados.includes(servico.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setDadosAgendamento(prev => ({
                      ...prev,
                      servicos_selecionados: [...prev.servicos_selecionados, servico.id]
                    }));
                  } else {
                    setDadosAgendamento(prev => ({
                      ...prev,
                      servicos_selecionados: prev.servicos_selecionados.filter(id => id !== servico.id)
                    }));
                  }
                }}
              />
              <span style={{ fontSize: '14px', color: '#1E293B' }}>
                {servico.nome} - R$ {formatCurrency(servico.preco)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Barbeiros */}
     <CustomSelect
        value={dadosAgendamento.barbeiro_selecionado}
        onChange={(barbeiro_id) => {
          setDadosAgendamento(prev => ({ 
            ...prev, 
            barbeiro_selecionado: barbeiro_id,
            data_agendamento: ''
          }));
          setHorarioSelecionado('');
          setHorariosDisponiveis([]);
        }}
        options={barbeiros
          .filter(b => b.ativo === 'true' || b.ativo === true)
          .map(barbeiro => ({
            value: barbeiro.barbeiro_id,
            label: barbeiro.nome
          }))
        }
        label="Selecionar Barbeiro *"
        placeholder="Escolha o profissional"
      />

      {/* Valor Total */}
      {dadosAgendamento.servicos_selecionados.length > 0 && (
        <div style={{
          background: '#F8FAFC', borderRadius: '8px', padding: '12px', marginBottom: '16px',
          fontSize: '14px', color: '#1E293B', fontWeight: '600', textAlign: 'center'
        }}>
          💰 Valor Total: R$ {formatCurrency(
            dadosAgendamento.servicos_selecionados.reduce((total, servicoId) => {
              const servico = servicosDisponiveis.find(s => s.id === servicoId);
              return total + (servico?.preco || 0);
            }, 0)
          )}
        </div>
      )}

      {/* Botões */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => setShowAgendamentoModal(false)}
          style={{
            flex: 1, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0',
            borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
          }}
        >
          Cancelar
        </button>
        <button
          onClick={agendamentoEditando ? editarAgendamento : salvarNovoAgendamento}
          style={{
            flex: 1, background: '#10B981', color: 'white', border: 'none',
            borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
          }}
        >
          {agendamentoEditando ? 'Salvar Alterações' : 'Criar Agendamento'}
        </button>
      </div>
    </div>
  </div>
)}
      <BottomNav />
      <SideMenu />
      <NotificationPopup /> 
      <SuccessPopup />  
      <EditClientModal />
      <ProfissionalModal />
      {/* MODAL DE CONFIRMAÇÃO */}
      {showConfirmModal && agendamentoPendente && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: '#FEF3C7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle size={32} color="#F59E0B" />
            </div>
            
            <h3 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1E293B',
              margin: '0 0 8px 0'
            }}>
              Confirmar Pagamento?
            </h3>
            
            <p style={{
              fontSize: '14px',
              color: '#64748B',
              margin: '0 0 16px 0',
              lineHeight: '1.5'
            }}>
              Tem certeza que deseja confirmar o pagamento de <strong>{agendamentoPendente.cliente_nome}</strong>?
            </p>
            
            <div style={{
              background: '#F8FAFC',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '12px',
              color: '#64748B',
              textAlign: 'left'
            }}>
              <div><strong>Serviço:</strong> {agendamentoPendente.servico}</div>
              <div><strong>Profissional:</strong> {agendamentoPendente.nome_profissional}</div>
              <div><strong>Horário:</strong> {agendamentoPendente.hora_inicio?.substring(0, 5)}</div>
              {agendamentoPendente.valor_servico && (
                <div><strong>Valor:</strong> R$ {parseFloat(agendamentoPendente.valor_servico).toFixed(2).replace('.', ',')}</div>
              )}
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setAgendamentoPendente(null);
                }}
                style={{
                  flex: 1,
                  background: '#F8FAFC',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ❌ Não
              </button>
              <button
                onClick={executarConfirmacao}
                style={{
                  flex: 1,
                  background: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Sim, Pago
              </button>
            </div>
          </div>
        </div>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          
          @keyframes slideDown {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          
          @keyframes checkBounce {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
          
@keyframes progressBar {
  0% { width: 0%; }
  100% { width: 100%; }
}

@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes slideUp {
  0% { transform: translateY(20px) scale(0.95); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

@keyframes checkBounce {
  0% { transform: scale(0); }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
          }
          
          ::-webkit-scrollbar {
            width: 6px;
          }
          
          ::-webkit-scrollbar-track {
            background: #F8FAFC;
            border-radius: 3px;
          }
          
          ::-webkit-scrollbar-thumb {
            background: #CBD5E1;
            border-radius: 3px;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: #94A3B8;
          }
        `}
      </style>
    </div>
  );
};

const AppWithAuth = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default AppWithAuth;