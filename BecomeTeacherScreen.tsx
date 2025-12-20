import { BookOpen, Clock, Users, TrendingUp, DollarSign, Award, ChevronRight, Upload, FileText, CheckCircle } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';

const RULES = [
  {
    title: "Qualité du contenu",
    description: "Tous les cours doivent être de haute qualité avec une bonne production vidéo, un son clair et un contenu structuré."
  },
  {
    title: "Respect des droits d'auteur",
    description: "Vous devez être propriétaire ou avoir les droits d'utilisation de tout le contenu que vous publiez."
  },
  {
    title: "Pas de contenu offensant",
    description: "Aucun contenu discriminatoire, haineux, violent ou offensant n'est autorisé."
  },
  {
    title: "Engagement envers les étudiants",
    description: "Vous devez répondre aux questions des étudiants dans un délai raisonnable."
  },
  {
    title: "Comment vous êtes payé",
    description: "Vous recevez 80% du prix de chaque cours vendu. Les 20% restants couvrent les frais de plateforme."
  }
];

export default function BecomeTeacherScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState<'rules' | 'verification'>('rules');
  const [currentRuleIndex, setCurrentRuleIndex] = useState(0);
  const [rulesRead, setRulesRead] = useState(0);
  
  // KYC states
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [motivation, setMotivation] = useState('');
  const [socialLinks, setSocialLinks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentRule = RULES[currentRuleIndex];
  const isLastRule = currentRuleIndex === RULES.length - 1;
  const canSkip = rulesRead >= 3;

  const handleImageUpload = (type: 'front' | 'back' | 'selfie') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (type === 'front') setFrontImage(result);
          else if (type === 'back') setBackImage(result);
          else setSelfieImage(result);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleSubmitKYC = async () => {
    if (!user || !frontImage || !backImage || !selfieImage || !motivation.trim()) {
      alert('Veuillez remplir tous les champs requis');
      return;
    }

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'kyc', user.uid), {
        uid: user.uid,
        frontImage,
        backImage,
        selfieImage,
        status: 'pending',
        submittedAt: serverTimestamp(),
        motivation: motivation.trim(),
        socialLinks: socialLinks.trim(),
      });

      await setDoc(doc(db, 'users', user.uid), {
        role: 'teacher',
        teacherStatus: 'pending'
      }, { merge: true });

      alert('Demande soumise avec succès !');
      navigate('/teacher/onboarding');
    } catch (error) {
      console.error('Error submitting KYC:', error);
      alert('Erreur lors de la soumission');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Rules step
  if (currentStep === 'rules') {
    return (
      <div className="min-h-screen bg-[#f3f4f6] text-gray-900 font-sans">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
            <div className="flex items-center gap-3">
              <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Jimmy School" className="h-9 w-9 rounded-lg" />
              <div className="leading-tight">
                <p className="text-sm font-bold md:text-base text-gray-900">Jimmy School</p>
                <p className="hidden text-[10px] text-gray-500 md:block md:text-xs">
                  Devenir Formateur
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-12">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">
                Règle {currentRuleIndex + 1} sur {RULES.length}
              </span>
              <span className="text-sm font-medium text-primary">
                {Math.round(((currentRuleIndex + 1) / RULES.length) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((currentRuleIndex + 1) / RULES.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Rule Card */}
          <div className="rounded-3xl bg-white p-8 shadow-[0_20px_60px_-15px_rgba(106,27,154,0.15)] border border-gray-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {currentRuleIndex + 1}. {currentRule.title}
                </h2>
              </div>
            </div>
            
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              {currentRule.description}
            </p>

            <div className="flex gap-4">
              {canSkip && (
                <button
                  onClick={() => setCurrentStep('verification')}
                  className="px-6 py-3 border border-primary text-primary rounded-xl font-semibold hover:bg-primary/5 transition"
                >
                  Passer
                </button>
              )}
              
              <button
                onClick={() => {
                  if (isLastRule) {
                    setCurrentStep('verification');
                  } else {
                    setCurrentRuleIndex(currentRuleIndex + 1);
                    setRulesRead(rulesRead + 1);
                  }
                }}
                className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-semibold shadow-lg shadow-primary/25 hover:bg-primaryHover transition"
              >
                {isLastRule ? 'Continuer' : 'Suivant'}
              </button>
            </div>

            {!canSkip && (
              <p className="text-sm text-gray-500 text-center mt-4 italic">
                Lisez au moins {3 - rulesRead} règle(s) de plus pour pouvoir passer
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Verification step
  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3">
            <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Jimmy School" className="h-9 w-9 rounded-lg" />
            <div className="leading-tight">
              <p className="text-sm font-bold md:text-base text-gray-900">Jimmy School</p>
              <p className="hidden text-[10px] text-gray-500 md:block md:text-xs">
                Vérification d'identité
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-12">
        {/* Hero Section */}
        <section className="relative mb-12 rounded-[2.5rem] bg-gradient-to-br from-[#e5e7ff] via-white to-[#eef2ff] px-8 py-12 shadow-[0_20px_60px_-15px_rgba(106,27,154,0.15)]">
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-[#9d4edd]/10 blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center text-white shadow-lg">
                <Award size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Vérification d'identité
                </h1>
                <p className="text-gray-600">
                  Étape 2 sur 2 - Gratuit et sécurisé
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Identity Photos */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Photos d'identité</h2>
          
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 border border-gray-100 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Recto de votre carte
              </label>
              <button
                onClick={() => handleImageUpload('front')}
                className={`w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition ${
                  frontImage 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-300 hover:border-primary hover:bg-purple-50'
                }`}
              >
                {frontImage ? (
                  <>
                    <CheckCircle size={24} className="text-green-600 mb-2" />
                    <span className="text-sm text-green-600">Recto sélectionné</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Prendre une photo</span>
                  </>
                )}
              </button>
              {frontImage && (
                <img src={frontImage} className="w-full h-32 object-cover rounded-xl mt-4" alt="Recto" />
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 border border-gray-100 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Verso de votre carte
              </label>
              <button
                onClick={() => handleImageUpload('back')}
                className={`w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition ${
                  backImage 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-300 hover:border-primary hover:bg-purple-50'
                }`}
              >
                {backImage ? (
                  <>
                    <CheckCircle size={24} className="text-green-600 mb-2" />
                    <span className="text-sm text-green-600">Verso sélectionné</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Prendre une photo</span>
                  </>
                )}
              </button>
              {backImage && (
                <img src={backImage} className="w-full h-32 object-cover rounded-xl mt-4" alt="Verso" />
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 border border-gray-100 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Selfie avec votre carte
              </label>
              <button
                onClick={() => handleImageUpload('selfie')}
                className={`w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition ${
                  selfieImage 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-300 hover:border-primary hover:bg-purple-50'
                }`}
              >
                {selfieImage ? (
                  <>
                    <CheckCircle size={24} className="text-green-600 mb-2" />
                    <span className="text-sm text-green-600">Selfie sélectionné</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Prendre une photo</span>
                  </>
                )}
              </button>
              {selfieImage && (
                <img src={selfieImage} className="w-full h-32 object-cover rounded-xl mt-4" alt="Selfie" />
              )}
            </div>
          </div>
        </section>

        {/* Motivation */}
        <section className="mb-8">
          <div className="rounded-2xl bg-white p-6 border border-gray-100 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Lettre de motivation
            </label>
            <textarea
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Parlez-nous de vous, de vos compétences, de votre parcours..."
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              rows={6}
            />
          </div>
        </section>

        {/* Social Links */}
        <section className="mb-8">
          <div className="rounded-2xl bg-white p-6 border border-gray-100 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Liens réseaux sociaux / portfolio
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="LinkedIn, GitHub, portfolio, site perso..."
              value={socialLinks}
              onChange={(e) => setSocialLinks(e.target.value)}
            />
          </div>
        </section>

        {/* Submit */}
        <button
          onClick={handleSubmitKYC}
          disabled={!frontImage || !backImage || !selfieImage || !motivation.trim() || isSubmitting}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-purple-400 p-6 text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
          ) : (
            <FileText size={20} />
          )}
          <span className="font-bold text-lg">
            {isSubmitting ? 'Soumission en cours...' : 'Soumettre ma demande'}
          </span>
        </button>
      </main>
    </div>
  );
}
