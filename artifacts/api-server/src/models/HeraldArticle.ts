import mongoose, { Document, Schema } from "mongoose";

export interface IHeraldArticle extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HeraldArticleSchema = new Schema<IHeraldArticle>(
  {
    title: { type: String, required: true, maxlength: 120, trim: true },
    content: { type: String, required: true, maxlength: 5000, trim: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

HeraldArticleSchema.index({ pinned: -1, createdAt: -1 });

export default mongoose.model<IHeraldArticle>("HeraldArticle", HeraldArticleSchema);
