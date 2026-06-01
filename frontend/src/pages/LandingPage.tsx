import "../landing.css";
import LenisProvider from "@/providers/LenisProvider";
import Navbar from "@/components/landing/Navbar/Navbar";
import Hero from "@/components/landing/Hero/Hero";
import Features from "@/components/landing/Features/Features";
import Assistant from "@/components/landing/Assistant/Assistant";
import HowItWorks from "@/components/landing/HowItWorks/HowItWorks";
import Pricing from "@/components/landing/Pricing/Pricing";
import Footer from "@/components/landing/Footer/Footer";

export default function LandingPage() {
  return (
    <LenisProvider>
      <div className="landing-root">
        <Navbar />
        <Hero />
        <Features />
        <Assistant />
        <HowItWorks />
        <Pricing />
        <Footer />
      </div>
    </LenisProvider>
  );
}
