/**
 * Types pour les cours structurés avec sections et leçons
 * Système compatible avec Udemy/OpenClassroom
 */

export interface CourseMetadata {
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  price: number; // en cents (ex: 9999 = $99.99)
  currency: string;
  thumbnailUrl: string;
  previewVideoUrl?: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string;
  rating: number; // 0-5
  reviewCount: number;
  enrolledCount: number;
  viewCount: number;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  status: 'draft' | 'published' | 'archived';
  isFeatured?: boolean;
  tags?: string[];
}

export interface Section {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Lesson {
  id: string;
  sectionId: string;
  courseId: string;
  title: string;
  description?: string;
  type: 'video' | 'text' | 'quiz' | 'resource';
  order: number;
  duration?: number; // en secondes
  isFree?: boolean; // Aperçu gratuit
  
  // Pour type 'video'
  videoUrl?: string;
  videoDuration?: number;
  videoPreviewStart?: number; // en secondes
  videoPreviewDuration?: number; // 5 secondes par défaut
  videoThumbnailUrl?: string;
  
  // Pour type 'text'
  content?: string;
  
  // Pour type 'quiz'
  quizData?: Quiz;
  
  // Pour type 'resource'
  resourceUrl?: string;
  resourceType?: string; // 'pdf', 'doc', 'zip', etc.
  resourceSize?: number; // en bytes
  
  createdAt: number;
  updatedAt: number;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  passingScore: number; // 0-100
  timeLimit?: number; // en secondes
  allowRetake?: boolean;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[]; // Pour multiple-choice
  correctAnswer: string | number;
  explanation?: string;
  points?: number;
}

export interface UserProgress {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  completed: boolean;
  completedAt?: number;
  lastWatchedAt: number;
  watchDuration?: number; // Secondes regardées
  watchPercentage?: number; // 0-100
  notes?: string;
  quizScore?: number; // Pour les quiz
}

export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: number;
  lastAccessedAt: number;
  progressPercentage: number;
  completedLessons: number;
  totalLessons: number;
  certificateId?: string;
  certificateIssuedAt?: number;
}

export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  issuedAt: number;
  expiresAt?: number;
  verificationCode: string;
  verificationUrl: string;
}

export interface CourseReview {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number; // 1-5
  title: string;
  content: string;
  helpful: number;
  createdAt: number;
  updatedAt: number;
}

export interface CourseStats {
  courseId: string;
  totalEnrollments: number;
  totalRevenue: number; // en cents
  averageRating: number;
  totalReviews: number;
  totalViews: number;
  completionRate: number; // 0-100
  lastUpdated: number;
}

export interface TeacherStats {
  teacherId: string;
  totalCourses: number;
  totalStudents: number;
  totalRevenue: number; // en cents
  averageRating: number;
  totalReviews: number;
  totalViews: number;
  lastUpdated: number;
}

export const COURSE_CATEGORIES = [
  { id: 'school', label: 'Cours scolaires' },
  { id: 'university', label: 'Université' },
  { id: 'tech', label: 'Technologie & Informatique' },
  { id: 'personal_dev', label: 'Développement personnel' },
  { id: 'pro_skills', label: 'Compétences professionnelles' },
  { id: 'science', label: 'Sciences & vulgarisation' },
  { id: 'art', label: 'Art & créativité' },
  { id: 'finance', label: 'Finance & argent' },
  { id: 'kids', label: 'Enfants' },
] as const;

/**
 * Constantes pour les types de cours
 */
export const COURSE_LEVELS = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
} as const;

export const LESSON_TYPES = {
  video: 'Vidéo',
  text: 'Texte',
  quiz: 'Quiz',
  resource: 'Ressource',
} as const;

export const RESOURCE_TYPES = {
  pdf: 'PDF',
  doc: 'Document',
  zip: 'Archive',
  image: 'Image',
  other: 'Autre',
} as const;

export const QUIZ_TYPES = {
  'multiple-choice': 'Choix multiples',
  'true-false': 'Vrai/Faux',
  'short-answer': 'Réponse courte',
} as const;

/**
 * Utilitaires
 */
export function calculateCourseProgress(
  completedLessons: number,
  totalLessons: number
): number {
  if (totalLessons === 0) return 0;
  return Math.round((completedLessons / totalLessons) * 100);
}

export function formatPrice(cents: number, currency: string = 'USD'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(dollars);
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function calculateCompletionRate(
  completedLessons: number,
  totalLessons: number
): number {
  if (totalLessons === 0) return 0;
  return Math.round((completedLessons / totalLessons) * 100);
}
