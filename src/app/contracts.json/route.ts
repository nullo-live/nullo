import { BRAND, CHAIN } from "@/config/brand";
import { CONTRACTS, labelsLive } from "@/config/contracts";
import { LABELS_ABI } from "@/lib/abi";

export const dynamic = "force-static";

/** Machine-readable pointer to the labels contract: chain, address (null until deployed) and the full ABI. */
export function GET() {
  const body = {
    name: BRAND.name,
    chain: { name: CHAIN.name, id: CHAIN.id, rpc: CHAIN.publicRpc, explorer: CHAIN.explorer },
    contracts: {
      NulloSpenderLabels: {
        address: labelsLive() ? CONTRACTS.labels : null,
        deployedBlock: labelsLive() ? CONTRACTS.labelsBlock : null,
        status: labelsLive() ? "deployed" : "not deployed yet",
        abi: LABELS_ABI,
      },
    },
    notes: "Categories 1..8, flag reasons 1..6. One label and one flag per wallet per spender. No owner, no fees, never holds funds, never hides anything.",
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" } });
}
