import type { InputHTMLAttributes } from 'react'
import { Search } from 'lucide-react'

type SearchFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string
  inputClassName?: string
}

const SearchField = ({ wrapperClassName = '', inputClassName = '', type = 'search', ...props }: SearchFieldProps) => {
  return (
    <label className={`relative block ${wrapperClassName}`.trim()}>
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
      <input type={type} className={`input-kcs pl-11 ${inputClassName}`.trim()} {...props} />
    </label>
  )
}

export default SearchField