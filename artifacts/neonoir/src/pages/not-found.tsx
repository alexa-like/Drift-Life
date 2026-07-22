import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { AnimatedCard } from "../components/AnimatedCard";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center relative z-10 p-4">
      <div className="dl-page-bg bg-terminal" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      
      <AnimatedCard accent="#ff2d55" className="max-w-md w-full text-center py-8">
        <div className="flex justify-center mb-4">
          <AlertCircle className="h-12 w-12" style={{ color: "#ff2d55", filter: "drop-shadow(0 0 8px #ff2d5580)" }} />
        </div>
        <CyberSectionHeader title="404: SIGNAL LOST" accent="#ff2d55" className="mb-2 justify-center" />
        <p className="font-mono text-xs mb-8" style={{ color: "#94a3b8" }}>
          The requested data node does not exist on this network layer.
        </p>
        
        <Link href="/">
          <CyberButton variant="primary" size="md">
            Return to Hub
          </CyberButton>
        </Link>
      </AnimatedCard>
    </div>
  );
}
