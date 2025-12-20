/**
 * Constantes pour l'application Jimmy School
 */

export const CATEGORY_LABELS: Record<string, string> = {
  school: 'Cours scolaires',
  university: 'Université',
  tech: 'Technologie & Informatique',
  personal_dev: 'Développement personnel',
  pro_skills: 'Compétences professionnelles',
  science: 'Sciences & vulgarisation',
  art: 'Art & créativité',
  finance: 'Finance & argent',
  kids: 'Enfants',
  business: 'Business',
  marketing: 'Marketing',
  design: 'Design',
  photography: 'Photographie',
  music: 'Musique',
  health: 'Santé & Bien-être',
  languages: 'Langues',
  sports: 'Sport',
  cooking: 'Cuisine',
  gardening: 'Jardinage',
  diy: 'Bricolage',
  other: 'Autre'
};

export const COURSE_LEVELS: Record<string, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé'
};

export const PAYMENT_STATUSES = {
  pending: 'En attente',
  completed: 'Complété',
  failed: 'Échoué',
  cancelled: 'Annulé',
  refunded: 'Remboursé'
} as const;

export const SUPPORT_CATEGORIES = {
  course: 'Problème de cours',
  payment: 'Problème de paiement',
  technical: 'Problème technique',
  other: 'Autre'
} as const;
