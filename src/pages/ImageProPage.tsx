import { Layout } from "@/components/Layout";
import ImagePro from "@/components/ImagePro";
import { Suspense } from "react";
import { Loader2, Sparkles, Atom } from "lucide-react";

/* ---------- LOADER ---------- */

function ImageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

/* ---------- PAGE ---------- */

export default function ImageProPage() {
  return (
    <Layout>
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex flex-col min-h-full">
          <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-10">

            {/* HEADER */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                Nexus Image Pro
                <Sparkles className="w-5 h-5 text-primary" />
              </h1>

              <p className="text-sm text-muted-foreground mt-1">
                Generate professional AI images using Nexus generator.
                Now with <strong>AI Prompt Assistant</strong> and 
                <strong> Blend PRO</strong> for mixing two images.
              </p>
            </div>

            {/* IMAGE PRO CORE */}
            <Suspense fallback={<ImageLoader />}>
              <ImagePro />
            </Suspense>
          </div>
        </div>
      </div>
    </Layout>
  );
}
