import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./Assistant.module.css";

gsap.registerPlugin(ScrollTrigger);

const conversation = [
  { role: "user" as const, text: "Olá Nexus, ativa o modo desenvolvedor." },
  {
    role: "ai" as const,
    text: "Modo Desenvolvedor ativado. Abrindo VS Code e sua playlist de foco no YouTube. Bom trabalho!",
  },
  { role: "user" as const, text: "Salva uma ideia: testar nova API de pagamentos." },
  {
    role: "ai" as const,
    text: "Ideia salva no seu banco. Quer que eu crie uma tarefa no kanban com prioridade alta também?",
  },
];

export default function Assistant() {
  const sectionRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(`.${styles.textBlock}`, {
        x: -60,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
        },
      });

      gsap.from(`.${styles.mockup}`, {
        x: 60,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
        },
      });

      gsap.from(`.${styles.message}`, {
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: `.${styles.conversation}`,
          start: "top 80%",
        },
      });

      gsap.to(ringRef.current, {
        rotation: 360,
        duration: 20,
        ease: "none",
        repeat: -1,
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} id="assistant" className={styles.assistant}>
      <div className={styles.container}>
        <div className={styles.textBlock}>
          <span className={styles.label}>Assistente I.A.</span>
          <h2 className={styles.title}>
            Converse com o
            <br />
            <span className={styles.gradient}>Nexus naturalmente</span>
          </h2>
          <p className={styles.description}>
            Diga &quot;Olá, Nexus&quot; e controle tudo por voz. Salve ideias,
            ative rotinas, organize tarefas e consulte sua agenda sem tocar
            na tela.
          </p>
          <div className={styles.capabilities}>
            <div className={styles.capability}>
              <span className={styles.capDot} />
              Controle por voz ou texto
            </div>
            <div className={styles.capability}>
              <span className={styles.capDot} />
              Executa ações reais nos seus apps
            </div>
            <div className={styles.capability}>
              <span className={styles.capDot} />
              Lembra suas preferências e se adapta
            </div>
          </div>
        </div>

        <div className={styles.mockup}>
          <div className={styles.mockupFrame}>
            <div className={styles.aiCore}>
              <div ref={ringRef} className={styles.ring} />
              <div className={styles.coreCenter}>
                <img src="/logo.webp" alt="Nexus" width={48} height={48} className={styles.coreLogo} />
              </div>
            </div>
            <div className={styles.conversation}>
              {conversation.map((msg, i) => (
                <div
                  key={i}
                  className={`${styles.message} ${
                    msg.role === "ai" ? styles.messageAi : styles.messageUser
                  }`}
                >
                  {msg.role === "ai" && (
                    <span className={styles.aiTag}>NEXUS</span>
                  )}
                  <p>{msg.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
