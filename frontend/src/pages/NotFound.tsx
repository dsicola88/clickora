import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

const NotFound = () => {
  const location = useLocation();
  const { t } = useAppLocale();

  useEffect(() => {
    console.warn("[404]", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t("pages.notFound.title")}</p>
        <p className="mb-4 text-sm text-muted-foreground">{t("pages.notFound.subtitle")}</p>
        <Link to="/inicio" className="text-primary underline hover:text-primary/90">
          {t("pages.notFound.home")}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
