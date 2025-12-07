export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'teacher' | 'admin';
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