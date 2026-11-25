import React, { useState } from 'react';

interface UserAvatarProps {
  src?: string | null;
  alt?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const FAVICON_URL = '/file/7/aiicon.png';

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  alt = 'Аватар пользователя',
  className = '',
  size = 'md'
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };

  const isInvalidSrc = !src || src.trim() === '' || src.includes('undefined') || src.includes('null');

  const avatarSrc = (hasError || isInvalidSrc) ? FAVICON_URL : src;

  return (
    <img
      src={avatarSrc}
      alt={alt}
      className={`rounded-full object-cover border-2 border-gold/40 shadow-sm shrink-0 ${sizeClasses[size]} ${className}`}
      onError={() => {
        if (!hasError) setHasError(true);
      }}
      referrerPolicy="no-referrer"
    />
  );
};


