/**
 * PlayerGarage — tracks a player's owned cars and car parts.
 * One document per player.
 * Cars reference RaceCar catalog by carId slug.
 * Parts reference CarPart catalog by partId slug.
 */
import mongoose, { Document, Schema } from "mongoose";

interface EquippedParts {
  engine:  string | null;
  tires:   string | null;
  nitro:   string | null;
  bodyKit: string | null;
  spoiler: string | null;
}

interface CarCustomization {
  paint:     string;   // hex color or preset name
  underglow: string;   // hex color
  decals:    string;   // decal preset name
  rims:      string;   // rim preset name
}

export interface OwnedCar {
  carId:          string;
  equippedParts:  EquippedParts;
  customization:  CarCustomization;
  acquiredAt:     Date;
}

interface PartStack {
  partId:   string;
  quantity: number;
}

export interface IPlayerGarage extends Document {
  userId:    mongoose.Types.ObjectId;
  cars:      OwnedCar[];
  parts:     PartStack[];
  activeCar: string | null;   // carId of currently selected car
}

const EquippedPartsSchema = new Schema<EquippedParts>(
  {
    engine:  { type: String, default: null },
    tires:   { type: String, default: null },
    nitro:   { type: String, default: null },
    bodyKit: { type: String, default: null },
    spoiler: { type: String, default: null },
  },
  { _id: false },
);

const CarCustomizationSchema = new Schema<CarCustomization>(
  {
    paint:     { type: String, default: "#1a1a2e" },
    underglow: { type: String, default: "#00E0FF" },
    decals:    { type: String, default: "none" },
    rims:      { type: String, default: "standard" },
  },
  { _id: false },
);

const OwnedCarSchema = new Schema<OwnedCar>(
  {
    carId:         { type: String, required: true },
    equippedParts: { type: EquippedPartsSchema, default: () => ({}) },
    customization: { type: CarCustomizationSchema, default: () => ({}) },
    acquiredAt:    { type: Date, default: Date.now },
  },
  { _id: false },
);

const PartStackSchema = new Schema<PartStack>(
  {
    partId:   { type: String, required: true },
    quantity: { type: Number, required: true, default: 1, min: 0 },
  },
  { _id: false },
);

const PlayerGarageSchema = new Schema<IPlayerGarage>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    cars:      { type: [OwnedCarSchema], default: [] },
    parts:     { type: [PartStackSchema], default: [] },
    activeCar: { type: String, default: null },
  },
  { timestamps: true },
);

export default mongoose.model<IPlayerGarage>("PlayerGarage", PlayerGarageSchema);
