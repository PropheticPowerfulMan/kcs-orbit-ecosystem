import React from 'react';
import { Search } from 'lucide-react';

const defaultInputClass = 'w-full rounded-xl border border-github-border bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none focus:border-kcs-blue';

const SearchField = ({ value, onChange, placeholder, className = '', inputClassName = '', ...props }) => (
  <label className={`relative block ${className}`.trim()}>
    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange?.(event)}
      placeholder={placeholder}
      className={`${defaultInputClass} ${inputClassName}`.trim()}
      {...props}
    />
  </label>
);

export default SearchField;