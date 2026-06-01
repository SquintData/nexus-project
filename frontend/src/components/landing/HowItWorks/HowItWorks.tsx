import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./HowItWorks.module.css";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    number: "01",
    title: "Crie sua conta",
    description:
      "Cadastro em 30 segundos. Sem cartão de crédito, sem burocracia.",
  },
  {
    number: "02",
    title: "Organize tudo",
    description:
      "Tarefas, agenda, ideias, hábitos e finanças — tudo em um só lugar, do seu jeito.",
  },
  {
    number: "03",
    title: "Ative o assistente",
    description:
      "Assine e comece a falar ou digitar. O Nexus executa ações reais e fica mais inteligente a cada dia.",
  },
];

export default function HowItWorks() {
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

      gsap.from(`.${styles.step}`, {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.18,
        scrollTrigger: {
          trigger: `.${styles.steps}`,
          start: "top 80%",
        },
      });

      gsap.from(`.${styles.line}`, {
        scaleX: 0,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: `.${styles.steps}`,
          start: "top 80%",
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} id="how" className={styles.howItWorks}>
      <div className={styles.container}>
        <div className={styles.heading}>
          <span className={styles.label}>Como funciona</span>
          <h2 className={styles.title}>
            Três passos.
            <br />
            <span className={styles.muted}>Zero complicação.</span>
          </h2>
        </div>

        <div className={styles.steps}>
          <div className={styles.line} />
          {steps.map((step, i) => (
            <div key={i} className={styles.step}>
              <div className={styles.stepNumber}>{step.number}</div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
