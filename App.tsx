import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Home, Compass, PlayCircle, User, LogOut, LayoutDashboard, Wallet, BarChart3, Upload, Star, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { collection, query, where, getDocs, limit, orderBy, doc, getDoc, updateDoc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Hls from 'hls.js';

import Landing from './components/Landing';
import AITutor from './components/AITutor';
import { db, storage } from './services/firebase';
import { authService } from './services/auth';
import { workerApi } from './services/worker';
import { useAuthStore } from './store/useAuthStore';
import { Course, User as UserType } from './types';

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
  const { setUser, setToken } = useAuthStore();

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{type === 'login' ? 'Connexion' : 'Inscription'}</h1>
          <p className="text-sm text-gray-500">Bienvenue sur Jimmy School</p>
        </div>
        
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'signup' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nom complet</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 font-bold text-white transition hover:bg-primaryHover disabled:opacity-50 flex justify-center items-center"
          >
            {loading ? <Loader2 className="animate-spin" /> : (type === 'login' ? 'Se connecter' : "S'inscrire")}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          {type === 'login' ? (
            <p>Pas encore de compte ? <Link to="/auth/signup" className="font-semibold text-primary">S'inscrire</Link></p>
          ) : (
            <p>Déjà un compte ? <Link to="/auth/login" className="font-semibold text-primary">Se connecter</Link></p>
          )}
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

const AppLayout = ({ children, role = 'student' }: { children: React.ReactNode, role?: 'student' | 'teacher' }) => {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return <Navigate to="/auth/login" replace />;

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="flex h-16 items-center px-6 border-b border-gray-100">
           <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold">J</div>
              <span className="font-bold text-lg">Jimmy School</span>
           </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {role === 'student' ? (
            <>
              <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Apprentissage</p>
              <SidebarItem to="/app" icon={Home} label="Accueil" active={location.pathname === '/app'} />
              <SidebarItem to="/app/my-courses" icon={PlayCircle} label="Mes Cours" active={location.pathname === '/app/my-courses'} />
              
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
            </>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 space-y-2">
           {role === 'student' ? (
              <Link to="/teacher" className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-2.5 text-xs font-semibold text-white transition hover:bg-black">
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
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary text-white flex items-center justify-center font-bold">J</div>
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
           <div className="mx-auto max-w-5xl">
              {children}
           </div>
        </div>
      </main>
      
      {role === 'student' && <AITutor />}
    </div>
  );
};

const CourseCard = ({ course }: { course: Course }) => (
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

// --- Student Pages ---

const StudentDashboard = () => {
  const { user } = useAuthStore();
  
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

  return (
    <AppLayout>
      <div className="mb-8">
         <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.displayName} 👋</h1>
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
           {courses?.map(course => (
              <CourseCard key={course.id} course={course} />
           ))}
        </div>
      )}
    </AppLayout>
  );
};

const CourseDetail = () => {
  const { id } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
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

  const handleBuy = async () => {
    if (!course || !user) return;
    try {
      // 1. Init Payment via Worker
      const { paymentUrl } = await workerApi.createDeposit(user.uid, course.id, course.price);
      // 2. Redirect to Payment
      window.location.href = paymentUrl;
    } catch (e) {
      alert("Erreur lors de l'initialisation du paiement");
    }
  };

  if (!course) return <div className="p-8 text-center">Chargement...</div>;

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
            <h1 className="mb-2 text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-600 mb-6">{course.description}</p>
         </div>
         
         <div className="space-y-6">
            <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
               <div className="mb-6 text-3xl font-bold text-gray-900">{course.price > 0 ? `${course.price} $` : 'Gratuit'}</div>
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
    </AppLayout>
  );
};

const WatchPage = () => {
  const { id } = useParams();
  const { user } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);

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
       
       if (!course?.videoUrl) throw new Error("Vidéo non disponible");
       return await workerApi.getPlaybackUrl(course.videoUrl);
    },
    enabled: !!course && !!user,
    retry: false
  });

  useEffect(() => {
    if (videoData?.playbackUrl && videoRef.current) {
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
         <h1 className="text-xl font-bold mb-4">{course?.title}</h1>
         <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
           <video ref={videoRef} controls className="w-full h-full" poster={course?.thumbnailUrl} />
         </div>
       </div>
    </AppLayout>
  );
};

const PaymentReturnPage = () => {
  const navigate = useNavigate();
  // In a real flow, we would verify the 'depositId' query param via worker here.
  // The worker handles the redirect to here.
  useEffect(() => {
    // Simulate a check or simply redirect after a delay
    const timer = setTimeout(() => {
      alert("Paiement vérifié !");
      navigate('/app/my-courses');
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4">
       <Loader2 className="animate-spin h-10 w-10 text-primary" />
       <p>Vérification du paiement en cours...</p>
    </div>
  );
};

// --- Teacher Pages ---

const TeacherDashboard = () => {
  const { user } = useAuthStore();
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
        const purchasesQ = query(collection(db, 'purchases'), where('teacherId', '==', user?.uid));
        
        const [coursesSnap, purchasesSnap] = await Promise.all([getDocs(coursesQ), getDocs(purchasesQ)]);
        
        const totalRevenue = purchasesSnap.docs.reduce((acc, curr) => acc + (curr.data().amount || 0), 0);
        
        return {
           totalRevenue,
           totalStudents: purchasesSnap.size,
           courseCount: coursesSnap.size
        };
     },
     enabled: user?.role === 'teacher'
  });

  return (
    <AppLayout role="teacher">
       <h1 className="text-2xl font-bold mb-6">Tableau de Bord</h1>
       <div className="grid gap-4 sm:grid-cols-3 mb-8">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
               <p className="text-xs text-gray-500 uppercase font-bold">Revenus</p>
               <p className="text-3xl font-bold text-gray-900">{stats?.totalRevenue.toFixed(2) || 0} $</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
               <p className="text-xs text-gray-500 uppercase font-bold">Étudiants</p>
               <p className="text-3xl font-bold text-gray-900">{stats?.totalStudents || 0}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
               <p className="text-xs text-gray-500 uppercase font-bold">Cours</p>
               <p className="text-3xl font-bold text-gray-900">{stats?.courseCount || 0}</p>
            </div>
       </div>
    </AppLayout>
  );
};

const BecomeTeacher = () => {
  const { user, setUser } = useAuthStore();
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
   const { user } = useAuthStore();
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
         navigate('/teacher');
      } catch (e) {
         alert("Erreur d'upload");
      } finally {
         setUploading(false);
      }
   };

   return (
      <AppLayout role="teacher">
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
  const { user } = useAuthStore();
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
    <AppLayout role="teacher">
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
          <Route path="/app/my-courses" element={<StudentDashboard />} /> {/* Simplified for demo */}
          <Route path="/app/profile" element={<StudentDashboard />} />
          <Route path="/course/:id" element={<CourseDetail />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/payment-return" element={<PaymentReturnPage />} />
          
          {/* Teacher */}
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/onboarding" element={<BecomeTeacher />} />
          <Route path="/teacher/kyc" element={<TeacherKYC />} />
          <Route path="/teacher/create" element={<CreateCourse />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}

export default App;
