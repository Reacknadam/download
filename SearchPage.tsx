import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Filter, X, Clock, Star, User, PlayCircle, TrendingUp, Mail } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import { useAuth } from './stores/auth';
import { Course, Playlist } from './types';
import { useQuery } from '@tanstack/react-query';

const CATEGORIES = [
  { id: 'all', label: 'Tous' },
  { id: 'development', label: 'Développement' },
  { id: 'business', label: 'Business' },
  { id: 'design', label: 'Design' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'music', label: 'Musique' },
  { id: 'photography', label: 'Photographie' },
  { id: 'health', label: 'Santé' },
  { id: 'languages', label: 'Langues' },
];

const SEARCH_HISTORY_KEY = 'search_history';

interface Teacher {
  uid: string;
  displayName?: string;
  email: string;
  photoURL?: string;
  courseCount?: number;
  isTeacherVerified?: boolean;
}

interface TeacherCardProps {
  teacher: Teacher;
  key?: string;
}

interface PlaylistCardProps {
  playlist: Playlist;
  key?: string;
}

interface CourseCardProps {
  course: Course;
  key?: string;
}

interface HistoryItemProps {
  item: string;
  key?: string;
}

const SearchPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Charger l'historique
  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = () => {
    try {
      const history = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  const saveToHistory = (query: string) => {
    if (!query.trim()) return;
    
    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
    setSearchHistory(newHistory);
    
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  const clearHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  // Charger les séries (playlists)
  const { data: allPlaylists = [], isLoading: isPlaylistsLoading } = useQuery({
    queryKey: ['playlists', 'all'],
    queryFn: async () => {
      try {
        const playlistsRef = collection(db, 'playlists');
        const q = query(playlistsRef, where('isPublished', '==', true), where('isPublic', '==', true), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Playlist));
      } catch (error) {
        console.error('Error loading playlists:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Charger tous les cours
  const { data: allCourses = [], isLoading: isCoursesLoading } = useQuery({
    queryKey: ['courses', 'all'],
    queryFn: async () => {
      setLoading(true);
      try {
        const coursesRef = collection(db, 'courses');
        const q = query(coursesRef, where('isPublished', '==', true), orderBy('viewCount', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      } catch (error) {
        console.error('Error loading courses:', error);
        return [];
      } finally {
        setLoading(false);
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Charger les formateurs
  const { data: teachers = [], isLoading: isTeachersLoading } = useQuery({
    queryKey: ['teachers', 'all'],
    queryFn: async () => {
      try {
        const q = query(collection(db, 'users'), where('isTeacherVerified', '==', true));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as Teacher));
      } catch (error) {
        console.error('Error loading teachers:', error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  // Filtrage
  const { filteredCourses, filteredTeachers, filteredPlaylists } = useMemo(() => {
    let courses = allCourses;
    let teachersList = teachers;
    let playlists = allPlaylists;

    if (selectedCategory !== 'all') {
      courses = courses.filter(c => c.category === selectedCategory);
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      
      courses = courses.filter(c =>
        c.title.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.teacherName?.toLowerCase().includes(query) ||
        (c as any).teacherEmail?.toLowerCase().includes(query)
      );

      playlists = playlists.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.teacherName?.toLowerCase().includes(query) ||
        (p as any).teacherEmail?.toLowerCase().includes(query)
      );

      teachersList = teachersList.filter(t =>
        t.displayName?.toLowerCase().includes(query) ||
        t.email.toLowerCase().includes(query)
      );
    }

    return { filteredCourses: courses, filteredTeachers: teachersList, filteredPlaylists: playlists };
  }, [allCourses, teachers, allPlaylists, selectedCategory, searchTerm]);

  const COURSES_PER_PAGE = 12;
  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / COURSES_PER_PAGE));
  const pagedCourses = filteredCourses.slice(
    currentPage * COURSES_PER_PAGE,
    currentPage * COURSES_PER_PAGE + COURSES_PER_PAGE,
  );

  useEffect(() => {
    // Réinitialiser la pagination quand la recherche ou la catégorie change
    setCurrentPage(0);
  }, [searchTerm, selectedCategory]);

  const handleSearch = (query: string) => {
    setSearchTerm(query);
    setShowSuggestions(false);
    if (query.trim()) {
      saveToHistory(query);
    }
  };

  const PlaylistCard = ({ playlist }: PlaylistCardProps) => {
    // Utiliser le thumbnail de la première vidéo si celui de la playlist est vide
    const getThumbnailUrl = () => {
      if (!playlist.thumbnailUrl || playlist.thumbnailUrl === '') {
        if (playlist.videos && playlist.videos.length > 0) {
          return playlist.videos[0].thumbnailUrl;
        }
      }
      return playlist.thumbnailUrl || 'https://via.placeholder.com/320x180';
    };

    return (
      <div 
        onClick={() => navigate(`/playlist/${playlist.id}`)}
        className="group cursor-pointer flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-gray-200">
          <img
            src={getThumbnailUrl()}
            alt={playlist.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = 'https://via.placeholder.com/320x180';
            }}
          />
          <div className="absolute top-2 left-2 rounded-full bg-purple-600 px-2 py-1 text-xs font-bold text-white">
            SÉRIE
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
              <PlayCircle className="ml-1 h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="mb-1 line-clamp-2 flex-1 text-sm font-bold text-gray-900 leading-snug">
            {playlist.title}
          </h3>
          <Link 
            to={`/instructor/${playlist.teacherId}`}
            onClick={(e) => e.stopPropagation()}
            className="mb-3 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            {(playlist as any).teacherEmail || (playlist as any).teacherName}
          </Link>
          <div className="mb-2 flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <PlayCircle size={12} />
              <span>{playlist.courseCount || 0} cours</span>
            </div>
            {playlist.totalDuration && (
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>{Math.floor(playlist.totalDuration / 60)}min</span>
              </div>
            )}
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="flex items-center gap-1">
                <TrendingUp size={12} />
                <span className="text-[10px]">{playlist.viewCount || 0}</span>
              </div>
            </div>
            <span className="text-sm font-bold text-purple-600">
              {playlist.price === 0 ? 'Gratuit' : `${playlist.price} USD`}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const CourseCard = ({ course }: CourseCardProps) => {
    const courseCount = allCourses.filter(c => c.teacherId === course.teacherId).length;
    
    return (
      <div 
        onClick={() => navigate(`/course/${course.id}`)}
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
          <h3 className="mb-1 line-clamp-2 flex-1 text-sm font-bold text-gray-900 leading-snug">
            {course.title}
          </h3>
          <Link 
            to={`/instructor/${course.teacherId}`}
            onClick={(e) => e.stopPropagation()}
            className="mb-3 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            {(course as any).teacherEmail || (course as any).teacherName}
          </Link>
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
      </div>
    );
  };

  const TeacherCard = ({ teacher }: TeacherCardProps) => {
    const courseCount = allCourses.filter(c => c.teacherId === teacher.uid).length;
    
    return (
      <Link
        to={`/instructor/${teacher.uid}`}
        onClick={() => setShowSuggestions(false)}
        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all"
      >
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
          {teacher.photoURL ? (
            <img src={teacher.photoURL} alt={teacher.displayName} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <User size={24} className="text-purple-600" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900">
            {teacher.displayName || teacher.email}
          </p>
          <p className="text-sm text-gray-500">
            {courseCount} cours
          </p>
        </div>
        <Mail size={16} className="text-gray-400" />
      </Link>
    );
  };

  const HistoryItem = ({ item }: HistoryItemProps) => (
    <div
      onClick={() => handleSearch(item)}
      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
    >
      <Clock size={18} className="text-gray-400" />
      <span className="text-gray-600">{item}</span>
    </div>
  );

  const showHistory = !searchTerm && searchHistory.length > 0 && showSuggestions;
  const showResults = searchTerm.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
            
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Rechercher des cours, séries, formateurs..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setShowSuggestions(true);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100'
              }`}
            >
              <Filter size={20} />
            </button>
          </div>
          
          {/* Search Suggestions */}
          {showHistory && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">Recherches récentes</h3>
                  <button
                    onClick={clearHistory}
                    className="text-sm text-purple-600 hover:text-purple-800"
                  >
                    Effacer
                  </button>
                </div>
                <div className="space-y-1">
                  {searchHistory.map((item: string, index: number) => (
                    <HistoryItem key={`history-${index}`} item={item} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Catégories */}
          {!showHistory && (
            <div className="mt-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                      selectedCategory === category.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {showResults && (
          <>
            {/* Séries */}
            {filteredPlaylists.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Séries de cours</h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredPlaylists.slice(0, 8).map((playlist: Playlist) => (
                    <PlaylistCard key={playlist.id} playlist={playlist} />
                  ))}
                </div>
              </div>
            )}

            {/* Formateurs */}
            {filteredTeachers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Formateurs</h2>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTeachers.slice(0, 3).map((teacher: Teacher) => (
                    <TeacherCard key={teacher.uid} teacher={teacher} />
                  ))}
                </div>
              </div>
            )}

            {/* Cours */}
            <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {loading ? 'Recherche...' : `${filteredCourses.length} cours`}
            </h2>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : filteredCourses.length > 0 ? (
                <>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {pagedCourses.map((course: Course) => (
                      <CourseCard key={course.id} course={course} />
                    ))}
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-8">
                      <button
                        onClick={() => currentPage > 0 && setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 0}
                        className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Précédent
                      </button>
                      <span className="text-gray-600">
                        Page {currentPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => currentPage < totalPages - 1 && setCurrentPage(currentPage + 1)}
                        disabled={currentPage >= totalPages - 1}
                        className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Suivant
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <Search size={48} className="mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun résultat trouvé</h3>
                  <p className="text-gray-600">Essayez d'autres mots-clés ou modifiez les filtres</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Suggestions (pas de recherche) */}
        {!showResults && !showHistory && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cours et séries populaires</h2>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {allCourses.slice(0, 20).map((course: Course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
