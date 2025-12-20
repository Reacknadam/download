import Button from '@/components/ui/Button';
import { db } from '@/lib/firebase';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { useAuth } from '@/stores/auth';
import { useSettings } from '@/stores/settings';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Award, Bell, BookOpen, ChevronRight, Edit3, LogOut, Moon, Sun, Trash2, User, Settings, CreditCard, HelpCircle, Users, ArrowLeft } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import Modal, { Alert } from '@/components/ui/Modal';
import Switch from '@/components/ui/Switch';
import { Link } from 'react-router-dom';

const WORKER_ROOT = 'https://jimmy-school.jimmyokoko57.workers.dev';

const QuickActionCard = ({ icon, title, desc, onClick, isWhite = false }: { icon: React.ReactNode, title: string, desc: string, onClick: () => void, isWhite?: boolean }) => (
  <button
    onClick={onClick}
    className={`rounded-2xl border p-6 shadow-sm transition-all hover:shadow-md group w-full text-left ${
      isWhite 
        ? 'border-white/20 bg-white/10 hover:bg-white/20' 
        : 'border-gray-100 bg-white hover:border-primary/20'
    }`}
  >
    <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${
      isWhite ? 'bg-white/20 text-white' : 'bg-purple-50 text-primary'
    }`}>
      {icon}
    </div>
    <h3 className={`text-lg font-bold ${isWhite ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
    <p className={`mt-2 text-sm leading-relaxed ${isWhite ? 'text-white/90' : 'text-gray-600'}`}>{desc}</p>
  </button>
);

export default function ProfileScreen() {
  const router = useNavigate();
  const darkMode = useSettings((s) => s.darkMode);
  const theme = useSettings((s) => (s.darkMode ? 'dark' : 'light'));
  const setTheme = (t: 'light' | 'dark' | 'auto') => useSettings.getState().toggleDarkMode();

  const { user, isTeacher, signOut, deleteAccount } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [isCheckingTeacher, setIsCheckingTeacher] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');

  useEffect(() => {
    if (user?.uid) {
      registerForPushNotificationsAsync(user.uid).then(token => {
        if (token) {
          setNotificationsEnabled(true);
        }
      });
    }
  }, [user?.uid]);

  const handleSaveProfile = async () => {
    if (!user?.uid) return;
    
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        phoneNumber,
        bio,
      });
      alert('Profil mis à jour avec succès');
      setIsEditMode(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert('Impossible de mettre à jour le profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenSupport = () => {
    if (!user) {
      alert('Vous devez être connecté pour contacter le support.');
      return;
    }
    setShowSupportModal(true);
  };

  const handleSendSupport = async () => {
    if (isSendingSupport) return;
    
    if (!user) {
      alert('Vous devez être connecté pour contacter le support.');
      return;
    }

    const trimmed = supportMessage.trim();
    if (!trimmed) {
      alert('Merci de décrire brièvement votre problème.');
      return;
    }

    setIsSendingSupport(true);
    try {
      await addDoc(collection(db, 'supportMessages'), {
        userId: user.uid,
        userEmail: user.email || null,
        message: trimmed,
        createdAt: serverTimestamp(),
      });

      setSupportMessage('');
      setShowSupportModal(false);
      alert('Votre message a bien été envoyé au support.');
    } catch (e: any) {
      alert(e?.message || 'Impossible d\'envoyer votre message pour le moment.');
    } finally {
      setIsSendingSupport(false);
    }
  };

  const handleBecomeTeacher = async () => {
    if (isCheckingTeacher) return;
    if (!user?.uid) return;

    setIsCheckingTeacher(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (userData?.isTeacherVerified) {
        router('/teacher/onboarding');
        return;
      }

      // Redirection directe vers onboarding
      try {
        await addDoc(collection(db, 'payments'), {
          userId: user.uid,
          userEmail: user.email,
          amount: 0,
          currency: 'USD',
          type: 'teacher_subscription',
          status: 'pending',
          createdAt: serverTimestamp(),
          expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000),
        });
        
        router('/teacher/onboarding');
      } catch (error) {
        console.error('Payment error:', error);
        alert('Impossible d\'initier la demande');
      }
    } catch (error) {
      console.error('Error checking teacher status:', error);
      alert('Une erreur est survenue');
    } finally {
      setIsCheckingTeacher(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      signOut()
        .then(() => {
          router('/');
        });
    }
  };

  const handleDeleteAccount = () => {
    if (!user) return;

    if (confirm("Cette action est définitive. Toutes vos données principales seront supprimées. Continuer ?")) {
      try {
        deleteAccount();
        alert('Votre compte a été supprimé.');
        router('/auth/login');
      } catch (error: any) {
        console.error('Delete account error:', error);
        alert(error?.message || 'Impossible de supprimer le compte pour le moment.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="leading-tight">
              <p className="text-sm font-bold md:text-base text-gray-900">Mon Profil</p>
              <p className="hidden text-[10px] text-gray-500 md:block md:text-xs flex items-center gap-1">
                <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Jimmy School" className="h-3 w-3" />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 flex items-center gap-2"
            >
              <LogOut size={14} />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-12">
        {/* Profile Hero Section */}
        <section className="relative grid gap-8 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#e5e7ff] via-white to-[#eef2ff] px-6 py-12 shadow-[0_20px_60px_-15px_rgba(106,27,154,0.15)] md:grid-cols-2 md:items-center md:gap-16 md:px-12 md:py-20">
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-[#9d4edd]/10 blur-3xl" />

          <div className="relative space-y-6 z-10">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center text-white shadow-lg">
                  <User size={40} />
                </div>
                {user?.isTeacherVerified && (
                  <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white border-4 border-white">
                    <Award size={16} />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {user?.displayName || 'Utilisateur'}
                </h1>
                <p className="text-gray-600">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {user?.role === 'admin' ? 'Admin' : user?.role === 'teacher' || user?.isTeacherVerified ? 'Formateur' : 'Étudiant'}
                  </span>
                  {user?.isTeacherVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      <Award size={12} />
                      Vérifié
                    </span>
                  )}
                </div>
              </div>
            </div>

            {user?.phoneNumber && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                {user.phoneNumber}
              </div>
            )}

            {user?.bio && (
              <div className="rounded-xl bg-white/60 p-4 border border-white/50">
                <p className="text-sm text-gray-700 leading-relaxed">{user.bio}</p>
              </div>
            )}

            <button
              onClick={() => setIsEditMode(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primaryHover hover:-translate-y-0.5"
            >
              <Edit3 size={16} />
              Modifier le profil
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="space-y-4 w-full max-w-sm">
              {user?.role === 'student' && !user?.isTeacherVerified && (
                <button
                  onClick={handleBecomeTeacher}
                  className="w-full rounded-xl bg-gradient-to-r from-primary to-purple-400 p-6 text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Award size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-lg">Devenir formateur</h3>
                      <p className="text-sm opacity-90">Partagez vos connaissances</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto" />
                  </div>
                </button>
              )}

              {(user?.role === 'teacher' || user?.role === 'admin' || user?.isTeacherVerified) && (
                <Link
                  to="/teacher"
                  className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-400 p-6 text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 group block"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Award size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-lg">Espace Formateur</h3>
                      <p className="text-sm opacity-90">Gérez vos cours</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto" />
                  </div>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Teacher Tools Section - Only for verified teachers */}
        {(user?.role === 'teacher' || user?.role === 'admin' || user?.isTeacherVerified) && (
          <section className="mt-8 rounded-3xl bg-gradient-to-r from-primary to-purple-400 p-6 md:p-8 shadow-lg text-white">
            <h2 className="text-xl font-bold text-white mb-6">Outils Formateur</h2>
            
            <div className="grid gap-4 md:grid-cols-2">
              <QuickActionCard
                icon={<BookOpen size={20} />}
                title="Publier un cours"
                desc="Créer un nouveau cours"
                onClick={() => router('/teacher/create')}
                isWhite={true}
              />
              <QuickActionCard
                icon={<CreditCard size={20} />}
                title="Mes revenus"
                desc="Voir les statistiques"
                onClick={() => router('/teacher/wallet')}
                isWhite={true}
              />
              <QuickActionCard
                icon={<Settings size={20} />}
                title="Gestion des cours"
                desc="Modifier les cours existants"
                onClick={() => router('/teacher/courses')}
                isWhite={true}
              />
              <QuickActionCard
                icon={<Users size={20} />}
                title="Étudiants"
                desc="Gérer les apprenants"
                onClick={() => router('/teacher')}
                isWhite={true}
              />
            </div>
          </section>
        )}

        {/* Quick Actions */}
        <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
                icon={<BookOpen size={20} />}
                title="Mes cours achetes"
                desc="Cours achetés"
                onClick={() => router('app/my-courses')}
              />
              <QuickActionCard
                icon={<CreditCard size={20} />}
                title="Transactions"
                desc="Historique"
                onClick={() => router('/transactions')}
              />
            
              <QuickActionCard
                icon={<HelpCircle size={20} />}
                title="Aide"
                desc="Support"
                onClick={handleOpenSupport}
              />
        </section>

        {/* Settings Section */}
        <section className="mt-8 rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Paramètres</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  {darkMode ? <Moon size={20} className="text-primary" /> : <Sun size={20} className="text-primary" />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Thème</h3>
                  <p className="text-sm text-gray-600">Choisissez entre le thème clair et sombre</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    theme === 'light'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => setTheme('light')}
                >
                  Clair
                </button>
                <button
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    theme === 'dark'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => setTheme('dark')}
                >
                  Sombre
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Bell size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                  <p className="text-sm text-gray-600">Alertes pour les nouveaux cours</p>
                </div>
              </div>
              <Switch
                value={notificationsEnabled}
                onValueChange={async (value) => {
                  if (value && user?.uid) {
                    try {
                      const token = await registerForPushNotificationsAsync(user.uid);
                      if (token) {
                        setNotificationsEnabled(true);
                        alert('Notifications activées');
                      } else {
                        alert('Impossible d\'activer les notifications');
                      }
                    } catch (error) {
                      alert('Impossible d\'activer les notifications');
                    }
                  } else {
                    setNotificationsEnabled(false);
                    alert('Notifications désactivées');
                  }
                }}
              />
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        
      </main>

      {/* Edit Modal */}
      {isEditMode && (
        <Modal
          isOpen={isEditMode}
          onClose={() => setIsEditMode(false)}
          title="Modifier le profil"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nom complet"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Numéro de téléphone"
                type="tel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Bio"
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setIsEditMode(false);
                  setDisplayName(user?.displayName || '');
                  setPhoneNumber(user?.phoneNumber || '');
                  setBio(user?.bio || '');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primaryHover disabled:opacity-50"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Support Modal */}
      <Modal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        title="Aide & support"
      >
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Contactez le support
          </h3>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Décrivez votre problème ou votre question..."
            value={supportMessage}
            onChange={(e) => setSupportMessage(e.target.value)}
            rows={6}
          />

          <button 
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primaryHover"
            onClick={handleSendSupport}
          >
            Envoyer au support
          </button>
        </div>
      </Modal>
    </div>
  );
};
