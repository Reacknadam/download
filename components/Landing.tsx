import React from "react";
import { Link } from "react-router-dom";
import { Download, ChevronRight, Play, Check, Search, BookOpen, Share2 } from 'lucide-react';

const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 font-sans">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3">
             <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold text-lg">
                J
             </div>
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
            <a href="#features" className="hover:text-primary transition-colors">Fonctionnalités</a>
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
        {/* Hero */}
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
            
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center pt-2">
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primaryHover hover:-translate-y-0.5"
              >
                <Search size={18} />
                Explorer les cours
              </Link>
              <a
                href="https://storage.googleapis.com/jimmy-school.firebasestorage.app/apk/jimmy-school.apk"
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-gray-800 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
              >
                <Download size={18} />
                Télécharger l'APK
              </a>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-medium text-gray-500 pt-4">
              <div className="flex -space-x-2">
                 {[1,2,3,4].map(i => (
                    <img key={i} src={`https://picsum.photos/32/32?random=${i+20}`} className="h-8 w-8 rounded-full border-2 border-white" alt="User" />
                 ))}
              </div>
              <span>Rejoint par +10,000 apprenants</span>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
             <div className="relative z-10 w-[280px] md:w-[320px] rounded-[3rem] border-8 border-gray-900 bg-gray-900 shadow-2xl overflow-hidden aspect-[9/19]">
                {/* Mockup Screen */}
                <div className="h-full w-full bg-white relative overflow-hidden flex flex-col">
                   <div className="h-full w-full bg-gray-50 overflow-hidden relative">
                      {/* Fake UI Header */}
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
                   {/* Notch */}
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 h-7 w-32 bg-gray-900 rounded-b-2xl z-20"></div>
                </div>
             </div>
             {/* Decorative circles */}
             <div className="absolute -right-12 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full border border-primary/20 bg-primary/5"></div>
             <div className="absolute -right-4 top-1/2 -translate-y-1/2 h-48 w-48 rounded-full border border-primary/20"></div>
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
                desc="Des cours à partir de 500 FCFA et beaucoup de contenu gratuit de haute qualité."
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
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-black hover:-translate-y-1"
                >
                  <Download size={18} />
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
      </main>

      <footer className="border-t border-gray-200 bg-white py-8 text-center md:py-12">
        <div className="mx-auto max-w-7xl px-4 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary text-white flex items-center justify-center text-xs font-bold">J</div>
              <span className="font-bold text-gray-900">Jimmy School</span>
           </div>
           <p className="text-xs text-gray-500">
             © {new Date().getFullYear()} Jimmy School. Fait avec ❤️ pour l'Afrique.
           </p>
        </div>
      </footer>
    </div>
  );
};

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