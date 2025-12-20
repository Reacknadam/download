import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Volume2, ArrowLeft, BookOpen, Clock, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, query, where, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './services/firebase';
import { useAuth } from './stores/auth';
import { Playlist, VideoProgress } from './types';
import { workerApi } from './services/worker';
import Hls from 'hls.js';

const PlaylistWatchPage = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Récupérer l'ID depuis les paramètres URL ou la route
  const id = searchParams.get('id') || routeId;
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Compatibilité entre structures Web (videos) et Android (sections.lessons)
  const getVideos = (playlist: any) => {
    // Priorité au format Web, fallback Android
    return playlist.videos || 
      playlist.sections?.flatMap((s: any) => s.lessons || []) || [];
  };

  // Récupérer la playlist
  const { data: playlist, isLoading } = useQuery({
    queryKey: ['playlist', id],
    queryFn: async () => {
      if (!id) return null;
      const playlistDoc = await getDoc(doc(db, 'playlists', id));
      if (!playlistDoc.exists()) return null;
      return { id: playlistDoc.id, ...playlistDoc.data() } as Playlist;
    },
    enabled: !!id,
  });

  // Récupérer la progression de l'utilisateur
  const { data: userProgress = {} } = useQuery({
    queryKey: ['video-progress', user?.uid, id],
    queryFn: async () => {
      if (!user || !id) return {};
      const progressQuery = query(
        collection(db, 'videoProgress'),
        where('userId', '==', user.uid),
        where('playlistId', '==', id)
      );
      const progressSnapshot = await getDocs(progressQuery);
      
      const map: Record<string, VideoProgress> = {};
      progressSnapshot.docs.forEach(doc => {
        const data = doc.data() as VideoProgress;
        map[data.videoId] = { ...data, id: doc.id };
      });
      
      return map;
    },
    enabled: !!user && !!id,
  });

  // Vérifier si l'utilisateur a acheté la playlist ou est le formateur
  const { data: accessData } = useQuery({
    queryKey: ['playlistAccess', id, user?.uid],
    queryFn: async () => {
      if (!user || !id) return { hasAccess: false, isOwner: false };
      
      // Vérifier si l'utilisateur est le propriétaire
      if (playlist?.teacherId === user.uid) {
        return { hasAccess: true, isOwner: true };
      }
      
      // Vérifier si l'utilisateur a acheté la playlist
      const purchasesQuery = query(
        collection(db, 'purchases'),
        where('userId', '==', user.uid),
        where('courseId', '==', id),
        where('status', '==', 'completed')
      );
      const purchasesSnapshot = await getDocs(purchasesQuery);
      
      return { 
        hasAccess: !purchasesSnapshot.empty, 
        isOwner: false 
      };
    },
    enabled: !!user && !!id && !!playlist,
  });

  // Utiliser userProgress directement au lieu de créer un état local
  const progressMap = userProgress || {};

  const currentVideo = playlist?.videos?.[currentVideoIndex];

  // Récupérer l'URL de playback pour la vidéo actuelle
  const { data: videoPlaybackData, isLoading: isVideoLoading } = useQuery({
    queryKey: ['videoPlayback', currentVideo?.videoUrl],
    queryFn: async () => {
      if (!currentVideo?.videoUrl) return null;
      
      try {
        // Vérifier si c'est une vidéo Bunny Stream (videoUrl est un Bunny Video ID)
        const bunnyVideoId = currentVideo.bunnyVideoId || currentVideo.videoUrl;
        
        if (bunnyVideoId && typeof bunnyVideoId === 'string' && !bunnyVideoId.includes('http')) {
          // C'est un Bunny Video ID
          return {
            type: 'bunny',
            embedUrl: `https://player.mediadelivery.net/embed/544980/${bunnyVideoId}`
          };
        }
        
        // Sinon, vérifier si c'est déjà une URL complète
        if (currentVideo.videoUrl.startsWith('http')) {
          // URL directe, essayer workerApi
          return {
            type: 'legacy',
            playbackUrl: await workerApi.getPlaybackUrl(currentVideo.videoUrl)
          };
        }
        
        // Sinon, traiter comme un ID de vidéo legacy
        return {
          type: 'legacy',
          playbackUrl: await workerApi.getPlaybackUrl(currentVideo.videoUrl)
        };
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'URL de playback:', error);
        return null;
      }
    },
    enabled: !!currentVideo?.videoUrl,
  });

  // Initialiser HLS pour les vidéos legacy
  useEffect(() => {
    if (videoPlaybackData?.type === 'legacy' && videoPlaybackData?.playbackUrl && videoRef.current) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(videoPlaybackData.playbackUrl);
        hls.attachMedia(videoRef.current);
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = videoPlaybackData.playbackUrl;
      }
    }
  }, [videoPlaybackData]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Sauvegarder la progression toutes les 5 secondes
      if (Math.floor(videoRef.current.currentTime) % 5 === 0) {
        saveProgress(videoRef.current.currentTime, videoRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      
      // Restaurer la progression sauvegardée
      const savedProgress = progressMap[currentVideo?.videoUrl || ''];
      if (savedProgress && savedProgress.currentTime > 0) {
        videoRef.current.currentTime = savedProgress.currentTime;
      }
    }
  };

  const handleVideoEnd = () => {
    // Marquer la vidéo comme terminée
    saveProgress(duration, duration, true);
    
    // Passer à la vidéo suivante
    if (currentVideoIndex < (playlist?.videos?.length || 0) - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    }
  };

  const saveProgress = async (currentTime: number, duration: number, completed: boolean = false) => {
    if (!user || !currentVideo || !id) return;

    const progressData = {
      userId: user.uid,
      playlistId: id,
      videoId: currentVideo.videoUrl,
      currentTime,
      duration,
      completed,
      updatedAt: serverTimestamp(),
    };

    try {
      const existingProgress = progressMap[currentVideo.videoUrl];
      if (existingProgress) {
        await updateDoc(doc(db, 'videoProgress', existingProgress.id), progressData);
      } else {
        // Créer un nouveau document de progression
        await addDoc(collection(db, 'videoProgress'), progressData);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la progression:', error);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVideoProgress = (videoUrl: string) => {
    const progress = progressMap[videoUrl];
    if (!progress) return 0;
    return Math.round((progress.currentTime / progress.duration) * 100);
  };

  const isVideoCompleted = (videoUrl: string) => {
    const progress = progressMap[videoUrl];
    return progress?.completed || false;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-white text-2xl mb-4">Playlist non trouvée</h2>
          <Link to="/app/my-courses" className="text-purple-400 hover:text-purple-300">
            Retour à mes cours
          </Link>
        </div>
      </div>
    );
  }

  if (!accessData?.hasAccess) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-white text-2xl mb-4">Accès non autorisé</h2>
          <p className="text-gray-400 mb-4">
            {accessData?.isOwner 
              ? "Vous êtes le propriétaire de cette playlist" 
              : "Vous devez acheter cette playlist pour y accéder"
            }
          </p>
          {!accessData?.isOwner && (
            <Link to={`/playlist/${id}`} className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700">
              Acheter la playlist
            </Link>
          )}
          <div className="mt-4">
            <Link to="/app/my-courses" className="text-purple-400 hover:text-purple-300">
              Retour à mes cours
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/app/my-courses')}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold">{playlist.title}</h1>
              <p className="text-gray-400 text-sm">Série de {playlist.videos?.length || 0} vidéos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lecteur vidéo */}
        <div className="lg:col-span-2">
          <div className="bg-black rounded-lg overflow-hidden">
            {/* Thumbnail et informations de la vidéo actuelle */}
            {currentVideo && (
              <div className="relative">
                <img 
                  src={currentVideo.thumbnailUrl} 
                  alt={currentVideo.title}
                  className="w-full aspect-video object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "https://via.placeholder.com/.placeholder.com/640x360/000000/FFFFFF?text=Loading+Video";
                  }}
                />
                
                {/* Overlay de lecture si la vidéo n'est pas en cours de lecture */}
                {!isPlaying && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <button
                      onClick={handlePlayPause}
                      className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center hover:bg-purple-700 transition-colors"
                    >
                      <Play size={32} className="text-white ml-1" />
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {isVideoLoading ? (
              <div className="w-full aspect-video flex items-center justify-center bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
              </div>
            ) : currentVideo && videoPlaybackData ? (
              videoPlaybackData.type === 'bunny' ? (
                <div className="hidden">
                  <iframe
                    src={videoPlaybackData.embedUrl}
                    className="w-full aspect-video"
                    allowFullScreen
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  />
                </div>
              ) : (
                <video
                  ref={videoRef}
                  className="hidden"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleVideoEnd}
                  controls={false}
                />
              )
            ) : (
              <div className="w-full aspect-video flex items-center justify-center bg-gray-900">
                <p className="text-white">Chargement de la vidéo...</p>
              </div>
            )}
            
            {/* Contrôles vidéo */}
            <div className="bg-gray-800 p-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">{currentVideo?.title || ''}</h3>
                <p className="text-gray-400 text-sm">{currentVideo?.description || ''}</p>
              </div>
              
              {/* Barre de progression */}
              <div className="mb-4">
                <div className="bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-purple-600 h-full transition-all duration-300"
                    style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              
              {/* Contrôles */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentVideoIndex(Math.max(0, currentVideoIndex - 1))}
                    disabled={currentVideoIndex === 0}
                    className="p-2 hover:bg-gray-700 rounded disabled:opacity-50"
                  >
                    <SkipBack size={20} />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="p-3 bg-purple-600 hover:bg-purple-700 rounded-full"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button
                    onClick={() => setCurrentVideoIndex(Math.min((playlist.videos?.length || 0) - 1, currentVideoIndex + 1))}
                    disabled={currentVideoIndex === (playlist.videos?.length || 0) - 1}
                    className="p-2 hover:bg-gray-700 rounded disabled:opacity-50"
                  >
                    <SkipForward size={20} />
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Volume2 size={20} />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-24"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des vidéos */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Contenu de la série</h3>
            <div className="space-y-2">
              {getVideos(playlist)?.map((video, index) => (
                <button
                  key={video.videoUrl}
                  onClick={() => setCurrentVideoIndex(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    index === currentVideoIndex
                      ? 'bg-purple-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 relative">
                      {/* Thumbnail de la vidéo */}
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title}
                        className="w-16 h-10 rounded object-cover"
                        onError={(e) => {
                          // Fallback si le thumbnail ne charge pas
                          e.currentTarget.src = "https://via.placeholder.com/.placeholder.com/64xh/40/000000/FFFFFF?text=Video";
                        }}
                      />
                      
                      {/* Overlay avec l'icône de lecture */}
                      <div className="absolute inset-0 inset-0 flex items-center justify-center">
                        {isVideoCompleted(video.videoUrl) ? (
                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle size={12} className="text-white" />
                          </div>
                        ) : index === currentVideoIndex && isPlaying ? (
                          <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                            <Pause size={12} className="text-white" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                            <Play size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{video.title}</h4>
                      <p className="text-xs text-gray-400">{video.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={12} />
                        <span className="text-xs text-gray-400">
                          {Math.floor(video.duration / 60)}min
                        </span>
                        {getVideoProgress(video.videoUrl) > 0 && (
                          <span className="text-xs text-purple-400">
                            {getVideoProgress(video.videoUrl)}% vu
                          </span>
                        )}
                      </div>
                      {/* Barre de progression de la vidéo */}
                      {getVideoProgress(video.videoUrl) > 0 && (
                        <div className="mt-2 bg-gray-600 h-1 rounded-full overflow-hidden">
                          <div 
                            className="bg-purple-400 h-full"
                            style={{ width: `${getVideoProgress(video.videoUrl)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistWatchPage;
