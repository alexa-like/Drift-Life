import { Router } from "express";
import HeraldArticle from "../models/HeraldArticle";
import { requireAuth, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /api/herald — get latest 20 articles (public, but requires auth to read in-game)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const articles = await HeraldArticle.find()
      .sort({ pinned: -1, createdAt: -1 })
      .limit(20)
      .select("title content authorName pinned createdAt");

    res.json(articles.map((a) => ({
      id: a._id,
      title: a.title,
      content: a.content,
      author: a.authorName,
      pinned: a.pinned,
      publishedAt: a.createdAt,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/herald — publish an article (staff/owner only)
router.post("/", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { title, content, pinned } = req.body as { title: string; content: string; pinned?: boolean };
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ message: "Title and content required" });

    const article = await HeraldArticle.create({
      title: title.trim(),
      content: content.trim(),
      authorId: req.userId,
      authorName: req.username ?? "Staff",
      pinned: pinned ?? false,
    });

    res.status(201).json({ message: "Article published", id: article._id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/herald/:id/pin — pin/unpin
router.patch("/:id/pin", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const article = await HeraldArticle.findById(req.params.id);
    if (!article) return res.status(404).json({ message: "Article not found" });
    article.pinned = !article.pinned;
    await article.save();
    res.json({ message: article.pinned ? "Article pinned" : "Article unpinned", pinned: article.pinned });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/herald/:id — delete article
router.delete("/:id", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const article = await HeraldArticle.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ message: "Article not found" });
    res.json({ message: "Article deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
