import mongoose from "mongoose";
import Frame from "../models/Frame";
import { connectDb } from "../lib/db";

const NAME_MAP: Record<string, string> = {
  ghostFrame:     "Phantom",
  basicWhite:     "Bulkhead",
  basicGray:      "Hex Cut",
  neonBlue:       "Twin Ring",
  neonGreen:      "Grid Lines",
  neonRed:        "Hazard",
  corpGray:       "Corp Tag",
  streetOrange:   "Street Wire",
  cyanPulse:      "Crosshair",
  goldBasic:      "Diamond Cut",
  shimmerCyan:    "Circuit Trace",
  shimmerPurple:  "Twin Orbit",
  shimmerGold:    "Ticker",
  shimmerRed:     "Triple Crown",
  shimmerGreen:   "Comet",
  shimmerOrange:  "Beacon",
  techShimmer:    "Data Ping",
  suitShimmer:    "Executive",
  crimsonShimmer: "Dual Ring",
  iceShimmer:     "Frost Crawl",
  pulseCyan:      "Lifeline",
  pulsePurple:    "Binary Breath",
  pulseGold:      "Spotlight",
  pulseRed:       "Erratic",
  pulseGreen:     "Scanner",
  hackerPulse:    "Corner Bloom",
  corePulse:      "Octacore",
  vaultPulse:     "Vault",
  streetPulse:    "Strobe",
  spectralPulse:  "Spectral",
  epicCyan:       "Radar",
  epicPurple:     "Dual Radar",
  epicGold:       "Sector Load",
  syndicate:      "Syndicate",
  epicRed:        "Plasma Burn",
  gridCore:       "Grid Matrix",
  suitsFrame:     "Orbit",
  epicVoid:       "Void Spark",
  epicInferno:    "Inferno",
  epicNova:       "Nova Burst",
  legendCyan:     "Arc Node",
  legendPurple:   "Chain Lightning",
  legendGold:     "Glitch Lord",
  legendRed:      "Heartbeat",
  crimsonLord:    "Chromatic",
  arcLight:       "Arc Crawl",
  plasmaBolt:     "Plasma Bolt",
  thunderClap:    "Thunderclap",
  vantaLegend:    "Vanta",
  executioner:    "Executioner",
  matrixGreen:    "Matrix",
  matrixBlue:     "Blue Code",
  matrixGold:     "Golden Code",
  matrixRed:      "Red Code",
  voidWalker:     "Void Walker",
  nova2047:       "Nova 2047",
  godMode:        "God Mode",
  omega:          "Omega",
  architect:      "Architect",
  theOne:         "The One",
};

async function migrate() {
  await connectDb();
  let updated = 0;
  for (const [frameId, displayName] of Object.entries(NAME_MAP)) {
    const result = await Frame.updateOne({ frameId }, { $set: { displayName } });
    if (result.modifiedCount > 0) updated++;
  }
  console.log(`Frame name migration complete: ${updated} frames updated`);
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
