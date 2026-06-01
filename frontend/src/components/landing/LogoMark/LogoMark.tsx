import styles from "./LogoMark.module.css";

interface LogoMarkProps {
  size?: number;
}

export default function LogoMark({ size = 48 }: LogoMarkProps) {
  return (
    <div className={styles.container} style={{ width: size, height: size }}>
      <div className={styles.glow} />
      <img
        src="/logo.webp"
        alt="Nexus"
        width={size}
        height={size}
        className={styles.image}
      />
    </div>
  );
}
