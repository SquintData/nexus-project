import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./Hero.module.css";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const orbGlowRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ delay: 0.6 });

      tl.from(`.${styles.badge}`, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
      })
        .from(
          `.${styles.title}`,
          { y: 60, opacity: 0, duration: 1, ease: "power3.out" },
          "-=0.4"
        )
        .from(
          `.${styles.subtitle}`,
          { y: 40, opacity: 0, duration: 0.8, ease: "power3.out" },
          "-=0.5"
        )
        .from(
          `.${styles.actions}`,
          { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" },
          "-=0.4"
        )
        .from(
          `.${styles.trustRow}`,
          { y: 20, opacity: 0, duration: 0.7, ease: "power3.out" },
          "-=0.3"
        )
        .from(
          `.${styles.mockup}`,
          { y: 80, opacity: 0, duration: 1.2, ease: "power3.out" },
          "-=0.6"
        );

      gsap.to(orbRef.current, {
        scale: 1.08,
        duration: 3,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      gsap.to(orbGlowRef.current, {
        opacity: 0.6,
        duration: 2.5,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className={styles.hero}>
      <div className={styles.bgOrb} />
      <div className={styles.bgOrbSecondary} />
      <div className={styles.grid} />

      <div className={styles.content}>
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          Assistente I.A. com comando de voz
        </div>

        <h1 className={styles.title}>
          Organize sua mente.
          <br />
          <span className={styles.gradient}>O Nexus faz o resto.</span>
        </h1>

        <p className={styles.subtitle}>
          Ideias, rotinas, tarefas, agenda — tudo em um só lugar. Diga
          &quot;Olá, Nexus&quot; e controle tudo por voz. Um assistente que
          aprende com você e lembra do que você gosta.
        </p>

        <div className={styles.actions}>
          <a href="#pricing" className={styles.primary}>
            Começar Agora
            <span className={styles.arrow}>&rarr;</span>
          </a>
          <a href="#assistant" className={styles.secondary}>
            Ver Demonstração
          </a>
        </div>

        <div className={styles.trustRow}>
          <div className={styles.trustItem}>
            <span className={styles.trustCheck}>&#10003;</span>
            Grátis para começar
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustCheck}>&#10003;</span>
            Controle por voz
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustCheck}>&#10003;</span>
            I.A. que aprende com você
          </div>
        </div>

        <div className={styles.mockup}>
          <div className={styles.mockupBar}>
            <div className={styles.mockupDots}>
              <span /><span /><span />
            </div>
            <div className={styles.mockupUrl}>app.nexus.com</div>
            <div className={styles.mockupSpacer} />
          </div>
          <div className={styles.mockupBody}>
            <div className={styles.sidebar}>
              <div className={styles.sidebarLogo}>
                <img src="/logo.webp" alt="Nexus" width={24} height={24} className={styles.sidebarLogoImg} />
                <span className={styles.sidebarBrand}>Nexus</span>
              </div>
              <span className={styles.sidebarEmail}>usuario@email.com</span>
              <div className={styles.sidebarNav}>
                <div className={`${styles.sidebarItem} ${styles.sidebarActive}`}>
                  <span>⊞</span> Dashboard
                </div>
                <div className={styles.sidebarItem}><span>○</span> Chat</div>
                <div className={styles.sidebarItem}><span>⊡</span> Kanban</div>
                <div className={styles.sidebarItem}><span>⊟</span> Agenda</div>
                <div className={styles.sidebarItem}><span>♦</span> Ideias</div>
                <div className={styles.sidebarItem}><span>⚙</span> Rotinas</div>
                <div className={styles.sidebarItem}><span>⊕</span> Memória</div>
                <div className={styles.sidebarItem}><span>⊏</span> Finanças</div>
                <div className={styles.sidebarItem}><span>↻</span> Hábitos</div>
                <div className={styles.sidebarItem}><span>⊞</span> Diário</div>
              </div>
            </div>

            <div className={styles.mockupMain}>
              <div className={styles.mockupHeader}>
                <div>
                  <span className={styles.mockupTitle}>Dashboard</span>
                  <span className={styles.mockupSub}>Diga &quot;Olá, Nexus&quot; para começar.</span>
                </div>
              </div>

              <div className={styles.orbArea}>
                <div ref={orbGlowRef} className={styles.orbGlow} />
                <div ref={orbRef} className={styles.orb}>
                  <div className={styles.orbRing} />
                  <div className={styles.orbCore} />
                </div>
                <span className={styles.orbStatus}>DORMINDO</span>
              </div>

              <div className={styles.statCards}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>TAREFAS PENDENTES</span>
                  <span className={styles.statValue}>5</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>PRÓXIMOS 7 DIAS</span>
                  <span className={styles.statValue}>3</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>HÁBITOS HOJE</span>
                  <span className={styles.statValue}>2/4</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
