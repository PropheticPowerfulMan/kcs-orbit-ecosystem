import React from 'react';

const StatCard = ({ title, value, subtitle, accent = 'text-teal-300' }) => {
  return (
    <div className="kpi-tile page-enter">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</p>
      <p className={`mt-2 text-3xl font-display font-bold ${accent}`}>{value}</p>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
    </div>
  );
};

export default StatCard;
