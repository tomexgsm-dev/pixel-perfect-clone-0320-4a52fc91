import { Layout } from "@/components/Layout";
import ImagePro from "@/components/ImagePro";

export default function ImageProPage() {
  return (
    <Layout>
      <div className="flex flex-col h-full absolute inset-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-4 md:px-8 py-8">
          <ImagePro />
        </div>
      </div>
    </Layout>
  );
}
