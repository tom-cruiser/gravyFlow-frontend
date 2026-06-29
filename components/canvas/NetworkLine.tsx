type NetworkLineProps = {
  d: string;
  highlighted?: boolean;
};

export function NetworkLine({ d, highlighted = false }: NetworkLineProps) {
  return (
    <path
      d={d}
      fill="none"
      stroke={highlighted ? 'rgba(56, 189, 248, 0.9)' : 'rgba(113, 113, 122, 0.55)'}
      strokeWidth={highlighted ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={highlighted ? '0' : '6 8'}
      className="drop-shadow-[0_0_12px_rgba(56,189,248,0.12)]"
    />
  );
}
