import { useState, type ChangeEvent, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value?: string
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
}

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

export default function DateSelect({ value, onChange, className = '', required, disabled, min, max, ...props }: Props) {
  const [internalValue, setInternalValue] = useState('')
  const [year = '', month = '', day = ''] = String(value || internalValue).slice(0, 10).split('-')
  const currentYear = new Date().getFullYear()
  const minYear = Number(String(min || '').slice(0, 4)) || 1900
  const maxYear = Number(String(max || '').slice(0, 4)) || currentYear + 10
  const years = Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, index) => String(maxYear - index))
  const dayCount = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31
  const emit = (nextYear: string, nextMonth: string, nextDay: string) => {
    const nextValue = nextYear && nextMonth && nextDay ? `${nextYear}-${nextMonth}-${nextDay.padStart(2, '0')}` : ''
    setInternalValue(`${nextYear}-${nextMonth}-${nextDay}`)
    onChange?.({ target: { value: nextValue, name: props.name } } as ChangeEvent<HTMLInputElement>)
  }
  const selectClass = `${className} min-w-0 flex-1 bg-white dark:bg-kcs-blue-950`
  return <span className="flex w-full gap-2" data-date-select {...(props['aria-label'] ? { 'aria-label': props['aria-label'] } : {})}>
    <select aria-label="Jour" value={day} required={required} disabled={disabled} className={selectClass} onChange={(event) => emit(year, month, event.target.value)}><option value="">Jour</option>{Array.from({ length: dayCount }, (_, index) => String(index + 1).padStart(2, '0')).map((item) => <option key={item} value={item}>{item}</option>)}</select>
    <select aria-label="Mois" value={month} required={required} disabled={disabled} className={selectClass} onChange={(event) => emit(year, event.target.value, day)}><option value="">Mois</option>{MONTHS.map((label, index) => <option key={label} value={String(index + 1).padStart(2, '0')}>{label}</option>)}</select>
    <select aria-label="Année" value={year} required={required} disabled={disabled} className={selectClass} onChange={(event) => emit(event.target.value, month, day)}><option value="">Année</option>{years.map((item) => <option key={item}>{item}</option>)}</select>
  </span>
}
