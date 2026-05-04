import React from 'react';

const SchoolLogo = ({ size = 'md', withText = false, className = '' }) => {
  const logoSrc = `${import.meta.env.BASE_URL}kcs.jpg`;
  const sizes = {
    sm: 'h-9 w-9',
    md: 'h-12 w-12',
    lg: 'h-20 w-20',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${sizes[size]} brand-logo shrink-0 overflow-hidden rounded-full`}>
        <img src={logoSrc} alt="Kinshasa Christian School" className="h-full w-full object-cover" />
      </div>
      {withText && (
        <div className="min-w-0">
          <p className="font-display text-sm font-bold uppercase text-slate-50">Kinshasa Christian School</p>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-kcs-blue">KCS</p>
        </div>
      )}
    </div>
  );
};

export default SchoolLogo;
