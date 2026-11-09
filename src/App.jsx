import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Ticket, PlusCircle, BarChart3, Search, 
  Bell, Clock, AlertTriangle, MessageSquare, Copy, CheckCircle2, 
  AlertCircle, Clock3, User, Building, Phone, Save, ArrowLeft, 
  LogOut, Users, Settings, Download, FileText, ChevronRight,
  Menu, X, Printer, Edit2, ShieldAlert, Check, HelpCircle, Eye,
  RefreshCw, CheckCircle, Info, Trash2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, onSnapshot, collection, deleteDoc, getDoc, query, where, runTransaction } from 'firebase/firestore';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCTgvf8FapHvMNbt_e6oY1YtFiBWODuRto",
  authDomain: "bex-helpdesk.firebaseapp.com",
  projectId: "bex-helpdesk",
  storageBucket: "bex-helpdesk.firebasestorage.app",
  messagingSenderId: "1016543344368",
  appId: "1:1016543344368:web:726ea92f62de8968027435",
  measurementId: "G-P4PNR336V4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const USERS_COLLECTION = 'bex_users';
const COMPANIES_COLLECTION = 'bex_companies';
const CASES_COLLECTION = 'bex_cases';

// --- COLORES CORPORATIVOS BEX ---
const BEX_COLORS = {
  primary: '#F26522', // Naranja BEX
  dark: '#17243A',    // Azul oscuro BEX
  light: '#F4F6F8',   // Gris claro de fondo
  white: '#FFFFFF',
  success: '#10B981', // Verde solucionado
  warning: '#F59E0B', // Amarillo pendientes
  danger: '#EF4444',  // Rojo alertas y vencimientos
};

const STATUSES = [
  { id: 'Nuevo', color: 'bg-blue-100 text-blue-800' },
  { id: 'Pendiente de primera respuesta', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'Cliente informado', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'En validación interna', color: 'bg-purple-100 text-purple-800' },
  { id: 'Escalado al equipo técnico', color: 'bg-orange-100 text-orange-800' },
  { id: 'Pendiente de terceros', color: 'bg-gray-100 text-gray-800' },
  { id: 'Pendiente de validación del cliente', color: 'bg-teal-100 text-teal-800' },
  { id: 'Solucionado', color: 'bg-green-100 text-green-800' },
  { id: 'Cerrado', color: 'bg-emerald-100 text-emerald-800' }
];

const INITIAL_COMPANIES = [
  "Agenciauto", "Alianza Motor", "Almotores", "Automotriz Caldas Motor", "Auto Partes Castilla", 
  "BYCSA", "Calzado Terrano", "Caldas Motor", "Caribe Motor", "Casa Británica", "Casa Toro", 
  "Centro Automotor", "Colchones Relax", "Corsan - Industrias Metálicas Corsan", "Faizan", 
  "Freniteca", "Globoland", "Importadoras Nipon", "IndulacteosPRE", "Juan Autos", "Las Caseritas", 
  "Marcali", "Massy", "Motocosta", "Pastomotor", "Provigas", "Punto Merca", "Renault Norte y Sur (NyS)", 
  "Sanautos", "Sincromotores", "Tayrona", "VinCorte"
];

// Categorías oficiales solicitadas
const CATEGORIES = [
  'Error',
  'Duda técnica',
  'Incidente',
  'Requerimiento',
  'Consulta'
];

// Matriz oficial de niveles de servicio (SLA) BEX Móvil
const SLA_MATRIX = {
  'Crítica': {
    badge: '🔴 Crítica',
    color: 'text-red-600 bg-red-50 border-red-200',
    firstResponseMinutes: 15,
    firstResponseLabel: '15 minutos',
    followUpHours: 1,
    followUpLabel: 'Cada hora',
    targetResolutionLabel: 'Lo antes posible según complejidad',
    resolutionMinutes: 240, // 4 horas hábiles objetivo
    description: 'La operación del cliente está detenida (no puede vender, no sincroniza ningún vendedor, caída general, pedidos no llegan al ERP para toda la empresa)'
  },
  'Alta': {
    badge: '🟠 Alta',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    firstResponseMinutes: 30,
    firstResponseLabel: '30 minutos',
    followUpHours: 4,
    followUpLabel: 'Cada 4 horas',
    targetResolutionLabel: 'Según el análisis del caso',
    resolutionMinutes: 480, // 8 horas hábiles objetivo
    description: 'Afecta uno o varios usuarios, pero existe una alternativa temporal de trabajo'
  },
  'Media': {
    badge: '🟡 Media',
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    firstResponseMinutes: 60, // 1 hora exacta solicitada
    firstResponseLabel: '1 hora',
    followUpHours: 8,
    followUpLabel: 'Diario (1 vez al día)',
    targetResolutionLabel: 'Según la prioridad del cliente',
    resolutionMinutes: 1440, // 24 horas hábiles
    description: 'Incidencias funcionales que no detienen la operación (clientes, productos, precios, promociones, etc.)'
  },
  'Baja': {
    badge: '🟢 Baja',
    color: 'text-green-600 bg-green-50 border-green-200',
    firstResponseMinutes: 480, // 8 horas hábiles
    firstResponseLabel: '8 horas hábiles',
    followUpHours: 24,
    followUpLabel: 'Según programación',
    targetResolutionLabel: 'Programado',
    resolutionMinutes: 2880, // 48 horas hábiles
    description: 'Consultas, solicitudes de configuración, dudas funcionales o mejoras'
  }
};

const PRIORITIES = ['Crítica', 'Alta', 'Media', 'Baja'];
const CHANNELS = ['WhatsApp', 'Llamada', 'Correo', 'Bitrix24', 'Otro'];

