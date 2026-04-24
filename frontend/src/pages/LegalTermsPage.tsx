import { Link } from "react-router-dom";
import { LegalDocLayout } from "@/components/legal/LegalDocLayout";
import { SITE_LEGAL_NAME, SITE_SUPPORT_EMAIL } from "@/lib/siteLegal";

export default function LegalTermsPage() {
  const mail = `mailto:${SITE_SUPPORT_EMAIL}`;
  return (
    <LegalDocLayout title="Termos de utilização">
      <p className="lead text-muted-foreground text-base not-prose mb-8">
        Última actualização: Abril de 2026. Ao criar conta ou utilizar <strong className="text-foreground">{SITE_LEGAL_NAME}</strong>, aceita
        estes termos. Se não concordar, não utilize o serviço.
      </p>

      <h2>1. Objeto</h2>
      <p>
        O Clickora é uma plataforma de software para criação de páginas de pré-venda (presells), tracking de
        campanhas, integrações com redes de afiliação e ferramentas de marketing. O serviço é prestado &quot;como
        está&quot;, com esforço comercial razoável de disponibilidade e segurança.
      </p>

      <h2>2. Conta e credenciais</h2>
      <p>
        É responsável pela exactidão dos dados de registo e pela confidencialidade da palavra-passe. Qualquer actividade
        realizada com as suas credenciais presume-se feita por si. Notifique-nos em{" "}
        <a href={mail} className="text-primary underline underline-offset-2">
          {SITE_SUPPORT_EMAIL}
        </a>{" "}
        em caso de uso não autorizado.
      </p>

      <h2>3. Planos, trial e pagamentos</h2>
      <p>
        Os planos gratuitos ou de teste têm os limites indicados na aplicação. Planos pagos podem ser vendidos através
        de parceiro externo (ex.: Hotmart); nesse caso aplicam-se também os termos desse parceiro. O acesso pago é
        activado após confirmação do parceiro (ex.: webhook de compra aprovada).
      </p>

      <h2>4. Uso aceitável</h2>
      <p>Concorda em não utilizar o serviço para:</p>
      <ul>
        <li>Violar leis aplicáveis ou direitos de terceiros;</li>
        <li>Distribuir malware, phishing ou conteúdo enganador grave;</li>
        <li>Tentar aceder a dados ou contas de outros utilizadores;</li>
        <li>Sobrecarregar ou testar a segurança da infra-estrutura sem autorização;</li>
        <li>Revender ou partilhar o acesso de forma que viole o plano contratado.</li>
      </ul>
      <p>
        Podemos suspender ou encerrar contas em caso de violação grave ou risco para a plataforma ou terceiros.
      </p>

      <h2>5. Conteúdo e conformidade do afiliado</h2>
      <p>
        O conteúdo das suas presells, links de afiliado e cumprimento das regras das redes (Hotmart, Meta, Google,
        etc.) é da sua exclusiva responsabilidade. Deve respeitar publicidade comparativa, saúde, menores, e regras
        específicas de cada rede e jurisdição onde anuncia.
      </p>

      <h2>6. Propriedade intelectual</h2>
      <p>
        O software, marca e materiais da plataforma pertencem aos respectivos titulares. Conserva a propriedade do
        conteúdo que carregar; concede uma licença limitada para o armazenamento e processamento necessários à prestação
        do serviço.
      </p>

      <h2>7. Limitação de responsabilidade</h2>
      <p>
        Na medida permitida pela lei aplicável, não respondemos por lucros cessantes, perda de dados por culpa
        exclusiva do utilizador, ou danos indirectos. A responsabilidade total por falhas do serviço, em cada período
        de 12 meses, fica limitada ao que for mandatório legalmente ou, na sua ausência, ao valor pago por si ao
        operador do serviço nos últimos 12 meses (ou zero se só usar plano gratuito).
      </p>

      <h2>8. Disponibilidade e alterações do serviço</h2>
      <p>
        Podemos modificar funcionalidades, limites ou estes termos. Continuar a usar o serviço após aviso razoável
        constitui aceitação das alterações essenciais, salvo direito de resolver quando a lei o exija.
      </p>

      <h2>9. Lei aplicável e litígios</h2>
      <p>
        Salvo norma imperativa em contrário, estes termos regem-se pela lei aplicável à entidade operadora que indicar
        publicamente. Para litígios, competem os tribunais da mesma jurisdição, sem prejuízo de meios alternativos de
        resolução de conflitos.
      </p>

      <h2>10. Privacidade</h2>
      <p>
        O tratamento de dados pessoais descreve-se na{" "}
        <Link to="/privacidade" className="text-primary underline underline-offset-2">
          Política de privacidade
        </Link>
        .
      </p>

      <p className="text-sm text-muted-foreground not-prose mt-12 border-t border-border pt-6">
        Documento informativo. Ajuste jurisdição, entidade e limites de responsabilidade com assessoria jurídica.
      </p>
    </LegalDocLayout>
  );
}
