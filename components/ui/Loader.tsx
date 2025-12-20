import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoaderProps {
  size?: number;
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({
  size = 24,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-center min-h-screen ${className}`}>
      <Loader2 
        size={size} 
        className="animate-spin text-blue-600" 
      />
    </div>
  );
};

export default Loader;
