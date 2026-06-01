import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Link } from "react-router-dom";
import styles from "./Pricing.module.css";

gsap.registerPlugin(ScrollTrigger);

const plans = [
  {
    name: "Free",
    price: "Grátis",
    period: "",
    pricingYear: "",
    description: "Organize tudo manualmente, sem precisar de IA.",
    features: [
      "Dashboard, Tarefas, Agenda, Ideias",
      "Hábitos, Diário, Finanças, Memória",
      "Sem IA — operação manual",
    ],
    cta: "Começar Grátis",
    highlighted: false,
    href: "/login",
    external: false,
  },
  {
    name: "Nexus Chat",
    price: "R$39",
    period: "/mês",
    pricingYear: "ou R$392/ano",
    description: "IA completa via texto. Controle tudo por chat.",
    features: [
      "Tudo do Free",
      "Chat ilimitado com o assistente",
      "IA cria e edita Tarefas, Agenda, Ideias",
      "IA gerencia Hábitos, Diário, Finanças",
      "IA salva e recupera Memórias",
      "IA abre apps, URLs e playlists",
    ],
    cta: "Assinar Chat",
    highlighted: true,
    href: "/upgrade?plan=chat",
    external: false,
  },
  {
    name: "Nexus Voice",
    price: "R$99",
    period: "/mês",
    pricingYear: "ou R$992/ano",
    description: "Controle por voz. Diga \"Olá, Nexus\" e pronto.",
    features: [
      "Tudo do Nexus Chat",
      "Wake word \"Olá, Nexus\"",
      "Todos os comandos por voz",
      "Respostas em áudio natural (pt-BR)",
      "Acesso antecipado a novas features",
      "Suporte prioritário",
    ],
    cta: "Assinar Voice",
    highlighted: false,
    href: "/upgrade?plan=voice",
    external: false,
  },
];

export default function Pricing() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from(`.${styles.heading}`, {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: `.${styles.heading}`,
          start: "top 85%",
        },
      });

      gsap.from(`.${styles.card}`, {
        y: 60,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: `.${styles.cards}`,
          start: "top 80%",
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} id="pricing" className={styles.pricing}>
      <div className={styles.container}>
        <div className={styles.heading}>
          <span className={styles.label}>Planos</span>
          <h2 className={styles.title}>
            Invista na sua
            <br />
            <span className={styles.gradient}>produtividade</span>
          </h2>
        </div>

        <div className={styles.cards}>
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`${styles.card} ${
                plan.highlighted ? styles.cardHighlighted : ""
              }`}
            >
              {plan.highlighted && (
                <span className={styles.popular}>Mais Popular</span>
              )}
              <h3 className={styles.planName}>{plan.name}</h3>
              <div className={styles.priceRow}>
                <span className={styles.price}>{plan.price}</span>
                {plan.period && (
                  <span className={styles.period}>{plan.period}</span>
                )}
              </div>
              {plan.pricingYear && (
                <p className={styles.priceYear}>{plan.pricingYear}</p>
              )}
              <p className={styles.planDescription}>{plan.description}</p>
              <ul className={styles.featureList}>
                {plan.features.map((feature, j) => (
                  <li key={j} className={styles.featureItem}>
                    <span className={styles.check}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to={plan.href}
                className={`${styles.planCta} ${
                  plan.highlighted ? styles.planCtaPrimary : ""
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
