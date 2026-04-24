import { LegalDocLayout } from "@/components/legal/LegalDocLayout";
import { SITE_LEGAL_NAME, SITE_SUPPORT_EMAIL } from "@/lib/siteLegal";

export default function LegalPrivacyPage() {
  const mail = `mailto:${SITE_SUPPORT_EMAIL}`;
  return (
    <LegalDocLayout title="Política de privacidade">
      <p className="lead text-muted-foreground text-base not-prose mb-8">
        Última actualização: Abril de 2026. Esta política descreve como o serviço{" "}
        <strong className="text-foreground">{SITE_LEGAL_NAME}</strong> trata dados pessoais dos utilizadores da
        plataforma (afiliados e equipas). Os textos legais das <em>suas</em> presells dirigidas ao público final são da
        sua responsabilidade e configuráveis na página.
      </p>

      <h2>1. Responsável pelo tratamento</h2>
      <p>
        O responsável pelo tratamento dos dados associados à sua conta na plataforma é a entidade que opera este
        serviço (<strong>{SITE_LEGAL_NAME}</strong>). Para exercer os seus direitos ou questões de privacidade, contacte:{" "}
        <a href={mail} className="text-primary underline underline-offset-2">
          {SITE_SUPPORT_EMAIL}
        </a>
        .
      </p>
      <p className="text-sm text-muted-foreground">
        Se a sua organização tiver nome legal, sede e NIPC distintos, deve actualizar o texto no site e as variáveis
        públicas de contacto para refletir esses dados.
      </p>

      <h2>2. Que dados tratamos</h2>
      <ul>
        <li>
          <strong>Dados de conta:</strong> e-mail, nome, palavra-passe (armazenada de forma segura), identificador de
          sessão, e opcionalmente ligação a login Google quando activo.
        </li>
        <li>
          <strong>Dados de utilização:</strong> páginas presell, eventos de clique/impressão/conversão, registos
          técnicos necessários ao funcionamento do tracking e integrações que activar.
        </li>
        <li>
          <strong>Conteúdo que introduz:</strong> textos, imagens, URLs, códigos de tracking, domínios personalizados e
          configurações de integrações (ex.: Telegram, redes de anúncios quando configuradas).
        </li>
        <li>
          <strong>Dados de pagamento de subscrição:</strong> quando aplicável, o pagamento de planos pagos pode
          processar-se noutra plataforma (ex.: Hotmart); os dados de cartão tratam-se nessa plataforma, não no
          Clickora.
        </li>
      </ul>

      <h2>3. Finalidades e bases legais</h2>
      <p>Tratamos dados para:</p>
      <ul>
        <li>Prestação do serviço contratado ou em teste (execução de contrato / medidas pré-contratuais);</li>
        <li>Cumprimento de obrigações legais (ex.: faturação, se aplicável);</li>
        <li>Interesse legítimo em segurança, prevenção de abuso e melhoria do serviço, quando compatível com os seus
          direitos;</li>
        <li>Consentimento, quando recolhermos dados com base em consentimento explícito (ex.: registo com aceitação
          de termos).
        </li>
      </ul>

      <h2>4. Conservação</h2>
      <p>
        Conservamos os dados enquanto a sua conta estiver activa ou for necessário para as finalidades acima. Após
        eliminação da conta, apagamos ou anonimizamos os dados associados à conta nesta instalação, salvo quando a lei
        exija conservação (ex.: obrigações contabilísticas ou litígio).
      </p>

      <h2>5. Subcontratados e transferências</h2>
      <p>
        O serviço pode utilizar infra-estrutura em nuvem (alojamento, base de dados, entrega de e-mail) e integrações
        que escolher (redes de anúncios, mensagens, plataformas de afiliação). Esses fornecedores podem estar dentro ou
        fora do Espaço Económico Europeu; aplicam-se salvaguardas adequadas (incluindo cláusulas-tipo, quando
        relevante).
      </p>

      <h2>6. Os seus direitos (LGPD / RGPD)</h2>
      <p>Tem direito a solicitar:</p>
      <ul>
        <li>Acesso aos dados pessoais associados à sua conta;</li>
        <li>Rectificação de dados incorrectos;</li>
        <li>Eliminação (&quot;direito a ser esquecido&quot;), quando aplicável;</li>
        <li>Limitação ou oposição ao tratamento, em certas circunstâncias;</li>
        <li>Portabilidade dos dados que forneceu, num formato estruturado (exportação disponível na área de conta).</li>
      </ul>
      <p>
        Pode descarregar uma cópia dos metadados da sua conta em{" "}
        <strong>Conta → Dados e privacidade</strong>, após iniciar sessão. Para outros pedidos, use o contacto acima.
      </p>

      <h2>7. Cookies e presells públicas</h2>
      <p>
        As páginas presell públicas podem incluir modais de cookies ou gates configurados por si. O visitante final
        interage com políticas e ferramentas que você define; recomendamos indicar um link para a sua política de
        cookies/privacidade quando usar o tipo &quot;cookies&quot; ou tracking de terceiros.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Aplicamos medidas técnicas e organizativas adequadas (incluindo HTTPS, segregação de contas, e boas práticas
        de armazenamento de credenciais). Nenhum sistema é isento de risco; notifique-nos de imediato qualquer suspeita
        de acesso indevido através do contacto indicado.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Podemos actualizar esta política; a data no topo indica a revisão corrente. Alterações relevantes serão
        comunicadas por meios razoáveis (ex.: aviso no site ou por e-mail).
      </p>

      <p className="text-sm text-muted-foreground not-prose mt-12 border-t border-border pt-6">
        Documento informativo. Valide com o seu advogado conforme a sua entidade, país dos utilizadores e fluxos de
        dados.
      </p>
    </LegalDocLayout>
  );
}
