import mongoose, { Document, Schema } from "mongoose";

export interface IWorldEvent {
  id: string;
  name: string;
  type: "crackdown" | "market_crash" | "race_week" | "heat_wave" | "storm";
  startsAt: Date;
  endsAt: Date;
  effectModifiers: {
    heatGainMult?: number;       // e.g. 1.5 = +50% heat gain
    runPayoutMult?: number;
    simPriceMult?: number;
    racePrizeMult?: number;
    gripPenalty?: number;
  };
}

export interface IWorldState extends Document {
  _id: mongoose.Types.ObjectId;
  timeOfDay: "day" | "night";
  weather: "clear" | "rain";
  lastCycledAt: Date;
  // Season
  seasonId: string;
  seasonName: string;
  seasonStartsAt: Date;
  seasonEndsAt: Date;
  // SIM price
  simPrice: number;          // current price in DC per SIM
  simBuyVolume: number;      // rolling 1h buy volume
  simSellVolume: number;     // rolling 1h sell volume
  simPriceHistory: Array<{ price: number; at: Date }>;
  simVolumeResetAt: Date;
  // Active world events
  activeEvents: IWorldEvent[];
}

const WorldEventSchema = new Schema<IWorldEvent>({
  id:              { type: String, required: true },
  name:            { type: String, required: true },
  type:            { type: String, required: true },
  startsAt:        { type: Date, required: true },
  endsAt:          { type: Date, required: true },
  effectModifiers: { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const WorldStateSchema = new Schema<IWorldState>(
  {
    timeOfDay:        { type: String, enum: ["day","night"], default: "day" },
    weather:          { type: String, enum: ["clear","rain"], default: "clear" },
    lastCycledAt:     { type: Date, default: Date.now },
    seasonId:         { type: String, default: "season-1" },
    seasonName:       { type: String, default: "Genesis Season" },
    seasonStartsAt:   { type: Date, default: Date.now },
    seasonEndsAt:     { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    simPrice:         { type: Number, default: 1000 },
    simBuyVolume:     { type: Number, default: 0 },
    simSellVolume:    { type: Number, default: 0 },
    simPriceHistory:  [{ price: Number, at: Date }],
    simVolumeResetAt: { type: Date, default: Date.now },
    activeEvents:     [WorldEventSchema],
  },
  { timestamps: true }
);

/** Get or create singleton WorldState */
export async function getWorldState(): Promise<IWorldState> {
  let state = await WorldStateModel.findOne();
  if (!state) {
    state = await WorldStateModel.create({});
  }
  return state;
}

/** Modifiers applied to a run based on world state */
export function worldRunModifiers(state: IWorldState): { payoutMult: number; heatGainMult: number } {
  let payoutMult = 1;
  let heatGainMult = 1;

  if (state.timeOfDay === "night") {
    payoutMult *= 1.15;
    heatGainMult *= 1.10;
  }

  for (const ev of state.activeEvents) {
    if (ev.endsAt > new Date()) {
      payoutMult *= ev.effectModifiers.runPayoutMult ?? 1;
      heatGainMult *= ev.effectModifiers.heatGainMult ?? 1;
    }
  }

  return { payoutMult, heatGainMult };
}

/** Recalculate SIM price based on buy/sell volume pressure. Capped at ±15%/hr */
export function recalcSimPrice(state: IWorldState): number {
  const LIQUIDITY = 100_000;
  const rawPrice = state.simPrice * (1 + (state.simBuyVolume - state.simSellVolume) / LIQUIDITY);
  const maxSwing = state.simPrice * 0.15;
  return Math.max(100, Math.min(state.simPrice + maxSwing, Math.max(state.simPrice - maxSwing, rawPrice)));
}

const WorldStateModel = mongoose.model<IWorldState>("WorldState", WorldStateSchema);
export default WorldStateModel;
