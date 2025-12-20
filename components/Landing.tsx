import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Download, ChevronRight, Play, Check, Search, Share2, X, Users, Target, Zap, TrendingUp, Wallet, Globe, Award, ArrowRight, Calculator, Sparkles, Star } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Course } from '../types';
import { Helmet, HelmetProvider } from 'react-helmet-async';

const Landing: React.FC = () => {
  const [showTesterModal, setShowTesterModal] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Récupérer les cours populaires
  useEffect(() => {
    const fetchFeaturedCourses = async () => {
      try {
        const q = query(
          collection(db, 'courses'),
          where('isPublished', '==', true),
          orderBy('viewCount', 'desc'),
          limit(6)
        );
        const querySnapshot = await getDocs(q);
        const courses = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Course));
        setFeaturedCourses(courses);
      } catch (error) {
        console.error('Erreur lors du chargement des cours:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeaturedCourses();
  }, []);

  // --- STATE POUR LE SIMULATEUR DE REVENUS ---
  const [courseDuration, setCourseDuration] = useState(30); // minutes
  const [studentCount, setStudentCount] = useState(100); // élèves
  const [totalEarnings, setTotalEarnings] = useState(0);

  // Logique : 0.05$ par minute * Durée * Nombre d'élèves
  useEffect(() => {
    const pricePerCourse = courseDuration * 0.05;
    const earnings = pricePerCourse * studentCount;
    setTotalEarnings(earnings);
  }, [courseDuration, studentCount]);

  // Configuration SEO
  const pageTitle = "Jimmy School - Apprendre avec les meilleurs créateurs africains";
  const pageDescription = "La première plateforme mobile d'apprentissage en Afrique. Business, Tech, Marketing. Formez-vous avec des cours adaptés à nos réalités. Paiement Mobile Money accepté.";
  const pageUrl = "https://jimmyschool.com"; 
  const pageImage = "https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f";

  return (
    <HelmetProvider>
      <div className="min-h-screen bg-[#f3f4f6] text-gray-900 font-sans overflow-x-hidden">
        
        {/* CSS pour les animations 'Dessin Animé' */}
        <style>{`
          @keyframes float {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          @keyframes float-delayed {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(-5deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          .animate-float { animation: float 6s ease-in-out infinite; }
          .animate-float-delayed { animation: float-delayed 7s ease-in-out infinite; }
          .btn-app-download {
            transition: all 0.3s ease;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
            border: 2px solid transparent;
          }
          .btn-app-download:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 30px rgba(0,0,0,0.2);
          }
          .btn-app-download:active {
            transform: translateY(0);
          }
          
          /* Style personnalisé pour les sliders */
          .slider-thumb::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 24px;
            height: 24px;
            background: #7c3aed;
            cursor: pointer;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
        `}</style>

        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content={pageDescription} />
          <meta property="og:image" content={pageImage} />
        </Helmet>

        <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
            <div className="flex items-center gap-3">
              <img src={pageImage} alt="Jimmy School Logo" className="h-9 w-9 rounded-lg" />
              <div className="leading-tight">
                <p className="text-sm font-bold md:text-base text-gray-900">Jimmy School</p>
                <p className="hidden text-[10px] text-gray-500 md:block md:text-xs">
                  Apprendre avec les meilleurs créateurs africains
                </p>
              </div>
            </div>
            <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 lg:flex">
              <a href="#why" className="hover:text-primary transition-colors">Pourquoi</a>
              <a href="#how" className="hover:text-primary transition-colors">Comment ça marche</a>
              <Link to="/teacher/onboarding" className="text-purple-600 hover:text-purple-700 transition-colors font-semibold">Devenir Formateur</Link>
              <Link to="/teacher" className="text-primary hover:text-primaryHover">
                Espace Formateur
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/app" className="hidden rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 sm:block">
                Connexion
              </Link>
              <Link to="/app" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-primaryHover md:px-5 md:py-2.5 md:text-sm">
                Version Web
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-12">
          {/* Hero Section */}
          <section
            id="hero"
            className="relative grid gap-8 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#e5e7ff] via-white to-[#eef2ff] px-6 py-12 shadow-[0_20px_60px_-15px_rgba(106,27,154,0.15)] md:grid-cols-2 md:items-center md:gap-16 md:px-12 md:py-20"
          >
            <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-[#9d4edd]/10 blur-3xl" />

            <div className="relative space-y-6 z-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary backdrop-blur-sm border border-white/50">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Plateforme mobile d'apprentissage
              </div>
              
              <h1 className="text-4xl font-extrabold leading-[1.1] text-gray-900 md:text-5xl lg:text-6xl tracking-tight">
                Apprenez des compétences utiles <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">pour l'Afrique</span>.
              </h1>
              
              <p className="text-base leading-relaxed text-gray-600 md:text-lg lg:max-w-lg">
                Des cours vidéo courts, concrets et accessibles. Business, tech, marketing, création de contenu : formez-vous avec ceux qui réussissent déjà.
              </p>
              
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center pt-2 relative">
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primaryHover hover:-translate-y-0.5"
                >
                  <Search size={18} />
                  Explorer les cours
                </Link>
                
                {/* Bouton Google Play avec psychologie inversée - Version améliorée */}
                <div className="relative group flex-shrink-0 transition-all duration-300 hover:scale-105">
                  <a 
                    href="https://play.google.com/store/apps/details?id=com.jimmyschool.cd" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="relative z-10 inline-flex items-center bg-white text-gray-900 font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 border-2 border-yellow-400 hover:border-yellow-500"
                  >
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" 
                      alt="Disponible sur Google Play" 
                      className="h-6"
                    />
                    <span className="ml-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                      Téléchargez maintenant
                    </span>
                  </a>
                  <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl opacity-0 group-hover:opacity-20 blur-md -z-10 transition-all duration-300"></div>
                </div>
                
                <p className="text-xs text-gray-500 mt-2 sm:mt-0">
                  <span className="font-medium">PS:</span> Non, ce n'est pas pour tout le monde... seulement pour ceux qui veulent vraiment réussir.
                </p>
              </div>
              
              <div className="flex items-center gap-4 text-xs font-medium text-gray-500 pt-4">
                 <div className="flex -space-x-2">
                   {[1,2,3,4].map(i => (
                      <img key={i} src={`https://picsum.photos/32/32?random=${i+20}`} className="h-8 w-8 rounded-full border-2 border-white" alt="User" />
                   ))}
                </div>
                <span>Rejoint par +1000 apprenants</span>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
               <div className="relative z-10 w-[280px] md:w-[320px] rounded-[3rem] border-8 border-gray-900 bg-gray-900 shadow-2xl overflow-hidden aspect-[9/19]">
                 <div className="h-full w-full bg-white relative overflow-hidden flex flex-col">
                    <div className="h-full w-full bg-gray-50 overflow-hidden relative">
                      <div className="absolute top-0 w-full h-24 bg-gradient-to-b from-black/50 to-transparent z-10 p-6 flex justify-between items-start pt-10 text-white">
                          <div className="font-bold text-lg">Jimmy.</div>
                      </div>
                      <img src="https://picsum.photos/400/800?random=99" className="absolute inset-0 w-full h-full object-cover" alt="App Preview" />
                      <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 text-white">
                          <h3 className="font-bold text-xl mb-1">Devenir Freelance</h3>
                          <p className="text-sm opacity-90 mb-3">Apprenez à gérer vos clients.</p>
                          <button className="w-full py-3 bg-primary rounded-xl font-bold text-sm">Commencer</button>
                      </div>
                    </div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-7 w-32 bg-gray-900 rounded-b-2xl z-20"></div>
                 </div>
               </div>
               <div className="absolute -right-12 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full border border-primary/20 bg-primary/5"></div>
               <div className="absolute -right-4 top-1/2 -translate-y-1/2 h-48 w-48 rounded-full border border-primary/20"></div>
            </div>
          </section>

          {/* Cours Populaires - Défilement Horizontal */}
          <section className="mt-24 md:mt-32 overflow-hidden">
            <div className="mb-8 md:mb-12">
              <h2 className="text-3xl font-extrabold text-gray-900 md:text-4xl tracking-tight">
                Découvrez nos cours populaires
              </h2>
              <p className="mt-2 text-gray-600">
                Les formations les plus appréciées par notre communauté d'apprenants
              </p>
            </div>

            {isLoading ? (
              <div className="flex gap-6 overflow-hidden py-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-64 h-40 bg-gray-100 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="relative
                before:absolute before:left-0 before:top-0 before:bottom-0 before:w-24 before:bg-gradient-to-r before:from-white before:to-transparent before:z-10 before:pointer-events-none
                after:absolute after:right-0 after:top-0 after:bottom-0 after:w-24 after:bg-gradient-to-l after:from-white after:to-transparent after:z-10 after:pointer-events-none
              ">
                <div className="flex gap-6 py-6 overflow-x-auto scrollbar-hide">
                  {[...featuredCourses, ...featuredCourses].map((course, index) => (
                    <Link 
                      to={`/course/${course.id}`} 
                      key={`${course.id}-${index}`}
                      className="group flex-shrink-0 w-56 bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 hover:-translate-y-1"
                    >
                      <div className="relative h-40 bg-gray-100 overflow-hidden">
                        <img 
                          src={course.thumbnailUrl || 'https://via.placeholder.com/400/225'} 
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                          <div className="flex items-center text-white text-sm">
                            <Play size={16} className="mr-1" />
                            Voir le cours
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 line-clamp-2 text-sm">{course.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">Par {course.teacherName}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10 text-center">
              <Link 
                to="#/app" 
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-primary hover:bg-primaryHover shadow-sm hover:shadow-md transition-all duration-200"
              >
                Voir tous les cours
                <ChevronRight size={18} className="ml-2" />
              </Link>
            </div>
          </section>

          {/* Pourquoi Jimmy School ? */}
          <section id="why" className="mt-24 md:mt-32">
            <div className="mb-12 md:text-center md:max-w-2xl md:mx-auto">
              <h2 className="text-3xl font-extrabold text-gray-900 md:text-4xl tracking-tight">
                Apprendre sérieusement,<br className="hidden md:block" /> sans se prendre la tête.
              </h2>
              <p className="mt-4 text-gray-600">
                Jimmy School est pensée pour l'Afrique. Pas de théorie inutile, juste du concret adapté à ton marché et tes contraintes.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
               <FeatureCard 
                 icon={<Download size={24} />}
                 title="Pensé pour le mobile"
                 desc="Vidéos légères, mode hors ligne. Apprends dans les transports sans vider ton forfait."
               />
               <FeatureCard 
                 icon={<Check size={24} />}
                 title="Réalité locale"
                 desc="Exemples et cas pratiques adaptés au contexte africain (Mobile Money, WhatsApp Business, etc.)."
               />
               <FeatureCard 
                 icon={<Search size={24} />}
                 title="Prix accessibles"
                 desc="Des cours à partir de 0.5 usd environ 1200 CDF et beaucoup de contenu gratuit de haute qualité."
               />
            </div>
          </section>

          {/* Featured Section */}
          <section id="how" className="mt-24 rounded-3xl bg-gray-900 px-6 py-12 md:px-12 md:py-20 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-primary/30 rounded-full blur-[100px]"></div>
             <div className="relative z-10 grid gap-12 lg:grid-cols-2 items-center">
               <div>
                  <h2 className="text-3xl font-bold md:text-4xl mb-6">Comment ça marche ?</h2>
                  <div className="space-y-8">
                     <Step number="1" title="Découvre" desc="Parcours le catalogue et trouve le cours qui va booster ta carrière." />
                     <Step number="2" title="Apprends" desc="Regarde les vidéos courtes à ton rythme. Quiz et exercices inclus." />
                     <Step number="3" title="Applique" desc="Reçois ton certificat et mets en pratique tes nouvelles compétences." />
                  </div>
                  <div className="mt-10">
                     <Link to="/app" className="inline-flex items-center gap-2 text-primary font-bold hover:text-white transition-colors">
                        Commencer maintenant <ChevronRight size={20} />
                     </Link>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4 mt-8">
                     <img src="https://picsum.photos/400/500?random=1" className="rounded-2xl shadow-lg opacity-80" alt="Learning" />
                     <img src="https://picsum.photos/400/500?random=2" className="rounded-2xl shadow-lg" alt="Learning" />
                  </div>
                  <div className="space-y-4">
                     <img src="https://picsum.photos/400/500?random=3" className="rounded-2xl shadow-lg" alt="Learning" />
                     <img src="https://picsum.photos/400/500?random=4" className="rounded-2xl shadow-lg opacity-80" alt="Learning" />
                  </div>
               </div>
             </div>
          </section>

          {/* --- SECTION FORMATEURS IMMERSIVE (TYPE CARTOON/3D) --- */}
          <section id="teacher-benefits" className="mt-24 relative rounded-[3rem] overflow-hidden bg-[#1a0b2e] py-16 px-6 md:py-24 md:px-12 text-white">
             {/* Background Decoration 3D simulée */}
             <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-10 right-10 w-32 h-32 bg-purple-500 rounded-full blur-[80px] opacity-40"></div>
                <div className="absolute bottom-10 left-10 w-48 h-48 bg-blue-500 rounded-full blur-[100px] opacity-30"></div>
                
                {/* Floating Elements (Emojis/Icons) */}
                <div className="absolute top-1/4 left-10 text-4xl animate-float opacity-80">💰</div>
                <div className="absolute bottom-1/3 right-10 text-5xl animate-float-delayed opacity-80">🚀</div>
                <div className="absolute top-10 right-1/3 text-3xl animate-float opacity-50">💎</div>
             </div>

             <div className="relative z-10 flex flex-col lg:flex-row gap-16 items-center">
                
                {/* Left Side: Le Pitch qui fait rêver */}
                <div className="lg:w-1/2 text-center lg:text-left">
                   <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-purple-200 text-sm font-bold uppercase tracking-wider mb-6">
                      <Sparkles size={16} className="text-yellow-400" />
                      Devenez Créateur
                   </div>
                   
                   <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight">
                      Transformez votre savoir en <br/>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-purple-400">Cash Machine 💸</span>
                   </h2>
                   
                   <p className="text-lg text-gray-300 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
                      Ne laissez pas vos connaissances dormir. Sur Jimmy School, <strong>chaque minute de vidéo vous rapporte.</strong> <br/>
                      Vous créez le cours une fois, et vous encaissez à chaque vente, même quand vous dormez.
                   </p>

                   <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                       <Link 
                         to="/teacher/onboarding" 
                         className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl font-bold text-lg text-white shadow-[0_10px_40px_-10px_rgba(124,58,237,0.5)] hover:scale-105 transition-transform flex items-center gap-3"
                      >
                         Je lance mon cours
                         <ArrowRight className="animate-bounce-x" />
                      </Link>
                      <a href="#simulator" className="px-8 py-4 bg-white/10 border border-white/20 rounded-2xl font-bold text-lg hover:bg-white/20 transition-colors">
                         Simuler mes gains
                      </a>
                   </div>
                </div>

                {/* Right Side: Le Simulateur Gamifié (Carte 3D) */}
                <div id="simulator" className="lg:w-1/2 w-full">
                   <div className="relative group perspective-1000">
                      {/* L'effet de carte flottante */}
                      <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-8 md:p-10 shadow-2xl transform transition-transform duration-500 hover:rotate-1 hover:scale-[1.02]">
                         
                         <div className="absolute -top-6 -right-6 bg-yellow-400 text-gray-900 font-black p-4 rounded-2xl rotate-12 shadow-lg">
                            Paiement Mobile !
                         </div>

                         <div className="mb-8">
                            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                               <Calculator className="text-purple-400" />
                               Simulateur de revenus
                            </h3>
                            <p className="text-sm text-gray-400">Basé sur notre modèle standard : <span className="text-yellow-400 font-bold">0.05$ / minute</span></p>
                         </div>

                         {/* Sliders Interactifs */}
                         <div className="space-y-8">
                            {/* Slider 1 */}
                            <div>
                               <div className="flex justify-between text-sm font-bold text-gray-300 mb-3">
                                  <span>Durée totale des vidéos</span>
                                  <span className="text-white bg-purple-600 px-3 py-1 rounded-lg">{courseDuration} min</span>
                               </div>
                               <input 
                                  type="range" 
                                  min="10" 
                                  max="300" 
                                  step="5"
                                  value={courseDuration}
                                  onChange={(e) => setCourseDuration(parseInt(e.target.value))}
                                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 slider-thumb hover:accent-purple-400"
                               />
                               <p className="text-xs text-gray-500 mt-2">Ex: 30 min = {(courseDuration * 0.05).toFixed(2)}$ prix du cours</p>
                            </div>

                            {/* Slider 2 */}
                            <div>
                               <div className="flex justify-between text-sm font-bold text-gray-300 mb-3">
                                  <span>Nombre d'élèves (Ventes)</span>
                                  <span className="text-white bg-blue-600 px-3 py-1 rounded-lg">{studentCount} élèves</span>
                               </div>
                               <input 
                                  type="range" 
                                  min="10" 
                                  max="5000" 
                                  step="10"
                                  value={studentCount}
                                  onChange={(e) => setStudentCount(parseInt(e.target.value))}
                                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 slider-thumb hover:accent-blue-400"
                               />
                            </div>
                         </div>

                         {/* Résultat (Le Jackpot) */}
                         <div className="mt-10 pt-8 border-t border-white/10 text-center">
                            <p className="text-gray-400 uppercase text-xs font-bold tracking-widest mb-2">Vos gains potentiels</p>
                            <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-green-300 to-green-600 drop-shadow-sm flex justify-center items-center gap-2">
                               {totalEarnings.toFixed(0)} <span className="text-4xl text-green-500">$</span>
                            </div>
                            <p className="text-sm text-gray-400 mt-2">
                               Soit environ <span className="text-white font-bold">{(totalEarnings * 2500).toLocaleString()} CDF</span>
                            </p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
             
             {/* Features Grid en dessous (Glassmorphism) */}
             <div className="grid md:grid-cols-3 gap-6 mt-16 relative z-10">
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                   <Wallet className="w-10 h-10 text-green-400 mb-4" />
                   <h4 className="font-bold text-xl mb-2">Paiements Locaux</h4>
                   <p className="text-sm text-gray-400">Recevez votre argent directement sur M-Pesa, Orange Money ou Airtel. Pas besoin de PayPal ou de banque.</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                   <Target className="w-10 h-10 text-purple-400 mb-4" />
                   <h4 className="font-bold text-xl mb-2">On s'occupe de la tech</h4>
                   <p className="text-sm text-gray-400">Hébergement, streaming, application mobile, sécurisation anti-téléchargement... on gère tout.</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors">
                   <Globe className="w-10 h-10 text-blue-400 mb-4" />
                   <h4 className="font-bold text-xl mb-2">Marketing Inclus</h4>
                   <p className="text-sm text-gray-400">On fait la pub pour vous. Votre cours est visible par des milliers d'utilisateurs dès le premier jour.</p>
                </div>
             </div>
          </section>

          {/* Download CTA */}
          <section id="download" className="mt-24 text-center">
            <div className="mx-auto max-w-3xl rounded-[2rem] bg-gradient-to-br from-purple-50 to-white border border-purple-100 p-8 md:p-12 shadow-xl shadow-purple-900/5">
               <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
                 Prêt à passer au niveau supérieur ?
               </h2>
               <p className="mt-4 text-gray-600 mb-8 max-w-lg mx-auto">
                 Rejoins la communauté Jimmy School aujourd'hui. Disponible sur le web et sur Android.
               </p>
               <div className="flex flex-col gap-3 justify-center sm:flex-row">
                  <a
                                  href="https://storage.googleapis.com/jimmy-school.firebasestorage.app/apk/jimmy-school.apk"
                                  download
                                  
                                  className="inline-flex items-center justify-center rounded-lg border border-[#6A1B9A] bg-white px-4 py-2.5 text-sm font-semibold text-[#6A1B9A] shadow-sm transition hover:bg-[#6A1B9A] hover:text-white"
                                >
                                  Télécharger l'APK
                                </a>
                
                  <Link
                    to="/app"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-primary shadow-sm transition hover:bg-gray-50 hover:-translate-y-1"
                  >
                     <Play size={18} fill="currentColor" />
                    Version Web
                  </Link>
               </div>
               <p className="mt-4 text-xs text-gray-400">
                 APK sécurisé via Firebase Storage
               </p>
            </div>
          </section>

          {/* Partenariats Mobile Money */}
          <section className="mt-24">
            <div className="mx-auto max-w-4xl">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-3xl p-8 md:p-12">
                <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Paiements Sécurisés via Nos Partenaires</h3>
                <div className="grid grid-cols-3 gap-8 items-center mb-8">
                  <div className="text-center">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c8/Orange_logo.svg" alt="Orange Money" className="h-16 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-gray-800">Orange Money</p>
                    <p className="text-sm text-gray-600">Instantané</p>
                  </div>
                  <div className="text-center">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/3a/Airtel_logo-01.png" alt="Airtel Money" className="h-16 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-gray-800">Airtel Money</p>
                    <p className="text-sm text-gray-600">Rapide</p>
                  </div>
                  <div className="text-center">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/0/0b/M-PESA.png" alt="M-Pesa" className="h-16 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-gray-800">M-Pesa</p>
                    <p className="text-sm text-gray-600">Fiable</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-lg text-gray-700 mb-4">
                    <span className="font-bold text-purple-600">Pacte d'exclusivité</span> avec les leaders du paiement mobile en Afrique
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm bg-green-100 text-green-700 font-medium">
                      ✓ 0% de frais
                    </span>
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm bg-blue-100 text-blue-700 font-medium">
                      ✓ Transaction instantanée
                    </span>
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm bg-purple-100 text-purple-700 font-medium">
                      ✓ 100% sécurisé
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
        
        <footer className="border-t border-gray-200 bg-white py-8 text-center md:py-12">
          <div className="mx-auto max-w-7xl px-4 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-2">
                <img src={pageImage} alt="Jimmy School" className="h-6 w-6 rounded" />
                <span className="font-bold text-gray-900">Jimmy School</span>
             </div>
             <div className="text-xs text-gray-500 flex flex-col md:flex-row gap-4 items-center">
               <span>&copy; {new Date().getFullYear()} Jimmy School.</span>
               <Link to="/legal" className="hover:text-gray-900">Mentions Légales</Link>
             </div>
          </div>
        </footer>

        {/* Modal Testeurs */}
        {showTesterModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Devenir Testeur Jimmy School</h3>
                <button 
                  onClick={() => setShowTesterModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-6">
                {!submitted ? (
                  <>
                    <div className="text-center">
                      <div className="h-16 w-16 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Users className="h-8 w-8 text-purple-600" />
                      </div>
                      <h4 className="text-xl font-bold text-gray-900 mb-2">Un message personnel du CEO</h4>
                    </div>

                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
                      <div className="flex items-start gap-3 mb-4">
                        <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="TEGRA OKOKO" className="h-12 w-12 rounded-full" />
                        <div>
                          <h5 className="font-bold text-gray-900">TEGRA OKOKO</h5>
                          <p className="text-sm text-gray-600">Fondateur & CEO, Jimmy School</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <p className="text-gray-700 leading-relaxed">
                          Chers futurs testeurs,<br/><br/>
                          Je m'appelle TEGRA OKOKO et je suis le fondateur de Jimmy School. Aujourd'hui, je vous demande un service, une aide précieuse.<br/><br/>
                          Google Play exige que nous ayons au moins 12 testeurs actifs par jour pour valider notre application. Sans vous, nous ne pourrons pas lancer Jimmy School et rendre l'éducation accessible à des milliers de jeunes Africains.<br/><br/>
                          <strong>Il n'y a rien à gagner ici.</strong> C'est un appel à l'aide sincère. Votre participation nous permettra de toucher des vies et de créer des opportunités là où il n'y en a pas.<br/><br/>
                          Si vous avez 15 minutes par jour pour nous aider, merci de laisser votre email ci-dessous.
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 italic">
                        "L'éducation est l'arme la plus puissante pour changer le monde." - Nelson Mandela
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Votre email (pour vous contacter) *
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="votre@email.com"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <button
                        onClick={async () => {
                          if (!email || !email.includes('@')) {
                            alert('Veuillez entrer un email valide');
                            return;
                          }
                          
                          setIsSubmitting(true);
                          try {
                            // Enregistrer l'email dans Firestore
                            await addDoc(collection(db, 'testerApplications'), {
                              email: email,
                              status: 'pending',
                              createdAt: serverTimestamp(),
                              source: 'landing_page'
                            });
                            
                            setSubmitted(true);
                          } catch (error) {
                            console.error('Erreur lors de l\'enregistrement:', error);
                            alert('Une erreur est survenue. Veuillez réessayer.');
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        disabled={isSubmitting || !email}
                        className="w-full bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Envoi en cours...' : "ENVOYER"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="h-16 w-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Users className="h-8 w-8 text-green-600" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">Merci du fond du cœur !</h4>
                    <p className="text-gray-600 mb-4">
                      Votre email a été reçu. Nous vous contacterons très prochainement avec les instructions pour devenir testeur.
                    </p>
                    <div className="bg-green-50 rounded-xl p-4">
                      <p className="text-green-800 text-sm">
                        <strong>Prochaines étapes :</strong> Vous recevrez un email avec le lien pour rejoindre notre programme de test sur Google Play.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowTesterModal(false);
                        setSubmitted(false);
                        setEmail('');
                      }}
                      className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Fermer
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 mt-6">
                <a
                  href="https://play.google.com/apps/testing/com.jimmyschool.cd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Users className="h-5 w-5" />
                  Devenir Testeur Officiel
                </a>
                
                <button
                  onClick={() => setShowTesterModal(false)}
                  className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  Plus tard
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                Test requis : Android 6.0+ • 15 minutes par jour maximum
              </p>
            </div>
          </div>
        )}
      </div>
    </HelmetProvider>
  );
};

// Composants utilitaires
const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
   <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/20 group">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-primary group-hover:scale-110 transition-transform">
         {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">
         {desc}
      </p>
   </div>
);

const Step = ({ number, title, desc }: { number: string, title: string, desc: string }) => (
   <div className="flex gap-4">
      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-white/10 flex items-center justify-center font-bold border border-white/20">
         {number}
      </div>
      <div>
         <h4 className="font-bold text-lg">{title}</h4>
         <p className="text-gray-400 text-sm mt-1">{desc}</p>
      </div>
   </div>
);

export default Landing;