import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Link } from "react-router-dom";
import LogoMark from "@/components/landing/LogoMark/LogoMark";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from(navRef.current, {
        y: -40,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        delay: 0.3,
      });
    },
    { scope: navRef }
  );

  return (
    <nav ref={navRef} className={styles.navbar}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <LogoMark size={44} />
          <div className={styles.logoTextBlock}>
            <span className={styles.logoText}>NEXUS</span>
            <span className={styles.logoSub}>ORGANIZER</span>
          </div>
        </div>
        <ul className={styles.links}>
          <li><a href="#features">Recursos</a></li>
          <li><a href="#assistant">Assistente</a></li>
          <li><a href="#how">Como Funciona</a></li>
          <li><a href="#pricing">Planos</a></li>
        </ul>
        <Link to="/login" className={styles.cta}>
          Entrar
        </Link>
      </div>
    </nav>
  );
}
