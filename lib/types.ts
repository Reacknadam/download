// Type definitions for the Jimmy application

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  price: number;
  currency: string;
  teacherId: string;
  teacherEmail?: string;
  teacherName?: string;
  teacherPhoto?: string;
  categories: string[];
  duration?: number;
  viewCount?: number;
  saleCount?: number;
  averageRating?: number;
  createdAt: number;
  updatedAt: number;
  published?: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  totalPrice: number;
  currency: string;
  teacherId: string;
  teacherEmail?: string;
  teacherName?: string;
  teacherPhoto?: string;
  categories: string[];
  videos: Video[];
  duration: number;
  viewCount?: number;
  saleCount?: number;
  averageRating?: number;
  createdAt: number;
  updatedAt: number;
  published?: boolean;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  duration: number;
  videoUrl: string;
  thumbnailUrl?: string;
  order: number;
  isFree?: boolean;
}

export interface KYC {
  uid: string;
  frontUrl: string;
  backUrl: string;
  selfieUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: number;
  motivation: string;
  socialLinks: string;
  reviewedAt?: number;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface Purchase {
  id: string;
  userId: string;
  courseId: string;
  teacherId: string;
  depositId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: number;
  completedAt?: number;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  phoneNumber?: string;
  bio?: string;
  photoURL?: string;
  role?: 'student' | 'teacher' | 'admin';
  isTeacherVerified?: boolean;
  createdAt: number;
  lastLoginAt?: number;
}

export interface SupportMessage {
  id: string;
  userId: string;
  userEmail?: string;
  courseId?: string;
  courseTitle?: string;
  teacherId?: string;
  teacherEmail?: string;
  source: 'course' | 'general' | 'payment';
  message: string;
  status: 'open' | 'in-progress' | 'resolved';
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface Payment {
  id: string;
  userId: string;
  userEmail?: string;
  amount: number;
  currency: string;
  type: 'course_purchase' | 'teacher_subscription';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: number;
  expiresAt?: number;
  depositId?: string;
}
