import { BookOpen, Film, Upload, X, Plus, Trash2, Clock, DollarSign, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, storage } from '@/services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { workerApi } from '@/services/worker';
import { calculateVideoPrice } from '@/lib/pricing';
import { COURSE_CATEGORIES } from '@/lib/courseTypes';

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [publicationType, setPublicationType] = useState<'single' | 'series'>('single');
  
  // Cours unique
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  
  // Série
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesDescription, setSeriesDescription] = useState('');
  const [seriesThumbnail, setSeriesThumbnail] = useState<File | null>(null);
  const [seriesThumbnailUrl, setSeriesThumbnailUrl] = useState<string>('');
  const [videos, setVideos] = useState<Array<{
    title: string;
    description: string;
    file: File;
    thumbnailFile: File;
    duration: number;
  }>>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [uploadedMB, setUploadedMB] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Calcul du prix selon la durée avec le nouveau système de pricing
  const calculatePrice = (durationSeconds: number) => {
    return calculateVideoPrice(durationSeconds);
  };

  // Vérification d'éligibilité
  const checkPublishingEligibility = () => {
    if (!user) {
      return { allowed: false, reason: 'Vous devez être connecté pour publier un cours.' };
    }

    if (user.role === 'admin' || user.role === 'teacher' || user.isTeacherVerified) {
      return { allowed: true };
    }

    if (user.role === 'student') {
      return {
        allowed: false,
        reason: 'Passez votre compte en mode formateur depuis Profil > Devenir formateur pour pouvoir publier.',
      };
    }

    return {
      allowed: false,
      reason: "Votre profil formateur est en attente de validation. Contactez l'équipe si nécessaire.",
    };
  };

  // Gestion de la vidéo
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      
      // Générer thumbnail automatiquement
      generateThumbnail(file);
      
      // Calculer durée
      const video = document.createElement('video');
      video.src = url;
      video.onloadedmetadata = () => {
        setDuration(video.duration);
      };
    }
  };

  // Génération de thumbnail
  const generateThumbnail = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.onloadeddata = () => {
        video.currentTime = 5; // 5 secondes
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, 320, 180);
        canvas.toBlob((blob) => {
          if (blob) {
            const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
            resolve(thumbnailFile);
          }
        }, 'image/jpeg', 0.8);
      };
    });
  };

  // Upload avec progression
  const uploadWithProgress = async (
    file: File, 
    path: string, 
    onProgress?: (progress: number, speed: number, uploaded: number) => void
  ): Promise<string> => {
    const storageRef = ref(storage, path);
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytes(storageRef, file);
      
      // Simuler progression pour l'exemple
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = progress > 0 ? (file.size * progress / 100) / elapsed / 1024 / 1024 : 0; // MB/s
        const uploaded = (file.size * progress / 100) / 1024 / 1024; // MB
        
        onProgress?.(progress, speed, uploaded);
        
        if (progress === 100) {
          resolve(getDownloadURL(storageRef));
        }
      }, 500);
    });
  };

  // Publication du cours
  const handleCreateCourse = async () => {
    const { allowed, reason } = checkPublishingEligibility();
    if (!allowed) {
      alert(reason);
      return;
    }

    if (publicationType === 'single') {
      if (!title || !description || !videoFile || categories.length === 0) {
        const missingFields = [];
        if (!title) missingFields.push('le titre');
        if (!description) missingFields.push('la description');
        if (!videoFile) missingFields.push('une vidéo');
        if (categories.length === 0) missingFields.push('au moins une catégorie');
        
        alert(`Veuillez compléter les champs suivants : ${missingFields.join(', ')}.`);
        return;
      }
    } else {
      if (!seriesTitle || !seriesDescription || videos.length === 0 || categories.length === 0) {
        alert('Veuillez remplir le titre, la description et ajouter au moins une vidéo.');
        return;
      }
      
      // Validation supplémentaire pour les vidéos de la série
      const invalidVideos = videos.filter(v => !v.title.trim() || !v.description.trim() || !v.file || !v.thumbnailFile);
      if (invalidVideos.length > 0) {
        alert('Certaines vidéos ont des informations manquantes. Veuillez vérifier que chaque vidéo a un titre, une description et un fichier.');
        return;
      }
    }

    setIsSubmitting(true);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Lire la config de revue des cours
      const reviewConfigSnap = await getDoc(doc(db, 'config', 'courseReview'));
      const autoApprove = reviewConfigSnap.exists()
        ? !!reviewConfigSnap.data()?.autoApproveCourses
        : false;

      const baseReviewFields = autoApprove
        ? { reviewStatus: 'approved' as const, isPublished: true, autoApproved: true }
        : { reviewStatus: 'pending' as const, isPublished: false, autoApproved: false };

      if (publicationType === 'single') {
        // Upload thumbnail si fourni, sinon utiliser une image par défaut
        let thumbnailUrl = 'https://via.placeholder.com/1280x720';
        if (thumbnailFile) {
          const thumbnailPath = `thumbnails/${Date.now()}_${thumbnailFile.name}`;
          thumbnailUrl = await uploadWithProgress(thumbnailFile, thumbnailPath, (pct, speed, uploaded) => {
            setUploadProgress(pct * 0.3); // 30% pour thumbnail
            setUploadSpeed(speed);
            setUploadedMB(uploaded);
          });
        }

        // Upload vidéo via worker
        const { videoId } = await workerApi.createBunnyVideo(title, Date.now().toString(), user!.uid);
        
        await workerApi.uploadVideo(videoId, videoFile, (pct) => {
          setUploadProgress(30 + (pct * 0.7)); // 70% pour vidéo
        });

        // Créer le cours
        const price = calculatePrice(duration);
        await addDoc(collection(db, 'courses'), {
          title,
          description,
          duration: Math.ceil(duration),
          price,
          currency: 'USD',
          teacherId: user!.uid,
          teacherName: user!.displayName || user!.email,
          teacherEmail: user!.email,
          bunnyVideoId: videoId,
          videoStatus: 'processing',
          thumbnailUrl,
          categories,
          createdAt: serverTimestamp(),
          ...baseReviewFields,
          saleCount: 0,
          viewCount: 0,
          rating: 0,
          reviewCount: 0,
        });

        alert(autoApprove 
          ? 'Cours publié et déjà disponible en ligne!'
          : 'Cours envoyé en revue. Vous serez notifié dès qu\'il sera disponible.'
        );
      } else {
        // Publication série
        const playlistId = Date.now().toString();
        let totalDuration = 0;
        const videoData: any[] = [];

        // Upload thumbnail série
        const seriesThumbPath = `thumbnails/${Date.now()}_${seriesThumbnail?.name || 'series.jpg'}`;
        const seriesThumbUrl = seriesThumbnail 
          ? await uploadWithProgress(seriesThumbnail, seriesThumbPath)
          : thumbnailUrl;

        // Upload toutes les vidéos
        for (let i = 0; i < videos.length; i++) {
          setCurrentVideoIndex(i);
          const video = videos[i];
          
          const { videoId } = await workerApi.createBunnyVideo(video.title, `${playlistId}_${i}`, user!.uid);
          await workerApi.uploadVideo(videoId, video.file, (pct) => {
            const overallProgress = (i / videos.length * 100) + (pct / videos.length);
            setUploadProgress(overallProgress);
          });

          const thumbPath = `thumbnails/${Date.now()}_${video.thumbnailFile.name}`;
          const thumbUrl = await uploadWithProgress(video.thumbnailFile, thumbPath);

          totalDuration += video.duration;
          videoData.push({
            title: video.title,
            description: video.description,
            bunnyVideoId: videoId,
            videoStatus: 'processing',
            thumbnailUrl: thumbUrl,
            duration: Math.ceil(video.duration),
            order: i,
          });
        }

        const totalPrice = calculatePrice(totalDuration);
        await addDoc(collection(db, 'playlists'), {
          title: seriesTitle,
          description: seriesDescription,
          thumbnailUrl: seriesThumbUrl,
          teacherId: user!.uid,
          teacherName: user!.displayName || user!.email,
          teacherEmail: user!.email,
          courseCount: videos.length,
          totalDuration: Math.ceil(totalDuration),
          price: totalPrice,
          currency: 'USD',
          videos: videoData,
          viewCount: 0,
          saleCount: 0,
          rating: 0,
          reviewCount: 0,
          isPublic: baseReviewFields.isPublished,
          ...baseReviewFields,
          categories,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        alert(autoApprove
          ? `Série créée avec ${videos.length} cours!`
          : `Série envoyée en revue (${videos.length} cours).`
        );
      }

      navigate('/teacher');
    } catch (error) {
      console.error('Erreur publication:', error);
      alert('Erreur lors de la publication');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
      setUploadProgress(null);
      setCurrentVideoIndex(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              <X size={20} />
            </button>
            <div className="leading-tight">
              <p className="text-sm font-bold md:text-base text-gray-900">Publier un cours</p>
              <p className="hidden text-[10px] text-gray-500 md:block md:text-xs flex items-center gap-1">
                <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Jimmy School" className="h-3 w-3" />
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
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Publier un nouveau cours
            </h1>
            <p className="text-gray-600">
              Partagez votre expertise avec la communauté
            </p>
          </div>
        </section>

        {/* Type de publication */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Type de publication</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => setPublicationType('single')}
              className={`rounded-2xl border-2 p-6 transition-all ${
                publicationType === 'single'
                  ? 'border-primary bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <Film size={24} className={`mb-4 ${publicationType === 'single' ? 'text-primary' : 'text-gray-400'}`} />
              <h3 className="text-lg font-bold mb-2">Cours unique</h3>
              <p className="text-sm text-gray-600">
                Idéal pour un sujet spécifique, une vidéo complète
              </p>
            </button>

            <button
              onClick={() => setPublicationType('series')}
              className={`rounded-2xl border-2 p-6 transition-all ${
                publicationType === 'series'
                  ? 'border-primary bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <BookOpen size={24} className={`mb-4 ${publicationType === 'series' ? 'text-primary' : 'text-gray-400'}`} />
              <h3 className="text-lg font-bold mb-2">Série de cours</h3>
              <p className="text-sm text-gray-600">
                Plusieurs vidéos sur un même thème, formation complète
              </p>
            </button>
          </div>
        </section>

        {/* Formulaire */}
        {publicationType === 'single' ? (
          <>
            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Informations du cours</h2>
              
              <div className="space-y-6">
                <div className="rounded-2xl bg-white p-6 border border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Titre du cours *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: React.js pour débutants"
                  />
                </div>

                <div className="rounded-2xl bg-white p-6 border border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Miniature (optionnel)
                  </label>
                  <div className="flex items-center gap-4">
                    {thumbnailUrl ? (
                      <div className="relative group">
                        <img 
                          src={thumbnailUrl} 
                          alt="Miniature" 
                          className="h-24 w-40 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setThumbnailFile(null);
                            setThumbnailUrl('');
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-40 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <Plus size={24} className="text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Ajouter une image</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setThumbnailFile(file);
                              setThumbnailUrl(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                    )}
                    <p className="text-xs text-gray-500">Format recommandé : 16:9 (1280×720px)</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-6 border border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Description détaillée *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Décrivez ce que les étudiants vont apprendre..."
                    rows={6}
                  />
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Catégories (max 2)</h2>
              <div className="rounded-2xl bg-white p-6 border border-gray-100">
                <div className="grid gap-3 md:grid-cols-2">
                  {COURSE_CATEGORIES.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <input
                        type="checkbox"
                        checked={categories.includes(cat.id)}
                        onChange={(e) => {
                          if (e.target.checked && categories.length < 2) {
                            setCategories([...categories, cat.id]);
                          } else if (!e.target.checked) {
                            setCategories(categories.filter(c => c !== cat.id));
                          }
                        }}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm font-medium">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Contenu vidéo</h2>
              
              <div className="space-y-6">
                <div className="rounded-2xl bg-white p-6 border border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Vidéo du cours *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary hover:bg-purple-50 transition cursor-pointer">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoChange}
                      className="hidden"
                      id="video-upload"
                    />
                    <label htmlFor="video-upload" className="cursor-pointer">
                      <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-semibold text-gray-700 mb-2">
                        {videoFile ? videoFile.name : 'Choisir une vidéo'}
                      </p>
                      <p className="text-sm text-gray-500">
                        MP4, MOV, AVI - Max 2GB
                      </p>
                    </label>
                  </div>

                  {videoUrl && (
                    <div className="mt-6">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full rounded-xl"
                        controls
                      />
                      {duration > 0 && (
                        <div className="mt-4 flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-gray-500" />
                            <span className="text-sm text-gray-600">
                              Durée: {Math.floor(duration / 60)}m {Math.floor(duration % 60)}s
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign size={16} className="text-gray-500" />
                            <span className="text-sm font-semibold text-primary">
                              Prix: ${calculatePrice(duration)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {thumbnailUrl && (
                  <div className="rounded-2xl bg-white p-6 border border-gray-100">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Miniature générée automatiquement
                    </label>
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail"
                      className="w-full rounded-xl"
                    />
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          /* Formulaire série */
          <>
            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Informations de la série</h2>
              
              <div className="space-y-6">
                <div className="rounded-2xl bg-white p-6 border border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Titre de la série *
                  </label>
                  <input
                    type="text"
                    value={seriesTitle}
                    onChange={(e) => setSeriesTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: Formation complète React"
                  />
                </div>

                <div className="rounded-2xl bg-white p-6 border border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Description de la série *
                  </label>
                  <textarea
                    value={seriesDescription}
                    onChange={(e) => setSeriesDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Décrivez le programme de la formation..."
                    rows={6}
                  />
                </div>

                <div className="rounded-2xl bg-white p-6 border border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Thumbnail de la série (optionnel)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSeriesThumbnail(file);
                        const url = URL.createObjectURL(file);
                        setSeriesThumbnailUrl(url);
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {seriesThumbnailUrl && (
                    <div className="mt-4">
                      <img
                        src={seriesThumbnailUrl}
                        alt="Thumbnail de la série"
                        className="w-full rounded-xl max-h-48 object-cover"
                      />
                    </div>
                  )}
                  <p className="mt-2 text-sm text-gray-500">
                    Laissez vide pour utiliser le thumbnail de la première vidéo
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Catégories (max 2)</h2>
              <div className="rounded-2xl bg-white p-6 border border-gray-100">
                <div className="grid gap-3 md:grid-cols-2">
                  {COURSE_CATEGORIES.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <input
                        type="checkbox"
                        checked={categories.includes(cat.id)}
                        onChange={(e) => {
                          if (e.target.checked && categories.length < 2) {
                            setCategories([...categories, cat.id]);
                          } else if (!e.target.checked) {
                            setCategories(categories.filter(c => c !== cat.id));
                          }
                        }}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm font-medium">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Vidéos de la série ({videos.length})
              </h2>
              
              <div className="space-y-4">
                {videos.map((video, index) => (
                  <div key={index} className="rounded-2xl bg-white p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">
                        Vidéo {index + 1}: {video.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock size={14} />
                          <span>{Math.floor(video.duration / 60)}m {Math.floor(video.duration % 60)}s</span>
                        </div>
                        <button
                          onClick={() => setVideos(videos.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700 transition"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Titre
                        </label>
                        <input
                          type="text"
                          value={video.title}
                          onChange={(e) => {
                            const updated = [...videos];
                            updated[index].title = e.target.value;
                            setVideos(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={video.description}
                          onChange={(e) => {
                            const updated = [...videos];
                            updated[index].description = e.target.value;
                            setVideos(updated);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                          rows={3}
                          placeholder="Description de cette vidéo..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={async () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'video/*';
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        try {
                          // Générer thumbnail et calculer durée
                          const thumbnailFile = await generateThumbnail(file);
                          
                          // Calculer durée automatiquement
                          const duration = await new Promise<number>((resolve) => {
                            const video = document.createElement('video');
                            video.src = URL.createObjectURL(file);
                            video.onloadedmetadata = () => {
                              resolve(video.duration);
                            };
                          });

                          setVideos([...videos, {
                            title: `Vidéo ${videos.length + 1}`,
                            description: '',
                            file,
                            thumbnailFile,
                            duration: duration,
                          }]);
                        } catch (error) {
                          console.error('Erreur lors du traitement de la vidéo:', error);
                          alert('Erreur lors du traitement de la vidéo. Veuillez réessayer.');
                        }
                      }
                    };
                    input.click();
                  }}
                  className="w-full rounded-2xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-primary hover:bg-purple-50 transition"
                >
                  <Plus size={24} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600">Ajouter une vidéo</p>
                </button>
              </div>
            </section>
          </>
        )}

        {/* Bouton de publication */}
        <button
          onClick={handleCreateCourse}
          disabled={isSubmitting || (publicationType === 'single' ? (!title || !description || !videoFile || categories.length === 0) : (!seriesTitle || !seriesDescription || videos.length === 0 || categories.length === 0))}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-purple-400 p-6 text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span className="font-bold text-lg">
                Publication en cours... {currentVideoIndex > 0 && `(${currentVideoIndex + 1}/${videos.length})`}
              </span>
            </>
          ) : (
            <>
              <Upload size={20} />
              <span className="font-bold text-lg">
                {publicationType === 'single' ? 'Publier le cours' : `Publier la série (${videos.length} vidéos)`}
              </span>
            </>
          )}
        </button>
      </main>

      {/* Overlay d'upload */}
      {isUploading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <Loader2 className="animate-spin mx-auto mb-4 text-primary" size={48} />
              <h3 className="text-xl font-bold mb-2">Publication en cours</h3>
              
              {publicationType === 'series' && videos.length > 0 && (
                <p className="text-gray-600 mb-4">
                  Téléversement de la vidéo {currentVideoIndex + 1} sur {videos.length}...
                </p>
              )}

              {uploadProgress !== null && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>{Math.round(uploadProgress)}%</span>
                    {uploadSpeed > 0 && (
                      <span>{uploadSpeed.toFixed(1)} MB/s</span>
                    )}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  {uploadedMB > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      {uploadedMB.toFixed(1)} MB envoyés
                    </p>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-600">
                L'envoi peut prendre plusieurs minutes. Vous pouvez quitter cette page, le processus continuera en arrière-plan.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
