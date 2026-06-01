import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import LogoMark from "@/components/landing/LogoMark/LogoMark";
import styles from "./Footer.module.css";

gsap.registerPlugin(ScrollTrigger);

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from(footerRef.current, {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: footerRef.current,
          start: "top 90%",
        },
      });
    },
    { scope: footerRef }
  );

  return (
    <footer ref={footerRef} className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <div className={styles.logo}>
              <LogoMark size={36} />
              <div className={styles.logoTextBlock}>
                <span className={styles.logoText}>NEXUS</span>
                <span className={styles.logoSub}>ORGANIZER</span>
              </div>
            </div>
            <p className={styles.tagline}>
              Seu organizador pessoal com inteligência artificial.
            </p>
          </div>
          <div className={styles.columns}>
            <div className={styles.column}>
              <h4 className={styles.columnTitle}>Produto</h4>
              <a href="#features">Recursos</a>
              <a href="#pricing">Planos</a>
              <a href="#assistant">Assistente I.A.</a>
            </div>
            <div className={styles.column}>
              <h4 className={styles.columnTitle}>Empresa</h4>
              <a href="#">Sobre</a>
              <a href="#">Blog</a>
              <a href="#">Contato</a>
            </div>
            <div className={styles.column}>
              <h4 className={styles.columnTitle}>Legal</h4>
              <a href="#">Privacidade</a>
              <a href="#">Termos</a>
            </div>
          </div>
        </div>
        <div className={styles.bottom}>
          <p>&copy; 2025 Nexus. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
