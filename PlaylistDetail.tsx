import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, PlayCircle, Clock, DollarSign, Star, CheckCircle, Loader2, ArrowLeft, MessageCircle, User, Heart, X } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, updateDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { useAuth } from './stores/auth';
import { workerApi } from './services/worker';
import { Playlist } from './types';
import { sharePlaylist } from './lib/share';

const PlaylistDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [depositId, setDepositId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('pending');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const { data: playlist, isLoading } = useQuery({
    queryKey: ['playlist', id],
    queryFn: async () => {
      const docSnap = await getDoc(doc(db, 'playlists', id!));
      return { id: docSnap.id, ...docSnap.data() } as Playlist;
    },
    enabled: !!id
  });

  const { data: purchaseStatus } = useQuery({
    queryKey: ['playlistPurchase', id, user?.uid],
    queryFn: async () => {
      const q = query(
        collection(db, 'purchases'), 
        where('userId', '==', user?.uid), 
        where('courseId', '==', id), 
        where('status', '==', 'completed')
      );
      const snap = await getDocs(q);
      return !snap.empty;
    },
    enabled: !!user && !!id
  });

  // Récupérer les commentaires de la playlist
  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['playlistComments', id],
    queryFn: async () => {
      const q = query(
        collection(db, 'comments'),
        where('courseId', '==', id),
        where('type', '==', 'playlist'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!id
  });

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
    if (!playlist || !user) return;
    
    try {
      // Créer le document purchase
      await addDoc(collection(db, 'purchases'), {
        userId: user.uid,
        courseId: playlist.id,
        teacherId: playlist.teacherId,
        depositId: depId,
        amount: playlist.price,
        currency: 'USD',
        status: 'completed',
        createdAt: serverTimestamp(),
      });

      // Mettre à jour le compteur de ventes
      const courseRef = doc(db, 'playlists', playlist.id);
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
    if (!playlist || !user) return;
    try {
      const { paymentUrl: url, depositId: depId } = await workerApi.createDeposit(
        user.uid, 
        playlist.id, 
        playlist.price || 0
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

  const handleShare = async () => {
    if (!playlist) return;
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

  const handleVideoSelect = (index: number) => {
    if (purchaseStatus) {
      setSelectedVideoIndex(index);
    }
  };

  // Compatibilité entre structures Web (videos) et Android (sections.lessons)
  const getVideos = (playlist: any) => {
    // Priorité au format Web, fallback Android
    return playlist.videos || 
      playlist.sections?.flatMap((s: any) => s.lessons || []) || [];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Série non trouvée</h2>
          <button 
            onClick={() => navigate('/app')}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primaryHover"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{playlist.title}</h1>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative">
        <div className="aspect-video w-full bg-black">
          <img 
            src={playlist.thumbnailUrl} 
            alt={playlist.title}
            className="w-full h-full object-cover opacity-70"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="mb-4 rounded-full bg-purple-600 px-4 py-2 inline-block">
                <span className="text-sm font-bold">SÉRIE COMPLÈTE</span>
              </div>
              <h1 className="text-4xl font-bold mb-4">{playlist.title}</h1>
              <p className="text-lg opacity-90 max-w-2xl mx-auto">{playlist.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Par {playlist.teacherName}</p>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <BookOpen size={16} />
                  <span>{playlist.courseCount} cours</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={16} />
                  <span>{Math.floor((playlist.totalDuration || 0) / 60)} minutes</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star size={16} />
                  <span>{playlist.viewCount} vues</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary mb-2">
                {playlist.price === 0 ? 'Gratuit' : `${playlist.price} $`}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleShare}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  Partager
                </button>
                {purchaseStatus ? (
                  <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                    Déjà acheté
                  </button>
                ) : (
                  <button 
                    onClick={handleBuy}
                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primaryHover transition"
                  >
                    Acheter la série
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Videos List */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Contenu de la série</h2>
          <div className="space-y-4">
            {getVideos(playlist)?.map((video, index) => (
              <div 
                key={index}
                onClick={() => handleVideoSelect(index)}
                className={`flex gap-4 p-4 rounded-xl border transition cursor-pointer ${
                  selectedVideoIndex === index 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="relative">
                  <img 
                    src={video.thumbnailUrl} 
                    alt={video.title}
                    className="w-32 h-20 rounded-lg object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                    <PlayCircle className="text-white" size={24} />
                  </div>
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{video.title}</h3>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{video.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>{Math.floor(video.duration / 60)} min</span>
                    </div>
                    <span className={`px-2 py-1 rounded ${
                      video.videoStatus === 'ready' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {video.videoStatus === 'ready' ? 'Disponible' : 'En traitement'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle size={20} className="text-purple-600" />
              Avis des apprenants
            </h2>
            {comments && (
              <span className="text-sm text-gray-500">
                {comments.length} commentaire{comments.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {commentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-purple-600" />
            </div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment: any) => (
                <div key={comment.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <User size={20} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{comment.authorName}</h4>
                          <p className="text-xs text-gray-500">
                            {new Date(comment.createdAt?.toDate()).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">{comment.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageCircle size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun avis pour le moment</h3>
              <p className="text-gray-600 text-sm">Soyez le premier à donner votre avis sur cette série !</p>
            </div>
          )}
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

      {/* Video Player Modal */}
      {selectedVideoIndex !== null && playlist.videos && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl mx-4">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {playlist.videos[selectedVideoIndex].title}
              </h3>
              <button 
                onClick={() => setSelectedVideoIndex(null)}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
              >
                ×
              </button>
            </div>
            <div className="aspect-video bg-black">
              {/* Integrate video player here */}
              <div className="flex items-center justify-center h-full text-white">
                <p>Lecteur vidéo pour: {playlist.videos[selectedVideoIndex].title}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistDetail;
