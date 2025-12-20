import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { User, Mail, BookOpen, TrendingUp, Star, PlayCircle, Edit } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { useAuth } from './stores/auth';
import { Course } from './types';

interface UserProfile {
  uid: string;
  displayName?: string;
  email: string;
  photoURL?: string;
  isTeacherVerified?: boolean;
}

interface Playlist {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  courseCount: number;
  viewCount?: number;
  teacherId: string;
  isPublic: boolean;
  createdAt: any;
  videos?: Array<{
    videoUrl: string;
    title: string;
    description: string;
    duration: number;
    order: number;
    thumbnailUrl?: string;
    videoStatus?: string;
  }>;
}

const InstructorPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Récupérer le profil du formateur
  const { data: instructor } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      if (!id) return null;
      const userDoc = await getDoc(doc(db, 'users', id));
      return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
    },
    enabled: !!id,
  });

  // Récupérer les cours du formateur
  const { data: courses = [] } = useQuery({
    queryKey: ['courses', 'byTeacher', id],
    queryFn: async () => {
      if (!id) return [];
      const q = query(collection(db, 'courses'), where('teacherId', '==', id), where('isPublished', '==', true));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Course));
    },
    enabled: !!id,
  });

  // Récupérer les playlists du formateur
  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists', 'byTeacher', id],
    queryFn: async () => {
      if (!id) return [];
      const q = query(
        collection(db, 'playlists'),
        where('teacherId', '==', id),
        where('isPublic', '==', true)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Playlist));
    },
    enabled: !!id,
  });

  // Récupérer les cours individuels (non inclus dans des playlists)
  const { data: individualCourses = [] } = useQuery({
    queryKey: ['individual-courses', 'byTeacher', id],
    queryFn: async () => {
      if (!id) return [];
      // Récupérer tous les cours du formateur
      const coursesQuery = query(collection(db, 'courses'), where('teacherId', '==', id), where('isPublished', '==', true));
      const coursesSnapshot = await getDocs(coursesQuery);
      const allCourses = coursesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Course));
      
      // Pour l'instant, considérer tous les cours comme individuels
      // La logique de séparation sera affinée plus tard
      return allCourses;
    },
    enabled: !!id,
  });

  // Calculer les statistiques
  const totalViews = courses.reduce((sum, c) => sum + (c.viewCount || 0), 0);
  const totalStudents = courses.reduce((sum, c) => sum + (c.saleCount || 0), 0);
  const avgRating = courses.length > 0
    ? courses.reduce((sum, c) => sum + ((c as any).averageRating || 0), 0) / courses.length
    : 0;

  const displayEmail = instructor?.displayName || instructor?.email || 'Formateur';
  const photoURL = instructor?.photoURL;

  // Vérifier si l'utilisateur connecté est le propriétaire des playlists
  const isOwner = user?.uid === id;

  // Test temporaire: toujours afficher les boutons pour debug
  const showButtons = true; // isOwner;

  if (!instructor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec gradient */}
      <div className="bg-gradient-to-br from-purple-600 to-purple-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 relative">
          {/* Bouton retour */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 -left-2 p-3 rounded-lg bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm border border-white/30"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {photoURL && photoURL.trim() !== '' ? (
                <img
                  src={photoURL}
                  alt={displayEmail}
                  className="w-32 h-32 rounded-full border-4 border-white shadow-xl object-cover"
                  onError={(e) => {
                    // Si l'image ne charge pas, masquer l'img et montrer la lettre
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="w-32 h-32 rounded-full bg-purple-600 border-4 border-white shadow-xl flex items-center justify-center">
                          <span class="text-4xl font-bold text-white">
                            ${displayEmail.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      `;
                    }
                  }}
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-purple-600 border-4 border-white shadow-xl flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">
                    {displayEmail.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {/* Infos du formateur */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold mb-2 text-black">{displayEmail}</h1>
              <p className="text-purple-100 mb-4">{instructor.email}</p>
              {/* Statistiques */}
              <div className="flex flex-wrap gap-6 justify-center md:justify-start">
                <div className="flex items-center gap-2">
                  <BookOpen size={20} />
                  <span className="text-2xl font-bold text-black">{courses.length}</span>
                  <span className="text-black">Cours</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp size={20} />
                  <span className="text-2xl font-bold text-black">{totalViews.toLocaleString()}</span>
                  <span className="text-black">Vues</span>
                </div>
                <div className="flex items-center gap-2">
                  <User size={20} />
                  <span className="text-2xl font-bold text-black">{totalStudents.toLocaleString()}</span>
                  <span className="text-black">Étudiants</span>
                </div>
                {avgRating > 0 && (
                  <div className="flex items-center gap-2">
                    <Star size={20} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-2xl font-bold text-black">{avgRating.toFixed(1)}</span>
                    <span className="text-black">Note</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Playlists */}
        {playlists.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-black">Séries de cours</h2>
              {showButtons && (
                <button
                  onClick={() => navigate('/teacher/create-playlist')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <Edit size={16} />
                  Créer une série
                </button>
              )}
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {playlists.map((playlist) => (
                <div key={playlist.id} className="group relative">
                  <Link
                    to={`/playlist/${playlist.id}`}
                    className="flex gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-200 hover:shadow-lg transition-all"
                  >
                    <div className="flex-shrink-0">
                      {playlist.thumbnailUrl ? (
                        <img
                          src={playlist.thumbnailUrl}
                          alt={playlist.title}
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                          <PlayCircle size={32} className="text-purple-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-black mb-1 group-hover:text-purple-600 transition-colors">
                        {playlist.title}
                      </h3>
                      {playlist.description && (
                        <p className="text-sm text-black mb-2 line-clamp-2">{playlist.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{playlist.courseCount} cours</span>
                        <span>{playlist.viewCount || 0} vues</span>
                      </div>
                    </div>
                  </Link>
                  {showButtons && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/teacher/edit-playlist/${playlist.id}`);
                        }}
                        className="p-2 bg-white rounded-lg shadow-md border border-gray-200 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                        title="Modifier la série"
                      >
                        <Edit size={16} className="text-purple-600" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Cours individuels */}
      {individualCourses.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-black mb-6">Mes cours individuels</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {individualCourses.map((course) => (
              <Link
                key={course.id}
                to={`/course/${course.id}`}
                className="group cursor-pointer flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-gray-200">
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
                      <PlayCircle className="ml-1 h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="mb-1 line-clamp-2 flex-1 text-sm font-bold text-black leading-snug">
                    {course.title}
                  </h3>
                  <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-3 text-gray-400">
                      <div className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        <span className="text-[10px]">{course.viewCount || 0}</span>
                      </div>
                      {(course as any).averageRating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-yellow-500 fill-yellow-500" />
                          <span className="text-[10px]">{(course as any).averageRating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-bold text-purple-600">
                      {course.price === 0 ? 'Gratuit' : `${course.price} USD`}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Cours inclus dans les séries */}
      {playlists.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-black mb-6">Mes cours de séries</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {playlists.map((playlist) => 
              playlist.videos?.map((video, index) => (
                <div key={`${playlist.id}-${video.videoUrl}`} className="group relative cursor-pointer flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="absolute top-2 left-2 z-10 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                    Dans une série
                  </div>
                  <div className="relative aspect-video w-full overflow-hidden bg-gray-200">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                        <PlayCircle size={32} className="text-purple-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
                        <BookOpen className="ml-1 h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="mb-1 line-clamp-2 flex-1 text-sm font-bold text-black leading-snug">
                      {video.title}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                      {video.description}
                    </p>
                    <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-3 text-gray-400">
                        <div className="flex items-center gap-1">
                          <TrendingUp size={12} />
                          <span className="text-[10px]">{playlist.viewCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px]">{Math.floor(video.duration / 60)}min</span>
                        </div>
                      </div>
                      <span className="text-xs text-purple-600 font-medium">
                        {playlist.title}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Message si aucun contenu */}
      {playlists.length === 0 && courses.length === 0 && (
        <div className="text-center py-16">
          <div className="text-gray-400 mb-4">
            <BookOpen size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-black mb-2">Aucun contenu disponible</h3>
          <p className="text-black">Ce formateur n'a pas encore publié de cours ou de séries.</p>
          <Link 
            to="/search" 
            className="inline-block mt-6 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            Retour à la recherche
          </Link>
        </div>
      )}
      </div>
    </div>
  );
};

export default InstructorPage;