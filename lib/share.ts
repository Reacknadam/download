// URL du Worker Cloudflare pour les liens publics
const WORKER_URL = 'https://jimmy-school.jimmyokoko57.workers.dev';

export interface ShareData {
  title: string;
  description?: string;
  price?: number;
  teacherName?: string;
  thumbnailUrl?: string;
  viewCount?: number;
  courseCount?: number;
}

// Génère l'URL de partage pour un cours
export const generateCourseShareLink = (courseId: string, data?: Partial<ShareData>): string => {
  return `${WORKER_URL}/course/${courseId}`;
};

// Génère l'URL de partage pour une série
export const generatePlaylistShareLink = (playlistId: string, data?: Partial<ShareData>): string => {
  return `${WORKER_URL}/playlist/${playlistId}`;
};

// Partage un cours
export const shareCourse = async (courseId: string, data: ShareData) => {
  const url = generateCourseShareLink(courseId, data);
  const message = `Regarde ce cours intéressant : "${data.title}" sur Jimmy! ${url}`;
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: data.title,
        text: message,
        url: url
      });
      return true;
    } catch (error) {
      console.error('Erreur partage:', error);
      return false;
    }
  } else {
    // Fallback : copier dans le presse-papiers
    try {
      await navigator.clipboard.writeText(message);
      alert('Lien copié dans le presse-papiers!');
      return true;
    } catch (error) {
      console.error('Erreur clipboard:', error);
      return false;
    }
  }
};

// Partage une série
export const sharePlaylist = async (playlistId: string, data: ShareData) => {
  const url = generatePlaylistShareLink(playlistId, data);
  const message = `Regarde cette série de cours : "${data.title}" sur Jimmy! ${url}`;
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: data.title,
        text: message,
        url: url
      });
      return true;
    } catch (error) {
      console.error('Erreur partage:', error);
      return false;
    }
  } else {
    // Fallback : copier dans le presse-papiers
    try {
      await navigator.clipboard.writeText(message);
      alert('Lien copié dans le presse-papiers!');
      return true;
    } catch (error) {
      console.error('Erreur clipboard:', error);
      return false;
    }
  }
};
