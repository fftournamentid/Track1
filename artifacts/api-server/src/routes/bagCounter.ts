import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface AnalyzeRequestBody {
  imageBase64?: unknown;
  mimeType?: unknown;
  side?: unknown;
  bagType?: unknown;
}

interface GeminiCountResult {
  totalBags: number;
  confidence: number;
  notes?: string;
}

function isValidSide(v: unknown): v is "front" | "back" {
  return v === "front" || v === "back";
}

/**
 * Extracts the first JSON object embedded in a text blob. Gemini is asked to
 * return `responseMimeType: application/json`, but we defensively strip any
 * stray markdown fencing in case the model ignores the instruction.
 */
function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

router.post("/bag-counter/analyze", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const body = req.body as AnalyzeRequestBody;

  const { imageBase64, mimeType, side, bagType } = body;

  if (typeof imageBase64 !== "string" || imageBase64.length < 100) {
    return res.status(400).json({ error: "INVALID_IMAGE", message: "A valid base64-encoded image is required." });
  }
  if (typeof mimeType !== "string" || !mimeType.startsWith("image/")) {
    return res.status(400).json({ error: "INVALID_MIME_TYPE", message: "mimeType must be an image/* mime type." });
  }
  if (!isValidSide(side)) {
    return res.status(400).json({ error: "INVALID_SIDE", message: "side must be 'front' or 'back'." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.error("GEMINI_API_KEY is not configured on the server");
    return res.status(500).json({ error: "AI_NOT_CONFIGURED", message: "AI service is not configured." });
  }

  const bagLabel = typeof bagType === "string" && bagType.trim() ? bagType.trim() : "stacked bags (cement, sugar, rice, wheat, maize, fertilizer, animal feed, flour, or similar)";

  const prompt =
    `You are a vision system used by truck drivers, transporters, warehouses and loaders to count stacked bags in a photo. ` +
    `The photo shows the ${side} side of a stack of ${bagLabel}. ` +
    `Count the total number of individual bags visible in the stack, including partially visible bags at the edges. ` +
    `Estimate a confidence percentage (0-100) reflecting how certain you are of the count, based on image clarity, occlusion, and stacking regularity. ` +
    `Respond with ONLY a JSON object matching this exact shape: {"totalBags": <integer>, "confidence": <integer 0-100>, "notes": "<short one-sentence note>"}.`;

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              totalBags: { type: "integer" },
              confidence: { type: "integer" },
              notes: { type: "string" },
            },
            required: ["totalBags", "confidence"],
          },
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      logger.error({ status: geminiRes.status, errText }, "Gemini API request failed");
      if (geminiRes.status === 429) {
        return res.status(429).json({ error: "AI_RATE_LIMITED", message: "AI service is busy. Please try again shortly." });
      }
      return res.status(502).json({ error: "AI_FAILED", message: "AI failed to analyze the image." });
    }

    const data = (await geminiRes.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      logger.error({ data }, "Gemini response missing text content");
      return res.status(502).json({ error: "AI_FAILED", message: "AI did not return a result." });
    }

    let parsed: GeminiCountResult;
    try {
      const json = extractJson(text) as Partial<GeminiCountResult>;
      if (typeof json.totalBags !== "number" || typeof json.confidence !== "number") {
        throw new Error("Missing required fields in AI response");
      }
      parsed = {
        totalBags: Math.max(0, Math.round(json.totalBags)),
        confidence: Math.min(100, Math.max(0, Math.round(json.confidence))),
        notes: typeof json.notes === "string" ? json.notes : undefined,
      };
    } catch (parseErr) {
      logger.error({ parseErr, text }, "Failed to parse Gemini JSON response");
      return res.status(502).json({ error: "AI_FAILED", message: "AI returned an unreadable result." });
    }

    return res.json({
      totalBags: parsed.totalBags,
      confidence: parsed.confidence,
      notes: parsed.notes,
      side,
      scanTimeMs: Date.now() - startedAt,
      model: GEMINI_MODEL,
    });
  } catch (err) {
    logger.error({ err }, "Network error contacting Gemini API");
    return res.status(503).json({ error: "NETWORK_ERROR", message: "Could not reach the AI service. Check your connection and try again." });
  }
});

export default router;
