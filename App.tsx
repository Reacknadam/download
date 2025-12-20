import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate, useNavigate, useParams } from 'react-router-dom';
import { User, Home, PlayCircle, Upload, LayoutDashboard, BookOpen, Wallet, LogOut, Loader2, Search, Compass, Star, CheckCircle, AlertCircle, CreditCard, Users, HelpCircle, Mail, TrendingUp, Clock, X, Filter, MessageCircle, Send, ArrowRight, ArrowLeft, Award } from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, deleteDoc, orderBy, limit, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Hls from 'hls.js';

import Landing from './components/Landing';
import AITutor from './components/AITutor';
import ProfileScreen from './ProfileScreen';
import TeacherProfileScreen from './TeacherProfileScreen';
import BecomeTeacherScreen from './BecomeTeacherScreen';
import MyCoursesPage from './MyCoursesPage';
import CreateCoursePage from './CreateCoursePage';
import WalletPage from './WalletPage';
import SearchPage from './SearchPage';
import InstructorPage from './InstructorPage';
import PlaylistDetail from './PlaylistDetail';
import PlaylistWatchPage from './PlaylistWatchPage';
import HistoryPage from './HistoryPage';
import { db, storage } from './services/firebase';
import { authService } from './services/auth';
import { workerApi } from './services/worker';
import { useAuth } from './stores/auth';
import { Course, User as UserType, Playlist } from './types';
import { formatPrice, calculateRevenueShare } from './lib/pricing';
import { shareCourse, sharePlaylist } from './lib/share';

// --- Query Client Setup ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// --- Auth Components ---