// Algoritmo de Tiempos Hábiles en Colombia (Lunes a Viernes de 8:00 AM a 5:00 PM)
const addBusinessMinutes = (startDate, minutesToAdd) => {
  let current = new Date(startDate);
  let added = 0;
  while (added < minutesToAdd) {
    current.setTime(current.getTime() + 60 * 1000); // Avanzar 1 minuto
    const day = current.getDay();
    const hour = current.getHours();
    
    if (day >= 1 && day <= 5 && hour >= 8 && hour < 17) {
      added++;
    } else if (hour >= 17) {
      current.setDate(current.getDate() + (day === 5 ? 3 : 1));
      current.setHours(8, 0, 0, 0);
    } else if (hour < 8) {
      current.setHours(8, 0, 0, 0);
    } else if (day === 6) {
      current.setDate(current.getDate() + 2);
      current.setHours(8, 0, 0, 0);
    } else if (day === 0) {
      current.setDate(current.getDate() + 1);
      current.setHours(8, 0, 0, 0);
    }
  }
  return current.getTime();
};

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appProfile, setAppProfile] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [companies, setCompanies] = useState([]);
  
  const [view, setView] = useState('dashboard');
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [casesFilter, setCasesFilter] = useState('mi_gestion');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNextDayModal, setShowNextDayModal] = useState(false);
  const [showSlaMatrixModal, setShowSlaMatrixModal] = useState(false);
  const [showPdfReportModal, setShowPdfReportModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Escuchar la sesión de Firebase Authentication.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) setAppProfile(null);
    });
    return () => unsubscribe();
  }, []);

  // Cargar el perfil Firestore usando el UID autenticado.
  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      if (!firebaseUser) {
        setAppProfile(null);
        return;
      }
      try {
        const profileSnap = await getDoc(doc(db, USERS_COLLECTION, firebaseUser.uid));
        if (!profileSnap.exists()) {
          await signOut(auth);
          alert('Tu cuenta no tiene un perfil registrado en BEX HELPDESK. Contacta al administrador.');
          return;
        }
        const profile = { id: profileSnap.id, ...profileSnap.data() };
        if (profile.active !== true) {
          await signOut(auth);
          alert('Tu usuario está inactivo. Contacta al administrador.');
          return;
        }
        if (!cancelled) setAppProfile(profile);
      } catch (error) {
        console.error('Error cargando perfil:', error);
        if (!cancelled) alert('No fue posible cargar tu perfil. Verifica las reglas de Firestore.');
      }
    };
    loadProfile();
    return () => { cancelled = true; };
  }, [firebaseUser]);

  // Escuchar datos de las colecciones raíz solo con un perfil válido.
  useEffect(() => {
    if (!firebaseUser || !appProfile) return;

    const unsubUsers = onSnapshot(collection(db, USERS_COLLECTION), (snapshot) => {
      setUsersList(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    }, (error) => console.error('Error leyendo usuarios:', error));

    const unsubCompanies = onSnapshot(collection(db, COMPANIES_COLLECTION), (snapshot) => {
      setCompanies(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    }, (error) => console.error('Error leyendo empresas:', error));

    const casesRef = collection(db, CASES_COLLECTION);
    const casesQuery = appProfile.role === 'AUDITOR'
      ? casesRef
      : query(casesRef, where('assignedTo', '==', firebaseUser.uid));

    const unsubTickets = onSnapshot(casesQuery, (snapshot) => {
      const list = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      list.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
      setTickets(list);
    }, (error) => console.error('Error leyendo casos:', error));

    return () => { unsubUsers(); unsubCompanies(); unsubTickets(); };
  }, [firebaseUser, appProfile]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await signInWithEmailAndPassword(
        auth,
        form.email.value.trim(),
        form.password.value
      );
      form.reset();
    } catch (error) {
      console.error('Error de inicio de sesión:', error);
      const messages = {
        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
        'auth/user-disabled': 'Esta cuenta está deshabilitada.',
        'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
        'auth/network-request-failed': 'No hay conexión con Firebase. Verifica Internet.'
      };
      alert(messages[error.code] || `No fue posible iniciar sesión: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAppProfile(null);
      setView('dashboard');
    } catch (error) {
      console.error('Error cerrando sesión:', error);
      alert('No fue posible cerrar la sesión.');
    }
  };

  const exportCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "ID Caso,Fecha Recepción,Cliente,Empresa,Contacto,Canal,Módulo,Categoría,Prioridad,Estado,Consultor Responsable,1ra Respuesta Enviada,Fecha Límite 1ra Resp,Fecha Límite Resolución,Última Gestión\n";
    reportTickets.forEach(t => {
      const assigned = usersList.find(u => u.id === t.assignedTo)?.name || 'Sin Asignar';
      const lastHistory = t.history && t.history.length > 0 ? t.history[t.history.length - 1].content.replace(/[\n\r]+/g, ' ') : '';
      const row = [
        `"${t.caseId || ''}"`,
        `"${new Date(t.createdAt).toLocaleString('es-CO')}"`,
        `"${(t.clientName || '').replace(/"/g, '""')}"`,
        `"${(t.company || '').replace(/"/g, '""')}"`,
        `"${(t.contactName || '').replace(/"/g, '""')}"`,
        `"${t.channel || ''}"`,
        `"${t.module || ''}"`,
        `"${t.category || ''}"`,
        `"${t.priority || ''}"`,
        `"${t.status || ''}"`,
        `"${assigned.replace(/"/g, '""')}"`,
        `"${t.hasFirstResponse ? 'Respondido' : 'Pendiente'}"`,
        `"${t.slaResponseDeadline ? new Date(t.slaResponseDeadline).toLocaleString('es-CO') : ''}"`,
        `"${t.slaResolutionDeadline ? new Date(t.slaResolutionDeadline).toLocaleString('es-CO') : ''}"`,
        `"${lastHistory.replace(/"/g, '""')}"`
      ].join(",");
      csvContent += row + "\r\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BEX_Consolidado_Casos_${reportStartDate || 'inicio'}_${reportEndDate || 'hoy'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentHour = currentTime.getHours();
  const currentMin = currentTime.getMinutes();
  const isWorkingHours = currentHour >= 8 && currentHour < 17;
  const showYellowAlert = isWorkingHours && currentHour === 16 && currentMin >= 0 && currentMin < 30;
  const showRedAlert = isWorkingHours && currentHour === 16 && currentMin >= 30;

  const myTickets = (appProfile?.role === 'CONSULTOR' ? tickets.filter(t => t.assignedTo === appProfile.id) : tickets).filter(t => t.isDeleted !== true);
  const reportTickets = useMemo(() => {
    const start = reportStartDate ? new Date(`${reportStartDate}T00:00:00`).getTime() : null;
    const end = reportEndDate ? new Date(`${reportEndDate}T23:59:59.999`).getTime() : null;
    return tickets.filter(t => {
      if (t.isDeleted === true) return false;
      const createdAt = Number(t.createdAt || 0);
      return (start === null || createdAt >= start) && (end === null || createdAt <= end);
    }).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [tickets, reportStartDate, reportEndDate]);
  const activeTicket = tickets.find(t => t.id === activeTicketId);
  const unrespondedTickets = myTickets.filter(t => !t.hasFirstResponse && !['Cerrado', 'Solucionado'].includes(t.status));
  const pendingUpdateTickets = myTickets.filter(t => {
    if (['Cerrado', 'Solucionado'].includes(t.status)) return false;
    const lastUpdateDate = new Date(t.lastResponseAt || t.createdAt);
    return lastUpdateDate.getDate() !== currentTime.getDate();
  });

  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F8] p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4" style={{ borderColor: BEX_COLORS.primary }}>
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-orange-50 text-[#F26522] mb-3">
            <Ticket className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: BEX_COLORS.dark }}>
            BEX <span style={{ color: BEX_COLORS.primary }}>HELPDESK</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Gestión & Control de Incidentes BEX Móvil</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Correo Electrónico</label>
            <input required name="email" type="email" className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none text-sm transition" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contraseña</label>
            <input required name="password" type="password" className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none text-sm transition" />
          </div>
          <button type="submit" className="w-full p-3 text-white rounded-xl font-semibold transition shadow-md hover:opacity-90 flex items-center justify-center" style={{ backgroundColor: BEX_COLORS.primary }}>
            Iniciar Sesión
          </button>
        </form>
        <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">
          Acceso protegido mediante Firebase Authentication
        </div>
      </div>
    </div>
  );

  const renderSidebar = () => (
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col h-full shrink-0 shadow-2xl transition-transform duration-300 lg:static lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ backgroundColor: BEX_COLORS.dark }}>
      <div className="h-16 flex items-center justify-between px-6 font-bold text-xl text-white border-b border-white/10 tracking-wider">
        <div className="flex items-center">
          BEX <span style={{ color: BEX_COLORS.primary }} className="ml-2">HELPDESK</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        <button onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-medium text-sm ${view === 'dashboard' ? 'bg-[#F26522] text-white shadow' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}>
          <LayoutDashboard className="w-5 h-5 mr-3" /> Dashboard
        </button>
        <button onClick={() => { setView('cases'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-medium text-sm ${view === 'cases' ? 'bg-[#F26522] text-white shadow' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}>
          <Ticket className="w-5 h-5 mr-3" /> Casos y Gestión
        </button>
        <button onClick={() => { setView('new'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-medium text-sm ${view === 'new' ? 'bg-[#F26522] text-white shadow' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}>
          <PlusCircle className="w-5 h-5 mr-3" /> Registrar Novedad
        </button>
        <button onClick={() => { setView('reports'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-medium text-sm ${view === 'reports' ? 'bg-[#F26522] text-white shadow' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}>
          <FileText className="w-5 h-5 mr-3" /> Informes y Reportes
        </button>
        
        {appProfile?.role === 'AUDITOR' && (
          <>
            <div className="pt-5 pb-2 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Administración</div>
            <button onClick={() => { setView('users'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-medium text-sm ${view === 'users' ? 'bg-[#F26522] text-white shadow' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}>
              <Users className="w-5 h-5 mr-3" /> Usuarios & Roles
            </button>
            <button onClick={() => { setView('companies'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-medium text-sm ${view === 'companies' ? 'bg-[#F26522] text-white shadow' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}>
              <Building className="w-5 h-5 mr-3" /> Empresas
            </button>
          </>
        )}

        <div className="pt-4 px-2">
          <button 
            onClick={() => setShowSlaMatrixModal(true)}
            className="w-full flex items-center justify-center p-2.5 rounded-xl text-xs font-semibold bg-white/5 text-orange-300 hover:bg-white/10 border border-orange-500/30 transition"
          >
            <HelpCircle className="w-4 h-4 mr-2" /> Matriz SLA & Reglas
          </button>
        </div>
      </nav>
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center text-white mb-3 px-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3 shadow shrink-0" style={{ backgroundColor: BEX_COLORS.primary }}>
            {appProfile?.name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden text-sm">
            <p className="truncate font-semibold">{appProfile?.name}</p>
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold uppercase tracking-wide">
              {appProfile?.role}
            </span>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
          <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
        </button>
      </div>
    </aside>
  );

  const renderDashboard = () => {
    const stats = {
      recibidosHoy: myTickets.filter(t => new Date(t.createdAt).toDateString() === currentTime.toDateString()).length,
      pendientes: unrespondedTickets.length,
      actualizarHoy: pendingUpdateTickets.length,
      escalados: myTickets.filter(t => t.status === 'Escalado al equipo técnico').length,
    };

    const statusData = STATUSES.map(s => ({
      name: s.id,
      value: myTickets.filter(t => t.status === s.id).length
    })).filter(d => d.value > 0);

    const COLORS = ['#F26522', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#64748B', '#06B6D4', '#EC4899'];
    const totalCases = myTickets.length;

    return (
      <div className="p-4 sm:p-6 space-y-6 bg-[#F4F6F8] min-h-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: BEX_COLORS.dark }}>Panel Principal</h1>
            <p className="text-xs sm:text-sm text-gray-500">Supervisión operativa y control de tiempos de atención</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSlaMatrixModal(true)}
              className="text-xs font-semibold px-3 py-2 bg-white rounded-xl shadow-sm border border-orange-200 text-[#F26522] hover:bg-orange-50 transition flex items-center"
            >
              <Info className="w-4 h-4 mr-1.5" /> Matriz SLA
            </button>
            <div className="text-xs sm:text-sm font-semibold text-gray-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 flex items-center">
              <Clock className="w-4 h-4 mr-2" style={{ color: BEX_COLORS.primary }}/>
              {currentTime.toLocaleTimeString('es-CO')}
            </div>
          </div>
        </div>

        {showRedAlert && pendingUpdateTickets.length > 0 && (
          <div className="bg-red-500 text-white p-4 rounded-xl shadow-lg flex items-start space-x-4 animate-pulse">
            <AlertTriangle className="w-8 h-8 shrink-0" />
            <div>
              <h3 className="font-bold text-lg">¡ALERTA CRÍTICA DE CIERRE DE JORNADA (4:30 PM)!</h3>
              <p className="text-sm mt-1">Existen <strong>{pendingUpdateTickets.length} caso(s)</strong> pendientes de actualización hacia el cliente antes del fin del día laboral.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-[#F26522] flex items-center justify-between">
            <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Recibidos Hoy</p><p className="text-2xl font-black" style={{color: BEX_COLORS.dark}}>{stats.recibidosHoy}</p></div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-orange-100 text-[#F26522]"><Ticket className="w-6 h-6"/></div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-yellow-500 flex items-center justify-between">
            <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Sin 1ra Respuesta</p><p className="text-2xl font-black text-yellow-600">{stats.pendientes}</p></div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-yellow-100 text-yellow-600"><Clock3 className="w-6 h-6"/></div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-red-500 flex items-center justify-between">
            <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Requieren Actualización</p><p className="text-2xl font-black text-red-600">{stats.actualizarHoy}</p></div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-100 text-red-600"><AlertTriangle className="w-6 h-6"/></div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-blue-500 flex items-center justify-between">
            <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Escalados a Equipo</p><p className="text-2xl font-black text-blue-600">{stats.escalados}</p></div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600"><Building className="w-6 h-6"/></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-base font-bold mb-4" style={{ color: BEX_COLORS.dark }}>Distribución por Estado</h3>
            {statusData.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center text-gray-400 text-sm">
                <Ticket className="w-10 h-10 mb-2 opacity-30" />
                No hay casos registrados aún
              </div>
            ) : (
              <div className="h-60 flex flex-col sm:flex-row items-center justify-around gap-6">
                <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {(() => {
                      let accumulated = 0;
                      return statusData.map((item, idx) => {
                        const percent = totalCases > 0 ? (item.value / totalCases) * 100 : 0;
                        const strokeDasharray = `${percent} ${100 - percent}`;
                        const strokeDashoffset = -accumulated;
                        accumulated += percent;
                        return (
                          <circle
                            key={item.name}
                            cx="50"
                            cy="50"
                            r="36"
                            fill="transparent"
                            stroke={COLORS[idx % COLORS.length]}
                            strokeWidth="16"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            pathLength="100"
                            className="transition-all duration-300"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-2xl font-black" style={{ color: BEX_COLORS.dark }}>
                      {totalCases}
                    </span>
                    <p className="text-[11px] text-gray-400 font-semibold">Total</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1 text-xs w-full">
                  {statusData.map((item, idx) => {
                    const percentage = totalCases > 0 ? Math.round((item.value / totalCases) * 100) : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-center space-x-2 truncate pr-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                          <span className="text-gray-700 truncate" title={item.name}>{item.name}</span>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="font-bold text-gray-900">{item.value}</span>
                          <span className="text-gray-400 text-[10px]">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <div>
                <h3 className="text-base font-bold" style={{ color: BEX_COLORS.dark }}>Clientes Pendientes de Actualización Hoy</h3>
                <p className="text-xs text-gray-500">Obligatorio brindar al menos 1 reporte al día</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                {pendingUpdateTickets.length} pendientes
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-60">
              {pendingUpdateTickets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-8 text-gray-400">
                  <CheckCircle2 className="w-10 h-10 mb-2 text-green-500 opacity-80" />
                  <p className="text-sm font-semibold text-gray-700">¡Al día con los clientes!</p>
                  <p className="text-xs text-gray-400">Todos los casos activos han recibido seguimiento hoy.</p>
                </div>
              ) : (
                pendingUpdateTickets.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-red-50/70 hover:bg-red-50 rounded-xl border border-red-100 transition">
                    <div className="truncate mr-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-red-900 text-sm truncate">{t.caseId}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-200 text-red-800">{t.priority}</span>
                      </div>
                      <p className="text-xs font-medium text-gray-800 truncate mt-0.5">{t.clientName} - {t.company}</p>
                    </div>
                    <button onClick={() => { setActiveTicketId(t.id); setView('detail'); }} className="shrink-0 text-xs bg-[#F26522] hover:opacity-90 text-white font-semibold px-3 py-1.5 rounded-lg shadow-sm transition">
                      Actualizar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNewTicket = () => {
    const handleSubmit = async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const formData = new FormData(form);
      
      const priority = formData.get('priority') || 'Media';
      const slaConfig = SLA_MATRIX[priority] || SLA_MATRIX['Media'];
      const now = Date.now();
      
      const slaResponse = addBusinessMinutes(now, slaConfig.firstResponseMinutes);
      const slaResolution = addBusinessMinutes(now, slaConfig.resolutionMinutes);
      const nextFollowUp = addBusinessMinutes(now, slaConfig.followUpHours * 60);
      
      const newTicket = {
        createdAt: now,
        clientName: formData.get('clientName'),
        company: formData.get('company'),
        contactName: formData.get('contactName'),
        channel: formData.get('channel'),
        module: formData.get('module'),
        category: formData.get('category'),
        priority: priority,
        description: formData.get('description'),
        assignedTo: appProfile.id,
        status: 'Nuevo',
        hasFirstResponse: false,
        slaResponseDeadline: slaResponse,
        slaResolutionDeadline: slaResolution,
        nextFollowUpDeadline: nextFollowUp,
        history: [{
          id: Date.now(),
          type: 'system',
          content: `Caso creado en BEX Helpdesk.\nPrioridad: ${priority} (${slaConfig.badge}).\nSLA 1ra Respuesta: ${slaConfig.firstResponseLabel}.\nSeguimiento obligatorio: ${slaConfig.followUpLabel}.`,
          author: appProfile.name,
          timestamp: now
        }]
      };

      try {
        // Transacción atómica para generar consecutivos únicos.
        const counterRef = doc(db, 'bex_counters', 'cases');
        const caseRef = doc(collection(db, CASES_COLLECTION));
        await runTransaction(db, async (transaction) => {
          const counterSnap = await transaction.get(counterRef);
          const nextNumber = (counterSnap.exists() ? Number(counterSnap.data().lastNumber || 0) : 0) + 1;
          transaction.set(counterRef, { lastNumber: nextNumber, updatedAt: Date.now() }, { merge: true });
          transaction.set(caseRef, {
            ...newTicket,
            caseId: `BEX-${String(nextNumber).padStart(5, '0')}`,
            isDeleted: false
          });
        });
        form.reset();
        setView('cases');
        alert('Caso registrado correctamente.');
      } catch (error) {
        console.error("Error guardando el caso:", error);
        alert(`No fue posible guardar el caso: ${error.message}`);
      }
    };

    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto bg-[#F4F6F8] min-h-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: BEX_COLORS.dark }}>Registrar Nuevo Caso</h1>
            <p className="text-sm text-gray-500">Ingreso y tipificación de solicitud o incidente de BEX Móvil</p>
          </div>
          <button onClick={() => setView('cases')} className="text-sm font-semibold text-gray-600 hover:text-gray-900 flex items-center">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre del Cliente *</label>
              <input required name="clientName" type="text" placeholder="Ej: Juan Pérez" className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none text-sm" />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Empresa / Concesionario *</label>
              <select required name="company" className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none text-sm bg-white">
                <option value="">Seleccione una empresa</option>
                {(companies.length > 0 ? companies.filter(c => c.active).map(c => c.name) : INITIAL_COMPANIES).map(cName => (
                  <option key={cName} value={cName}>{cName}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre del Contacto</label>
              <input name="contactName" type="text" placeholder="Persona que reportó la novedad" className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none text-sm" />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Canal de Recepción</label>
              <select name="channel" defaultValue="WhatsApp" className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none text-sm bg-white">
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Módulo Afectado *</label>
              <input required name="module" type="text" placeholder="Ej: Sincronización, Pedidos, Cartera, Rutas" className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none text-sm" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Categoría *</label>
              <select required name="category" defaultValue="Incidente" className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none text-sm bg-white font-medium">
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Prioridad y Nivel de Servicio (SLA) *</label>
              <select name="priority" defaultValue="Media" className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none text-sm bg-white font-medium">
                {Object.keys(SLA_MATRIX).map(pKey => {
                  const m = SLA_MATRIX[pKey];
                  return (
                    <option key={pKey} value={pKey}>
                      {m.badge} - 1ra Resp: {m.firstResponseLabel} | Seg: {m.followUpLabel} ({m.targetResolutionLabel})
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                La primera respuesta para 🔴 Crítica es de 15 min, 🟠 Alta 30 min, 🟡 Media 1 hora y 🟢 Baja 8 horas hábiles.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Descripción Detallada *</label>
            <textarea required name="description" rows="4" placeholder="Describa la novedad, síntomas y pasos para reproducir..." className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none resize-y text-sm"></textarea>
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button type="button" onClick={() => setView('cases')} className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 text-sm font-semibold transition-colors">Cancelar</button>
            <button type="submit" className="px-6 py-2.5 rounded-xl text-white font-semibold text-sm flex items-center transition-colors shadow-md hover:opacity-90" style={{ backgroundColor: BEX_COLORS.primary }}>
              <Save className="w-4 h-4 mr-2" /> Guardar Caso
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderCasesList = () => {
    const handleDeleteCase = async (ticket) => {
      const reason = window.prompt(`Indica el motivo para anular el caso ${ticket.caseId}:`, 'Caso creado por error');
      if (reason === null) return;
      if (!reason.trim()) { alert('Debes indicar el motivo de anulación.'); return; }
      if (!window.confirm(`¿Confirmas la anulación de ${ticket.caseId}? Se ocultará de la gestión e informes, pero conservará su historial.`)) return;
      try {
        const now = Date.now();
        const event = { id: now, type: 'system', content: `Caso anulado. Motivo: ${reason.trim()}`, author: appProfile.name, timestamp: now };
        await updateDoc(doc(db, CASES_COLLECTION, ticket.id), {
          isDeleted: true, deletedAt: now, deletedBy: firebaseUser.uid,
          deletionReason: reason.trim(), history: [...(ticket.history || []), event]
        });
        alert(`${ticket.caseId} fue anulado. Se conservó su trazabilidad.`);
      } catch (error) {
        console.error('Error anulando el caso:', error);
        alert(`No fue posible anular el caso: ${error.message}`);
      }
    };

    let displayTickets = myTickets;
    if (appProfile?.role === 'AUDITOR' && casesFilter === 'todos') {
      displayTickets = tickets.filter(t => t.isDeleted !== true);
    }

    displayTickets = displayTickets.filter(t => 
      t.caseId.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getSlaStatus = (ticket) => {
      const now = currentTime.getTime();
      if (!ticket.hasFirstResponse) {
        if (now > ticket.slaResponseDeadline) return { label: `Vencido 1ra Resp`, color: 'bg-red-100 text-red-800' };
        if (ticket.slaResponseDeadline - now < 30 * 60 * 1000) return { label: 'Por vencer (1ra Resp)', color: 'bg-yellow-100 text-yellow-800' };
        return { label: `En tiempo`, color: 'bg-green-100 text-green-800' };
      }
      if (!['Cerrado', 'Solucionado'].includes(ticket.status)) {
        if (ticket.slaResolutionDeadline && now > ticket.slaResolutionDeadline) return { label: 'Resolución Vencida', color: 'bg-red-100 text-red-800' };
        return { label: 'En seguimiento', color: 'bg-blue-100 text-blue-800' };
      }
      return { label: 'Cumplido', color: 'bg-gray-100 text-gray-800' };
    };

    return (
      <div className="p-4 sm:p-6 h-full flex flex-col bg-[#F4F6F8]">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: BEX_COLORS.dark }}>Gestión de Casos</h1>
            <div className="flex space-x-4 mt-2">
              <button onClick={() => setCasesFilter('mi_gestion')} className={`text-sm font-semibold pb-1 border-b-2 ${casesFilter === 'mi_gestion' ? 'border-[#F26522] text-[#F26522]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Mi Gestión de Hoy
              </button>
              {appProfile?.role === 'AUDITOR' && (
                <button onClick={() => setCasesFilter('todos')} className={`text-sm font-semibold pb-1 border-b-2 ${casesFilter === 'todos' ? 'border-[#F26522] text-[#F26522]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  Todos los Casos ({tickets.length})
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setView('new')} className="px-4 py-2.5 text-white rounded-xl flex items-center text-sm font-semibold shadow hover:opacity-90 transition-colors" style={{ backgroundColor: BEX_COLORS.primary }}>
              <PlusCircle className="w-4 h-4 mr-2" /> Nuevo Caso
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center w-full max-w-md">
            <Search className="w-5 h-5 text-gray-400 mr-2" />
            <input 
              type="text" 
              placeholder="Buscar por ID, Cliente, Empresa o Categoría..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 outline-none text-sm font-medium"
            />
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-gray-600 min-w-[760px]">
              <thead className="bg-gray-100/80 text-gray-500 uppercase text-xs font-bold tracking-wider sticky top-0">
                <tr>
                  <th className="px-5 py-3.5">ID Caso</th>
                  <th className="px-5 py-3.5">Fecha</th>
                  <th className="px-5 py-3.5">Cliente / Empresa</th>
                  <th className="px-5 py-3.5">Categoría</th>
                  <th className="px-5 py-3.5">Prioridad</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5">SLA Control</th>
                  <th className="px-5 py-3.5">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayTickets.map(ticket => {
                  const sla = getSlaStatus(ticket);
                  const priorityMeta = SLA_MATRIX[ticket.priority] || SLA_MATRIX['Media'];
                  
                  return (
                  <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-bold text-gray-900">{ticket.caseId}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs">{new Date(ticket.createdAt).toLocaleDateString('es-CO')}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900 truncate max-w-[200px]">{ticket.clientName}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{ticket.company}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-lg text-xs bg-gray-100 text-gray-700 font-medium">
                        {ticket.category || 'Incidente'}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${priorityMeta.color}`}>
                        {priorityMeta.badge}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUSES.find(s => s.id === ticket.status)?.color || 'bg-gray-100 text-gray-800'}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${sla.color}`}>
                        {sla.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setActiveTicketId(ticket.id); setView('detail'); }} className="text-[#F26522] hover:underline font-bold text-xs flex items-center">
                          Gestionar <ChevronRight className="w-4 h-4 ml-0.5" />
                        </button>
                        <button onClick={() => handleDeleteCase(ticket)} title="Anular caso creado por error" className="text-red-600 hover:text-red-800 font-semibold text-xs flex items-center">
                          <Trash2 className="w-4 h-4 mr-1" /> Anular
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
                {displayTickets.length === 0 && (
                  <tr><td colSpan="8" className="px-6 py-12 text-center text-gray-500">No se encontraron casos con los criterios aplicados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCaseDetail = () => {
    if (!activeTicket) return null;

    const addEvent = async (type, content, extraFields = {}) => {
      const ref = doc(db, CASES_COLLECTION, activeTicket.id);
      const newEvent = { id: Date.now(), type, content, author: appProfile.name, timestamp: Date.now() };
      
      const updateData = {
        history: [...(activeTicket.history || []), newEvent],
        ...extraFields
      };

      if (type === 'message') {
        updateData.hasFirstResponse = true;
        updateData.lastResponseAt = Date.now();
      }

      await updateDoc(ref, updateData);
    };

    const handleSendMessage = (e) => {
      e.preventDefault();
      const msg = e.target.message.value;
      if (!msg.trim()) return;
      addEvent('message', msg);
      e.target.reset();
    };

    const handleStatusChange = (e) => {
      const newStatus = e.target.value;
      addEvent('system', `Estado actualizado a: ${newStatus}`, { status: newStatus });
    };

    const submitEODNote = (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const content = `[NOVEDAD TRASLADO DE DÍA]\n• Validado hoy: ${formData.get('validado')}\n• Pendiente / Escalamiento: ${formData.get('falta')}\n• Lo que se le informó al cliente: ${formData.get('informado')}`;
      
      addEvent('novedad_eod', content, { lastResponseAt: Date.now() });
      setShowNextDayModal(false);
    };

    const priorityMeta = SLA_MATRIX[activeTicket.priority] || SLA_MATRIX['Media'];

    return (
      <div className="p-4 sm:p-6 h-full flex flex-col bg-[#F4F6F8]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3">
            <button onClick={() => { setActiveTicketId(null); setView('cases'); }} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold" style={{ color: BEX_COLORS.dark }}>
                  {activeTicket.caseId}
                </h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${priorityMeta.color}`}>
                  {priorityMeta.badge}
                </span>
              </div>
              <p className="text-gray-400 text-xs mt-0.5">Creado: {new Date(activeTicket.createdAt).toLocaleString('es-CO')}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {!['Solucionado', 'Cerrado'].includes(activeTicket.status) && (
               <button onClick={() => setShowNextDayModal(true)} className="px-3.5 py-2 bg-gray-800 text-white rounded-xl text-xs font-semibold hover:bg-gray-700 shadow-sm flex items-center">
                 <Clock3 className="w-4 h-4 mr-1.5"/> Justificar para Siguiente Día
               </button>
            )}
            <select 
              value={activeTicket.status}
              onChange={handleStatusChange}
              className="p-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-[#F26522] outline-none font-semibold text-xs"
            >
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-1">
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <h3 className="font-bold text-sm border-b pb-2 mb-3" style={{ color: BEX_COLORS.dark }}>Información del Caso</h3>
              <div className="space-y-3 text-xs">
                <div><p className="text-gray-400 font-semibold uppercase">Cliente / Contacto</p><p className="font-bold text-gray-900 text-sm mt-0.5">{activeTicket.clientName}</p><p className="text-gray-600">{activeTicket.contactName || 'No especificado'}</p></div>
                <div><p className="text-gray-400 font-semibold uppercase">Empresa</p><p className="font-bold text-gray-900">{activeTicket.company}</p></div>
                <div><p className="text-gray-400 font-semibold uppercase">Categoría</p><p className="font-semibold text-gray-800">{activeTicket.category || 'Incidente'}</p></div>
                <div><p className="text-gray-400 font-semibold uppercase">Módulo</p><p className="font-semibold text-gray-800">{activeTicket.module}</p></div>
                
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-gray-400 font-semibold uppercase mb-1">Acuerdos SLA BEX</p>
                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                    <p>• <strong>1ra Respuesta:</strong> {priorityMeta.firstResponseLabel}</p>
                    <p>• <strong>Seguimiento:</strong> {priorityMeta.followUpLabel}</p>
                    <p>• <strong>Resolución:</strong> {priorityMeta.targetResolutionLabel}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <h3 className="font-bold text-sm border-b pb-2 mb-3" style={{ color: BEX_COLORS.dark }}>Descripción de la Novedad</h3>
              <div className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed">
                {activeTicket.description}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 p-3.5 border-b border-gray-200 font-bold text-xs flex items-center justify-between text-gray-700">
              <span className="flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" style={{ color: BEX_COLORS.primary }}/> Línea de Tiempo y Comunicaciones
              </span>
              <span className="text-gray-400 font-normal">Trazabilidad inmutable</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {(activeTicket.history || []).map((event) => (
                <div key={event.id} className="flex space-x-3">
                  <div className="shrink-0 mt-1">
                    {event.type === 'system' ? (
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center"><Clock3 className="w-3.5 h-3.5 text-gray-500" /></div>
                    ) : event.type === 'novedad_eod' ? (
                      <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center"><AlertTriangle className="w-3.5 h-3.5 text-yellow-600" /></div>
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: BEX_COLORS.dark }}><User className="w-3.5 h-3.5" /></div>
                    )}
                  </div>
                  <div className={`flex-1 rounded-2xl p-3.5 border ${event.type === 'message' || event.type === 'novedad_eod' ? 'bg-white shadow-sm border-gray-200' : 'bg-transparent border-transparent text-gray-500 py-1'}`}>
                    {(event.type === 'message' || event.type === 'novedad_eod') && (
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-gray-900 text-xs">{event.author}</span>
                        <span className="text-[10px] text-gray-400">{new Date(event.timestamp).toLocaleString('es-CO')}</span>
                      </div>
                    )}
                    {event.type === 'system' && <span className="text-[11px] text-gray-400 mr-2 font-mono">{new Date(event.timestamp).toLocaleTimeString('es-CO')} - </span>}
                    <p className="text-gray-700 text-xs whitespace-pre-wrap leading-relaxed">{event.content}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="p-3.5 bg-gray-50 border-t border-gray-200">
              <textarea 
                name="message" 
                rows="2" 
                placeholder="Registrar respuesta al cliente por WhatsApp / nota interna..." 
                className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F26522] outline-none resize-none text-xs"
              ></textarea>
              <div className="flex justify-between items-center mt-2">
                <span className="text-[11px] text-gray-500 italic">Cuenta como respuesta inicial / actualización diaria</span>
                <button type="submit" className="px-5 py-2 rounded-xl text-white font-semibold text-xs shadow-sm hover:opacity-90 transition-colors" style={{ backgroundColor: BEX_COLORS.primary }}>
                  Agregar Respuesta
                </button>
              </div>
            </form>
          </div>
        </div>

        {showNextDayModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-center text-yellow-600 mb-3">
                <AlertTriangle className="w-6 h-6 mr-2" />
                <h2 className="text-lg font-bold text-gray-900">Novedad Obligatoria de Traslado</h2>
              </div>
              <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                El sistema BEX exige documentar qué se hizo hoy y qué se le comunicó al cliente para poder dejar el caso abierto para el siguiente día.
              </p>
              
              <form onSubmit={submitEODNote} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">¿Qué se logró validar durante el día?</label>
                  <textarea required name="validado" rows="2" className="w-full p-2 border border-gray-300 rounded-xl focus:ring-[#F26522] text-xs"></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">¿Qué falta por hacer / A quién se escaló?</label>
                  <textarea required name="falta" rows="2" className="w-full p-2 border border-gray-300 rounded-xl focus:ring-[#F26522] text-xs"></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">¿Qué se le informó al cliente para cerrar la jornada?</label>
                  <textarea required name="informado" rows="2" className="w-full p-2 border border-gray-300 rounded-xl focus:ring-[#F26522] text-xs"></textarea>
                </div>
                <div className="pt-2 flex justify-end space-x-3">
                  <button type="button" onClick={() => setShowNextDayModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-semibold text-xs">Cancelar</button>
                  <button type="submit" className="px-4 py-2 text-white rounded-xl font-semibold text-xs shadow-sm hover:opacity-90" style={{ backgroundColor: BEX_COLORS.primary }}>Guardar Novedad</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUsers = () => {
    if (appProfile?.role !== 'AUDITOR') return null;

    const handleCreateUser = async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      const email = String(f.get('email')).trim();
      const password = String(f.get('password'));
      let secondaryApp;

      try {
        // La instancia secundaria evita cerrar la sesión del administrador actual.
        secondaryApp = initializeApp(firebaseConfig, `BEX-User-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);

        await setDoc(doc(db, USERS_COLLECTION, credential.user.uid), {
          name: String(f.get('name')).trim(),
          email,
          role: String(f.get('role')),
          active: true,
          createdAt: Date.now()
        });

        await signOut(secondaryAuth);
        form.reset();
        alert('Usuario creado correctamente. Ya puede ingresar con su correo y contraseña.');
      } catch (error) {
        console.error('Error creando usuario:', error);
        alert(`No fue posible crear el usuario: ${error.message}`);
      } finally {
        if (secondaryApp) {
          const { deleteApp } = await import('firebase/app');
          await deleteApp(secondaryApp).catch(() => {});
        }
      }
    };

    const handleUpdateUser = async (e) => {
      e.preventDefault();
      if (!editingUser) return;
      const f = new FormData(e.currentTarget);
      const updateData = {
        name: String(f.get('name')).trim(),
        email: String(f.get('email')).trim(),
        role: String(f.get('role')),
        active: f.get('active') === 'true'
      };
      const requestPasswordReset = String(f.get('password') || '').trim() !== '';

      try {
        await updateDoc(doc(db, USERS_COLLECTION, editingUser.id), updateData);
        if (requestPasswordReset) {
          await sendPasswordResetEmail(auth, updateData.email);
          alert('Perfil actualizado. Se envió un enlace para restablecer la contraseña.');
        }
        setEditingUser(null);
      } catch (error) {
        console.error('Error actualizando usuario:', error);
        alert(`No fue posible actualizar el usuario: ${error.message}`);
      }
    };

    return (
      <div className="p-4 sm:p-6 bg-[#F4F6F8] min-h-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: BEX_COLORS.dark }}>Administración de Usuarios</h1>
            <p className="text-xs sm:text-sm text-gray-500">Gestión de perfiles, roles y accesos. Las contraseñas se administran con Firebase Authentication.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm h-fit">
            <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center">
              <PlusCircle className="w-5 h-5 mr-2 text-[#F26522]" /> Crear Nuevo Usuario
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Nombre Completo</label>
                <input required name="name" placeholder="Ej: Gilberto Hernández" className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#F26522] outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Correo Electrónico</label>
                <input required name="email" type="email" placeholder="usuario@bexsoluciones.com" className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#F26522] outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Contraseña inicial (mínimo 6 caracteres)</label>
                <input required name="password" type="password" minLength={6} placeholder="Contraseña temporal" className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#F26522] outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Rol en Plataforma</label>
                <select required name="role" defaultValue="CONSULTOR" className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#F26522] outline-none bg-white">
                  <option value="CONSULTOR">CONSULTOR (Gestión de casos)</option>
                  <option value="AUDITOR">AUDITOR (Acceso total & Reportes)</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 text-white rounded-xl font-bold text-xs shadow hover:opacity-90 transition mt-2" style={{ backgroundColor: BEX_COLORS.primary }}>
                Guardar Usuario
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="font-bold text-xs text-gray-700 uppercase">Usuarios Registrados ({usersList.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600 min-w-[500px]">
                <thead className="bg-gray-100/70 border-b text-gray-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usersList.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-bold text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${u.role === 'AUDITOR' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => setEditingUser(u)} 
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-[#F26522] transition inline-flex items-center"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {editingUser && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h3 className="font-bold text-base text-gray-900 flex items-center">
                  <Edit2 className="w-4 h-4 mr-2 text-[#F26522]" /> Editar Usuario: {editingUser.name}
                </h3>
                <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Nombre Completo</label>
                  <input required name="name" defaultValue={editingUser.name} className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#F26522] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Correo Electrónico</label>
                  <input required name="email" type="email" defaultValue={editingUser.email} className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#F26522] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Enviar restablecimiento de contraseña (opcional)</label>
                  <input name="password" placeholder="Escriba nueva clave..." className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#F26522] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Rol</label>
                  <select name="role" defaultValue={editingUser.role} className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#F26522] outline-none bg-white">
                    <option value="CONSULTOR">CONSULTOR</option>
                    <option value="AUDITOR">AUDITOR</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Estado de la cuenta</label>
                  <select name="active" defaultValue={editingUser.active ? 'true' : 'false'} className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#F26522] outline-none bg-white">
                    <option value="true">Activo</option>
                    <option value="false">Inactivo (bloquear acceso)</option>
                  </select>
                </div>
                <div className="pt-3 flex justify-end space-x-2">
                  <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 text-xs font-bold text-white rounded-xl shadow hover:opacity-90" style={{ backgroundColor: BEX_COLORS.primary }}>
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCompanies = () => {
    if (appProfile?.role !== 'AUDITOR') return null;

    const handleAddCompany = async (e) => {
      e.preventDefault();
      const name = e.target.name.value;
      if (!name) return;
      try {
        const newRef = doc(collection(db, COMPANIES_COLLECTION));
        await setDoc(newRef, { name, active: true });
        e.target.reset();
      } catch (err) { console.error(err); }
    };

    return (
      <div className="p-4 sm:p-6 bg-[#F4F6F8] min-h-full">
        <h1 className="text-2xl font-bold mb-6" style={{ color: BEX_COLORS.dark }}>Catálogo de Empresas & Concesionarios</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm h-fit">
            <h3 className="font-bold text-gray-800 mb-4 text-base">Agregar Empresa</h3>
            <form onSubmit={handleAddCompany} className="space-y-4">
              <input required name="name" placeholder="Nombre de la empresa" className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-[#F26522] outline-none" />
              <button type="submit" className="w-full py-2.5 text-white rounded-xl font-bold text-xs" style={{ backgroundColor: BEX_COLORS.primary }}>Guardar Empresa</button>
            </form>
          </div>
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-96 overflow-y-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-100 border-b sticky top-0"><tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Estado</th></tr></thead>
              <tbody className="divide-y">
                {companies.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{c.name}</td>
                    <td className="px-4 py-3"><span className="text-green-600 font-bold text-xs">Activo</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    const invalidRange = reportStartDate && reportEndDate && reportStartDate > reportEndDate;
    return (
      <div className="p-4 sm:p-6 bg-[#F4F6F8] min-h-full flex flex-col items-center justify-center">
        <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-md border-t-4 text-center max-w-3xl w-full" style={{ borderColor: BEX_COLORS.primary }}>
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-[#F26522] flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8" /></div>
          <h2 className="text-2xl font-bold mb-2 tracking-tight" style={{ color: BEX_COLORS.dark }}>Centro de Informes & Exportación BEX</h2>
          <p className="text-gray-500 mb-6 text-xs sm:text-sm">Selecciona el periodo de recepción de los casos que necesitas incluir en el informe.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-3">
            <div><label className="block text-xs font-bold text-gray-700 mb-1">Fecha inicial</label>
              <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#F26522] outline-none" /></div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1">Fecha final</label>
              <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#F26522] outline-none" /></div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 text-xs">
            <span className="text-gray-500">Casos encontrados: <strong className="text-gray-900">{invalidRange ? 0 : reportTickets.length}</strong></span>
            <button onClick={() => { setReportStartDate(''); setReportEndDate(''); }} className="text-[#F26522] font-semibold hover:underline">Limpiar fechas · Mostrar todos</button>
          </div>
          {invalidRange && <p className="text-red-600 text-xs mb-4">La fecha inicial no puede ser posterior a la fecha final.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50 flex flex-col justify-between">
              <div><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-800 uppercase tracking-wide">Excel / CSV</span>
                <h3 className="font-bold text-sm text-gray-900 mt-2">Consolidado en Excel</h3><p className="text-xs text-gray-500 mt-1">Descarga únicamente los casos recibidos dentro del periodo seleccionado.</p></div>
              <button disabled={invalidRange || reportTickets.length === 0} onClick={exportCSV} className="mt-4 w-full py-2.5 px-3 rounded-xl text-white font-bold text-xs flex items-center justify-center shadow disabled:opacity-40" style={{ backgroundColor: BEX_COLORS.primary }}><Download className="w-4 h-4 mr-2" /> Exportar a Excel</button>
            </div>
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50 flex flex-col justify-between">
              <div><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wide">Documento PDF</span>
                <h3 className="font-bold text-sm text-gray-900 mt-2">Informe Ejecutivo Estructurado</h3><p className="text-xs text-gray-500 mt-1">Genera un informe imprimible con resumen y detalle de los casos del periodo seleccionado.</p></div>
              <button disabled={invalidRange || reportTickets.length === 0} onClick={() => setShowPdfReportModal(true)} className="mt-4 w-full py-2.5 px-3 rounded-xl text-white font-bold text-xs flex items-center justify-center shadow bg-[#17243A] disabled:opacity-40"><Printer className="w-4 h-4 mr-2" /> Generar Informe PDF</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!firebaseUser) return renderLogin();
  if (!appProfile) return <div className="h-screen w-screen flex items-center justify-center text-gray-600 font-semibold text-sm">Validando perfil de BEX HELPDESK...</div>;

  return (
    <div className="flex h-screen font-sans overflow-hidden selection:bg-[#F26522] selection:text-white bg-[#F4F6F8]">
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
        />
      )}

      {renderSidebar()}
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-gray-800 capitalize">
              {view === 'cases' ? 'Casos y Gestión' : view === 'new' ? 'Registrar Novedad' : view === 'reports' ? 'Informes' : view === 'users' ? 'Usuarios' : view === 'companies' ? 'Empresas' : 'Panel de Control'}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-600 cursor-pointer">
              <Bell className="w-5 h-5" />
              {unrespondedTickets.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </div>
            <div className="text-xs sm:text-sm font-semibold text-gray-700 border-l pl-4 border-gray-200 hidden sm:block">
              {currentTime.toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto">
          {view === 'dashboard' && renderDashboard()}
          {view === 'new' && renderNewTicket()}
          {view === 'cases' && renderCasesList()}
          {view === 'detail' && renderCaseDetail()}
          {view === 'reports' && renderReports()}
          {view === 'users' && renderUsers()}
          {view === 'companies' && renderCompanies()}
        </div>
      </main>

      {showSlaMatrixModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900" style={{ color: BEX_COLORS.dark }}>
                  Matriz de Atención & Acuerdos de Servicio (SLA) BEX
                </h3>
                <p className="text-xs text-gray-500">Horario Hábil: Lunes a Viernes 8:00 AM - 5:00 PM (Colombia)</p>
              </div>
              <button onClick={() => setShowSlaMatrixModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-100 font-bold text-gray-700">
                    <tr>
                      <th className="p-2.5">Prioridad</th>
                      <th className="p-2.5">Tipo de Caso</th>
                      <th className="p-2.5">1ra Respuesta</th>
                      <th className="p-2.5">Seguimiento</th>
                      <th className="p-2.5">Objetivo Solución*</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.keys(SLA_MATRIX).map(key => {
                      const item = SLA_MATRIX[key];
                      return (
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="p-2.5 font-bold whitespace-nowrap">{item.badge}</td>
                          <td className="p-2.5 text-gray-600 max-w-[200px] text-[11px]">{item.description}</td>
                          <td className="p-2.5 font-bold text-orange-600 whitespace-nowrap">{item.firstResponseLabel}</td>
                          <td className="p-2.5 font-semibold text-gray-800 whitespace-nowrap">{item.followUpLabel}</td>
                          <td className="p-2.5 text-gray-600 text-[11px]">{item.targetResolutionLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-xs space-y-2 text-gray-800">
                <p className="font-bold text-[#F26522] text-sm flex items-center">
                  <ShieldAlert className="w-4 h-4 mr-1.5" /> Reglas Fundamentales del Servicio:
                </p>
                <p>1. <strong>Ningún caso puede permanecer sin respuesta.</strong></p>
                <p>2. <strong>Ningún cliente puede pasar más de un día hábil sin recibir una actualización</strong> cuando el caso continúe abierto.</p>
                <p>3. <strong>Todo caso escalado debe tener seguimiento hasta su cierre.</strong></p>
                <p>4. <strong>El consultor es responsable del seguimiento</strong>, aunque la solución dependa de otra área o de terceros.</p>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={() => setShowSlaMatrixModal(false)}
                  className="px-5 py-2 rounded-xl text-white font-bold text-xs" 
                  style={{ backgroundColor: BEX_COLORS.primary }}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPdfReportModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 sm:p-8 animate-in zoom-in-95 duration-200 my-auto print:m-0 print:p-0 print:shadow-none print:w-full">
            <div className="flex justify-between items-center mb-6 border-b pb-4 print:hidden">
              <div className="flex items-center space-x-2">
                <FileText className="w-6 h-6 text-[#F26522]" />
                <h3 className="font-bold text-lg text-gray-900">Vista Previa de Informe Ejecutivo</h3>
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-[#17243A] text-white font-bold text-xs flex items-center shadow hover:opacity-90 transition"
                >
                  <Printer className="w-4 h-4 mr-2" /> Imprimir / Guardar como PDF
                </button>
                <button 
                  onClick={() => setShowPdfReportModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-300 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="space-y-6 text-gray-800">
              <div className="border-b-2 border-[#F26522] pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black tracking-tight" style={{ color: BEX_COLORS.dark }}>
                    BEX <span style={{ color: BEX_COLORS.primary }}>HELPDESK</span>
                  </h1>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">Informe Consolidado de Gestión & Incidentes BEX Móvil</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold text-gray-900">Fecha de Emisión: {new Date().toLocaleDateString('es-CO')}</p>
                  <p className="text-gray-500">Periodo: {reportStartDate || 'Inicio'} a {reportEndDate || 'Hoy'}</p>
                  <p className="text-gray-500">Hora: {currentTime.toLocaleTimeString('es-CO')}</p>
                  <p className="text-gray-500">Emitido por: {appProfile.name} ({appProfile.role})</p>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">1. Dashboard Resumen de Operación</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-[11px] font-bold text-gray-500 uppercase">Total Casos</p>
                    <p className="text-xl font-black text-gray-900 mt-1">{reportTickets.length}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-50 border border-orange-200">
                    <p className="text-[11px] font-bold text-[#F26522] uppercase">En Gestión</p>
                    <p className="text-xl font-black text-[#F26522] mt-1">{reportTickets.filter(t => !['Solucionado', 'Cerrado'].includes(t.status)).length}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                    <p className="text-[11px] font-bold text-green-700 uppercase">Solucionados</p>
                    <p className="text-xl font-black text-green-700 mt-1">{reportTickets.filter(t => ['Solucionado', 'Cerrado'].includes(t.status)).length}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                    <p className="text-[11px] font-bold text-red-700 uppercase">Pendientes Actualizar</p>
                    <p className="text-xl font-black text-red-700 mt-1">{reportTickets.filter(t => !t.hasFirstResponse && !['Cerrado', 'Solucionado'].includes(t.status)).length}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">2. Distribución de Casos por Nivel de Prioridad</h2>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {Object.keys(SLA_MATRIX).map(pKey => {
                    const count = reportTickets.filter(t => t.priority === pKey).length;
                    const meta = SLA_MATRIX[pKey];
                    return (
                      <div key={pKey} className="p-2.5 rounded-xl border border-gray-200 bg-white">
                        <p className="font-bold">{meta.badge}</p>
                        <p className="text-lg font-black text-gray-900 mt-0.5">{count}</p>
                        <p className="text-[10px] text-gray-500">1ra Resp: {meta.firstResponseLabel}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">3. Detalle Individual de Casos</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-gray-200">
                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2 border">ID</th>
                        <th className="p-2 border">Fecha</th>
                        <th className="p-2 border">Cliente / Empresa</th>
                        <th className="p-2 border">Cat.</th>
                        <th className="p-2 border">Prioridad</th>
                        <th className="p-2 border">Estado</th>
                        <th className="p-2 border">Consultor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {reportTickets.map(t => (
                        <tr key={t.id}>
                          <td className="p-2 border font-bold text-gray-900 whitespace-nowrap">{t.caseId}</td>
                          <td className="p-2 border text-[10px] whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString('es-CO')}</td>
                          <td className="p-2 border">
                            <span className="font-bold">{t.clientName}</span> - {t.company}
                          </td>
                          <td className="p-2 border text-[11px]">{t.category || 'Incidente'}</td>
                          <td className="p-2 border font-semibold text-[11px] whitespace-nowrap">{t.priority}</td>
                          <td className="p-2 border text-[11px] whitespace-nowrap">{t.status}</td>
                          <td className="p-2 border text-[11px] whitespace-nowrap">{usersList.find(u => u.id === t.assignedTo)?.name || 'Sin Asignar'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400">
                Documento oficial generado desde BEX HELPDESK • Sistema de Trazabilidad y Garantía de Servicio
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}