import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { COUNTRIES, displayCountry } from "@/lib/countries";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function CountrySelect({ value, onChange, placeholder = "选择国家/地区" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const s = search.toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.code.toLowerCase().includes(s) ||
        c.flag === s
    );
  }, [search]);

  const selectedLabel = value ? displayCountry(value) : placeholder;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content focus:outline-none focus:border-brand/30 flex items-center justify-between transition-colors hover:border-line"
      >
        <span className={value ? "text-content" : "text-faint"}>{selectedLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-elevated border border-line rounded-xl shadow-2xl overflow-hidden" style={{ maxHeight: "320px" }}>
          {/* Search input */}
          <div className="sticky top-0 bg-elevated border-b border-line p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索国家/地区..."
                className="w-full bg-base border border-line rounded-lg pl-8 pr-7 py-1.5 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); inputRef.current?.focus(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-content"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto" style={{ maxHeight: "260px" }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-faint">未找到匹配的国家/地区</div>
            ) : (
              filtered.map((c) => {
                const optionValue = `${c.flag}-${c.code}-${c.name}`;
                const isSelected = value === optionValue;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onChange(optionValue);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors hover:bg-hover ${
                      isSelected ? "bg-lime/10 text-brand" : "text-content"
                    }`}
                  >
                    <span className="text-sm">{c.flag}</span>
                    <span className="text-faint w-7 flex-shrink-0">{c.code}</span>
                    <span className="truncate">{c.name}</span>
                    {isSelected && <span className="ml-auto text-brand">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
