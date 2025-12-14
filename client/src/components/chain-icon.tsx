import { Bitcoin, Coins } from "lucide-react";
import { SiEthereum, SiBinance, SiPolygon } from "react-icons/si";

interface ChainIconProps {
  symbol: string;
  iconColor?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function ChainIcon({ symbol, iconColor, className = "", size = "md" }: ChainIconProps) {
  const sizeClass = sizeClasses[size];
  const style = iconColor ? { color: iconColor } : {};

  const iconMap: Record<string, JSX.Element> = {
    BTC: <Bitcoin className={`${sizeClass} ${className}`} style={{ color: "#F7931A" }} />,
    ETH: <SiEthereum className={`${sizeClass} ${className}`} style={{ color: "#627EEA" }} />,
    BNB: <SiBinance className={`${sizeClass} ${className}`} style={{ color: "#F3BA2F" }} />,
    MATIC: <SiPolygon className={`${sizeClass} ${className}`} style={{ color: "#8247E5" }} />,
  };

  if (iconMap[symbol.toUpperCase()]) {
    return iconMap[symbol.toUpperCase()];
  }

  return (
    <div 
      className={`flex items-center justify-center rounded-full ${sizeClass} ${className}`}
      style={{ backgroundColor: iconColor || "#6B7280" }}
    >
      <Coins className="h-1/2 w-1/2 text-white" />
    </div>
  );
}
