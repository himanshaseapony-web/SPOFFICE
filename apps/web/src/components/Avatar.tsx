import { useMemo } from 'react'

type AvatarProps = {
  displayName?: string
  email?: string
  profileImageUrl?: string
  size?: 'small' | 'medium' | 'large'
  className?: string
}

const sizeClasses = {
  small: { container: '1.5rem', text: '0.7rem' },
  medium: { container: '2.2rem', text: '0.8rem' },
  large: { container: '3rem', text: '1rem' },
}

export function Avatar({ displayName, email, profileImageUrl, size = 'medium', className = '' }: AvatarProps) {
  const initials = useMemo(() => {
    const source = displayName ?? email ?? ''
    return source
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'US'
  }, [displayName, email])

  const sizeConfig = sizeClasses[size]

  if (profileImageUrl) {
    return (
      <img
        src={profileImageUrl}
        alt={displayName || email || 'User'}
        className={className}
        style={{
          width: sizeConfig.container,
          height: sizeConfig.container,
          borderRadius: '0.75rem',
          objectFit: 'cover',
          display: 'block',
        }}
        onError={(e) => {
          // Fallback to initials if image fails to load
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent) {
            const fallback = document.createElement('span')
            fallback.textContent = initials
            fallback.style.cssText = `
              width: ${sizeConfig.container};
              height: ${sizeConfig.container};
              border-radius: 0.75rem;
              background: var(--accent-subtle);
              color: var(--accent-strong);
              display: grid;
              place-items: center;
              font-weight: 600;
              font-size: ${sizeConfig.text};
            `
            parent.appendChild(fallback)
          }
        }}
      />
    )
  }

  return (
    <span
      className={className}
      style={{
        width: sizeConfig.container,
        height: sizeConfig.container,
        borderRadius: '0.75rem',
        background: 'var(--accent-subtle)',
        color: 'var(--accent-strong)',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 600,
        fontSize: sizeConfig.text,
      }}
    >
      {initials}
    </span>
  )
}

