import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setSimulatedTier, useTier, type Tier } from "@/hooks/useTier";

export const TierSimulator = () => {
  const { simulatedTier, dbTier } = useTier();
  if (!import.meta.env.DEV) return null;
  const value = simulatedTier ?? "__real__";
  return (
    <Select
      value={value}
      onValueChange={(v) => setSimulatedTier(v === "__real__" ? null : (v as Tier))}
    >
      <SelectTrigger className="h-9 w-[140px] text-xs" aria-label="Simulate subscription tier">
        <SelectValue placeholder="Simulate tier" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__real__">Real ({dbTier})</SelectItem>
        <SelectItem value="free">Sim: Free</SelectItem>
        <SelectItem value="weekly">Sim: Weekly</SelectItem>
        <SelectItem value="monthly">Sim: Monthly</SelectItem>
        <SelectItem value="quarterly">Sim: Quarterly</SelectItem>
      </SelectContent>
    </Select>
  );
};
