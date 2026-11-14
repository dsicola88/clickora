import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useCallback, useEffect, useState } from "react";
import { applyMarketingAuthHead } from "@/lib/marketingSiteSeo";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { postAuthPathFromLocationState } from "@/lib/postAuthRedirect";
import {
  pathAllowsInactiveSubscription,
  userHasSubscriptionAccess,
} from "@/lib/subscriptionAccess";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/FieldError";
import { Zap, Mail, Lock, User, ArrowLeft, Building2 } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { toast } from "sonner";
import { loginSchema, registerSchema, recoverySchema, type LoginForm, type RegisterForm, type RecoveryForm } from "@/lib/validations";

type AuthMode = "login" | "register" | "recovery";

function MfaVerifyForm({
  email,
  mfaToken,
  onSuccess,
  onBack,
}: {
  email: string;
  mfaToken: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const { t } = useAppLocale();
  const { verifyMfa } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      toast.error(t("auth.mfaTooShort"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await verifyMfa(mfaToken, trimmed);
      if (error) throw new Error(error);
      toast.success(t("auth.sessionStarted"));
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("auth.mfaWrong");
      toast.error(message);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground text-pretty">
        {fill(t("auth.mfaIntro"), { email })}
      </p>
      <div className="space-y-2">
        <Label htmlFor="mfa-code">{t("auth.mfaCode")}</Label>
        <Input
          id="mfa-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          disabled={loading}
          maxLength={32}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading || code.trim().length < 6}>
        {loading ? t("auth.verifying") : t("auth.verifyEnter")}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
      >
        <ArrowLeft className="h-3 w-3" /> {t("auth.backToLogin")}
      </button>
    </form>
  );
}

function LoginFormComponent({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useAppLocale();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mfa, setMfa] = useState<{ mfa_token: string; email: string } | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
  });

  const onSubmit = async (values: LoginForm) => {
    setLoading(true);
    try {
      const result = await signIn(values.email, values.password);
      if (result.error) throw new Error(result.error);
      if (result.mfa) {
        setMfa(result.mfa);
        toast.message(t("auth.mfaContinue"));
        return;
      }
      toast.success(t("auth.sessionStarted"));
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("auth.loginFailed");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (mfa) {
    return (
      <MfaVerifyForm
        email={mfa.email}
        mfaToken={mfa.mfa_token}
        onSuccess={onSuccess}
        onBack={() => setMfa(null)}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            className={`pl-10 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
            {...register("email")}
          />
        </div>
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className={`pl-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
            {...register("password")}
          />
        </div>
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("auth.loading") : t("auth.submit")}
      </Button>
    </form>
  );
}

function RegisterFormComponent({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useAppLocale();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
  });

  const onSubmit = async (values: RegisterForm) => {
    if (!acceptedPolicies) {
      toast.error(t("auth.acceptRequired"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(values.email, values.password, values.fullName, true);
      if (error) throw new Error(error);
      toast.success(t("auth.accountCreated"));
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("auth.registerFailed");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t("auth.fullName")}</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="fullName"
            placeholder={t("auth.namePlaceholder")}
            className={`pl-10 ${errors.fullName ? "border-destructive focus-visible:ring-destructive" : ""}`}
            {...register("fullName")}
          />
        </div>
        <FieldError message={errors.fullName?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            className={`pl-10 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
            {...register("email")}
          />
        </div>
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className={`pl-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
            {...register("password")}
          />
        </div>
        <FieldError message={errors.password?.message} />
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="accept-policies"
          checked={acceptedPolicies}
          onCheckedChange={(v) => setAcceptedPolicies(v === true)}
        />
        <label htmlFor="accept-policies" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
          {t("auth.acceptLead")}{" "}
          <Link to="/termos" className="underline underline-offset-2 hover:text-foreground">
            {t("auth.terms")}
          </Link>{" "}
          {t("auth.acceptMid")}{" "}
          <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground">
            {t("auth.privacyPolicy")}
          </Link>
          .
        </label>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("auth.processing") : t("auth.register")}
      </Button>
    </form>
  );
}

function RecoveryFormComponent() {
  const { t } = useAppLocale();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<RecoveryForm>({
    resolver: zodResolver(recoverySchema),
    mode: "onTouched",
  });

  const onSubmit = async (values: RecoveryForm) => {
    setLoading(true);
    try {
      const { error } = await authService.resetPassword(values.email);
      if (error) throw new Error(error);
      toast.success(t("auth.recoverySent"));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("auth.recoveryFailed");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            className={`pl-10 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
            {...register("email")}
          />
        </div>
        <FieldError message={errors.email?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("auth.processing") : t("auth.sendEmail")}
      </Button>
    </form>
  );
}

export default function Auth() {
  const { t } = useAppLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const { completeOidcLogin } = useAuth();
  const [searchParams] = useSearchParams();
  const trialIntent =
    searchParams.get("trial") === "1" ||
    searchParams.get("intent") === "trial";

  const [mode, setMode] = useState<AuthMode>(() => (trialIntent ? "register" : "login"));
  const [externalMfa, setExternalMfa] = useState<{ mfa_token: string; email: string } | null>(null);
  const [oidcBusy, setOidcBusy] = useState(false);

  const redirectParam = searchParams.get("redirect");
  const goAfterAuth = useCallback(() => {
    let target = postAuthPathFromLocationState(location.state, redirectParam);
    const stored = authService.getStoredUser();
    const pathOnly = target.split(/[?#]/)[0] || target;
    if (
      stored &&
      !userHasSubscriptionAccess(stored) &&
      !pathAllowsInactiveSubscription(pathOnly)
    ) {
      target = "/planos";
    }
    navigate(target, { replace: true });
  }, [location.state, redirectParam, navigate]);

  useEffect(() => {
    if (trialIntent) setMode("register");
  }, [trialIntent]);

  useEffect(() => {
    if (searchParams.get("error") !== "sso_unavailable") return;
    toast.error(t("auth.ssoUnavailable"));
    const next = new URLSearchParams(searchParams);
    next.delete("error");
    const q = next.toString();
    navigate(`/auth${q ? `?${q}` : ""}`, { replace: true });
  }, [searchParams, navigate, t]);

  useEffect(() => {
    return applyMarketingAuthHead();
  }, []);

  /** Consome `#oidc_token=…` ou `#mfa_required=1&mfa_token=…` do callback SSO. */
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;
    const hash = new URLSearchParams(raw);
    const oidcToken = hash.get("oidc_token");
    const mfaToken = hash.get("mfa_token");
    const mfaRequired = hash.get("mfa_required") === "1";
    const email = hash.get("email") || "";

    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

    if (mfaRequired && mfaToken) {
      setMode("login");
      setExternalMfa({ mfa_token: mfaToken, email: email || t("auth.yourAccount") });
      toast.message(t("auth.mfaContinue"));
      return;
    }

    if (!oidcToken) return;

    let cancelled = false;
    setOidcBusy(true);
    void (async () => {
      try {
        const { error } = await completeOidcLogin(oidcToken);
        if (cancelled) return;
        if (error) {
          toast.error(error);
          return;
        }
        toast.success(t("auth.ssoSuccess"));
        goAfterAuth();
      } finally {
        setOidcBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consumir #oidc_token uma vez no mount
  }, [completeOidcLogin, t]);

  const goInicio = goAfterAuth;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Zap className="h-4 w-4" /> dclickora
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {mode === "login" && t("auth.title")}
            {mode === "register" && (trialIntent ? t("auth.trialTitle") : t("auth.registerTitle"))}
            {mode === "recovery" && t("auth.recoveryTitle")}
          </h1>
          <p className="text-muted-foreground mt-2 text-pretty max-w-sm mx-auto">
            {mode === "login" && t("auth.loginSubtitle")}
            {mode === "register" && (trialIntent ? t("auth.trialSubtitle") : t("auth.registerSubtitle"))}
            {mode === "recovery" && t("auth.recoverySubtitle")}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
          {oidcBusy ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("auth.ssoBusy")}</p>
          ) : null}
          {mode === "login" && !oidcBusy && externalMfa ? (
            <MfaVerifyForm
              email={externalMfa.email}
              mfaToken={externalMfa.mfa_token}
              onSuccess={goInicio}
              onBack={() => setExternalMfa(null)}
            />
          ) : null}
          {mode === "login" && !oidcBusy && !externalMfa && (
            <div className="space-y-6">
              <GoogleSignInButton onSuccess={goInicio} onMfaRequired={setExternalMfa} />
              {import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ? (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t("auth.orEmail")}</span>
                  </div>
                </div>
              ) : null}
              <LoginFormComponent onSuccess={goInicio} />
              {/* SSO enterprise (Okta/Azure/…) — não confundir com Google GIS. Só com VITE_OIDC_SSO_ENABLED=1. */}
              {import.meta.env.VITE_OIDC_SSO_ENABLED === "1" ? (
                <Button type="button" variant="outline" className="w-full gap-2" asChild>
                  <a href={authService.getOidcLoginUrl()}>
                    <Building2 className="h-4 w-4" />
                    {t("auth.ssoButton")}
                  </a>
                </Button>
              ) : null}
            </div>
          )}
          {mode === "register" && <RegisterFormComponent onSuccess={goInicio} />}
          {mode === "recovery" && <RecoveryFormComponent />}

          <div className="text-center text-sm space-y-2 mt-4">
            {mode === "login" && (
              <>
                <button type="button" onClick={() => setMode("recovery")} className="text-primary hover:underline block w-full">
                  {t("auth.forgot")}
                </button>
                <p className="text-muted-foreground">
                  {t("auth.noAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/auth?trial=1", { replace: true });
                      setMode("register");
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    {t("auth.trialCta")}
                  </button>
                </p>
              </>
            )}
            {mode === "register" && (
              <p className="text-muted-foreground">
                {t("auth.hasAccount")}{" "}
                <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                  {t("chrome.signIn")}
                </button>
              </p>
            )}
            {mode === "recovery" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-primary hover:underline flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="h-3 w-3" /> {t("auth.backToLogin")}
              </button>
            )}
          </div>
        </div>
        <p className="text-center mt-6 space-y-2">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline block"
          >
            {t("auth.browsePlans")}
          </Link>
          <span className="text-xs text-muted-foreground">
            <Link to="/privacidade" className="underline-offset-2 hover:underline">
              {t("auth.privacyShort")}
            </Link>
            {" · "}
            <Link to="/termos" className="underline-offset-2 hover:underline">
              {t("auth.termsShort")}
            </Link>
          </span>
        </p>
      </div>
    </div>
  );
}
