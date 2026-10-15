import { LegalDocLayout } from "@/components/legal/LegalDocLayout";
import { SITE_LEGAL_NAME, SITE_SUPPORT_EMAIL } from "@/lib/siteLegal";

/**
 * Isenção médica real e genérica (não inventa benefícios de produto).
 * Exigida em páginas de bem-estar / suplementos para transparência Ads.
 */
export default function LegalMedicalDisclaimerPage() {
  const mail = `mailto:${SITE_SUPPORT_EMAIL}`;
  return (
    <LegalDocLayout title="Aviso de isenção médica">
      <p className="lead text-muted-foreground text-base not-prose mb-8">
        Última actualização: Outubro de 2026. Este aviso aplica-se a conteúdos informativos
        publicados através da plataforma <strong className="text-foreground">{SITE_LEGAL_NAME}</strong>{" "}
        e às páginas de oferta (presells) dos operadores.
      </p>

      <h2>1. Conteúdo informativo</h2>
      <p>
        Os textos, imagens e ligações apresentados nas páginas de oferta têm carácter informativo e
        comercial. <strong>Não constituem aconselhamento médico, nutricional, farmacêutico nem
        jurídico</strong>. Não substituem consulta com profissional de saúde qualificado.
      </p>

      <h2>2. Produtos e alegações</h2>
      <p>
        Qualquer informação sobre composição, modo de uso, contraindicações, resultados ou
        benefícios deve ser confirmada exclusivamente no site oficial do comerciante e no rótulo /
        bula do produto. A plataforma e os operadores das presells <strong>não inventam</strong>{" "}
        alegações de saúde e não garantem resultados.
      </p>

      <h2>3. Relação de afiliado</h2>
      <p>
        As páginas podem conter ligações de afiliado. Se efectuar uma compra através desses links,
        o operador da página poderá receber uma comissão, sem custo adicional para si. Isso não
        altera o facto de o pagamento e o cumprimento do contrato serem da responsabilidade do
        vendedor.
      </p>

      <h2>4. Contacto</h2>
      <p>
        Questões sobre este aviso ou sobre a plataforma:{" "}
        <a href={mail} className="text-primary underline underline-offset-2">
          {SITE_SUPPORT_EMAIL}
        </a>
        . Questões sobre um produto concreto devem ser dirigidas ao fabricante ou ao suporte do
        site da oferta.
      </p>
    </LegalDocLayout>
  );
}
