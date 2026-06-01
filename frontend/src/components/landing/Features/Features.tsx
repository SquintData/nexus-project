import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./Features.module.css";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: "💡",
    title: "Banco de Ideias",
    description:
      "Salve ideias a qualquer momento com texto, fotos e áudio. Nada se perde, tudo fica organizado.",
  },
  {
    icon: "⚡",
    title: "Rotinas Automáticas",
    description:
      "Configure modos como \"Desenvolvedor\" pra abrir VS Code e uma playlist de uma vez. Qualquer app ou link.",
  },
  {
    icon: "📋",
    title: "Tarefas Kanban",
    description:
      "A fazer, fazendo, feito. Arraste pra mover, organize por prioridade. Simples e visual.",
  },
  {
    icon: "📅",
    title: "Agenda Completa",
    description:
      "Todos seus compromissos com horário, data e localização. Tudo visível em um só lugar.",
  },
  {
    icon: "🧠",
    title: "Chat com I.A.",
    description:
      "O cérebro do Nexus. Converse por texto ou voz e ele executa ações reais, não só respostas.",
  },
  {
    icon: "💾",
    title: "Memória Pessoal",
    description:
      "O Nexus lembra do que você prefere. Respostas e sugestões cada vez mais personalizadas.",
  },
  {
    icon: "💰",
    title: "Finanças",
    description:
      "Controle entradas e saídas por mês. Saldo total, categorias e histórico visual pra você nunca perder o controle.",
  },
  {
    icon: "🔄",
    title: "Hábitos",
    description:
      "Acompanhe seus hábitos diários com progresso visual. Mantenha a consistência e evolua todo dia.",
  },
  {
    icon: "📔",
    title: "Diário",
    description:
      "Registre seus pensamentos por dia com calendário integrado. Releia quando quiser, tudo organizado por data.",
  },
];

export default function Features() {
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
        stagger: 0.12,
        scrollTrigger: {
          trigger: `.${styles.grid}`,
          start: "top 80%",
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} id="features" className={styles.features}>
      <div className={styles.container}>
        <div className={styles.heading}>
          <span className={styles.label}>Recursos</span>
          <h2 className={styles.title}>
            Tudo que você precisa.
            <br />
            <span className={styles.muted}>Nada que você não precisa.</span>
          </h2>
        </div>

        <div className={styles.grid}>
          {features.map((feature, i) => (
            <div key={i} className={styles.card}>
              <span className={styles.cardIcon}>{feature.icon}</span>
              <h3 className={styles.cardTitle}>{feature.title}</h3>
              <p className={styles.cardDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