const AuthPage = ({ type }: { type: 'login' | 'signup' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, setUser, setToken } = useAuth();

  // SEO: Update document title and meta tags
  useEffect(() => {
    document.title = type === 'login' 
      ? 'Connexion - Jimmy School | Accédez à vos cours en ligne'
      : 'Inscription - Jimmy School | Commencez votre apprentissage';
    
    // Update or create meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 
      type === 'login'
        ? 'Connectez-vous à votre compte Jimmy School pour accéder à vos cours en ligne et poursuivre votre apprentissage.'
        : 'Inscrivez-vous gratuitement sur Jimmy School et accédez à des milliers de cours en ligne pour développer vos compétences.'
    );

    // Update Open Graph tags
    updateMetaTag('og:title', document.title);
    updateMetaTag('og:description', metaDescription.getAttribute('content') || '');
    updateMetaTag('og:type', 'website');
    updateMetaTag('og:url', window.location.href);
    updateMetaTag('og:image', 'https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f');
    
    // Update Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', document.title);
    updateMetaTag('twitter:description', metaDescription.getAttribute('content') || '');
    updateMetaTag('twitter:image', 'https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f');
  }, [type]);

  const updateMetaTag = (property: string, content: string) => {
    let tag = document.querySelector(`meta[property="${property}"]`) || 
              document.querySelector(`meta[name="${property}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(property.startsWith('og:') ? 'property' : 'name', property);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (type === 'signup') {
        const user = await authService.signUp(email, password, name);
        // Auto login flow after signup usually requires re-auth or we use the session if available.
        // For simplicity, we ask them to login or implement auto-login if token available.
        // Our service returns the user object but we might need to login to get the token for Supabase.
        const { token } = await authService.login(email, password);
        setUser(user);
        setToken(token);
      } else {
        const { user, token } = await authService.login(email, password);
        setUser(user);
        setToken(token);
      }
      navigate('/app');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex">
      {/* Left side - Illustration and branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primaryHover p-12 text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-center h-full">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <img 
                src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" 
                alt="Jimmy School" 
                className="h-12 w-12 rounded-xl shadow-lg" 
              />
              <h1 className="text-3xl font-bold">Jimmy School</h1>
            </div>
            <h2 className="text-4xl font-bold mb-4 leading-tight">
              {type === 'login' ? 'Bienvenue de retour' : 'Commencez votre voyage d\'apprentissage'}
            </h2>
            <p className="text-xl opacity-90 mb-8 leading-relaxed">
              {type === 'login' 
                ? 'Accédez à vos cours, poursuivez votre apprentissage et atteignez vos objectifs.'
                : 'Rejoignez des milliers d\'étudiants et développez de nouvelles compétences avec nos cours en ligne.'
              }
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">1000+ Cours disponibles</h3>
                <p className="opacity-80">Apprenez à votre rythme</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Communauté active</h3>
                <p className="opacity-80">Apprenez avec d'autres</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Certificats reconnus</h3>
                <p className="opacity-80">Validez vos compétences</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 backdrop-blur-sm"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24 backdrop-blur-sm"></div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 justify-center mb-8 lg:hidden">
            <img 
              src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" 
              alt="Jimmy School" 
              className="h-10 w-10 rounded-lg shadow-md" 
            />
            <h1 className="text-2xl font-bold text-gray-900">Jimmy School</h1>
          </div>
          
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                {type === 'login' ? 'Connexion' : 'Inscription'}
              </h1>
              <p className="text-gray-600">
                {type === 'login' 
                  ? 'Accédez à votre espace personnel'
                  : 'Créez votre compte gratuitement'
                }
              </p>
            </div>
            
            {error && (
              <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-3" role="alert">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6" aria-label={type === 'login' ? 'Formulaire de connexion' : 'Formulaire d\'inscription'}>
              {type === 'signup' && (
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-semibold text-gray-700">
                    Nom complet
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Jean Dupont"
                    autoComplete="name"
                  />
                </div>
              )}
              
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-gray-700">
                  Adresse email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="votre@email.com"
                  autoComplete={type === 'login' ? 'username' : 'email'}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-gray-700">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="••••••••"
                  autoComplete={type === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                />
                {type === 'signup' && (
                  <p className="mt-2 text-xs text-gray-500">Minimum 8 caractères</p>
                )}
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-primaryHover py-3.5 font-bold text-white transition-all duration-200 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex justify-center items-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {type === 'login' ? 'Connexion...' : 'Inscription...'}
                  </>
                ) : (
                  <>
                    {type === 'login' ? 'Se connecter' : "S'inscrire"}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                {type === 'login' ? (
                  <>Pas encore de compte ? {' '}
                    <Link 
                      to="/auth/signup" 
                      className="font-semibold text-primary hover:text-primaryHover transition-colors"
                    >
                      S'inscrire gratuitement
                    </Link>
                  </>
                ) : (
                  <>Déjà un compte ? {' '}
                    <Link 
                      to="/auth/login" 
                      className="font-semibold text-primary hover:text-primaryHover transition-colors"
                    >
                      Se connecter
                    </Link>
                  </>
                )}
              </p>
            </div>

            {/* Additional links */}
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <Link 
                to="/" 
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                Retour à l'accueil
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Shared Components ---

const SidebarItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link
    to={to}
    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
      active
        ? 'bg-primary/10 text-primary'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </Link>
);

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user, login, signUp, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    signOut();
    navigate('/');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  if (!user) return <Navigate to="/auth/login" replace />;

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.isTeacherVerified;

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* Mobile Menu Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-gray-200 bg-white transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex h-16 items-center justify-between px-6 border-b border-gray-100">
           <Link to="/" className="flex items-center gap-2">
              <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Jimmy School" className="h-8 w-8 rounded-lg" />
              <span className="font-bold text-lg">Jimmy School</span>
           </Link>
           <button
             onClick={() => setIsSidebarOpen(false)}
             className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
           >
             <X className="h-5 w-5" />
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {!isTeacher ? (
            <>
              <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Apprentissage</p>
              <SidebarItem to="/app" icon={Home} label="Accueil" active={location.pathname === '/app'} />
              <SidebarItem to="/app/my-courses" icon={PlayCircle} label="Mes Cours achetes" active={location.pathname === '/app/my-courses'} />
              
              <div className="my-6 border-t border-gray-100"></div>
              
              <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Compte</p>
              <SidebarItem to="/app/profile" icon={User} label="Mon Profil" active={location.pathname === '/app/profile'} />
            </>
          ) : (
            <>
              <div className="mb-4 rounded-lg bg-purple-50 p-3">
                 <p className="text-xs font-medium text-primary uppercase">Mode Formateur</p>
              </div>
              <SidebarItem to="/teacher" icon={LayoutDashboard} label="Tableau de bord" active={location.pathname === '/teacher'} />
              <SidebarItem to="/teacher/create" icon={Upload} label="Créer un cours" active={location.pathname === '/teacher/create'} />
              <SidebarItem to="/teacher/courses" icon={BookOpen} label="Gerer mes cours" active={location.pathname === '/teacher/courses'} />
              <SidebarItem to="/teacher/wallet" icon={Wallet} label="Wallet" active={location.pathname === '/teacher/wallet'} />
            </>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 space-y-2">
           {!isTeacher ? (
              <Link to="/teacher/onboarding" className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-2.5 text-xs font-semibold text-white transition hover:bg-black">
                Devenir Formateur
              </Link>
           ) : (
             <Link to="/app" className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 py-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
                Retour Élève
              </Link>
           )}
           <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-red-600 hover:bg-red-50">
              <LogOut size={14} /> Déconnexion
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navigation */}
        <header className="bg-white border-b border-gray-200">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSidebar}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <Link to="/" className="flex items-center gap-2">
                  <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Jimmy School" className="h-8 w-8 rounded" />
                  <span className="font-bold text-lg hidden sm:inline">Jimmy School</span>
                </Link>
              </div>
              
              <div className="hidden md:flex items-center gap-6">
                <a href="/#why" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">
                  Pourquoi
                </a>
                <a href="/#how" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">
                  Comment ça marche
                </a>
                <a href="/#features" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">
                  Fonctionnalités
                </a>
              </div>
              
              <div className="flex items-center gap-2">
                <Link to="/app" className="flex items-center gap-1 p-2 rounded hover:bg-gray-100">
                  <Home size={20} />
                  <span className="text-sm text-gray-600 hidden sm:inline">Accueil</span>
                </Link>
                <Link to="/app/my-courses" className="flex items-center gap-1 p-2 rounded hover:bg-gray-100">
                  <PlayCircle size={20} />
                  <span className="text-sm text-gray-600 hidden sm:inline">Mes Cours achetes
                    
                  </span>
                </Link>
                {isTeacher && (
                  <Link to="/teacher" className="flex items-center gap-1 p-2 rounded hover:bg-gray-100">
                    <LayoutDashboard size={20} />
                    <span className="text-sm text-gray-600 hidden sm:inline">Tableau</span>
                  </Link>
                )}
                {isTeacher && (
                  <Link to="/teacher/create" className="flex items-center gap-1 p-2 rounded hover:bg-gray-100">
                    <Upload size={20} />
                    <span className="text-sm text-gray-600 hidden sm:inline">Créer</span>
                  </Link>
                )}
                <Link to="/app/profile" className="flex items-center gap-1 p-2 rounded hover:bg-gray-100">
                  <User size={20} />
                  <span className="text-sm text-gray-600 hidden sm:inline">Profil</span>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-4 md:p-8">
           <div className="mx-auto max-w-5xl">
              {children}
           </div>
        </div>
      </div>
      
      {!isTeacher && <AITutor />}
    </div>
  );
};

const CourseCard = ({ course }: { course: Course; key?: string }) => {
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    await shareCourse(course.id, {
      title: course.title,
      description: course.description,
      price: course.price,
      teacherName: course.teacherName,
      thumbnailUrl: course.thumbnailUrl,
      viewCount: course.viewCount
    });
  };

  return (
    <Link to={`/course/${course.id}`} className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-video w-full overflow-hidden bg-gray-200">
        <img
          src={course.thumbnailUrl}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
            <PlayCircle className="ml-1 h-6 w-6 text-primary" />
          </div>
        </div>
        <button
          onClick={handleShare}
          className="absolute top-2 right-2 rounded-lg bg-white/90 p-2 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 line-clamp-2 flex-1 text-sm font-bold text-gray-900 leading-snug">{course.title}</h3>
        <p className="mb-3 text-xs text-gray-500">Par {course.teacherName}</p>
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5 text-gray-400">
            <span className="text-[10px]">{course.viewCount} vues</span>
          </div>
          <span className="text-sm font-bold text-primary">{course.price === 0 ? 'Gratuit' : `${course.price} $`}</span>
        </div>
      </div>
    </Link>
  );
};

const PlaylistCard = ({ playlist }: { playlist: Playlist; key?: string }) => {
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    await sharePlaylist(playlist.id, {
      title: playlist.title,
      description: playlist.description,
      price: playlist.price,
      teacherName: playlist.teacherName,
      thumbnailUrl: playlist.thumbnailUrl,
      viewCount: playlist.viewCount,
      courseCount: playlist.courseCount
    });
  };

  // Utiliser le thumbnail de la première vidéo si celui de la playlist est vide
  const getThumbnailUrl = () => {
    if (!playlist.thumbnailUrl || playlist.thumbnailUrl === '') {
      if (playlist.videos && playlist.videos.length > 0) {
        return playlist.videos[0].thumbnailUrl;
      }
    }
    return playlist.thumbnailUrl || 'https://via.placeholder.com/320x180';
  };

  return (
    <Link to={`/playlist/${playlist.id}`} className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-video w-full overflow-hidden bg-gray-200">
        <img
          src={getThumbnailUrl()}
          alt={playlist.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/320x180';
          }}
        />
        <div className="absolute top-2 left-2 rounded-full bg-purple-600 px-2 py-1 text-xs font-bold text-white">
          SÉRIE
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
            <BookOpen className="ml-1 h-6 w-6 text-primary" />
          </div>
        </div>
        <button
          onClick={handleShare}
          className="absolute top-2 right-2 rounded-lg bg-white/90 p-2 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 line-clamp-2 flex-1 text-sm font-bold text-gray-900 leading-snug">{playlist.title}</h3>
        <p className="mb-3 text-xs text-gray-500">Par {playlist.teacherName}</p>
        <div className="mb-2 flex items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <BookOpen size={12} />
            <span>{playlist.courseCount} cours</span>
          </div>
          {playlist.totalDuration && (
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{Math.floor(playlist.totalDuration / 60)}min</span>
            </div>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5 text-gray-400">
            <span className="text-[10px]">{playlist.viewCount} vues</span>
          </div>
          <span className="text-sm font-bold text-primary">{playlist.price === 0 ? 'Gratuit' : `${playlist.price} $`}</span>
        </div>
      </div>
    </Link>
  );
};

// --- Student Pages ---

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Fetch Banners
  const { data: banners } = useQuery({
    queryKey: ['banners'],
    queryFn: async () => {
      const q = query(collection(db, 'config'), where('__name__', '==', 'banners'));
      const snap = await getDocs(q);
      const data = snap.docs[0]?.data();
      return data?.banners?.filter((b: any) => b.isActive) || [];
    }
  });

  // Fetch Trending Courses
  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses', 'trending'],
    queryFn: async () => {
      // In a real scenario, create a composite index in Firebase for orderBy('viewCount') + where('isPublished')
      // Fallback to client side filter if index missing during dev
      const q = query(collection(db, 'courses'), orderBy('viewCount', 'desc'), limit(10));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
    }
  });

  // Fetch Playlists (Séries)
  const { data: playlists, isLoading: playlistsLoading } = useQuery({
    queryKey: ['playlists', 'public'],
    queryFn: async () => {
      const q = query(
        collection(db, 'playlists'),
        where('isPublic', '==', true),
        where('isPublished', '==', true),
        orderBy('createdAt', 'desc'),
        limit(6)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Playlist));
    }
  });

  return (
    <AppLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Cours Populaires</h2>
        
        {/* Barre de recherche */}
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="Rechercher un cours..."
            className="w-full px-4 py-3 pl-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            onClick={() => navigate('/search')}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>
      </div>

      {/* Banners */}
      {banners && banners.length > 0 && (
        <div className="mb-10 relative overflow-hidden rounded-3xl p-8 text-white shadow-xl" style={{ backgroundColor: banners[0].backgroundColor || '#1F2937' }}>
           <div className="relative z-10 max-w-lg">
              <h2 className="mb-4 text-3xl font-bold leading-tight">{banners[0].title}</h2>
              <p className="mb-6 text-sm opacity-90">{banners[0].description}</p>
           </div>
           {banners[0].imageUrl && (
             <img src={banners[0].imageUrl} alt="Banner" className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-50" />
           )}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
         <h3 className="text-lg font-bold text-gray-900">Cours Tendances 🔥</h3>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-10">
           {Array.isArray(courses) ? courses.map(course => (
              <CourseCard key={course.id} course={course} />
           )) : null}
        </div>
      )}

      {/* Séries de cours */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Séries Populaires</h3>
      </div>

      {playlistsLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          {Array.isArray(playlists) ? playlists.map(playlist => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          )) : null}
        </div>
      )}

          </AppLayout>
  );
};

const CourseDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: course } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const docSnap = await getDoc(doc(db, 'courses', id!));
      return { id: docSnap.id, ...docSnap.data() } as Course;
    },
    enabled: !!id
  });

  const { data: purchaseStatus } = useQuery({
    queryKey: ['purchase', id, user?.uid],
    queryFn: async () => {
      const q = query(collection(db, 'purchases'), where('userId', '==', user?.uid), where('courseId', '==', id), where('status', '==', 'completed'));
      const snap = await getDocs(q);
      return !snap.empty;
    },
    enabled: !!user && !!id
  });

  // Récupérer les commentaires du cours
  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['courseComments', id],
    queryFn: async () => {
      const q = query(
        collection(db, 'comments'),
        where('courseId', '==', id),
        where('type', '==', 'course'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!id
  });

  // Récupérer les autres cours du même formateur
  const { data: teacherCourses = [] } = useQuery({
    queryKey: ['teacherCourses', course?.teacherId],
    queryFn: async () => {
      if (!course?.teacherId) return [];
      const q = query(collection(db, 'courses'), where('teacherId', '==', course.teacherId), where('isPublished', '==', true));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)).filter(c => c.id !== course?.id);
    },
    enabled: !!course?.teacherId
  });

  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [depositId, setDepositId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('pending');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Polling du statut de paiement
  const pollStatus = (id: string) => {
    let attempts = 0;
    const maxAttempts = 20; // 60 secondes max
    
    pollRef.current = setInterval(async () => {
      attempts++;
      
      try {
        const result = await workerApi.getDepositStatus(id);
        const status = result.status?.toLowerCase();
        
        if (['completed', 'success'].includes(status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          await grantAccess(id);
          setPaymentStatus('success');
          setTimeout(() => {
            setShowPayment(false);
            setPaymentStatus('pending');
          }, 2000);
        } else if (['failed', 'cancelled', 'rejected'].includes(status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPaymentStatus('failed');
          setTimeout(() => {
            setShowPayment(false);
            setPaymentStatus('pending');
          }, 3000);
        } else if (attempts >= maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPaymentStatus('failed');
          setTimeout(() => {
            setShowPayment(false);
            setPaymentStatus('pending');
          }, 3000);
        }
      } catch (error) {
        console.error('Erreur polling:', error);
        if (attempts >= maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPaymentStatus('failed');
        }
      }
    }, 3000); // Toutes les 3 secondes
  };

  // Accorder l'accès après paiement réussi
  const grantAccess = async (depId: string) => {
    if (!course || !user) return;
    
    try {
      // Créer le document purchase
      await addDoc(collection(db, 'purchases'), {
        userId: user.uid,
        courseId: course.id,
        teacherId: course.teacherId,
        depositId: depId,
        amount: course.price,
        currency: 'USD',
        status: 'completed',
        createdAt: serverTimestamp(),
      });

      // Mettre à jour le compteur de ventes
      const courseRef = doc(db, 'courses', course.id);
      const courseSnap = await getDoc(courseRef);
      if (courseSnap.exists()) {
        await updateDoc(courseRef, {
          saleCount: (courseSnap.data().saleCount ?? 0) + 1,
        });
      }
    } catch (error) {
      console.error('Erreur grantAccess:', error);
    }
  };

  const handleBuy = async () => {
    if (!course || !user) return;
    try {
      const { paymentUrl: url, depositId: depId } = await workerApi.createDeposit(
        user.uid, 
        course.id, 
        course.price
      );
      
      if (!url || !depId) {
        throw new Error('Réponse invalide du serveur');
      }
      
      setPaymentUrl(url);
      setDepositId(depId);
      setShowPayment(true);
      setPaymentStatus('pending');
      
      // Démarrer le polling
      pollStatus(depId);
    } catch (e) {
      console.error('Erreur paiement:', e);
      alert("Erreur lors de l'initialisation du paiement");
    }
  };

  // Nettoyer le polling au démontage
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  const handleComment = async () => {
    if (!user || !newComment.trim() || newRating === 0) {
      alert('Vous devez être connecté, laisser un commentaire et une note');
      return;
    }

    if (!purchaseStatus) {
      alert('Vous devez avoir acheté le cours pour laisser un commentaire');
      return;
    }

    try {
      console.log('Envoi du commentaire:', { courseId: id, userId: user.uid, userName: user.displayName || user.email, rating: newRating, comment: newComment });
      
      await addDoc(collection(db, 'comments'), {
        courseId: id,
        userId: user.uid,
        userName: user.displayName || user.email,
        userPhoto: user.photoURL || null,
        rating: newRating,
        comment: newComment,
        createdAt: serverTimestamp()
      });

      console.log('Commentaire envoyé avec succès');
      setNewComment('');
      setNewRating(0);
      // Invalider le cache pour recharger les commentaires
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      alert('Commentaire ajouté avec succès!');
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
      alert('Erreur lors de l\'ajout du commentaire: ' + (error as Error).message);
    }
  };

  const StarRating = ({ rating, onRate, interactive = false }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={interactive ? 24 : 16}
            className={`cursor-pointer transition-colors ${
              star <= (hoveredStar || rating)
                ? 'text-yellow-500 fill-yellow-500'
                : 'text-gray-300'
            }`}
            onClick={() => interactive && onRate(star)}
            onMouseEnter={() => interactive && setHoveredStar(star)}
            onMouseLeave={() => interactive && setHoveredStar(0)}
          />
        ))}
      </div>
    );
  };

  if (!course) return <div className="p-8 text-center text-black">Chargement...</div>;

  return (
    <AppLayout>
      <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
         <div>
            <div className="mb-6 aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-lg relative">
               <img src={course.thumbnailUrl} className="w-full h-full object-cover opacity-60" alt="Thumbnail" />
               <div className="absolute inset-0 flex items-center justify-center">
                  {purchaseStatus ? (
                    <Link to={`/watch/${course.id}`} className="h-16 w-16 bg-primary rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                       <PlayCircle className="h-10 w-10 text-white ml-1" />
                    </Link>
                  ) : (
                    <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                       <PlayCircle className="h-10 w-10 text-white ml-1" />
                    </div>
                  )}
               </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-black">{course.title}</h1>
            
            {/* Teacher Info */}
            <div className="mb-4 flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <User size={20} className="text-purple-600" />
              </div>
              <div className="flex-1">
                <Link 
                  to={`/instructor/${course.teacherId}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {(course as any).teacherEmail || (course as any).teacherName || 'formateur@jimmy-school.com'}
                </Link>
                <p className="text-xs text-black">Formateur</p>
              </div>
              <Mail size={16} className="text-gray-400" />
            </div>
            
            <p className="text-black mb-6">{course.description}</p>
            
            {/* Comments Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-black mb-4">Commentaires et avis</h3>
              
              {/* Add Comment */}
              {purchaseStatus && user && (
                <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-black mb-2">Votre note</label>
                    <StarRating rating={newRating} onRate={setNewRating} interactive={true} />
                  </div>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Laissez votre commentaire..."
                    className="w-full p-3 border border-white rounded-lg resize-none h-24 text-black"
                  />
                  <button
                    onClick={handleComment}
                    className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Envoyer le commentaire
                  </button>
                </div>
              )}
              
              {/* Comments List */}
              <div className="space-y-4">
                {Array.isArray(comments) ? comments.map((comment: any) => (
                  <div key={comment.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        {comment.userPhoto ? (
                          <img src={comment.userPhoto} alt={comment.userName} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <User size={16} className="text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm text-black">{comment.authorName}</p>
                          <StarRating rating={comment.rating} onRate={() => {}} />
                        </div>
                        <p className="text-black text-sm">{comment.message}</p>
                      </div>
                    </div>
                  </div>
                )) : commentsLoading ? (
                  <p className="text-center text-gray-600 py-8">Chargement des commentaires...</p>
                ) : null}
                {Array.isArray(comments) && comments.length === 0 && !commentsLoading && (
                  <p className="text-center text-gray-600 py-8">Aucun commentaire pour ce cours</p>
                )}
              </div>
            </div>
            
            {/* Other Courses from Teacher */}
            {Array.isArray(teacherCourses) && teacherCourses.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-black mb-4">Autres cours de ce formateur</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.isArray(teacherCourses) && teacherCourses.slice(0, 4).map((teacherCourse) => (
                    <Link
                      key={teacherCourse.id}
                      to={`/course/${teacherCourse.id}`}
                      className="flex gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-200 transition-colors"
                    >
                      <img
                        src={teacherCourse.thumbnailUrl}
                        alt={teacherCourse.title}
                        className="w-20 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm mb-1 line-clamp-2 text-black">{teacherCourse.title}</h4>
                        <p className="text-purple-600 font-bold text-sm">
                          {teacherCourse.price === 0 ? 'Gratuit' : `${teacherCourse.price} USD`}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                {Array.isArray(teacherCourses) && teacherCourses.length > 4 && (
                  <Link
                    to={`/instructor/${course.teacherId}`}
                    className="block text-center mt-4 text-purple-600 hover:text-purple-800 font-medium"
                  >
                    Voir tous les cours de ce formateur
                  </Link>
                )}
              </div>
            )}
         </div>
         <div className="space-y-6">
            <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
               <div className="mb-6 text-3xl font-bold text-purple-600">{course.price > 0 ? `${course.price} $` : 'Gratuit'}</div>
               {purchaseStatus ? (
                  <Link to={`/watch/${course.id}`} className="flex justify-center w-full rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-green-700">
                    Regarder maintenant
                 </Link>
               ) : (
                 <button onClick={handleBuy} className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primaryHover">
                    Acheter le cours
                 </button>
               )}
            </div>
         </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl mx-4 h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Paiement sécurisé</h3>
              <button 
                onClick={() => {
                  setShowPayment(false);
                  if (pollRef.current) clearInterval(pollRef.current);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Status Messages */}
            {paymentStatus === 'success' && (
              <div className="p-4 bg-green-50 border border-green-200 m-4 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle size={20} />
                  <span className="font-medium">Paiement réussi ! Accès accordé</span>
                </div>
              </div>
            )}

            {paymentStatus === 'failed' && (
              <div className="p-4 bg-red-50 border border-red-200 m-4 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <X size={20} />
                  <span className="font-medium">Paiement échoué. Veuillez réessayer</span>
                </div>
              </div>
            )}

            {paymentStatus === 'pending' && (
              <div className="p-4 bg-blue-50 border border-blue-200 m-4 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700">
                  <Loader2 className="animate-spin" size={20} />
                  <span className="font-medium">Paiement en cours de traitement...</span>
                </div>
              </div>
            )}

            {/* WebView Container */}
            <div className="flex-1 bg-gray-100 rounded-lg m-4 overflow-hidden">
              {paymentUrl ? (
                <iframe
                  src={paymentUrl}
                  className="w-full h-full border-0"
                  title="Payment"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-top-navigation"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin text-purple-600" size={48} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 text-center text-sm text-gray-600">
              <p>Paiement sécurisé via PawaPay</p>
              <p className="text-xs mt-1">Ne fermez pas cette fenêtre pendant le traitement</p>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

const WatchPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  // Charger les commentaires en temps réel
  useEffect(() => {
    if (!id) return;

    const commentsQuery = query(
      collection(db, 'comments'),
      where('courseId', '==', id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      setComments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribeComments();
  }, [id]);

  // Fonction pour obtenir les initiales
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Fonction pour formater la date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Il y a quelques minutes';
    if (hours < 24) return `Il y a ${hours}h`;
    if (hours < 48) return 'Hier';
    return date.toLocaleDateString('fr-FR');
  };

  // Envoyer un commentaire
  const handleAddComment = async () => {
    if (!newComment.trim() || !user || !id || !course) return;

    try {
      await addDoc(collection(db, 'comments'), {
        message: newComment,
        courseId: id,
        creatorId: course.teacherId,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split('@')[0] || 'Anonyme',
        authorAvatar: user.photoURL || null,
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (error) {
      console.error('Erreur ajout commentaire:', error);
    }
  };

  const { data: course } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const d = await getDoc(doc(db, 'courses', id!));
      return { id: d.id, ...d.data() } as Course;
    }
  });

  // Verify access + Get Video URL
  const { data: videoData, error } = useQuery({
    queryKey: ['videoPlayback', id],
    queryFn: async () => {
       // Check purchase first
       const q = query(collection(db, 'purchases'), where('userId', '==', user?.uid), where('courseId', '==', id), where('status', '==', 'completed'));
       const snap = await getDocs(q);
       // Allow teacher to watch own course or purchased course
       if (snap.empty && course?.teacherId !== user?.uid) {
         throw new Error("Accès refusé. Veuillez acheter le cours.");
       }
       
       // Check for Bunny Stream video (priorité bunnyVideoId)
       const bunnyVideoId = (course as any)?.bunnyVideoId as string | undefined;
       const legacyVideoUrl = (course as any)?.videoUrl as string | undefined;
       const videoStatus = (course as any)?.videoStatus as string | undefined;
       
       if (bunnyVideoId) {
         return { 
           type: 'bunny',
           embedUrl: `https://player.mediadelivery.net/embed/544980/${bunnyVideoId}`
         };
       }
       
       // Fallback to old videoUrl system (compatibilité)
       if (!legacyVideoUrl) {
         if (videoStatus === 'processing') {
           throw new Error("Votre vidéo est en cours de traitement sur Bunny. Elle sera bientôt disponible.");
         }
         throw new Error("Cette vidéo ne dispose pas encore d'un identifiant Bunny. Contactez le support.");
       }
       
       return { 
         type: 'legacy',
         playbackUrl: await workerApi.getPlaybackUrl(legacyVideoUrl)
       };
    },
    enabled: !!course && !!user,
    retry: false
  });

  useEffect(() => {
    if (videoData?.type === 'legacy' && videoData?.playbackUrl && videoRef.current) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(videoData.playbackUrl);
        hls.attachMedia(videoRef.current);
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = videoData.playbackUrl;
      }
    }
  }, [videoData]);

  if (error) return <AppLayout><div className="text-red-500 p-10 font-bold text-center">{(error as Error).message}</div></AppLayout>;

  return (
    <AppLayout>
       <div className="max-w-4xl mx-auto">
         <h1 className="text-xl font-bold mb-4 text-black">{course?.title}</h1>
         <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl mb-8">
           {videoData?.type === 'bunny' ? (
             <iframe
               src={videoData.embedUrl}
               className="w-full h-full"
               allowFullScreen
               allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
             />
           ) : (
             <video ref={videoRef} controls className="w-full h-full" poster={course?.thumbnailUrl} />
           )}
         </div>

         {/* Section des commentaires */}
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
           <div className="flex items-center justify-between mb-6">
             <h2 className="text-lg font-semibold text-gray-900">
               Questions ({comments.length})
             </h2>
           </div>

           {/* Formulaire d'ajout de commentaire */}
           {user && (
             <div className="mb-6">
               <div className="flex gap-3">
                 <div className="flex-shrink-0">
                   <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                     <span className="text-sm font-medium text-purple-600">
                       {getInitials(user.displayName || user.email?.split('@')[0] || 'U')}
                     </span>
                   </div>
                 </div>
                 <div className="flex-1">
                   <div className="flex gap-2">
                     <input
                       type="text"
                       value={newComment}
                       onChange={(e) => setNewComment(e.target.value)}
                       onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                       placeholder="Posez votre question..."
                       className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                     />
                     <button
                       onClick={handleAddComment}
                       disabled={!newComment.trim()}
                       className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                     >
                       <Send size={16} />
                       Publier
                     </button>
                   </div>
                 </div>
               </div>
             </div>
           )}

           {/* Liste des commentaires */}
           <div className="space-y-4">
             {comments.length === 0 ? (
               <div className="text-center py-8 text-gray-500">
                 <MessageCircle size={48} className="mx-auto mb-4 text-gray-300" />
                 <p>Soyez le premier à poser une question !</p>
               </div>
             ) : (
               comments.map((comment) => (
                 <div key={comment.id} className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                   <div className="flex-shrink-0">
                     {comment.authorAvatar ? (
                       <img
                         src={comment.authorAvatar}
                         alt={comment.authorName}
                         className="w-10 h-10 rounded-full object-cover"
                       />
                     ) : (
                       <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                         <span className="text-sm font-medium text-purple-600">
                           {getInitials(comment.authorName)}
                         </span>
                       </div>
                     )}
                   </div>
                   <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                       <span className="font-medium text-gray-900">{comment.authorName}</span>
                       <span className="text-sm text-gray-500">{formatDate(comment.createdAt)}</span>
                     </div>
                     <p className="text-gray-700">{comment.message}</p>
                   </div>
                 </div>
               ))
             )}
           </div>
         </div>
       </div>
    </AppLayout>
  );
};

const PaymentReturnPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('Vérification du paiement en cours...');

  // Fonction pour accorder l'accès après paiement réussi
  const grantAccess = async (depositId: string) => {
    try {
      // Récupérer les infos du cours depuis le depositId
      const res = await fetch(`https://jimmy-school.jimmyokoko57.workers.dev/deposits/status/${depositId}`);
      const depositData = await res.json();
      
      if (!depositData.courseId || !depositData.amount) {
        throw new Error('Informations de paiement incomplètes');
      }

      // Créer le document purchase dans Firestore
      await addDoc(collection(db, 'purchases'), {
        userId: user!.uid,
        courseId: depositData.courseId,
        teacherId: depositData.teacherId || 'unknown',
        depositId: depositId,
        amount: depositData.amount,
        currency: depositData.currency || 'USD',
        status: 'completed',
        createdAt: serverTimestamp(),
      });

      // Mettre à jour les statistiques du cours
      const courseRef = doc(db, 'courses', depositData.courseId);
      const courseSnap = await getDoc(courseRef);
      if (courseSnap.exists()) {
        await updateDoc(courseRef, {
          saleCount: (courseSnap.data().saleCount ?? 0) + 1,
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'accord d\'accès:', error);
      throw error;
    }
  };

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Récupérer depositId depuis l'URL
        const params = new URLSearchParams(location.search);
        const depositId = params.get('depositId');
        
        if (!depositId) {
          setStatus('failed');
          setMessage('Aucune référence de paiement trouvée.');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        // Polling du statut comme Android
        let tries = 0;
        const max = 20; // 60 secondes max
        
        const pollInterval = setInterval(async () => {
          tries++;
          
          try {
            const res = await fetch(`https://jimmy-school.jimmyokoko57.workers.dev/deposits/status/${depositId}`);
            const data = await res.json();
            const st = String(data.status).toUpperCase();

            // Statuts succès
            if (['COMPLETED', 'SUCCESS'].includes(st)) {
              clearInterval(pollInterval);
              
              // Accorder l'accès au cours
              try {
                await grantAccess(depositId);
                setStatus('success');
                setMessage('Paiement réussi ! Votre accès au cours a été activé.');
                setTimeout(() => navigate('/app/my-courses'), 2000);
              } catch (error) {
                setStatus('failed');
                setMessage('Paiement réussi mais erreur lors de l\'activation de l\'accès. Contactez le support.');
                setTimeout(() => navigate('/'), 3000);
              }
              return;
            }

            // Statuts échec
            if (['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'ERROR'].includes(st)) {
              clearInterval(pollInterval);
              setStatus('failed');
              setMessage('Paiement échoué. Le paiement a été refusé ou annulé.');
              
              // Redirection vers page d'accueil après 3 secondes
              setTimeout(() => navigate('/'), 3000);
              return;
            }

            // Timeout
            if (tries >= max) {
              clearInterval(pollInterval);
              setStatus('failed');
              setMessage('Délai dépassé. Le paiement n\'a pas pu être confirmé.');
              setTimeout(() => navigate('/'), 3000);
            }
          } catch (error) {
            console.error('Erreur polling:', error);
          }
        }, 3000);

      } catch (error) {
        setStatus('failed');
        setMessage('Erreur lors de la vérification du paiement.');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    verifyPayment();
  }, [location, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4">
      {status === 'loading' && (
        <>
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
          <p className="text-gray-600">{message}</p>
        </>
      )}
      
      {status === 'success' && (
        <>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-green-600 font-semibold text-lg">{message}</p>
        </>
      )}
      
      {status === 'failed' && (
        <>
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-red-600 font-semibold text-lg">{message}</p>
        </>
      )}
    </div>
  );
};

// --- Teacher Pages ---

const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Check if actually teacher
  useEffect(() => {
    if (user?.role !== 'teacher') {
       navigate('/teacher/onboarding'); // Redirect to become teacher if not
    }
  }, [user]);

  // Fetch Stats
  const { data: stats } = useQuery({
     queryKey: ['teacherStats', user?.uid],
     queryFn: async () => {
        const coursesQ = query(collection(db, 'courses'), where('teacherId', '==', user?.uid));
        const playlistsQ = query(collection(db, 'playlists'), where('teacherId', '==', user?.uid));
        const purchasesQ = query(collection(db, 'purchases'), where('teacherId', '==', user?.uid));
        
        const [coursesSnap, playlistsSnap, purchasesSnap] = await Promise.all([getDocs(coursesQ), getDocs(playlistsQ), getDocs(purchasesQ)]);
        
        const totalRevenue = purchasesSnap.docs.reduce((acc, curr) => acc + (curr.data().amount || 0), 0);
        const { teacherShare, platformFee } = calculateRevenueShare(totalRevenue);
        
        // Calculer les vues totales
        const totalViews = coursesSnap.docs.reduce((acc, curr) => acc + (curr.data().viewCount || 0), 0) +
                           playlistsSnap.docs.reduce((acc, curr) => acc + (curr.data().viewCount || 0), 0);
        
        // Calculer le nombre total de vidéos dans les séries
        const totalVideos = playlistsSnap.docs.reduce((acc, curr) => acc + (curr.data().courseCount || 0), 0);
        
        return {
           totalRevenue,
           teacherShare,
           platformFee,
           totalStudents: purchasesSnap.size,
           courseCount: coursesSnap.size,
           playlistCount: playlistsSnap.size,
           totalViews,
           totalVideos,
           avgRating: coursesSnap.docs.reduce((acc, curr) => acc + ((curr.data() as any).averageRating || 0), 0) / coursesSnap.size || 0
        };
     },
     enabled: user?.role === 'teacher'
  });

  // Fetch recent activity
  const { data: recentActivity } = useQuery({
     queryKey: ['teacherActivity', user?.uid],
     queryFn: async () => {
        const purchasesQ = query(collection(db, 'purchases'), where('teacherId', '==', user?.uid), orderBy('createdAt', 'desc'), limit(5));
        const purchasesSnap = await getDocs(purchasesQ);
        
        return purchasesSnap.docs.map(doc => ({
           id: doc.id,
           ...doc.data(),
           createdAt: doc.data().createdAt?.toDate()
        }));
     },
     enabled: user?.role === 'teacher'
  });

  return (
    <AppLayout>
       <h1 className="text-2xl font-bold mb-6">Tableau de Bord Formateur</h1>
       
       {/* Stats principales */}
       <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
               <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase font-bold">Revenus Totaux</p>
                  <TrendingUp className="h-4 w-4 text-green-500" />
               </div>
               <p className="text-3xl font-bold text-gray-900">{formatPrice(stats?.totalRevenue || 0)}</p>
               <div className="mt-2 space-y-1">
                 <div className="flex justify-between text-xs">
                   <span className="text-gray-600">Votre part (80%):</span>
                   <span className="font-semibold text-green-600">{formatPrice(stats?.teacherShare || 0)}</span>
                 </div>
                 <div className="flex justify-between text-xs">
                   <span className="text-gray-600">Plateforme (20%):</span>
                   <span className="font-semibold text-gray-500">{formatPrice(stats?.platformFee || 0)}</span>
                 </div>
               </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
               <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase font-bold">Étudiants</p>
                  <Users className="h-4 w-4 text-blue-500" />
               </div>
               <p className="text-3xl font-bold text-gray-900">{stats?.totalStudents || 0}</p>
               <p className="text-xs text-gray-500 mt-1">Total des inscrits</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
               <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase font-bold">Cours</p>
                  <BookOpen className="h-4 w-4 text-purple-500" />
               </div>
               <p className="text-3xl font-bold text-gray-900">{stats?.courseCount || 0}</p>
               <p className="text-xs text-gray-500 mt-1">Cours individuels</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
               <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase font-bold">Séries</p>
                  <PlayCircle className="h-4 w-4 text-green-500" />
               </div>
               <p className="text-3xl font-bold text-gray-900">{stats?.playlistCount || 0}</p>
               <p className="text-xs text-gray-500 mt-1">{stats?.totalVideos || 0} vidéos au total</p>
            </div>
       </div>

       {/* Stats secondaires */}
       <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
               <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase font-bold">Vues totales</p>
                  <TrendingUp className="h-4 w-4 text-orange-500" />
               </div>
               <p className="text-2xl font-bold text-gray-900">{stats?.totalViews?.toLocaleString() || 0}</p>
               <p className="text-xs text-gray-500 mt-1">Toutes vos vidéos</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
               <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase font-bold">Note moyenne</p>
                  <Star className="h-4 w-4 text-yellow-500" />
               </div>
               <p className="text-2xl font-bold text-gray-900">{stats?.avgRating?.toFixed(1) || '0.0'}</p>
               <p className="text-xs text-gray-500 mt-1">Sur 5 étoiles</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
               <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase font-bold">Contenu total</p>
                  <BookOpen className="h-4 w-4 text-indigo-500" />
               </div>
               <p className="text-2xl font-bold text-gray-900">{(stats?.courseCount || 0) + (stats?.playlistCount || 0)}</p>
               <p className="text-xs text-gray-500 mt-1">Cours + séries</p>
            </div>
       </div>

       {/* Teacher Tools */}
       <div className="mb-8">
         <h2 className="text-xl font-bold mb-4">Outils Formateur</h2>
         <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
           <Link to="/teacher/create" className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
             <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-primary">
               <BookOpen size={20} />
             </div>
             <h3 className="text-lg font-bold text-gray-900">Créer un cours</h3>
             <p className="mt-2 text-sm text-gray-600">Nouveau cours individuel</p>
           </Link>
           
           <Link to="/teacher/create-playlist" className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
             <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
               <PlayCircle size={20} />
             </div>
             <h3 className="text-lg font-bold text-gray-900">Créer une série</h3>
             <p className="mt-2 text-sm text-gray-600">Série de vidéos</p>
           </Link>
           
           <Link to="/teacher/courses" className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
             <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
               <LayoutDashboard size={20} />
             </div>
             <h3 className="text-lg font-bold text-gray-900">Gérer</h3>
             <p className="mt-2 text-sm text-gray-600">Cours et séries</p>
           </Link>
           
           <Link to="/teacher/wallet" className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
             <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600">
               <Wallet size={20} />
             </div>
             <h3 className="text-lg font-bold text-gray-900">Wallet</h3>
             <p className="mt-2 text-sm text-gray-600">Gérer vos revenus</p>
           </Link>
         </div>
       </div>

       {/* Activité récente */}
       <div className="grid gap-8 lg:grid-cols-2">
         <div>
           <h2 className="text-xl font-bold mb-4">Activité récente</h2>
           <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
             {recentActivity && recentActivity.length > 0 ? (
               <div className="divide-y divide-gray-100">
                 {Array.isArray(recentActivity) ? recentActivity.map((activity: any) => (
                   <div key={activity.id} className="p-4">
                     <div className="flex items-center justify-between">
                       <div>
                         <p className="text-sm font-medium text-gray-900">Nouvel achat</p>
                         <p className="text-xs text-gray-500">{formatPrice(activity.amount)} - {activity.courseId}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-xs text-gray-500">
                           {activity.createdAt?.toLocaleDateString('fr-FR')}
                         </p>
                         <p className="text-xs text-green-600 font-medium">+{formatPrice(activity.amount * 0.8)}</p>
                       </div>
                     </div>
                   </div>
                 )) : null}
               </div>
             ) : (
               <div className="p-8 text-center">
                 <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                 <p className="text-gray-500">Aucune activité récente</p>
               </div>
             )}
           </div>
         </div>

         <div>
           <h2 className="text-xl font-bold mb-4">Actions rapides</h2>
           <div className="grid gap-3">
             <Link to="/teacher/create" className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors">
               <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                 <Upload className="h-5 w-5 text-purple-600" />
               </div>
               <div className="flex-1">
                 <p className="font-medium text-gray-900">Uploader un nouveau cours</p>
                 <p className="text-xs text-gray-500">Commencez à créer du contenu</p>
               </div>
             </Link>
             
             <Link to="/teacher/courses" className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors">
               <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                 <BookOpen className="h-5 w-5 text-blue-600" />
               </div>
               <div className="flex-1">
                 <p className="font-medium text-gray-900">Voir mes cours</p>
                 <p className="text-xs text-gray-500">Gérer votre contenu existant</p>
               </div>
             </Link>
             
             <Link to="/app/my-courses" className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors">
               <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                 <PlayCircle className="h-5 w-5 text-green-600" />
               </div>
               <div className="flex-1">
                 <p className="font-medium text-gray-900">Mes cours achetés</p>
                 <p className="text-xs text-gray-500">En tant qu'étudiant</p>
               </div>
             </Link>
           </div>
         </div>
       </div>
    </AppLayout>
  );
};

const BecomeTeacher = () => {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRequest = async () => {
     if (!user) return;
     setLoading(true);
     try {
        await updateDoc(doc(db, 'users', user.uid), {
           role: 'teacher',
           teacherStatus: 'pending'
        });
        setUser({ ...user, role: 'teacher', teacherStatus: 'pending' });
        navigate('/teacher/kyc');
     } catch (e) {
        alert("Erreur");
     } finally {
        setLoading(false);
     }
  };

  return (
     <AppLayout>
        <div className="max-w-2xl mx-auto text-center py-12">
           <h1 className="text-3xl font-bold mb-4">Devenez Formateur</h1>
           <p className="text-gray-600 mb-8">Partagez votre savoir et gagnez des revenus.</p>
           <button onClick={handleRequest} disabled={loading} className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primaryHover">
              {loading ? 'Traitement...' : 'Commencer l\'aventure'}
           </button>
        </div>
     </AppLayout>
  );
};

const TeacherKYC = () => {
   const { user } = useAuth();
   const [file, setFile] = useState<File | null>(null);
   const [uploading, setUploading] = useState(false);
   const navigate = useNavigate();

   const handleUpload = async () => {
      if (!file || !user) return;
      setUploading(true);
      try {
         const fileRef = ref(storage, `kyc/${user.uid}/${file.name}`);
         await uploadBytes(fileRef, file);
         const url = await getDownloadURL(fileRef);
         
         await addDoc(collection(db, 'kyc'), {
            uid: user.uid,
            frontUrl: url, // Simplified for demo, usually front+back+selfie
            status: 'pending',
            submittedAt: serverTimestamp()
         });
         
         alert("Documents envoyés ! En attente de validation.");
         navigate('/teacher/onboarding');
      } catch (e) {
         alert("Erreur d'upload");
      } finally {
         setUploading(false);
      }
   };

   return (
      <AppLayout>
         <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold mb-6">Vérification d'identité (KYC)</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-6">
               <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" id="kyc-file" />
               <label htmlFor="kyc-file" className="cursor-pointer text-primary font-bold">
                  {file ? file.name : "Cliquez pour uploader votre pièce d'identité"}
               </label>
            </div>
            <button onClick={handleUpload} disabled={uploading || !file} className="w-full py-3 bg-primary text-white font-bold rounded-xl disabled:opacity-50">
               {uploading ? 'Envoi...' : 'Soumettre le dossier'}
            </button>
         </div>
      </AppLayout>
   );
};

const CreateCourse = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [uploadProgress, setProgress] = useState(0);
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !videoFile || !thumbFile) return;

    try {
      setProgress(1);
      // 1. Upload Thumbnail to Firebase
      const thumbRef = ref(storage, `thumbnails/${Date.now()}_${thumbFile.name}`);
      await uploadBytes(thumbRef, thumbFile);
      const thumbnailUrl = await getDownloadURL(thumbRef);

      // 2. Create Bunny Video via Worker
      const { videoId } = await workerApi.createBunnyVideo(title, 'temp-id', user.uid);
      
      // 3. Upload Video Content via Worker (Direct Upload)
      await workerApi.uploadVideo(videoId, videoFile, (pct) => setProgress(pct));

      // 4. Create Firestore Doc
      await addDoc(collection(db, 'courses'), {
         title,
         price: Number(price),
         teacherId: user.uid,
         teacherName: user.displayName,
         thumbnailUrl,
         videoUrl: videoId,
         viewCount: 0,
         saleCount: 0,
         createdAt: serverTimestamp(),
         videoStatus: 'processing'
      });

      alert("Cours créé avec succès !");
      navigate('/teacher');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création");
      setProgress(0);
    }
  };

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-6">Nouveau Cours</h1>
      <form onSubmit={handleCreate} className="max-w-2xl bg-white p-6 rounded-2xl shadow-sm space-y-4">
         <div>
            <label className="block text-sm font-bold mb-1">Titre</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border p-2 rounded-lg" required />
         </div>
         <div>
            <label className="block text-sm font-bold mb-1">Prix ($)</label>
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full border p-2 rounded-lg" required />
         </div>
         <div>
            <label className="block text-sm font-bold mb-1">Miniature (Image)</label>
            <input type="file" accept="image/*" onChange={e => setThumbFile(e.target.files?.[0] || null)} className="w-full" required />
         </div>
         <div>
            <label className="block text-sm font-bold mb-1">Vidéo (MP4)</label>
            <input type="file" accept="video/mp4" onChange={e => setVideoFile(e.target.files?.[0] || null)} className="w-full" required />
         </div>

         {uploadProgress > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
               <div className="bg-primary h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
            </div>
         )}

         <button type="submit" disabled={uploadProgress > 0} className="w-full bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50">
            {uploadProgress > 0 ? `Upload en cours ${Math.round(uploadProgress)}%` : 'Publier le cours'}
         </button>
      </form>
    </AppLayout>
  );
};

// --- Main App ---

function App() {
  const { initializeAuth } = useAuth();

  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          
          {/* Auth */}
          <Route path="/auth/login" element={<AuthPage type="login" />} />
          <Route path="/auth/signup" element={<AuthPage type="signup" />} />
          
          {/* Student */}
          <Route path="/app" element={<StudentDashboard />} />
          <Route path="/app/my-courses" element={<MyCoursesPage />} />
          <Route path="/app/profile" element={<ProfileScreen />} />
          <Route path="/app/transactions" element={<HistoryPage />} />
          <Route path="/course/:id" element={<CourseDetail />} />
          <Route path="/playlist/:id" element={<PlaylistDetail />} />
          <Route path="/playlists/watch" element={<PlaylistWatchPage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/payment-return" element={<PaymentReturnPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/instructor/:id" element={<InstructorPage />} />
          
          {/* Teacher */}
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/onboarding" element={<BecomeTeacherScreen />} />
          <Route path="/teacher/kyc" element={<TeacherKYC />} />
          <Route path="/teacher/create" element={<CreateCoursePage />} />
          <Route path="/teacher/wallet" element={<WalletPage />} />
          <Route path="/teacher/courses" element={<TeacherProfileScreen />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}

export default App;
