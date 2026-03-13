import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const currentYear = new Date().getFullYear()
const years = Array.from({ length: currentYear - 1949 }, (_, i) =>
  String(currentYear - i)
)

export function CTAYearPicker({
  value,
  onChange,
}: {
  value?: string
  onChange: (year: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select graduation year" />
      </SelectTrigger>
      <SelectContent>
        {years.map((year) => (
          <SelectItem key={year} value={year}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}