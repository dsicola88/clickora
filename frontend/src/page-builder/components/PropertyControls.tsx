import type { SpacingValue } from "../types";
import { Link2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { presellService } from "@/services/presellService";

const labelCls = "block text-[11px] font-medium text-editor-fg-muted mb-1";
const inputCls =
  "w-full rounded bg-editor-panel-2 border border-editor-border px-2 py-1.5 text-xs text-editor-fg placeholder:text-editor-fg-muted focus:outline-none focus:ring-1 focus:ring-editor-accent";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </div>
  );
}

export function TextareaField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} font-mono`}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className={inputCls}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const safe = value || "#000000";
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-editor-border bg-transparent"
        />
        <input
          type="text"
          value={value}
          placeholder="transparente"
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      </div>
    </div>
  );
}

export function SpacingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SpacingValue;
  onChange: (v: SpacingValue) => void;
}) {
  const [linked, setLinked] = useState(
    value.top === value.right && value.right === value.bottom && value.bottom === value.left,
  );

  const update = (key: keyof SpacingValue, n: number) => {
    if (linked) {
      onChange({ ...value, top: n, right: n, bottom: n, left: n });
    } else {
      onChange({ ...value, [key]: n });
    }
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className={`${labelCls} mb-0`}>{label}</label>
        <button
          type="button"
          onClick={() => setLinked((v) => !v)}
          className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
            linked
              ? "bg-editor-accent text-white"
              : "text-editor-fg-muted hover:text-editor-fg"
          }`}
          title={linked ? "Vincular valores" : "Desvincular valores"}
        >
          <Link2 className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {(["top", "right", "bottom", "left"] as const).map((k) => (
          <div key={k} className="flex flex-col items-center">
            <input
              type="number"
              value={value[k]}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) update(k, n);
              }}
              className={`${inputCls} text-center`}
            />
            <span className="mt-0.5 text-[9px] uppercase text-editor-fg-muted">{k[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Campo URL + upload para o servidor (presell editor manual). */
export function BuilderImageUrlField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <TextField label={label} value={value} onChange={onChange} placeholder={placeholder} />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 3 * 1024 * 1024) {
            toast.error("Imagem demasiado grande (máx. 3 MB).");
            return;
          }
          setBusy(true);
          const { data, error } = await presellService.uploadBuilderMedia(file);
          setBusy(false);
          if (error || !data?.url) {
            toast.error(error || "Falha no upload.");
            return;
          }
          onChange(data.url);
          toast.success("Imagem carregada.");
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded border border-editor-border bg-editor-panel-2 px-2 py-1.5 text-[11px] font-medium text-editor-fg transition-colors hover:bg-editor-border disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5 shrink-0" />
        {busy ? "A enviar…" : "Carregar do PC"}
      </button>
    </div>
  );
}
