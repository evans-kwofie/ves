import * as React from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { CalendarDaysIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export type { DateRange } from "react-day-picker";

export function DateRangePicker({ value, onChange, className, placeholder = "Select dates" }: { value?: DateRange; onChange: (range: DateRange | undefined) => void; className?: string; placeholder?: string }) {
  const [open, setOpen] = React.useState(false);
  const [selection, setSelection] = React.useState<DateRange | undefined>(value);

  React.useEffect(() => {
    setSelection(value);
  }, [value?.from?.getTime(), value?.to?.getTime()]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setSelection(value);
  }

  const label = value?.from ? `${formatDate(value.from)}${value.to ? ` – ${formatDate(value.to)}` : ""}` : placeholder;
  return <Popover open={open} onOpenChange={handleOpenChange}>
    <PopoverTrigger render={<Button variant="outline" className={cn("min-w-52 justify-start font-normal", !value?.from && "text-muted-foreground", className)}><CalendarDaysIcon />{label}</Button>} />
    <PopoverContent align="end" className="w-auto p-3">
      <div className="mb-3 flex gap-1 border-b pb-3">
        {[7, 30, 90].map((days) => <Button key={days} size="xs" variant="ghost" onClick={() => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - (days - 1)); onChange({ from, to }); setOpen(false); }}>Last {days} days</Button>)}
      </div>
      <DayPicker mode="range" selected={selection} onSelect={(range) => { setSelection(range); if (range?.from && range.to) { onChange(range); setOpen(false); } }} numberOfMonths={2} showOutsideDays className="text-sm" classNames={{ months: "flex gap-5", month: "space-y-3", caption: "flex items-center justify-center pt-1", caption_label: "text-sm font-medium", nav: "flex items-center gap-1", button_previous: "absolute left-1 top-1", button_next: "absolute right-1 top-1", month_caption: "relative flex h-7 items-center justify-center", weekdays: "flex", weekday: "w-9 text-center text-xs font-normal text-muted-foreground", week: "mt-1 flex w-full", day: "relative size-9 p-0 text-center", day_button: "size-9 rounded-md text-sm hover:bg-muted aria-selected:bg-primary aria-selected:text-primary-foreground", selected: "", range_start: "rounded-l-md bg-primary text-primary-foreground", range_end: "rounded-r-md bg-primary text-primary-foreground", range_middle: "rounded-none bg-muted", today: "font-semibold text-primary", outside: "text-muted-foreground opacity-40", disabled: "opacity-40" }} />
    </PopoverContent>
  </Popover>;
}

function formatDate(date: Date) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date); }
