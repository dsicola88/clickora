import { useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import { trackEvent } from "../tracking";

export interface FormField {
  id: string;
  type: "text" | "email" | "tel" | "textarea" | "number";
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface FormContent {
  fields: FormField[];
  submitText: string;
  successMessage: string;
  errorMessage: string;
  webhookUrl: string;
  redirectUrl?: string;
  fieldGap: number;
  buttonBg: string;
  buttonColor: string;
  buttonRadius: number;
  inputBg: string;
  inputBorderColor: string;
  inputRadius: number;
  labelColor: string;
}

const validators: Record<FormField["type"], (v: string) => string | null> = {
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "E-mail inválido"),
  tel: (v) => (v.replace(/\D/g, "").length >= 8 ? null : "Telefone inválido"),
  text: (v) => (v.trim().length >= 1 ? null : "Campo obrigatório"),
  textarea: (v) => (v.trim().length >= 1 ? null : "Campo obrigatório"),
  number: (v) => (!Number.isNaN(Number(v)) && v.trim() !== "" ? null : "Número inválido"),
};

export function FormWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<FormContent>;
  const fields = c.fields ?? [];
  const submitText = c.submitText ?? "Enviar";
  const successMessage = c.successMessage ?? "Recebido! Em breve entraremos em contato.";
  const errorMessage = c.errorMessage ?? "Não foi possível enviar. Tente novamente.";
  const webhookUrl = c.webhookUrl ?? "";
  const redirectUrl = c.redirectUrl ?? "";
  const fieldGap = c.fieldGap ?? 12;
  const buttonBg = c.buttonBg ?? "#e63946";
  const buttonColor = c.buttonColor ?? "#ffffff";
  const buttonRadius = c.buttonRadius ?? 6;
  const inputBg = c.inputBg ?? "#ffffff";
  const inputBorderColor = c.inputBorderColor ?? "#d0d5dd";
  const inputRadius = c.inputRadius ?? 6;
  const labelColor = c.labelColor ?? "#1a1a1a";

  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const update = (name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const next: Record<string, string> = {};
    for (const f of fields) {
      const v = values[f.name] ?? "";
      if (f.required && !v.trim()) {
        next[f.name] = "Campo obrigatório";
        continue;
      }
      if (v.trim()) {
        const err = validators[f.type]?.(v);
        if (err) next[f.name] = err;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus("submitting");
    try {
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            _meta: { source: "page-builder", submittedAt: new Date().toISOString() },
          }),
          mode: "no-cors",
        });
      }
      // Conversion event for analytics (GTM/GA4/Pixel — Lead)
      trackEvent("form_submit", {
        form_id: widget.id,
        form_name: "lead_form",
        fields: Object.keys(values),
      });
      setStatus("success");
      setValues({});
      if (redirectUrl) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 800);
      }
    } catch {
      setStatus("error");
    }
  };

  const containerStyle = stylesToCssWidgetContent(widget.styles, device);

  if (status === "success") {
    return (
      <div style={containerStyle}>
        <div
          className="rounded p-4 text-center text-sm"
          style={{ background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" }}
        >
          {successMessage}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: `${fieldGap}px`, ...containerStyle }}
    >
      {fields.length === 0 && (
        <p className="text-center text-xs text-gray-400">
          Adicione campos no painel de propriedades.
        </p>
      )}
      {fields.map((field) => (
        <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {field.label && (
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: labelColor,
              }}
            >
              {field.label}
              {field.required && <span style={{ color: "#dc2626" }}> *</span>}
            </label>
          )}
          {field.type === "textarea" ? (
            <textarea
              name={field.name}
              placeholder={field.placeholder}
              value={values[field.name] ?? ""}
              onChange={(e) => update(field.name, e.target.value)}
              rows={4}
              style={{
                background: inputBg,
                border: `1px solid ${errors[field.name] ? "#dc2626" : inputBorderColor}`,
                borderRadius: inputRadius,
                padding: "10px 12px",
                fontSize: 14,
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          ) : (
            <input
              type={field.type}
              name={field.name}
              placeholder={field.placeholder}
              value={values[field.name] ?? ""}
              onChange={(e) => update(field.name, e.target.value)}
              style={{
                background: inputBg,
                border: `1px solid ${errors[field.name] ? "#dc2626" : inputBorderColor}`,
                borderRadius: inputRadius,
                padding: "10px 12px",
                fontSize: 14,
                outline: "none",
              }}
            />
          )}
          {errors[field.name] && (
            <span style={{ fontSize: 12, color: "#dc2626" }}>{errors[field.name]}</span>
          )}
        </div>
      ))}
      {status === "error" && (
        <div
          className="rounded p-2 text-center text-xs"
          style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}
        >
          {errorMessage}
        </div>
      )}
      {fields.length > 0 && (
        <button
          type="submit"
          disabled={status === "submitting"}
          style={{
            background: buttonBg,
            color: buttonColor,
            borderRadius: buttonRadius,
            padding: "12px 24px",
            fontSize: 16,
            fontWeight: 600,
            border: "none",
            cursor: status === "submitting" ? "not-allowed" : "pointer",
            opacity: status === "submitting" ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {status === "submitting" ? "Enviando..." : submitText}
        </button>
      )}
    </form>
  );
}
