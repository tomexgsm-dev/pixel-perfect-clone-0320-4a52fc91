import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Fetch HTML
    let htmlContent = "";
    let fetchError = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const pageResp = await fetch(formattedUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadFinder/1.0)" },
      });
      clearTimeout(timeout);
      if (pageResp.ok) {
        htmlContent = await pageResp.text();
        // Truncate to avoid token limits
        if (htmlContent.length > 8000) {
          htmlContent = htmlContent.substring(0, 8000);
        }
      } else {
        fetchError = true;
      }
    } catch {
      fetchError = true;
    }

    if (fetchError || !htmlContent) {
      return new Response(
        JSON.stringify({
          score: 0,
          status: "bad",
          summary: "Nie udało się pobrać strony. Strona może nie istnieć lub jest niedostępna.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract email from HTML
    const emailMatch = htmlContent.match(
      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
    );
    const extractedEmail = emailMatch ? emailMatch[0] : null;

    // Analyze with AI via Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback: basic heuristic analysis
      const hasForm = /<form/i.test(htmlContent);
      const hasCTA = /btn|button|cta|kontakt|contact|zamów|order/i.test(htmlContent);
      const hasResponsive = /viewport|responsive|media.*query|flex|grid/i.test(htmlContent);
      const isModern = /react|vue|angular|tailwind|bootstrap/i.test(htmlContent);

      let score = 30;
      if (hasForm) score += 15;
      if (hasCTA) score += 15;
      if (hasResponsive) score += 20;
      if (isModern) score += 20;
      score = Math.min(score, 100);

      const status = score >= 70 ? "good" : score >= 40 ? "average" : "bad";

      return new Response(
        JSON.stringify({
          score,
          status,
          summary: `Analiza heurystyczna: ${hasResponsive ? "responsywna" : "brak responsywności"}, ${hasCTA ? "ma CTA" : "brak CTA"}, ${hasForm ? "ma formularz" : "brak formularza"}.`,
          email: extractedEmail,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a website quality analyst. Analyze the HTML and return a JSON object with:
- score: number 0-100
- status: "good" (70+), "average" (40-69), "bad" (0-39)
- summary: brief Polish description of findings (max 200 chars)

Evaluate: design modernity, responsiveness, speed indicators, CTA presence, forms, overall UX.
Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `Analyze this website HTML:\n\n${htmlContent}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "website_analysis",
              description: "Return website quality analysis",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Score 0-100" },
                  status: { type: "string", enum: ["good", "average", "bad"] },
                  summary: { type: "string", description: "Brief analysis in Polish" },
                },
                required: ["score", "status", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "website_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      // Fallback to heuristic analysis for any AI error
      const hasForm = /<form/i.test(htmlContent);
      const hasCTA = /btn|button|cta|kontakt|contact|zamów|order/i.test(htmlContent);
      const hasResponsive = /viewport|responsive|media.*query|flex|grid/i.test(htmlContent);
      const isModern = /react|vue|angular|tailwind|bootstrap/i.test(htmlContent);

      let fallbackScore = 30;
      if (hasForm) fallbackScore += 15;
      if (hasCTA) fallbackScore += 15;
      if (hasResponsive) fallbackScore += 20;
      if (isModern) fallbackScore += 20;
      fallbackScore = Math.min(fallbackScore, 100);

      const fallbackStatus = fallbackScore >= 70 ? "good" : fallbackScore >= 40 ? "average" : "bad";

      return new Response(
        JSON.stringify({
          score: fallbackScore,
          status: fallbackStatus,
          summary: `Analiza heurystyczna: ${hasResponsive ? "responsywna" : "brak responsywności"}, ${hasCTA ? "ma CTA" : "brak CTA"}, ${hasForm ? "ma formularz" : "brak formularza"}.`,
          email: extractedEmail,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    let analysis = { score: 30, status: "bad" as string, summary: "Nie udało się przeanalizować." };

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        analysis = JSON.parse(toolCall.function.arguments);
      }
    } catch {
      console.error("Failed to parse AI response");
    }

    return new Response(
      JSON.stringify({ ...analysis, email: extractedEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("analyze-website error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
