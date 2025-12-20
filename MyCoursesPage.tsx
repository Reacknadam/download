import { BookOpen, Clock, Play, TrendingUp, ArrowLeft } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/stores/auth';
import { Course, Playlist, Purchase, VideoProgress } from '@/types';

export default function MyCoursesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: myCourses, isLoading, refetch } = useQuery({
    queryKey: ['my-courses', user?.uid],
    queryFn: async () => {
      if (!user) return [];

      const purchasesQuery = query(
        collection(db, 'purchases'),
        where('userId', '==', user.uid),
        where('status', '==', 'completed')
      );
      const purchasesSnapshot = await getDocs(purchasesQuery);
      const courseIds = purchasesSnapshot.docs.map(doc => (doc.data() as Purchase).courseId);

      if (courseIds.length === 0) return [];

      const [coursesSnapshot, playlistsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'courses'))),
        getDocs(query(collection(db, 'playlists'))),
      ]);

      const allCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      const allPlaylists = playlistsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Playlist));

      const ownedCourses = allCourses
        .filter(course => courseIds.includes(course.id))
        .map(course => ({ ...course, kind: 'course' as const }));

      const ownedPlaylists = allPlaylists
        .filter(playlist => courseIds.includes(playlist.id))
        .map(playlist => ({ ...playlist, kind: 'playlist' as const }));

      return [...ownedCourses, ...ownedPlaylists];
    },
    enabled: !!user,
  });

  // Charger les progressions
  const { data: progressMap = {} } = useQuery({
    queryKey: ['video-progress', user?.uid],
    queryFn: async () => {
      if (!user) return {};

      const progressQuery = query(
        collection(db, 'videoProgress'),
        where('userId', '==', user.uid)
      );
      const progressSnapshot = await getDocs(progressQuery);
      
      const map: Record<string, VideoProgress> = {};
      progressSnapshot.docs.forEach(doc => {
        const data = doc.data() as VideoProgress;
        map[data.courseId] = { ...data, id: doc.id };
      });
      
      return map;
    },
    enabled: !!user,
  });

  interface CourseCardProps {
    course: (Course | Playlist) & { kind?: 'course' | 'playlist' };
    key?: string;
  }

  const CourseCard: React.FC<CourseCardProps> = ({ course, key }) => {
    const isPlaylist = course.kind === 'playlist';
    const videoProgress = progressMap[course.id];
    const progress = videoProgress 
      ? Math.round((videoProgress.currentTime / videoProgress.duration) * 100)
      : 0;
    
    // Pour les playlists, utiliser le thumbnail de la première vidéo si le thumbnail de la playlist est vide
    const getThumbnailUrl = () => {
      if (isPlaylist && (!course.thumbnailUrl || course.thumbnailUrl === '')) {
        const playlist = course as Playlist;
        if (playlist.videos && playlist.videos.length > 0) {
          return playlist.videos[0].thumbnailUrl;
        }
      }
      return course.thumbnailUrl || 'https://via.placeholder.com/160x90';
    };
    
    return (
      <div 
        className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer"
        onClick={() => {
          if (isPlaylist) {
            navigate(`/playlists/watch?id=${course.id}`);
          } else {
            navigate(`/watch/${course.id}`);
          }
        }}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-gray-200">
          <img
            src={getThumbnailUrl()}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = 'https://via.placeholder.com/160x90';
            }}
          />
          {isPlaylist && (
            <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-medium">
              Série
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
              <Play className="ml-1 h-6 w-6 text-primary" />
            </div>
          </div>
          {progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
              <div 
                className="h-full bg-primary transition-all duration-300" 
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="mb-1 line-clamp-2 flex-1 text-sm font-bold text-gray-900 leading-snug">{course.title}</h3>
          <p className="mb-3 text-xs text-gray-500">{course.teacherName}</p>
          <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock size={12} />
              <span className="text-[10px]">
                {(() => {
                  const rawDuration = course.kind === 'playlist'
                    ? (course as Playlist).totalDuration
                    : (course as Course).duration;
                  const safeDuration = rawDuration || 0;
                  return safeDuration ? `${Math.floor(safeDuration / 60)}min` : 'N/A';
                })()}
              </span>
            </div>
            {progress > 0 ? (
              <span className="text-sm font-semibold text-primary">{progress}% terminé</span>
            ) : (
              <span className="text-sm font-semibold text-green-600">Commencer</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const totalCourses = myCourses?.length || 0;
  const totalHours = myCourses?.reduce((acc, c) => {
  const duration = c.kind === 'playlist' ? (c as Playlist).totalDuration || 0 : (c as Course).duration || 0;
  return acc + duration;
}, 0) || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

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
              <ArrowLeft size={20} />
            </button>
            <div className="leading-tight">
              <p className="text-sm font-bold md:text-base text-gray-900">Mes Cours achetes</p>
              <p className="hidden text-[10px] text-gray-500 md:block md:text-xs flex items-center gap-1">
                <img src="https://firebasestorage.googleapis.com/v0/b/jimmy-school.firebasestorage.app/o/thumbnails%2Ficon.png?alt=media&token=219e68a2-8dce-44a4-8653-8a1ea7f16b4f" alt="Jimmy School" className="h-3 w-3" />
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-12">
        {/* Stats Section */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center">
                <BookOpen size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{totalCourses}</h3>
                <p className="text-sm text-gray-600">Cours</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center">
                <Clock size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{Math.floor(totalHours / 3600)}h</h3>
                <p className="text-sm text-gray-600">Contenu</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center">
                <TrendingUp size={24} className="text-orange-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">0%</h3>
                <p className="text-sm text-gray-600">Progression</p>
              </div>
            </div>
          </div>
        </section>

        {/* Courses Grid */}
        {myCourses && myCourses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {myCourses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-12 text-center shadow-sm border border-gray-100">
            <BookOpen size={64} className="text-gray-300 mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun cours acheté</h3>
            <p className="text-gray-600 mb-8">Explorez notre catalogue pour commencer</p>
            <button
              onClick={() => navigate('/app/')}
              className="rounded-xl bg-primary px-8 py-3 font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primaryHover hover:-translate-y-0.5"
            >
              Explorer les cours
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
