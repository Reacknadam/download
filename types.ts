export interface User {
  uid: string;
  email: string;
  displayName?: string;
  phoneNumber?: string;
  bio?: string;
  role?: 'student' | 'teacher' | 'admin';
  isTeacherVerified?: boolean;
  photoURL?: string;
  teacherStatus?: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  teacherId: string;
  teacherName: string;
  thumbnailUrl: string;
  videoUrl?: string; // Bunny Video ID
  price: number;
  duration?: number;
  viewCount: number;
  saleCount?: number;
  isPublished?: boolean;
  category?: string;
  createdAt?: any;
  videoStatus?: 'processing' | 'ready' | 'failed';
  isNew?: boolean;
  rating?: number;
}

export interface Banner {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  link?: string;
  backgroundColor?: string;
  textColor?: string;
  isActive: boolean;
  order?: number;
}

export interface Purchase {
  id: string;
  courseId: string;
  userId: string;
  teacherId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: any;
}

export interface Wallet {
  uid: string;
  balance: number;
  totalEarned: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  teacherId: string;
  teacherName: string;
  thumbnailUrl: string;
  totalDuration?: number;
  courseCount: number;
  viewCount: number;
  saleCount?: number;
  isPublished?: boolean;
  isPublic?: boolean;
  createdAt?: any;
  price?: number;
  videos?: Array<{
    title: string;
    description: string;
    videoUrl: string;
    bunnyVideoId?: string;
    videoStatus?: 'processing' | 'ready' | 'failed';
    thumbnailUrl: string;
    duration: number;
    order: number;
  }>;
  rating?: number;
  reviewCount?: number;
}

export interface VideoProgress {
  id: string;
  userId: string;
  courseId: string;
  videoId?: string;
  currentTime: number;
  duration: number;
  completed: boolean;
  lastWatchedAt: any;
}