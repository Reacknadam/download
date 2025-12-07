import React from 'react';
import { Course } from '../types';
import { Star, PlayCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CourseCardProps {
  course: Course;
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  return (
    <Link to={`/course/${course.id}`} className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-video w-full overflow-hidden bg-gray-200">
        <img
          src={course.thumbnailUrl}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {course.isNew && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            Nouveau
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
            <PlayCircle className="ml-1 h-6 w-6 text-primary" />
          </div>
        </div>
      </div>
      
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase text-primary/80">{course.category}</span>
          <div className="flex items-center gap-1 text-amber-500">
            <Star size={12} fill="currentColor" />
            <span className="text-xs font-medium">{course.rating}</span>
          </div>
        </div>
        
        <h3 className="mb-1 line-clamp-2 flex-1 text-sm font-bold text-gray-900 leading-snug">
          {course.title}
        </h3>
        
        <p className="mb-3 text-xs text-gray-500">Par {course.teacherName}</p>
        
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Users size={12} />
            <span className="text-[10px]">{course.viewCount.toLocaleString()} vues</span>
          </div>
          <span className="text-sm font-bold text-primary">
            {course.price === 0 ? 'Gratuit' : `${course.price.toFixed(2)} $`}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default CourseCard;