import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './stores/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './services/firebase';
import { formatPrice } from './lib/pricing';
import { ArrowLeft, Edit3, Save, X, Upload, Trash2, Star, PlayCircle, Users, Clock, DollarSign, BookOpen, Image as ImageIcon } from 'lucide-react';

const TeacherProfileScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  // Fetch teacher's courses
  const { data: courses, isLoading, refetch } = useQuery({
    queryKey: ['teacherCourses', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
      const coursesQ = query(collection(db, 'courses'), where('teacherId', '==', user.uid));
      const coursesSnap = await getDocs(coursesQ);
      
      return coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!user
  });

  // Fetch teacher's playlists
  const { data: playlists, isLoading: playlistsLoading, refetch: refetchPlaylists } = useQuery({
    queryKey: ['teacherPlaylists', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
      const playlistsQ = query(collection(db, 'playlists'), where('teacherId', '==', user.uid));
      const playlistsSnap = await getDocs(playlistsQ);
      
      return playlistsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!user
  });

  // Update course mutation
  const updateCourseMutation = useMutation({
    mutationFn: async ({ courseId, updates }: { courseId: string; updates: any }) => {
      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    },
    onSuccess: () => {
      setEditingCourse(null);
      setEditFormData({});
      refetch();
    }
  });

  // Delete course mutation
  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      await deleteDoc(doc(db, 'courses', courseId));
    },
    onSuccess: () => {
      refetch();
    }
  });

  // Delete playlist mutation
  const deletePlaylistMutation = useMutation({
    mutationFn: async (playlistId: string) => {
      await deleteDoc(doc(db, 'playlists', playlistId));
    },
    onSuccess: () => {
      refetchPlaylists();
    }
  });

  // Upload thumbnail mutation
  const uploadThumbnailMutation = useMutation({
    mutationFn: async ({ courseId, file }: { courseId: string; file: File }) => {
      const storageRef = ref(storage, `courses/${courseId}/thumbnail`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        thumbnailUrl: downloadURL,
        updatedAt: serverTimestamp()
      });
      
      return downloadURL;
    },
    onSuccess: () => {
      refetch();
    }
  });

  const handleEditCourse = (course: any) => {
    setEditingCourse(course.id);
    setEditFormData({
      title: course.title,
      description: course.description,
      price: course.price,
      category: course.category,
      level: course.level
    });
  };

  const handleSaveCourse = async (courseId: string) => {
    if (!editFormData.title || !editFormData.description) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    updateCourseMutation.mutate({
      courseId,
      updates: editFormData
    });
  };

  const handleCancelEdit = () => {
    setEditingCourse(null);
    setEditFormData({});
  };

  const handleDeleteCourse = (courseId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce cours ? Cette action est irréversible.')) {
      deleteCourseMutation.mutate(courseId);
    }
  };

  const handleDeletePlaylist = (playlistId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette série ? Cette action est irréversible.')) {
      deletePlaylistMutation.mutate(playlistId);
    }
  };

  const handleThumbnailUpload = (courseId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadThumbnailMutation.mutate({ courseId, file });
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Veuillez vous connecter</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/teacher')}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Gestion des cours et séries</h1>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/teacher/create-playlist')}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <PlayCircle className="h-4 w-4" />
                Nouvelle série
              </button>
              <button
                onClick={() => navigate('/teacher/create')}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Upload className="h-4 w-4" />
                Nouveau cours
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 sm:px-6">
        {/* Section des cours */}
        <div className="mb-8 sm:mb-12">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Mes cours individuels</h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-purple-600 border-t-transparent rounded-full"></div>
            </div>
          ) : courses && courses.length > 0 ? (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              {courses.map((course: any) => (
              <div key={course.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Course Header */}
                <div className="relative">
                  <div className="aspect-video bg-gray-200 relative overflow-hidden">
                    {course.thumbnailUrl ? (
                      <img 
                        src={course.thumbnailUrl} 
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    
                    {editingCourse === course.id && (
                      <div className="absolute top-2 right-2">
                        <label className="bg-white/90 backdrop-blur px-3 py-2 rounded-lg cursor-pointer hover:bg-white transition-colors">
                          <Upload className="h-4 w-4" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleThumbnailUpload(course.id, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  
                  <div className="absolute top-2 left-2">
                    <span className="bg-purple-600 text-white px-2 py-1 rounded-lg text-xs font-medium">
                      {course.category || 'General'}
                    </span>
                  </div>
                </div>

                {/* Course Content */}
                <div className="p-4 sm:p-6">
                  {editingCourse === course.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                        <input
                          type="text"
                          value={editFormData.title || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={editFormData.description || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Prix ($)</label>
                          <input
                            type="number"
                            value={editFormData.price || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, price: Number(e.target.value) })}
                            step="0.01"
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                          <select
                            value={editFormData.category || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="school">Scolaire</option>
                            <option value="university">Universitaire</option>
                            <option value="tech">Tech</option>
                            <option value="personal_dev">Développement personnel</option>
                            <option value="pro_skills">Compétences pro</option>
                            <option value="science">Science</option>
                            <option value="art">Art</option>
                            <option value="finance">Finance</option>
                            <option value="kids">Enfants</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleSaveCourse(course.id)}
                          disabled={updateCourseMutation.isPending}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {updateCourseMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{course.title}</h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
                      
                      {/* Stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium">{(course.averageRating || 0).toFixed(1)}</span>
                          </div>
                          <p className="text-xs text-gray-500">{course.ratingCount || 0} avis</p>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                            <Users className="h-4 w-4" />
                            <span className="text-sm font-medium">{course.studentsCount || 0}</span>
                          </div>
                          <p className="text-xs text-gray-500">étudiants</p>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-sm font-medium">{formatPrice(course.price || 0)}</span>
                          </div>
                          <p className="text-xs text-gray-500">prix</p>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => handleEditCourse(course)}
                          className="w-full sm:flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <Edit3 className="h-4 w-4" />
                          Modifier
                        </button>
                        <button
                          onClick={() => navigate(`/watch/${course.id}`)}
                          className="w-full sm:flex-1 bg-green-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <PlayCircle className="h-4 w-4" />
                          Lire
                        </button>
                        <button
                          onClick={() => navigate(`/course/${course.id}`)}
                          className="w-full sm:flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                        >
                          Voir
                        </button>
                        <button
                          onClick={() => handleDeleteCourse(course.id)}
                          disabled={deleteCourseMutation.isPending}
                          className="bg-red-100 text-red-600 px-3 py-2 rounded-lg font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun cours</h3>
            <p className="text-gray-600 mb-6">Vous n'avez pas encore créé de cours</p>
            <button
              onClick={() => navigate('/teacher/create')}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <Upload className="h-4 w-4" />
              Créer votre premier cours
            </button>
          </div>
        )}
        </div>

        {/* Section des séries (playlists) */}
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Mes séries de cours</h2>
          {playlistsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-green-600 border-t-transparent rounded-full"></div>
            </div>
          ) : playlists && playlists.length > 0 ? (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              {playlists.map((playlist: any) => (
                <div key={playlist.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Playlist Header */}
                  <div className="relative">
                    <div className="aspect-video bg-gray-200 relative overflow-hidden">
                      {playlist.thumbnailUrl ? (
                        <img 
                          src={playlist.thumbnailUrl} 
                          alt={playlist.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-100 to-green-200">
                          <PlayCircle className="h-12 w-12 text-green-600" />
                        </div>
                      )}
                    </div>
                    
                    <div className="absolute top-2 left-2">
                      <span className="bg-green-600 text-white px-2 py-1 rounded-lg text-xs font-medium">
                        Série
                      </span>
                    </div>
                  </div>

                  {/* Playlist Content */}
                  <div className="p-4 sm:p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{playlist.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{playlist.description}</p>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                          <PlayCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">{playlist.courseCount || 0}</span>
                        </div>
                        <p className="text-xs text-gray-500">vidéos</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                          <Users className="h-4 w-4" />
                          <span className="text-sm font-medium">{playlist.saleCount || 0}</span>
                        </div>
                        <p className="text-xs text-gray-500">ventes</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-sm font-medium">{formatPrice(playlist.price || 0)}</span>
                        </div>
                        <p className="text-xs text-gray-500">prix</p>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => navigate(`/teacher/edit-playlist/${playlist.id}`)}
                        className="w-full sm:flex-1 bg-green-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        Modifier
                      </button>
                      <button
                        onClick={() => navigate(`/playlists/watch?id=${playlist.id}`)}
                        className="w-full sm:flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Lire
                      </button>
                      <button
                        onClick={() => navigate(`/playlist/${playlist.id}`)}
                        className="w-full sm:flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                      >
                        Voir
                      </button>
                      <button
                        onClick={() => handleDeletePlaylist(playlist.id)}
                        disabled={deletePlaylistMutation.isPending}
                        className="bg-red-100 text-red-600 px-3 py-2 rounded-lg font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <PlayCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune série</h3>
              <p className="text-gray-600 mb-6">Vous n'avez pas encore créé de séries de cours</p>
              <button
                onClick={() => navigate('/teacher/create-playlist')}
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <PlayCircle className="h-4 w-4" />
                Créer votre première série
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherProfileScreen;
