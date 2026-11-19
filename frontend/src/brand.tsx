import { useId } from 'react';

/** The shared Prepora spark mark used by the wordmark and loading states. */
export function PreporaSpark({ className = 'size-8', animated = false }: { className?: string; animated?: boolean }) {
  const gradientId = `prepora-spark-${useId().replace(/:/g, '')}`;
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center ${className}`}>
      <svg viewBox="0 0 48 48" className="size-[90%] overflow-visible">
        <g className={animated ? 'prepora-spark-spin' : undefined}>
          <defs>
            <linearGradient id={gradientId} x1="10" y1="5" x2="38" y2="44" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F2D76E" />
              <stop offset="0.56" stopColor="#F4A84E" />
              <stop offset="1" stopColor="#E97545" />
            </linearGradient>
          </defs>
          <path d="M24 2.5C27.2 14.2 33.8 20.8 45.5 24 33.8 27.2 27.2 33.8 24 45.5 20.8 33.8 14.2 27.2 2.5 24 14.2 20.8 20.8 14.2 24 2.5Z" fill={`url(#${gradientId})`} />
          <path d="M24 8.5C26.4 17.6 30.4 21.6 39.5 24 30.4 26.4 26.4 30.4 24 39.5 21.6 30.4 17.6 26.4 8.5 24 17.6 21.6 21.6 17.6 24 8.5Z" fill="#FFD777" fillOpacity=".48" />
        </g>
      </svg>
    </span>
  );
}
